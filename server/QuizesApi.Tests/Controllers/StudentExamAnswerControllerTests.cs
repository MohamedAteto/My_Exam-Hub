using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using QuizesApi.Controllers;
using QuizesApi.Models;

namespace QuizesApi.Tests.Controllers;

public class StudentExamAnswerControllerTests
{
    [Fact]
    public async Task GetStudentExamAnswers_ForAnotherStudent_ReturnsForbidden()
    {
        await using var context = CreateContext();
        var controller = CreateController(context, 100);

        var result = await controller.GetStudentExamAnswers(200, 1);

        result.Should().BeOfType<ForbidResult>();
    }

    [Fact]
    public async Task SubmitAnswers_OnlyAwardsTheConfiguredOption()
    {
        await using var context = CreateContext();
        context.Roles.Add(new Role { Id = 1, RoleName = "Student", BusinessEntity = "Exams" });
        context.Statuses.Add(new Status { Id = 1, StatusName = "Active", BusinessEntity = "Exams" });
        context.Accounts.Add(new Account
        {
            Id = 100,
            NationalId = "TEST-100",
            Email = "student@example.com",
            PasswordHash = "not-used",
            RoleId = 1,
            StatusId = 1,
            FullNameEn = "Test Student",
            FullNameAr = "Test Student",
            IsActive = true
        });
        context.ExamDetails.Add(new ExamDetail { ExamId = 1, Title = "Test Exam" });
        context.QuestionBanks.Add(new QuestionBank
        {
            QuestionId = 10,
            QuestionTitle = "Choose the correct answer",
            OptionA = "Correct",
            OptionB = "Wrong",
            OptionC = "Also wrong",
            OptionD = "Still wrong",
            CorrectAnswer = "A",
            Mark = 1
        });
        context.ExamQuestionBanks.Add(new ExamQuestionBank { Id = 1, ExamId = 1, QuestionId = 10 });
        await context.SaveChangesAsync();

        var controller = CreateController(context, 100);
        var result = await controller.SubmitStudentAnswers(new StudentAnswerSubmitDto
        {
            ExamId = 1,
            AccountId = 100,
            Answers = new List<AnswerDto>
            {
                new() { QuestionId = 10, Answer = "Wrong" }
            }
        });

        result.Should().BeOfType<OkObjectResult>();
        var savedAnswer = await context.StudentExamAnswers.SingleAsync();
        savedAnswer.Score.Should().BeFalse();
    }

    private static ElsewedySchoolSysDbDevContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ElsewedySchoolSysDbDevContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new ElsewedySchoolSysDbDevContext(options);
    }

    private static StudentExamAnswerController CreateController(ElsewedySchoolSysDbDevContext context, long accountId)
    {
        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.NameIdentifier, accountId.ToString()),
                new Claim(ClaimTypes.Role, "Student")
            },
            "test",
            ClaimTypes.Name,
            ClaimTypes.Role);
        return new StudentExamAnswerController(context, NullLogger<StudentExamAnswerController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }
}
