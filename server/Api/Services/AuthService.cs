using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using QuizesApi.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace QuizesApi.Services;

/// <summary>
/// Implements all authentication and account-management business logic:
///   - Registration (account creation, role assignment, Login entry)
///   - Login (account lookup, password verification, JWT generation)
///   - Profile retrieval and update
///
/// Preserved exactly from AuthController:
///   - BCrypt → SHA256 → plaintext password verification chain
///   - JWT claims: sub = accountId, email, ClaimTypes.Role per role
///   - 8-hour token expiry
///   - BusinessEntity = "Exams" for role and AccountRole filtering
///   - Admin role mapping (Admin/Superadmin → Board)
///   - Password strength validation rules
/// </summary>
public class AuthService : IAuthService
{
    private readonly ElsewedySchoolSysDbDevContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;
    private const string BusinessEntity = "Exams";

    public AuthService(
        ElsewedySchoolSysDbDevContext db,
        IConfiguration config,
        ILogger<AuthService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    // -------------------------------------------------------------------------
    // RegisterAsync
    // -------------------------------------------------------------------------

    public async Task<RegisterResult> RegisterAsync(RegisterModel model)
    {
        _logger.LogInformation("Register attempt for email: {Email}, requested role: {Role}", model.Email, model.Role);

        // Resolve role (default Student); map Admin/Superadmin to Board
        var roleName = string.IsNullOrWhiteSpace(model.Role) ? "Student" : model.Role.Trim();
        if (roleName.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
            roleName.Equals("Superadmin", StringComparison.OrdinalIgnoreCase))
        {
            roleName = "Board";
        }

        var role = await _db.Roles.FirstOrDefaultAsync(
            r => r.RoleName == roleName && r.BusinessEntity == BusinessEntity);

        if (role == null)
        {
            _logger.LogWarning("Role not found: {RoleName} in entity {Entity}", roleName, BusinessEntity);
            throw new ArgumentException($"Invalid role: {roleName} for entity {BusinessEntity}");
        }

        // Ensure a Status row exists for this entity
        var statusId = await _db.Statuses
            .Where(s => s.BusinessEntity == BusinessEntity)
            .OrderBy(s => s.Id)
            .Select(s => s.Id)
            .FirstOrDefaultAsync();

        if (statusId == 0)
        {
            statusId = await _db.Statuses.Select(s => s.Id).OrderBy(id => id).FirstOrDefaultAsync();
            if (statusId == 0)
            {
                var newStatus = new Status { StatusName = "Active", BusinessEntity = BusinessEntity, OrderNo = 1 };
                _db.Statuses.Add(newStatus);
                await _db.SaveChangesAsync();
                statusId = newStatus.Id;
            }
        }

        var account = new Account
        {
            Email        = model.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.Password),
            FullNameEn   = model.FullNameEn ?? model.Email,
            FullNameAr   = model.FullNameAr ?? model.Email,
            NationalId   = $"NID-{Guid.NewGuid().ToString("N").Substring(0, 8)}",
            RoleId       = role.Id,
            IsActive     = true,
            StatusId     = statusId
        };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Account created with ID: {AccountId}", account.Id);

        _db.AccountRoles.Add(new AccountRole
        {
            AccountId          = account.Id,
            RoleId             = role.Id,
            BusinessEntityName = BusinessEntity
        });
        await _db.SaveChangesAsync();
        _logger.LogInformation("AccountRole created for AccountId: {AccountId}, RoleId: {RoleId}", account.Id, role.Id);

        var loginEntry = new Login
        {
            AccountId    = account.Id,
            Email        = account.Email,
            PasswordHash = account.PasswordHash,
            StatusId     = statusId
        };
        _db.Logins.Add(loginEntry);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Login entry created for AccountId: {AccountId}", account.Id);

        return new RegisterResult(account.Id);
    }

    // -------------------------------------------------------------------------
    // LoginAsync
    // -------------------------------------------------------------------------

