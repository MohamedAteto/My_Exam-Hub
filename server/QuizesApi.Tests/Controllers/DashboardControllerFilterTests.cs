using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using QuizesApi.Controllers;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;

namespace QuizesApi.Tests.Controllers;

public class DashboardControllerFilterTests
{
    [Fact]
    public void StudentsReportEndpoint_RequiresStaffRole()
    {
        var action = typeof(DashboardController).GetMethod(nameof(DashboardController.GetStudents));
        var authorization = action!.GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single();

        authorization.Roles.Should().Be("Teacher,Admin,Superadmin,Board");
    }

    [Fact]
    public async Task TeacherDashboard_ForwardsSubjectAndDateFilters()
    {
        var repository = new Mock<IDashboardRepo>();
        repository.Setup(repo => repo.GetTeacherDashboardAsync(7863, It.IsAny<LeaderboardFilterDto>()))
            .ReturnsAsync(new TeacherDashboardDto { TeacherId = 7863 });
        var controller = CreateController(repository.Object, 7863, "Teacher");
        var start = new DateTime(2026, 9, 1, 9, 0, 0, DateTimeKind.Utc);
        var end = new DateTime(2026, 9, 30, 17, 30, 0, DateTimeKind.Utc);

        await controller.GetTeacherDashboard(7863, gradeId: 1, classId: 11, subjectId: 7, examId: 45, startDate: start, endDate: end);

        repository.Verify(repo => repo.GetTeacherDashboardAsync(7863, It.Is<LeaderboardFilterDto>(filters =>
            filters.GradeId == 1 && filters.ClassId == 11 && filters.SubjectId == 7 && filters.ExamId == 45 &&
            filters.StartDate == start && filters.EndDate == end)), Times.Once);
    }

    [Fact]
    public async Task ExamLeaderboard_ForwardsSubjectAndGroupingFilters()
    {
        var repository = new Mock<IDashboardRepo>();
        repository.Setup(repo => repo.GetLeaderboardAsync(45, It.IsAny<LeaderboardFilterDto>()))
            .ReturnsAsync(new LeaderboardDto { ExamId = 45 });
        var controller = CreateController(repository.Object, 7863, "Teacher");

        await controller.GetLeaderboard(45, gradeId: 1, classId: 11, subjectId: 7, groupBy: "Class");

        repository.Verify(repo => repo.GetLeaderboardAsync(45, It.Is<LeaderboardFilterDto>(filters =>
            filters.GradeId == 1 && filters.ClassId == 11 && filters.SubjectId == 7 && filters.GroupBy == "Class")), Times.Once);
    }

    [Fact]
    public async Task CombinedLeaderboard_RejectsAnInvertedDateRange()
    {
        var repository = new Mock<IDashboardRepo>();
        var controller = CreateController(repository.Object, 7863, "Teacher");

        var result = await controller.GetCombinedLeaderboard(
            startDate: new DateTime(2026, 9, 2),
            endDate: new DateTime(2026, 9, 1));

        result.Result.Should().BeOfType<BadRequestObjectResult>();
        repository.Verify(repo => repo.GetCombinedLeaderboardAsync(It.IsAny<LeaderboardFilterDto>()), Times.Never);
    }

    private static DashboardController CreateController(IDashboardRepo repository, long accountId, string role)
    {
        var options = new DbContextOptionsBuilder<ElsewedySchoolSysDbDevContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var context = new ElsewedySchoolSysDbDevContext(options);
        var controller = new DashboardController(repository, context, NullLogger<DashboardController>.Instance);
        var identity = new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, accountId.ToString()),
            new Claim(ClaimTypes.Role, role)
        }, "Test");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
        };
        return controller;
    }
}