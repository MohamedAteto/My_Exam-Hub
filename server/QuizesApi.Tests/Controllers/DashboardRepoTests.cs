using FluentAssertions;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using QuizesApi.Controllers;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Implementation;

namespace QuizesApi.Tests.Repositories;

public class DashboardRepoTests
{
    [Fact]
    public async Task GetStudents_ReturnsOnlyRegisteredStudentsInSupportedGrades()
    {
        await using var context = CreateContext();
        context.Statuses.Add(new Status { Id = 1, StatusName = "Active", BusinessEntity = "Exams" });
        context.Roles.AddRange(
            new Role { Id = 1, RoleName = "Student", BusinessEntity = "Exams" },
            new Role { Id = 2, RoleName = "Teacher", BusinessEntity = "Exams" });
        context.Grades.AddRange(
            new Grade { Id = 1, GradeName = "Junior", StatusId = 1 },
            new Grade { Id = 2, GradeName = "Wheeler", StatusId = 1 },
            new Grade { Id = 3, GradeName = "Senior", StatusId = 1 },
            new Grade { Id = 4, GradeName = "Graduate_2026", StatusId = 1 });
        context.TblClasses.AddRange(
            new TblClass { Id = 11, ClassName = "J1", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 12, ClassName = "W1", GradeId = 2, StatusId = 1 },
            new TblClass { Id = 13, ClassName = "S1", GradeId = 3, StatusId = 1 },
            new TblClass { Id = 14, ClassName = "G1", GradeId = 4, StatusId = 1 });
        context.Accounts.AddRange(
            CreateAccount(101, "junior@example.com", 1),
            CreateAccount(102, "wheeler@example.com", 1),
            CreateAccount(103, "senior@example.com", 1),
            CreateAccount(104, "graduate@example.com", 1),
            CreateAccount(105, "unregistered@example.com", 1),
            CreateAccount(106, "teacher@example.com", 2));
        context.StudentExtensions.AddRange(
            CreateExtension(101, 11),
            CreateExtension(102, 12),
            CreateExtension(103, 13),
            CreateExtension(104, 14));
        await context.SaveChangesAsync();

        var repository = new DashboardRepo(context, new MemoryCache(new MemoryCacheOptions()));

        var students = await repository.GetStudentsAsync();

        students.Select(student => student.Id).Should().BeEquivalentTo(new long[] { 101, 102, 103 });
        students.Select(student => student.Grade).Should().BeEquivalentTo(new[] { "Junior", "Wheeler", "Senior" });
        students.Select(student => student.GradeId).Should().BeEquivalentTo(new long?[] { 1, 2, 3 });
        students.Select(student => student.ClassId).Should().BeEquivalentTo(new long?[] { 11, 12, 13 });
    }

    [Fact]
    public async Task LookupData_ReturnsOnlySupportedDatabaseGradesAndRelatedClasses()
    {
        await using var context = CreateContext();
        context.Statuses.Add(new Status { Id = 1, StatusName = "Active", BusinessEntity = "Exams" });
        context.Grades.AddRange(
            new Grade { Id = 1, GradeName = "Junior", StatusId = 1 },
            new Grade { Id = 2, GradeName = "Wheeler", StatusId = 1 },
            new Grade { Id = 3, GradeName = "Senior", StatusId = 1 },
            new Grade { Id = 4, GradeName = "Graduate_2026", StatusId = 1 },
            new Grade { Id = 5, GradeName = "Graduate_2025", StatusId = 1 });
        context.TblClasses.AddRange(
            new TblClass { Id = 11, ClassName = "J1", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 12, ClassName = "J2", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 13, ClassName = "J3", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 14, ClassName = "J4", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 21, ClassName = "W1", GradeId = 2, StatusId = 1 },
            new TblClass { Id = 22, ClassName = "W2", GradeId = 2, StatusId = 1 },
            new TblClass { Id = 23, ClassName = "W3", GradeId = 2, StatusId = 1 },
            new TblClass { Id = 24, ClassName = "W4", GradeId = 2, StatusId = 1 },
            new TblClass { Id = 31, ClassName = "S1", GradeId = 3, StatusId = 1 },
            new TblClass { Id = 32, ClassName = "S2", GradeId = 3, StatusId = 1 },
            new TblClass { Id = 33, ClassName = "S3", GradeId = 3, StatusId = 1 },
            new TblClass { Id = 34, ClassName = "S4", GradeId = 3, StatusId = 1 },
            new TblClass { Id = 41, ClassName = "G1", GradeId = 4, StatusId = 1 },
            new TblClass { Id = 51, ClassName = "G2", GradeId = 5, StatusId = 1 },
            new TblClass { Id = 61, ClassName = "J5", GradeId = 1, StatusId = 1 });
        await context.SaveChangesAsync();

        var controller = new DashboardController(null!, context, NullLogger<DashboardController>.Instance);
        var action = await controller.GetLookupData();
        var response = action.Should().BeOfType<OkObjectResult>().Subject;
        using var payload = JsonDocument.Parse(JsonSerializer.Serialize(response.Value));
        var grades = payload.RootElement.GetProperty("grades").EnumerateArray().ToArray();
        var classes = payload.RootElement.GetProperty("classes").EnumerateArray().ToArray();

        grades.Select(grade => grade.GetProperty("gradeName").GetString())
            .Should().BeEquivalentTo(new[] { "Junior", "Wheeler", "Senior" });
        grades.Select(grade => grade.GetProperty("id").GetInt64())
            .Should().BeEquivalentTo(new long[] { 1, 2, 3 });
        classes.Select(classItem => classItem.GetProperty("id").GetInt64())
            .Should().BeEquivalentTo(new long[] { 11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34 });
        classes.Select(classItem => classItem.GetProperty("gradeId").GetInt64())
            .Should().BeEquivalentTo(new long[] { 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3 });
    }