    public async Task<LoginResult> LoginAsync(LoginModel model)
    {
        _logger.LogInformation("Login attempt for email: {Email}", model.Email);

        Account? account = null;
        string? storedHash = null;

        // 1. Primary: Login table
        var loginEntry = await _db.Logins
            .Include(l => l.Account)
            .FirstOrDefaultAsync(l => l.Email == model.Email);

        if (loginEntry?.Account != null && loginEntry.Account.IsActive)
        {
            account    = loginEntry.Account;
            storedHash = loginEntry.PasswordHash;
            _logger.LogInformation("User found in Login table. AccountId: {AccountId}", account.Id);
        }
        else
        {
            // 2. Fallback: Account table (legacy)
            account = await _db.Accounts
                .FirstOrDefaultAsync(a => a.Email == model.Email && a.IsActive);
            if (account != null)
            {
                storedHash = account.PasswordHash;
                _logger.LogInformation("User found in Account table (Fallback). AccountId: {AccountId}", account.Id);
            }
        }

        if (account == null)
        {
            _logger.LogWarning("Login failed: account not found or inactive for {Email}", model.Email);
            throw new UnauthorizedAccessException("Invalid credentials");
        }

        // Password verification: BCrypt → SHA256 → plaintext fallback
        bool isValidPassword = false;

        try
        {
            if (BCrypt.Net.BCrypt.Verify(model.Password, storedHash ?? string.Empty))
                isValidPassword = true;
        }
        catch { /* BCrypt throws on invalid hash format */ }

        if (!isValidPassword)
        {
            var legacyHash = ComputeSha256Hash(model.Password);
            if (string.Equals(legacyHash, storedHash, StringComparison.OrdinalIgnoreCase))
                isValidPassword = true;
            else
                _logger.LogWarning("Hash mismatch for {Email}. Stored: {Stored}, Computed: {Computed}",
                    model.Email, storedHash, legacyHash);
        }

        if (!isValidPassword)
        {
            var inputClean  = model.Password?.Trim();
            var storedClean = storedHash?.Trim();
            if (string.Equals(inputClean, storedClean, StringComparison.OrdinalIgnoreCase))
            {
                isValidPassword = true;
                _logger.LogWarning("User {Email} logged in with plaintext password (trimmed/case-insensitive).", model.Email);
            }
        }

        if (!isValidPassword)
        {
            _logger.LogWarning("Login failed: password mismatch for {Email}. Stored: {Stored}", model.Email, storedHash);
            throw new UnauthorizedAccessException("Invalid credentials");
        }

        var roles = await _db.AccountRoles
            .Where(ar => ar.AccountId == account.Id && ar.BusinessEntityName == BusinessEntity)
            .Join(_db.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => r.RoleName)
            .ToListAsync();

        _logger.LogInformation("Roles found: {Count} for AccountId: {AccountId}", roles.Count, account.Id);

        var token = GenerateJwtToken(account, roles);
        _logger.LogInformation("JWT token generated for AccountId: {AccountId}", account.Id);

        return new LoginResult(
            Token:      token,
            Roles:      roles,
            AccountId:  account.Id,
            Email:      account.Email,
            FullNameEn: account.FullNameEn,
            FullNameAr: account.FullNameAr,
            Role:       roles.FirstOrDefault());
    }

    // -------------------------------------------------------------------------
    // GetProfileAsync
    // -------------------------------------------------------------------------

    public async Task<AccountProfileDto?> GetProfileAsync(long accountId)
    {
        var account = await _db.Accounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == accountId);

        if (account == null) return null;

        return new AccountProfileDto(
            Id:        account.Id,
            Email:     account.Email,
            FullNameEn: account.FullNameEn,
            FullNameAr: account.FullNameAr,
            Phone:     account.Phone,
            IsActive:  account.IsActive,
            CreatedAt: account.CreatedAt,
            UpdatedAt: DateTime.UtcNow);
    }

    // -------------------------------------------------------------------------
    // UpdateProfileAsync
    // -------------------------------------------------------------------------

    public async Task<AccountProfileDto?> UpdateProfileAsync(long accountId, UpdateProfileModel model)
    {
        var account = await _db.Accounts.FirstOrDefaultAsync(a => a.Id == accountId);
        if (account == null) return null;

        if (!string.IsNullOrWhiteSpace(model.FullNameEn)) account.FullNameEn = model.FullNameEn;
        if (!string.IsNullOrWhiteSpace(model.FullNameAr)) account.FullNameAr = model.FullNameAr;
        if (!string.IsNullOrWhiteSpace(model.Email))      account.Email      = model.Email;
        if (model.Phone != null)                           account.Phone      = model.Phone;

        await _db.SaveChangesAsync();

        return new AccountProfileDto(
            Id:        account.Id,
            Email:     account.Email,
            FullNameEn: account.FullNameEn,
            FullNameAr: account.FullNameAr,
            Phone:     account.Phone,
            IsActive:  account.IsActive,
            CreatedAt: account.CreatedAt,
            UpdatedAt: DateTime.UtcNow);
    }

    // -------------------------------------------------------------------------
    // JWT generation — preserved exactly from original AuthController
    // -------------------------------------------------------------------------

    private string GenerateJwtToken(Account account, IEnumerable<string> roles)
    {
        _logger.LogInformation("Starting GenerateJwtToken for AccountId: {AccountId}", account.Id);

        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, account.Email)
        };
        foreach (var role in roles.Distinct())
            claims.Add(new Claim(ClaimTypes.Role, role));

        var keyStr = _config["Jwt:Key"];
        if (string.IsNullOrEmpty(keyStr))
            throw new ArgumentNullException("Jwt:Key", "Jwt:Key is missing in configuration");

        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyStr));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer:             _config["Jwt:Issuer"],
            audience:           _config["Jwt:Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        _logger.LogInformation("Token object created, writing token string...");
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // -------------------------------------------------------------------------
    // Password helpers — preserved exactly from original AuthController
    // -------------------------------------------------------------------------

    /// <summary>
    /// Validates password strength — same rules as the original controller.
    /// Throws ArgumentException when validation fails.
    /// </summary>
    public static (bool IsValid, string ErrorMessage) ValidatePasswordStrength(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return (false, "Password is required");
        if (password.Length < 8)
            return (false, "Password must be at least 8 characters long");
        if (!password.Any(char.IsUpper))
            return (false, "Password must contain at least one uppercase letter");
        if (!password.Any(char.IsLower))
            return (false, "Password must contain at least one lowercase letter");
        if (!password.Any(char.IsDigit))
            return (false, "Password must contain at least one digit");
        return (true, string.Empty);
    }

    private static string ComputeSha256Hash(string raw)
    {
        using var sha   = System.Security.Cryptography.SHA256.Create();
        var bytes       = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        var sb          = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}
