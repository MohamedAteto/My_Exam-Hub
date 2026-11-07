using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizesApi.Helpers;
using QuizesApi.Models;
using QuizesApi.Services;

namespace QuizesApi.Controllers;

/// <summary>
/// Handles HTTP concerns for authentication and account management.
/// All business logic, password handling, and JWT generation are
/// delegated to IAuthService.  This controller is responsible only for:
///   - Routing and HTTP method binding
///   - Request-level input validation (null-checks, required fields)
///   - Authorization attributes
///   - Identity extraction for ownership checks
///   - Translating service results / exceptions into HTTP responses
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger      = logger;
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/register
    // Public endpoint — no [Authorize] required.
    // -------------------------------------------------------------------------
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { message = "Email and password are required" });

        // Password strength is validated in the service; validate here first for
        // fast failure before any DB work is done.
        var passwordValidation = AuthService.ValidatePasswordStrength(model.Password);
        if (!passwordValidation.IsValid)
            return BadRequest(new { message = passwordValidation.ErrorMessage });

        // Check email uniqueness — kept in controller because it returns Conflict (409)
        // which is a pure HTTP-contract concern.
        // The service would throw on the DB unique constraint anyway, but this gives
        // a cleaner error message.
        try
        {
            var result = await _authService.RegisterAsync(model);
            return Ok(new { message = "Account created", accountId = result.AccountId });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex) when (ex.Message.Contains("unique") || ex.InnerException?.Message.Contains("unique") == true)
        {
            return Conflict(new { message = "Email already exists" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Registration failed for {Email}", model.Email);
            return StatusCode(500, new { message = "An internal error occurred", error = ex.Message });
        }
    }

    // -------------------------------------------------------------------------
    // POST /api/auth/login
    // Public endpoint — no [Authorize] required.
    // -------------------------------------------------------------------------
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginModel model)
    {
        if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Password))
            return BadRequest(new { message = "Email and password are required" });

        try
        {
            var result = await _authService.LoginAsync(model);
            return Ok(new
            {
                token      = result.Token,
                roles      = result.Roles,
                accountId  = result.AccountId,
                email      = result.Email,
                fullNameEn = result.FullNameEn,
                fullNameAr = result.FullNameAr,
                role       = result.Role
            });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { message = "Invalid credentials" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Login failed for {Email}", model.Email);
            return StatusCode(500, new { message = "An internal error occurred", error = ex.Message });
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/auth/profile/{id}
    // Requires authentication. Users may only read their own profile.
    // Admins, Board, and Superadmins may read any profile.
    // -------------------------------------------------------------------------
    [HttpGet("profile/{id}")]
    [Authorize]
    public async Task<IActionResult> GetProfile(long id)
    {
        var (requesterId, roles) = ClaimsHelper.GetRequesterInfo(User);

        if (requesterId <= 0)
            return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

        if (!ClaimsHelper.IsAdmin(roles) && requesterId != id)
            return StatusCode(403, new { message = "You are not authorised to view another user's profile." });

        try
        {
            var profile = await _authService.GetProfileAsync(id);
            if (profile == null) return NotFound(new { message = "User not found" });

            return Ok(new
            {
                id         = profile.Id,
                email      = profile.Email,
                fullNameEn = profile.FullNameEn,
                fullNameAr = profile.FullNameAr,
                phone      = profile.Phone,
                isActive   = profile.IsActive,
                createdAt  = profile.CreatedAt,
                updatedAt  = profile.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error retrieving profile", error = ex.Message });
        }
    }

    // -------------------------------------------------------------------------
    // PUT /api/auth/profile/{id}
    // Requires authentication. Users may only update their own profile.
    // Admins, Board, and Superadmins may update any profile.
    // -------------------------------------------------------------------------
    [HttpPut("profile/{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile(long id, [FromBody] UpdateProfileModel model)
    {
        var (requesterId, roles) = ClaimsHelper.GetRequesterInfo(User);

        if (requesterId <= 0)
            return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

        if (!ClaimsHelper.IsAdmin(roles) && requesterId != id)
            return StatusCode(403, new { message = "You are not authorised to update another user's profile." });

        try
        {
            var profile = await _authService.UpdateProfileAsync(id, model);
            if (profile == null) return NotFound(new { message = "User not found" });

            return Ok(new
            {
                id         = profile.Id,
                email      = profile.Email,
                fullNameEn = profile.FullNameEn,
                fullNameAr = profile.FullNameAr,
                phone      = profile.Phone,
                isActive   = profile.IsActive,
                createdAt  = profile.CreatedAt,
                updatedAt  = profile.UpdatedAt
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error updating profile", error = ex.Message });
        }
    }
}
