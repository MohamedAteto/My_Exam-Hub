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
public class AuthController : ControllerBase
{
    private readonly ElsewedySchoolContext _db;
    private readonly IConfiguration _config;

    public AuthController(ElsewedySchoolContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { message = "Email and password are required" });

        // Validate password strength
        var passwordValidation = ValidatePasswordStrength(model.Password);
        if (!passwordValidation.IsValid)
            return BadRequest(new { message = passwordValidation.ErrorMessage });

        if (await _db.Accounts.AnyAsync(a => a.Email == model.Email))
            return Conflict(new { message = "Email already exists" });

        // Resolve role (default Student)
        var roleName = string.IsNullOrWhiteSpace(model.Role) ? "Student" : model.Role.Trim();
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.RoleName == roleName && r.BusinessEntity == "Quizes System");
        if (role == null) return BadRequest(new { message = "Invalid role" });

        // Ensure Status exists
        var statusId = await _db.Statuses.Select(s => s.Id).OrderBy(id => id).FirstOrDefaultAsync();
        if (statusId == 0)
        {
            _db.Statuses.Add(new Status { StatusName = "Active", BusinessEntity = "Quizes System", OrderNo = 1 });
            await _db.SaveChangesAsync();
            statusId = await _db.Statuses.Select(s => s.Id).OrderBy(id => id).FirstAsync();
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

        // Link via AccountRole
        _db.AccountRoles.Add(new AccountRole { AccountId = account.Id, RoleId = role.Id, BusinessEntityName = "Quizes System" });
        await _db.SaveChangesAsync();

        return Ok(new { message = "Account created", accountId = account.Id });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { message = "Email and password are required" });

        var account = await _db.Accounts
            .Include(a => a.Role)
            .FirstOrDefaultAsync(a => a.Email == model.Email && a.IsActive);
        
        if (account == null)
            return Unauthorized(new { message = "Invalid credentials" });

        // Verify password using bcrypt
        if (!BCrypt.Net.BCrypt.Verify(model.Password, account.PasswordHash ?? string.Empty))
            return Unauthorized(new { message = "Invalid credentials" });

        var roles = await _db.AccountRoles
            .Where(ar => ar.AccountId == account.Id)
            .Join(_db.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => r.RoleName)
            .ToListAsync();

        var token = GenerateJwtToken(account, roles);
        
        return Ok(new 
        { 
            token, 
            roles,
            accountId = account.Id,
            email = account.Email,
            fullNameEn = account.FullNameEn,
            fullNameAr = account.FullNameAr,
            role = account.Role?.RoleName
        });
    }

    [HttpGet("profile/{id}")]
    public async Task<IActionResult> GetProfile(long id)
    {
        try
        {
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
                updatedAt = DateTime.UtcNow // You might want to add an UpdatedAt field to the Account model
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error retrieving profile", error = ex.Message });
        }
    }

    [HttpPut("profile/{id}")]
    public async Task<IActionResult> UpdateProfile(long id, [FromBody] UpdateProfileModel model)
    {
        try
        {
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
            return StatusCode(500, new { message = "Error updating profile", error = ex.Message });
        }
    }

    private string GenerateJwtToken(Account account, System.Collections.Generic.IEnumerable<string> roles)
    {
        var claims = new System.Collections.Generic.List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, account.Email)
        };
        foreach (var role in roles.Distinct())
        {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: System.DateTime.UtcNow.AddHours(8),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
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
}
