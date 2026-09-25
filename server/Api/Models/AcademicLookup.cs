namespace QuizesApi.Models;

public static class AcademicLookup
{
    public static readonly string[] SupportedGradeNames = { "junior", "wheeler", "senior" };

    public static string? GetClassPrefix(string? gradeName) => gradeName?.Trim().ToLowerInvariant() switch
    {
        "junior" => "J",
        "wheeler" => "W",
        "senior" => "S",
        _ => null
    };

    public static bool IsSupportedClassName(string? className, string? gradePrefix)
    {
        if (string.IsNullOrWhiteSpace(className) || gradePrefix is null) return false;
        var name = className.Trim();
        return name.Length == 2 &&
               string.Equals(name[..1], gradePrefix, StringComparison.OrdinalIgnoreCase) &&
               name[1] is >= '1' and <= '4';
    }
}