using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Implementation;

namespace QuizesApi.Tests.Repositories;

public class ExamQueryFiltersTests
{
    [Fact]
    public async Task Apply_CombinesSubjectGradeClassAndInclusiveEndMinute()
    {
        await using var context = CreateContext();
        var day = new DateTime(2026, 9, 30, 0, 0, 0, DateTimeKind.Utc);
        context.ExamDetails.AddRange(
            new ExamDetail { ExamId = 1, SubjectId = 7, GradeId = 1, ClassId = "11", StartDate = day.AddHours(9).AddMinutes(15) },
            new ExamDetail { ExamId = 2, SubjectId = 7, GradeId = 1, ClassId = "11", StartDate = day.AddHours(10).AddMinutes(30).AddSeconds(59).AddTicks(9_999_990) },
            new ExamDetail { ExamId = 3, SubjectId = 7, GradeId = 1, ClassId = "11", StartDate = day.AddHours(10).AddMinutes(31) },
            new ExamDetail { ExamId = 4, SubjectId = 8, GradeId = 1, ClassId = "11", StartDate = day.AddHours(10) },
            new ExamDetail { ExamId = 5, SubjectId = 7, GradeId = 2, ClassId = "11", StartDate = day.AddHours(10) },
            new ExamDetail { ExamId = 6, SubjectId = 7, GradeId = 1, ClassId = "21", StartDate = day.AddHours(10) },
            new ExamDetail { ExamId = 7, SubjectId = 7, GradeId = 1, ClassId = "11", StartDate = day.AddHours(9).AddMinutes(14).AddSeconds(59) });
        await context.SaveChangesAsync();

        var filters = new LeaderboardFilterDto
        {
            SubjectId = 7,
            GradeId = 1,
            ClassId = 11,
            StartDate = day.AddHours(9).AddMinutes(15),
            EndDate = day.AddHours(10).AddMinutes(30).AddSeconds(59)
        };

        var results = await ExamQueryFilters.Apply(context.ExamDetails.AsNoTracking(), filters).ToListAsync();

        results.Select(exam => exam.ExamId).Should().BeEquivalentTo(new long[] { 1, 2 });
    }

    private static ElsewedySchoolSysDbDevContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ElsewedySchoolSysDbDevContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ElsewedySchoolSysDbDevContext(options);
    }
}