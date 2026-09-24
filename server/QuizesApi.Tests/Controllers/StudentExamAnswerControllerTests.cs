using Xunit;
using Moq;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using QuizesApi.Controllers;
using QuizesApi.Data;
using QuizesApi.Models;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;

namespace QuizesApi.Tests.Controllers;

public class StudentExamAnswerControllerTests
{
    private readonly DbContextOptions<AppDbContext> _dbOptions;

    public StudentExamAnswerControllerTests()
    {
        _dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"TestDb_{Guid.NewGuid()}")
            .Options;
    }

    private AppDbContext CreateContext()
    {
        return new AppDbContext(_dbOptions);
    }

    [Fact]
    public async Task SubmitAnswers_WithValidData_SavesAnswers()
    {
        // Arrange
        var context = CreateContext();
        
        var exam = new ExamDetail
        {
            ExamId = 1,
            ExamName = "Test Exam",
            ClassId = "101"
        };
        context.ExamDetails.Add(exam);

        var questions = new List<QuestionBank>
        {
            new QuestionBank { QuestionBankId = 1, Question = "Q1", CorrectAnswer = "A" },
            new QuestionBank { QuestionBankId = 2, Question = "Q2", CorrectAnswer = "B" }
        };
        context.QuestionBanks.AddRange(questions);

        context.ExamQuestionBanks.AddRange(new List<ExamQuestionBank>
        {
            new ExamQuestionBank { ExamId = 1, QuestionBankId = 1 },
            new ExamQuestionBank { ExamId = 1, QuestionBankId = 2 }
        });

        await context.SaveChangesAsync();

        var controller = new StudentExamAnswerController(context);

        var submission = new
        {
            StudentId = 100,
            ExamId = 1,
            Answers = new[]
            {
                new { QuestionBankId = 1, StudentAnswer = "A" },
                new { QuestionBankId = 2, StudentAnswer = "B" }
            }
        };

        // Act
        var result = await controller.SubmitAnswers(submission.StudentId, submission.ExamId, submission.Answers);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        
        var savedAnswers = await context.StudentExamAnswers
            .Where(a => a.StudentId == 100 && a.ExamId == 1)
            .ToListAsync();
        
        savedAnswers.Should().HaveCount(2);
        savedAnswers.Should().Contain(a => a.QuestionBankId == 1 && a.StudentAnswer == "A");
        savedAnswers.Should().Contain(a => a.QuestionBankId == 2 && a.StudentAnswer == "B");
    }

    [Fact]
    public async Task SubmitAnswers_WithNormalizedAnswers_MatchesCorrectly()
    {
        // Arrange
        var context = CreateContext();
        
        var exam = new ExamDetail { ExamId = 1, ExamName = "Test", ClassId = "101" };
        context.ExamDetails.Add(exam);

        var question = new QuestionBank
        {
            QuestionBankId = 1,
            Question = "Test Question",
            CorrectAnswer = "answer a" // Lowercase with spaces
        };
        context.QuestionBanks.Add(question);

        context.ExamQuestionBanks.Add(new ExamQuestionBank { ExamId = 1, QuestionBankId = 1 });

        await context.SaveChangesAsync();

        var controller = new StudentExamAnswerController(context);

        var submission = new
        {
            StudentId = 100,
            ExamId = 1,
            Answers = new[]
            {
                new { QuestionBankId = 1, StudentAnswer = "  ANSWER A  " } // Different case, extra spaces
            }
        };

        // Act
        var result = await controller.SubmitAnswers(submission.StudentId, submission.ExamId, submission.Answers);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        
        var answer = await context.StudentExamAnswers
            .FirstAsync(a => a.StudentId == 100 && a.QuestionBankId == 1);
        
        answer.IsCorrect.Should().BeTrue("normalized answers should match");
    }

    [Fact]
    public async Task SubmitAnswers_TransactionRollback_OnError()
    {
        // Arrange
        var context = CreateContext();
        
        var exam = new ExamDetail { ExamId = 1, ExamName = "Test", ClassId = "101" };
        context.ExamDetails.Add(exam);
        await context.SaveChangesAsync();

        var controller = new StudentExamAnswerController(context);

        // Submit answers for non-existent questions (should fail FK constraint)
        var submission = new
        {
            StudentId = 100,
            ExamId = 1,
            Answers = new[]
            {
                new { QuestionBankId = 999, StudentAnswer = "A" } // Non-existent question
            }
        };

        // Act & Assert
        try
        {
            await controller.SubmitAnswers(submission.StudentId, submission.ExamId, submission.Answers);
        }
        catch
        {
            // Expected to fail
        }

        // Verify no partial data was saved
        var savedAnswers = await context.StudentExamAnswers
            .Where(a => a.StudentId == 100 && a.ExamId == 1)
            .ToListAsync();
        
        savedAnswers.Should().BeEmpty("transaction should have rolled back");
    }

    [Fact]
    public async Task SubmitAnswers_WithEmptyAnswers_ReturnsSuccess()
    {
        // Arrange
        var context = CreateContext();
        
        var exam = new ExamDetail { ExamId = 1, ExamName = "Test", ClassId = "101" };
        context.ExamDetails.Add(exam);
        await context.SaveChangesAsync();

        var controller = new StudentExamAnswerController(context);

        var submission = new
        {
            StudentId = 100,
            ExamId = 1,
            Answers = Array.Empty<object>()
        };

        // Act
        var result = await controller.SubmitAnswers(submission.StudentId, submission.ExamId, submission.Answers);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    public async Task GetStudentAnswers_ReturnsCorrectAnswers()
    {
        // Arrange
        var context = CreateContext();
        
        var answers = new List<StudentExamAnswer>
        {
            new StudentExamAnswer
            {
                StudentId = 100,
                ExamId = 1,
                QuestionBankId = 1,
                StudentAnswer = "A",
                IsCorrect = true,
                SubmittedAt = DateTime.UtcNow
            },
            new StudentExamAnswer
            {
                StudentId = 100,
                ExamId = 1,
                QuestionBankId = 2,
                StudentAnswer = "B",
                IsCorrect = false,
                SubmittedAt = DateTime.UtcNow
            }
        };
        context.StudentExamAnswers.AddRange(answers);
        await context.SaveChangesAsync();

        var controller = new StudentExamAnswerController(context);

        // Act
        var result = await controller.GetStudentAnswers(100, 1);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var returnedAnswers = okResult.Value as IEnumerable<StudentExamAnswer>;
        
        returnedAnswers.Should().HaveCount(2);
        returnedAnswers.Should().Contain(a => a.QuestionBankId == 1 && a.IsCorrect == true);
        returnedAnswers.Should().Contain(a => a.QuestionBankId == 2 && a.IsCorrect == false);
    }

    [Fact]
    public async Task CalculateScore_ReturnsCorrectScore()
    {
        // Arrange
        var context = CreateContext();
        
        var answers = new List<StudentExamAnswer>
        {
            new StudentExamAnswer { StudentId = 100, ExamId = 1, QuestionBankId = 1, IsCorrect = true },
            new StudentExamAnswer { StudentId = 100, ExamId = 1, QuestionBankId = 2, IsCorrect = true },
            new StudentExamAnswer { StudentId = 100, ExamId = 1, QuestionBankId = 3, IsCorrect = false },
            new StudentExamAnswer { StudentId = 100, ExamId = 1, QuestionBankId = 4, IsCorrect = false }
        };
        context.StudentExamAnswers.AddRange(answers);
        await context.SaveChangesAsync();

        var controller = new StudentExamAnswerController(context);

        // Act
        var result = await controller.CalculateScore(100, 1);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var score = okResult.Value.GetType().GetProperty("score")?.GetValue(okResult.Value);
        
        score.Should().NotBeNull();
        // 2 correct out of 4 = 50%
        ((double)score).Should().Be(50.0);
    }
}
