using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.Models;

namespace QuizesApi.Repositories.Implementation;

public static class ExamQueryFilters
{
    public static IQueryable<ExamDetail> Apply(IQueryable<ExamDetail> query, LeaderboardFilterDto? filters)
    {
        if (filters is null) return query;
        if (filters.GradeId.HasValue) query = query.Where(exam => exam.GradeId == filters.GradeId.Value);
        if (filters.ExamId.HasValue) query = query.Where(exam => exam.ExamId == filters.ExamId.Value);
        if (filters.SubjectId.HasValue) query = query.Where(exam => exam.SubjectId == filters.SubjectId.Value);
        if (!string.IsNullOrEmpty(filters.SearchTerm))
            query = query.Where(exam => exam.Title != null && EF.Functions.Like(exam.Title, "%" + filters.SearchTerm + "%"));

        if (filters.ClassId.HasValue)
        {
            var classId = filters.ClassId.Value.ToString();
            query = query.Where(exam => exam.ClassId != null && (
                exam.ClassId == classId ||
                exam.ClassId.StartsWith(classId + ",") ||
                exam.ClassId.EndsWith("," + classId) ||
                exam.ClassId.Contains("," + classId + ",") ||
                exam.ClassId.Contains("\"" + classId + "\"")));
        }

        if (filters.StartDate.HasValue)
        {
            var start = TruncateToMinute(filters.StartDate.Value);
            query = query.Where(exam => (exam.StartDate ?? exam.EndDate) >= start);
        }

        if (filters.EndDate.HasValue)
        {
            var endExclusive = TruncateToMinute(filters.EndDate.Value).AddMinutes(1);
            query = query.Where(exam => (exam.StartDate ?? exam.EndDate) < endExclusive);
        }

        return query;
    }

    private static DateTime TruncateToMinute(DateTime value) => new(
        value.Year, value.Month, value.Day, value.Hour, value.Minute, 0, value.Kind);
}