    [Fact]
    public async Task GetLeaderboard_SeparatesStudentAndSelectedClassGroupingInCache()
    {
        await using var context = CreateContext();
        context.Statuses.AddRange(
            new Status { Id = 1, StatusName = "Active", BusinessEntity = "Exams" },
            new Status { Id = 5, StatusName = "Mathematics", BusinessEntity = "Exams" });
        context.Roles.Add(new Role { Id = 1, RoleName = "Student", BusinessEntity = "Exams" });
        context.TblClasses.AddRange(
            new TblClass { Id = 11, ClassName = "J1", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 12, ClassName = "J2", GradeId = 1, StatusId = 1 });
        context.ExamDetails.Add(new ExamDetail
        {
            ExamId = 501,
            Title = "Filtered exam",
            GradeId = 1,
            ClassId = "11,12",
            SubjectId = 5,
            StartDate = new DateTime(2026, 9, 10, 10, 0, 0),
            EndDate = new DateTime(2026, 9, 10, 11, 0, 0)
        });
        context.ExamQuestionBanks.Add(new ExamQuestionBank { Id = 1, ExamId = 501, QuestionId = 701 });
        context.QuestionBanks.Add(new QuestionBank { QuestionId = 701, QuestionTitle = "Q1", Mark = 10 });
        context.Accounts.Add(CreateAccount(901, "student@example.com", 1));
        context.StudentExtensions.Add(CreateExtension(901, 11));
        context.StudentExamAnswers.Add(new StudentExamAnswer
        {
            Id = 1,
            AccountId = 901,
            ExamDetailsId = 501,
            QuestionBankId = 701,
            ChoosedAnswer = "A",
            Score = true
        });
        await context.SaveChangesAsync();

        var repository = new DashboardRepo(context, new MemoryCache(new MemoryCacheOptions()));
        var baseFilters = new LeaderboardFilterDto
        {
            GradeId = 1,
            ClassId = 11,
            SubjectId = 5,
            StartDate = new DateTime(2026, 9, 10, 9, 0, 0),
            EndDate = new DateTime(2026, 9, 10, 11, 0, 0)
        };
        var studentGrouping = await repository.GetLeaderboardAsync(501, baseFilters);
        var classGrouping = await repository.GetLeaderboardAsync(501, new LeaderboardFilterDto
        {
            GradeId = baseFilters.GradeId,
            ClassId = baseFilters.ClassId,
            SubjectId = baseFilters.SubjectId,
            StartDate = baseFilters.StartDate,
            EndDate = baseFilters.EndDate,
            GroupBy = "Class"
        });

        studentGrouping!.TopStudents.Select(entry => entry.StudentName).Should().Contain("student@example.com");
        classGrouping!.TopStudents.Select(entry => entry.StudentName).Should().BeEquivalentTo(new[] { "Junior 1" });
    }

