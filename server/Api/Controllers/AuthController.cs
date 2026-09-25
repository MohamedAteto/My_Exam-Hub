using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using QuizesApi.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.EntityFrameworkCore;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthController : ControllerBase
{
    private readonly ElsewedySchoolSysDbDevContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _logger;
    private const string BusinessEntity = "Exams";

    public AuthController(ElsewedySchoolSysDbDevContext db, IConfiguration config, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register(RegisterModel model)
    {
        _logger.LogInformation("Registration attempt for email: {Email}", model.Email);

        if (!string.IsNullOrWhiteSpace(model.Role) && !model.Role.Trim().Equals("Student", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Public registration is available for student accounts only" });

        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { message = "Email and password are required" });

        // Validate password strength
        var passwordValidation = ValidatePasswordStrength(model.Password);
        if (!passwordValidation.IsValid)
            return BadRequest(new { message = passwordValidation.ErrorMessage });

        if (await _db.Accounts.AnyAsync(a => a.Email == model.Email))
            return Conflict(new { message = "Email already exists" });

        // Resolve role (default Student)
        const string roleName = "Student";

        var role = await _db.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName && r.BusinessEntity == BusinessEntity);
        if (role == null) 
        {
            _logger.LogWarning("Role not found: {RoleName} in entity {Entity}", roleName, BusinessEntity);
            return BadRequest(new { message = $"Invalid role: {roleName} for entity {BusinessEntity}" });
        }

        // Ensure Status exists - try to find one for our entity first
        var statusId = await _db.Statuses
            .Where(s => s.BusinessEntity == BusinessEntity)
            .OrderBy(s => s.Id)
            .Select(s => s.Id)
            .FirstOrDefaultAsync();

        if (statusId == 0)
        {
            // Fallback to any active status or create new one
            statusId = await _db.Statuses.Select(s => s.Id).OrderBy(id => id).FirstOrDefaultAsync();
            if (statusId == 0)
            {
                var newStatus = new Status { StatusName = "Active", BusinessEntity = BusinessEntity, OrderNo = 1 };
                _db.Statuses.Add(newStatus);
                await _db.SaveChangesAsync();
                statusId = newStatus.Id;
            }
        }

        // Create account with bcrypt hashed password
        var account = new Account
        {
            Email = model.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.Password),
            FullNameEn = model.FullNameEn ?? model.Email,
            FullNameAr = model.FullNameAr ?? model.Email,
            NationalId = $"NID-{Guid.NewGuid().ToString("N").Substring(0,8)}",
            RoleId = role.Id,
            IsActive = true,
            StatusId = statusId
        };
        _db.Accounts.Add(account);
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("Account created with ID: {AccountId}", account.Id);

        // Link via AccountRole
        _db.AccountRoles.Add(new AccountRole { AccountId = account.Id, RoleId = role.Id, BusinessEntityName = BusinessEntity });
        await _db.SaveChangesAsync();
        
        _logger.LogInformation("AccountRole created for AccountId: {AccountId}, RoleId: {RoleId}, Entity: {Entity}", account.Id, role.Id, BusinessEntity);

        // Also create a Login entry
        var loginEntry = new Login
        {
            AccountId = account.Id,
            Email = account.Email,
            PasswordHash = account.PasswordHash,
            StatusId = statusId
        };
        _db.Logins.Add(loginEntry);
        await _db.SaveChangesAsync();
        _logger.LogInformation("Login entry created for AccountId: {AccountId}", account.Id);

        return Ok(new { message = "Account created", accountId = account.Id });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login(LoginModel model)
    {
        try
            {
                if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
                    return BadRequest(new { message = "Email and password are required" });

            _logger.LogInformation("Login attempt for email: {Email}", model.Email);

            Account account = null;
            string storedHash = null;

            // 1. Try to find in Login table (Primary)
            var loginEntry = await _db.Logins
                .Include(l => l.Account) // Removed ThenInclude(a => a.Role)
                .FirstOrDefaultAsync(l => l.Email == model.Email);

            if (loginEntry != null && loginEntry.Account != null && loginEntry.Account.IsActive)
            {
                account = loginEntry.Account;
                storedHash = loginEntry.PasswordHash;
                _logger.LogInformation("User found in Login table. AccountId: {AccountId}", account.Id);
            }
            else
            {
                // 2. Fallback: Try to find in Account table (Legacy/Backup)
                account = await _db.Accounts // Removed Include(a => a.Role)
                   .FirstOrDefaultAsync(a => a.Email == model.Email && a.IsActive);
                
                if (account != null)
                {
                   storedHash = account.PasswordHash;
                    _logger.LogInformation("User found in Account table (Fallback). AccountId: {AccountId}", account.Id);
                }
            }

            if (account == null)
            {
                _logger.LogWarning("Login failed: Account not found or inactive for email: {Email}", model.Email);
                return Unauthorized(new { message = "Invalid credentials" });
            }

            // Verify password (try BCrypt first, then legacy SHA256)
            bool isValidPassword = false;
            
            // 1. Try BCrypt
            try
            {
                if (BCrypt.Net.BCrypt.Verify(model.Password, storedHash ?? string.Empty))
                {
                    isValidPassword = true;
                }
            }
            catch
            {
                // BCrypt might throw if the hash format is invalid
            }

            // 2. Fallback to SHA256
            if (!isValidPassword)
            {
                var legacyHash = ComputeSha256Hash(model.Password);
                if (string.Equals(legacyHash, storedHash, StringComparison.OrdinalIgnoreCase))
                {
                    isValidPassword = true;
                }
                else 
                {
                    _logger.LogWarning("Password verification failed for account {AccountId}", account.Id);
                }
            }

            // 3. SECURITY RISK: Plaintext password check should be REMOVED in production
            // This fallback is only for legacy data migration and should be disabled
            if (!isValidPassword && _config.GetValue<bool>("Security:AllowPlaintextPasswordFallback", false))
            {
                // Robust comparison: Trim whitespace and ignore case
                var inputClean = model.Password?.Trim();
                var storedClean = storedHash?.Trim();

                if (string.Equals(inputClean, storedClean, StringComparison.OrdinalIgnoreCase))
                {
                    isValidPassword = true;
                    _logger.LogWarning("SECURITY WARNING: User {Email} logged in with plaintext password. This account should be migrated to BCrypt immediately.", model.Email);
                    
                    // Auto-migrate to BCrypt for next login
                    try
                    {
                        account.PasswordHash = BCrypt.Net.BCrypt.HashPassword(model.Password);
                        if (loginEntry != null)
                        {
                            loginEntry.PasswordHash = account.PasswordHash;
                        }
                        await _db.SaveChangesAsync();
                        _logger.LogInformation("Auto-migrated plaintext password to BCrypt for user {Email}", model.Email);
                    }
                    catch (Exception migrationEx)
                    {
                        _logger.LogError(migrationEx, "Failed to auto-migrate password for {Email}", model.Email);
                    }
                }
            }

            if (!isValidPassword)
            {
                // Re-compute for logging if needed, or just log the mismatch
                _logger.LogWarning("Login failed: Password mismatch for email: {Email}", model.Email);
                return Unauthorized(new { message = "Invalid credentials" });
            }

            var targetEntity = string.IsNullOrWhiteSpace(model.BusinessEntity) ? BusinessEntity : model.BusinessEntity;

            var roles = await _db.AccountRoles
                .Where(ar => ar.AccountId == account.Id && ar.BusinessEntityName == targetEntity)
                .Join(_db.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => r.RoleName)
                .ToListAsync();

            if (!roles.Any())
            {
                roles = await _db.AccountRoles
                    .Where(ar => ar.AccountId == account.Id)
                    .Join(_db.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => r.RoleName)
                    .ToListAsync();
            }

            _logger.LogInformation("Roles found for entity {Entity}: {RolesCount}", targetEntity, roles.Count);

            _logger.LogInformation("Generating JWT token...");
            var token = GenerateJwtToken(account, roles);
            _logger.LogInformation("JWT token generated successfully.");
            
            return Ok(new 
            { 
                token, 
                roles,
                accountId = account.Id,
                email = account.Email,
                fullNameEn = account.FullNameEn,
                fullNameAr = account.FullNameAr,
                role = roles.FirstOrDefault() // Use the first entity-specific role, not account.Role
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred during login for {Email}", model.Email);
            return StatusCode(500, new { message = "An internal error occurred" });
        }
    }

    [HttpPost("sso-token")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSsoToken([FromBody] SsoTokenModel model)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.SsoToken))
                return Unauthorized(new { message = "A valid SSO token and email are required" });

            var key = _config["Jwt:Key"];
            if (string.IsNullOrWhiteSpace(key))
                return StatusCode(500, new { message = "Authentication is not configured" });

            ClaimsPrincipal ssoPrincipal;
            try
            {
                ssoPrincipal = new JwtSecurityTokenHandler().ValidateToken(
                    model.SsoToken,
                    new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuers = new[] { _config["Jwt:Issuer"] ?? "CAS.Api", "CAS.Api", "QuizesApi" },
                        ValidateAudience = true,
                        ValidAudiences = new[] { _config["Jwt:Audience"] ?? "CAS.Clients", "CAS.Clients", "QuizesApiUsers" },
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromSeconds(30),
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
                    },
                    out _);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Rejected invalid SSO token");
                return Unauthorized(new { message = "The SSO token is invalid or expired" });
            }

            var tokenEmail = ssoPrincipal.FindFirst(ClaimTypes.Email)?.Value
                ?? ssoPrincipal.FindFirst(JwtRegisteredClaimNames.Email)?.Value
                ?? ssoPrincipal.FindFirst("Email")?.Value
                ?? ssoPrincipal.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")?.Value;
            if (string.IsNullOrWhiteSpace(tokenEmail) ||
                !string.Equals(tokenEmail, model.Email, StringComparison.OrdinalIgnoreCase))
                return Unauthorized(new { message = "The SSO token does not match the supplied email" });

            var entity = string.IsNullOrWhiteSpace(model.BusinessEntity) ? BusinessEntity : model.BusinessEntity;
            _logger.LogInformation("SSO token requested for entity {Entity}", entity);

            var account = await _db.Accounts.FirstOrDefaultAsync(a => a.Email == tokenEmail && a.IsActive);
            if (account == null)
            {
                var loginEntry = await _db.Logins.Include(l => l.Account).FirstOrDefaultAsync(l => l.Email == tokenEmail);
                if (loginEntry?.Account != null && loginEntry.Account.IsActive)
                {
                    account = loginEntry.Account;
                }
            }

            if (account == null)
            {
                return Unauthorized(new { message = "Account is not enabled for this application" });
            }

            var roles = await _db.AccountRoles
                .Where(ar => ar.AccountId == account.Id && ar.BusinessEntityName == entity)
                .Join(_db.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => r.RoleName)
                .ToListAsync();

            if (!roles.Any())
            {
                roles = await _db.AccountRoles
                    .Where(ar => ar.AccountId == account.Id)
                    .Join(_db.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => r.RoleName)
                    .ToListAsync();

                if (!roles.Any())
                {
                    roles = new System.Collections.Generic.List<string> { "Student" };
                }
            }

            var token = GenerateJwtToken(account, roles);

            return Ok(new
            {
                token,
                roles,
                accountId = account.Id,
                email = account.Email,
                fullNameEn = account.FullNameEn,
                fullNameAr = account.FullNameAr,
                role = roles.FirstOrDefault()
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating SSO token for {Email}", model.Email);
            return StatusCode(500, new { message = "An internal error occurred" });
        }
    }

    [HttpGet("profile/{id}")]
    public async Task<IActionResult> GetProfile(long id)
    {
        try
        {
            if (!CanManageProfile(id)) return Forbid();

            var account = await _db.Accounts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
            if (account == null)
                return NotFound(new { message = "User not found" });

            return Ok(new
            {
                id = account.Id,
                email = account.Email,
                fullNameEn = account.FullNameEn,
                fullNameAr = account.FullNameAr,
                phone = account.Phone,
                isActive = account.IsActive,
                createdAt = account.CreatedAt,
                updatedAt = DateTime.UtcNow 
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving profile for account {AccountId}", id);
            return StatusCode(500, new { message = "Error retrieving profile" });
        }
    }

    [HttpPut("profile/{id}")]
    public async Task<IActionResult> UpdateProfile(long id, [FromBody] UpdateProfileModel model)
    {
        try
        {
            if (!CanManageProfile(id)) return Forbid();

            var account = await _db.Accounts.FirstOrDefaultAsync(a => a.Id == id);
            if (account == null)
                return NotFound(new { message = "User not found" });

            // Update fields
            if (!string.IsNullOrWhiteSpace(model.FullNameEn))
                account.FullNameEn = model.FullNameEn;
            if (!string.IsNullOrWhiteSpace(model.FullNameAr))
                account.FullNameAr = model.FullNameAr;
            if (!string.IsNullOrWhiteSpace(model.Email))
                account.Email = model.Email;
            if (model.Phone != null)
                account.Phone = model.Phone;

            await _db.SaveChangesAsync();

            return Ok(new
            {
                id = account.Id,
                email = account.Email,
                fullNameEn = account.FullNameEn,
                fullNameAr = account.FullNameAr,
                phone = account.Phone,
                isActive = account.IsActive,
                createdAt = account.CreatedAt,
                updatedAt = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating profile for account {AccountId}", id);
            return StatusCode(500, new { message = "Error updating profile" });
        }
    }

    private bool CanManageProfile(long accountId)
    {
        if (User.IsInRole("Admin") || User.IsInRole("Superadmin") || User.IsInRole("Board")) return true;

        var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("sub")?.Value
            ?? User.FindFirst("id")?.Value;
        return long.TryParse(accountIdClaim, out var requesterId) && requesterId == accountId;
    }

    private string GenerateJwtToken(Account account, System.Collections.Generic.IEnumerable<string> roles)
    {
        try 
        {
            _logger.LogInformation("Starting GenerateJwtToken for Account: {AccountId}", account.Id);

            var claims = new System.Collections.Generic.List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, account.Email)
            };
            foreach (var role in roles.Distinct())
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            var keyStr = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(keyStr)) throw new ArgumentNullException("Jwt:Key is missing in config");

            var keyBytes = Encoding.UTF8.GetBytes(keyStr);
            var key = new SymmetricSecurityKey(keyBytes);
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: System.DateTime.UtcNow.AddHours(8),
                signingCredentials: creds);
            
            _logger.LogInformation("Token object created, writing token string...");

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        catch (Exception ex)
        {
             _logger.LogError(ex, "Error generating JWT token");
             throw;
        }
    }

    private static (bool IsValid, string ErrorMessage) ValidatePasswordStrength(string password)
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

    private string ComputeSha256Hash(string raw)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}
