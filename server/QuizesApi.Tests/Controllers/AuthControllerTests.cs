using Xunit;
using Moq;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using QuizesApi.Controllers;
using QuizesApi.Data;
using QuizesApi.Models;
using System.Threading.Tasks;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using BCrypt.Net;

namespace QuizesApi.Tests.Controllers;

public class AuthControllerTests
{
    private readonly Mock<IConfiguration> _mockConfig;
    private readonly DbContextOptions<AppDbContext> _dbOptions;

    public AuthControllerTests()
    {
        _mockConfig = new Mock<IConfiguration>();
        _dbOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: $"TestDb_{Guid.NewGuid()}")
            .Options;
    }

    private AppDbContext CreateContext()
    {
        return new AppDbContext(_dbOptions);
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsToken()
    {
        // Arrange
        var context = CreateContext();
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword("password123");
        
        context.Accounts.Add(new Account
        {
            AccountId = 1,
            Username = "testuser",
            Password = hashedPassword,
            Role = "student"
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Login(new LoginModel
        {
            Username = "testuser",
            Password = "password123"
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult.Value.Should().NotBeNull();
        
        // Extract token from anonymous object
        var token = okResult.Value.GetType().GetProperty("token")?.GetValue(okResult.Value);
        token.Should().NotBeNull();
        token.Should().BeOfType<string>();
    }

    [Fact]
    public async Task Login_WithInvalidUsername_ReturnsUnauthorized()
    {
        // Arrange
        var context = CreateContext();
        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Login(new LoginModel
        {
            Username = "nonexistent",
            Password = "password123"
        });

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Login_WithInvalidPassword_ReturnsUnauthorized()
    {
        // Arrange
        var context = CreateContext();
        var hashedPassword = BCrypt.Net.BCrypt.HashPassword("correctpassword");
        
        context.Accounts.Add(new Account
        {
            AccountId = 1,
            Username = "testuser",
            Password = hashedPassword,
            Role = "student"
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Login(new LoginModel
        {
            Username = "testuser",
            Password = "wrongpassword"
        });

        // Assert
        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    [Fact]
    public async Task Login_WithPlaintextPassword_MigratesAndLogsIn()
    {
        // Arrange
        var context = CreateContext();
        
        // Mock configuration to allow plaintext fallback
        var configSection = new Mock<IConfigurationSection>();
        configSection.Setup(x => x.Value).Returns("true");
        _mockConfig.Setup(x => x.GetSection("Authentication:AllowPlaintextFallback")).Returns(configSection.Object);
        
        context.Accounts.Add(new Account
        {
            AccountId = 1,
            Username = "legacyuser",
            Password = "plaintext123", // Plain text password
            Role = "student"
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Login(new LoginModel
        {
            Username = "legacyuser",
            Password = "plaintext123"
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        
        // Verify password was migrated to BCrypt
        var account = await context.Accounts.FirstAsync(a => a.Username == "legacyuser");
        BCrypt.Net.BCrypt.Verify("plaintext123", account.Password).Should().BeTrue();
    }

    [Fact]
    public async Task Login_WithNullCredentials_ReturnsBadRequest()
    {
        // Arrange
        var context = CreateContext();
        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Login(null);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Login_WithEmptyUsername_ReturnsBadRequest()
    {
        // Arrange
        var context = CreateContext();
        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Login(new LoginModel
        {
            Username = "",
            Password = "password123"
        });

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Register_WithValidData_CreatesAccount()
    {
        // Arrange
        var context = CreateContext();
        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Register(new RegisterModel
        {
            Username = "newuser",
            Password = "password123",
            Email = "newuser@example.com",
            Role = "student"
        });

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        
        var account = await context.Accounts.FirstOrDefaultAsync(a => a.Username == "newuser");
        account.Should().NotBeNull();
        account.Email.Should().Be("newuser@example.com");
        
        // Verify password is hashed
        BCrypt.Net.BCrypt.Verify("password123", account.Password).Should().BeTrue();
    }

    [Fact]
    public async Task Register_WithDuplicateUsername_ReturnsConflict()
    {
        // Arrange
        var context = CreateContext();
        context.Accounts.Add(new Account
        {
            AccountId = 1,
            Username = "existinguser",
            Password = BCrypt.Net.BCrypt.HashPassword("password"),
            Role = "student"
        });
        await context.SaveChangesAsync();

        var controller = new AuthController(context, _mockConfig.Object);

        // Act
        var result = await controller.Register(new RegisterModel
        {
            Username = "existinguser",
            Password = "newpassword",
            Role = "student"
        });

        // Assert
        result.Should().BeOfType<ConflictObjectResult>();
    }
}