    [Fact]
    public async Task DashboardAggregates_UseOnePopulationOfStudentExamResults()
    {
        await using var context = CreateContext();
        context.Statuses.AddRange(
            new Status { Id = 1, StatusName = "Active", BusinessEntity = "Accounts" },
            new Status { Id = 5, StatusName = "Mathematics", BusinessEntity = "Exams" });
        context.Roles.AddRange(
            new Role { Id = 1, RoleName = "Student", BusinessEntity = "Accounts" },
            new Role { Id = 2, RoleName = "Teacher", BusinessEntity = "Accounts" });
        context.Grades.Add(new Grade { Id = 1, GradeName = "Junior", StatusId = 1 });
        context.TblClasses.AddRange(
            new TblClass { Id = 11, ClassName = "J1", GradeId = 1, StatusId = 1 },
            new TblClass { Id = 12, ClassName = "J2", GradeId = 1, StatusId = 1 });
        context.Accounts.AddRange(
            CreateAccount(100, "teacher@example.com", 2),
            CreateAccount(101, "other-teacher@example.com", 2),
            CreateAccount(201, "student-one@example.com", 1),
            CreateAccount(202, "student-two@example.com", 1));
        context.StudentExtensions.AddRange(CreateExtension(201, 11), CreateExtension(202, 12));
        context.ExamDetails.AddRange(
            new ExamDetail { ExamId = 801, Title = "Exam One", CreatedBy_AccId = 100, GradeId = 1, ClassId = "11,12", SubjectId = 5, StartDate = new DateTime(2026, 9, 10, 9, 0, 0), EndDate = new DateTime(2026, 9, 10, 10, 0, 0) },
            new ExamDetail { ExamId = 802, Title = "Exam Two", CreatedBy_AccId = 101, GradeId = 1, ClassId = "11,12", SubjectId = 5, StartDate = new DateTime(2026, 9, 11, 9, 0, 0), EndDate = new DateTime(2026, 9, 11, 10, 0, 0) });
        context.ExamQuestionBanks.AddRange(
            new ExamQuestionBank { Id = 1, ExamId = 801, QuestionId = 701 },
            new ExamQuestionBank { Id = 2, ExamId = 802, QuestionId = 701 },
            new ExamQuestionBank { Id = 3, ExamId = 801, QuestionId = 701 },
            new ExamQuestionBank { Id = 4, ExamId = 802, QuestionId = 701 });
        context.QuestionBanks.Add(new QuestionBank { QuestionId = 701, QuestionTitle = "Question", Mark = 10 });
        context.StudentExamAnswers.AddRange(
            CreateAnswer(1, 201, 801, true),
            CreateAnswer(2, 202, 801, false),
            CreateAnswer(3, 201, 802, true),
            CreateAnswer(4, 202, 802, true));
        await context.SaveChangesAsync();

        var repository = new DashboardRepo(context, new MemoryCache(new MemoryCacheOptions()));
        var filters = new LeaderboardFilterDto
        {
            GradeId = 1,
            SubjectId = 5,
            StartDate = new DateTime(2026, 9, 10, 0, 0, 0),
            EndDate = new DateTime(2026, 9, 11, 23, 59, 0)
        };
        var teacherDashboard = await repository.GetTeacherDashboardAsync(100, filters);
        var superadminDashboard = await repository.GetSuperadminDashboardAsync(filters);
        var studentDashboard = await repository.GetStudentDashboardAsync(201, filters);
        var studentDashboardWithTamperedScope = await repository.GetStudentDashboardAsync(201, new LeaderboardFilterDto
        {
            GradeId = 2,
            ClassId = 12,
            SubjectId = 5,
            StartDate = filters.StartDate,
            EndDate = filters.EndDate
        });

        teacherDashboard!.TotalExamsCreated.Should().Be(2);
        teacherDashboard.TotalStudentsWhoTookExams.Should().Be(2);
        teacherDashboard.AverageScore.Should().Be(75);
        teacherDashboard.AveragePassPercentage.Should().Be(75);
        teacherDashboard.ScoreDistribution.Should().ContainSingle(point => point.Name == "<50%" && point.Value == 1);
        teacherDashboard.ScoreDistribution.Should().ContainSingle(point => point.Name == "85-100%" && point.Value == 3);
        superadminDashboard.AverageScore.Should().Be(75);
        superadminDashboard.OverallPassPercentage.Should().Be(75);
        superadminDashboard.ScoreDistribution.Should().ContainSingle(point => point.Name == "<50%" && point.Value == 1);
        superadminDashboard.ScoreDistribution.Should().ContainSingle(point => point.Name == "85-100%" && point.Value == 3);
        studentDashboard!.TotalExamsTaken.Should().Be(2);
        studentDashboard.AverageScore.Should().Be(100);
        studentDashboard.GradeId.Should().Be(1);
        studentDashboard.ClassId.Should().Be(11);
        studentDashboard.RecentExams.Should().HaveCount(2);
        studentDashboard.RecentExams.Should().OnlyContain(exam =>
            exam.GradeId == 1 && exam.SubjectId == 5 && exam.ClassIds.Order().SequenceEqual(new long[] { 11, 12 }));
        studentDashboard.LatestExamLeaderboard!.TopStudents.Select(entry => entry.StudentId)
            .Should().BeEquivalentTo(new long[] { 201 });
        studentDashboardWithTamperedScope!.GradeId.Should().Be(1);
        studentDashboardWithTamperedScope.ClassId.Should().Be(11);
        studentDashboardWithTamperedScope.RecentExams.Select(exam => exam.ExamId).Should().BeEquivalentTo(new long[] { 801, 802 });
    }

    private static StudentExamAnswer CreateAnswer(long id, long accountId, long examId, bool correct) => new()
    {
        Id = id,
        AccountId = accountId,
        ExamDetailsId = examId,
        QuestionBankId = 701,
        ChoosedAnswer = correct ? "A" : "B",
        Score = correct
    };

    private static ElsewedySchoolSysDbDevContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ElsewedySchoolSysDbDevContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ElsewedySchoolSysDbDevContext(options);
    }

    private static Account CreateAccount(long id, string email, long roleId) => new()
    {
        Id = id,
        Email = email,
        NationalId = $"NID-{id}",
        PasswordHash = "not-used",
        RoleId = roleId,
        StatusId = 1,
        FullNameEn = email,
        FullNameAr = email,
        IsActive = true
    };

    private static StudentExtension CreateExtension(long accountId, long classId) => new()
    {
        AccountId = accountId,
        ClassId = classId,
        StatusId = 1,
        IsLeader = false
    };
}
