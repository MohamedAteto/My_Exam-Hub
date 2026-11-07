using QuizesApi.Models;

namespace QuizesApi.Services;

/// <summary>
/// Business-logic contract for authentication and account management.
/// The controller handles HTTP routing, authorization attributes, and
/// response translation.  This service handles all auth business logic:
/// account creation, login, password verification, JWT generation, and
/// profile management.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Creates a new account with a bcrypt-hashed password, assigns a role,
    /// and creates the corresponding Login and AccountRole entries.
    /// </summary>
    Task<RegisterResult> RegisterAsync(RegisterModel model);

    /// <summary>
    /// Verifies credentials (BCrypt → SHA256 → plaintext fallback) and returns
    /// a signed JWT token plus the account's role information on success.
    /// </summary>
    Task<LoginResult> LoginAsync(LoginModel model);

    /// <summary>
    /// Returns the profile data for a given account ID.
    /// Returns null when the account does not exist.
    /// </summary>
    Task<AccountProfileDto?> GetProfileAsync(long accountId);

    /// <summary>
    /// Updates the profile fields of a given account.
    /// Returns the updated profile, or null if the account was not found.
    /// </summary>
    Task<AccountProfileDto?> UpdateProfileAsync(long accountId, UpdateProfileModel model);
}

// ---------------------------------------------------------------------------
// Result types — plain records that carry service output without HTTP concerns
// ---------------------------------------------------------------------------

/// <summary>Result of a successful registration.</summary>
public record RegisterResult(long AccountId);

/// <summary>Result of a successful login.</summary>
public record LoginResult(
    string Token,
    List<string> Roles,
    long AccountId,
    string? Email,
    string? FullNameEn,
    string? FullNameAr,
    string? Role);

/// <summary>Profile data returned by GetProfile and UpdateProfile.</summary>
public record AccountProfileDto(
    long Id,
    string? Email,
    string? FullNameEn,
    string? FullNameAr,
    string? Phone,
    bool IsActive,
    DateOnly? CreatedAt,
    DateTime UpdatedAt);
