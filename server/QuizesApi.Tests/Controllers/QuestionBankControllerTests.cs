using Xunit;
using Moq;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using QuizesApi.Controllers;
using QuizesApi.Data;
using QuizesApi.Models;
using System.Threading.Tasks;
using System.IO;
using Microsoft.EntityFrameworkCore;

namespace QuizesApi.Tests.Controllers;

public class QuestionBankControllerTests
{
    private readonly DbContextOptions<AppDbContext> _dbOptions;

    public QuestionBankControllerTests()
    {
        _dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"TestDb_{Guid.NewGuid()}")
            .Options;
    }

    private AppDbContext CreateContext()
    {
        return new AppDbContext(_dbOptions);
    }

    private Mock<IFormFile> CreateMockFile(string filename, long size, Stream content = null)
    {
        var mockFile = new Mock<IFormFile>();
        mockFile.Setup(f => f.FileName).Returns(filename);
        mockFile.Setup(f => f.Length).Returns(size);
        
        if (content != null)
        {
            mockFile.Setup(f => f.OpenReadStream()).Returns(content);
            mockFile.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Returns((Stream stream, CancellationToken token) => content.CopyToAsync(stream, token));
        }
        
        return mockFile;
    }

    [Fact]
    public async Task Upload_WithExcessiveFileSize_ReturnsBadRequest()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        // Create mock file larger than 10MB
        var mockFile = CreateMockFile("questions.xlsx", 11 * 1024 * 1024);

        // Act
        var result = await controller.Upload(mockFile.Object, 1);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequest = result as BadRequestObjectResult;
        badRequest.Value.Should().NotBeNull();
        badRequest.Value.ToString().Should().Contain("10MB");
    }

    [Fact]
    public async Task Upload_WithoutAuthentication_ReturnsUnauthorized()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        var mockFile = CreateMockFile("questions.xlsx", 1024);

        // Act - Pass invalid accountId (0 or negative)
        var result = await controller.Upload(mockFile.Object, 0);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Upload_WithNegativeAccountId_ReturnsUnauthorized()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        var mockFile = CreateMockFile("questions.xlsx", 1024);

        // Act
        var result = await controller.Upload(mockFile.Object, -1);

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Upload_WithNullFile_ReturnsBadRequest()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        // Act
        var result = await controller.Upload(null, 1);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Upload_WithInvalidExtension_ReturnsBadRequest()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        var mockFile = CreateMockFile("questions.txt", 1024);

        // Act
        var result = await controller.Upload(mockFile.Object, 1);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        var badRequest = result as BadRequestObjectResult;
        badRequest.Value.ToString().Should().Contain("xlsx");
    }

    [Fact]
    public async Task GetAll_ReturnsAllQuestions()
    {
        // Arrange
        var context = CreateContext();
        
        var questions = new List<QuestionBank>
        {
            new QuestionBank
            {
                QuestionBankId = 1,
                Question = "Question 1",
                OptionA = "A1",
                OptionB = "B1",
                OptionC = "C1",
                OptionD = "D1",
                CorrectAnswer = "A",
                CreatedBy = 1
            },
            new QuestionBank
            {
                QuestionBankId = 2,
                Question = "Question 2",
                OptionA = "A2",
                OptionB = "B2",
                OptionC = "C2",
                OptionD = "D2",
                CorrectAnswer = "B",
                CreatedBy = 1
            }
        };
        
        context.QuestionBanks.AddRange(questions);
        await context.SaveChangesAsync();

        var controller = new QuestionBankController(context);

        // Act
        var result = await controller.GetAll();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var returnedQuestions = okResult.Value as IEnumerable<QuestionBank>;
        
        returnedQuestions.Should().HaveCount(2);
        returnedQuestions.Should().Contain(q => q.Question == "Question 1");
        returnedQuestions.Should().Contain(q => q.Question == "Question 2");
    }

    [Fact]
    public async Task GetById_WithValidId_ReturnsQuestion()
    {
        // Arrange
        var context = CreateContext();
        
        var question = new QuestionBank
        {
            QuestionBankId = 1,
            Question = "Test Question",
            OptionA = "A",
            OptionB = "B",
            OptionC = "C",
            OptionD = "D",
            CorrectAnswer = "A",
            CreatedBy = 1
        };
        
        context.QuestionBanks.Add(question);
        await context.SaveChangesAsync();

        var controller = new QuestionBankController(context);

        // Act
        var result = await controller.GetById(1);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        var returnedQuestion = okResult.Value as QuestionBank;
        
        returnedQuestion.Should().NotBeNull();
        returnedQuestion.Question.Should().Be("Test Question");
    }

    [Fact]
    public async Task GetById_WithInvalidId_ReturnsNotFound()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        // Act
        var result = await controller.GetById(999);

        // Assert
        result.Should().BeOfType<NotFoundResult>();
    }

    [Fact]
    public async Task Delete_WithValidId_RemovesQuestion()
    {
        // Arrange
        var context = CreateContext();
        
        var question = new QuestionBank
        {
            QuestionBankId = 1,
            Question = "To Delete",
            CreatedBy = 1
        };
        
        context.QuestionBanks.Add(question);
        await context.SaveChangesAsync();

        var controller = new QuestionBankController(context);

        // Act
        var result = await controller.Delete(1);

        // Assert
        result.Should().BeOfType<NoContentResult>();
        
        var deletedQuestion = await context.QuestionBanks.FindAsync(1);
        deletedQuestion.Should().BeNull();
    }

    [Fact]
    public async Task GetTemplate_ReturnsExcelFile()
    {
        // Arrange
        var context = CreateContext();
        var controller = new QuestionBankController(context);

        // Act
        var result = controller.GetTemplate();

        // Assert
        result.Should().BeOfType<FileContentResult>();
        var fileResult = result as FileContentResult;
        
        fileResult.ContentType.Should().Be("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        fileResult.FileDownloadName.Should().Contain("Template");
        fileResult.FileContents.Should().NotBeEmpty();
    }
}
