using System.Security.Claims;

namespace QuizesApi.Helpers;

/// <summary>
/// Shared helpers for reading identity and role information from JWT claims.
/// Centralises the claims-extraction logic that was previously duplicated
/// across ExamDetailController, StudentExamAnswerController, and
/// DashboardController.
///
/// Security notes:
///   - AccountId is read exclusively from the JWT sub / NameIdentifier claim.
///     A client-supplied AccountId in the request body or URL is NEVER used.
///   - Roles are read from ClaimTypes.Role, which ASP.NET Core populates from
///     the JWT role claims emitted by AuthController.GenerateJwtToken().
///   - The staff role list matches the production roles registered under
///     BusinessEntity = "Exams": Teacher, Admin, Board, Superadmin.
/// </summary>
public static class ClaimsHelper
{
    /// <summary>
    /// Reads the authenticated user's AccountId and role list from their JWT claims.
    /// Returns AccountId = 0 when the token does not contain a recognisable subject claim.
    /// </summary>
    public static (long AccountId, List<string> Roles) GetRequesterInfo(ClaimsPrincipal user)
    {
        var accountIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value
            ?? user.FindFirst("id")?.Value;

        long.TryParse(accountIdClaim, out long accountId);

        var roles = user.FindAll(ClaimTypes.Role)
                        .Select(c => c.Value)
                        .ToList();

        return (accountId, roles);
    }

    /// <summary>
    /// Returns true when the supplied role list contains at least one staff role
    /// (Teacher, Admin, Board, or Superadmin).  Staff members bypass student-specific
    /// ownership and submission-state checks.
    /// </summary>
    public static bool IsStaff(IEnumerable<string> roles) =>
        roles.Contains("Teacher") ||
        roles.Contains("Admin")   ||
        roles.Contains("Board")   ||
        roles.Contains("Superadmin");

    /// <summary>
    /// Returns true when the supplied role list contains at least one admin-level role
    /// (Admin, Board, or Superadmin) — used for profile read/update access in AuthController.
    /// </summary>
    public static bool IsAdmin(IEnumerable<string> roles) =>
        roles.Contains("Admin") ||
        roles.Contains("Board") ||
        roles.Contains("Superadmin");
}
