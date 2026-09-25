using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using QuizesApi.Models;

namespace QuizesApi.Tests.Controllers;

public class AuthControllerTests
{
    [Fact]
    public async Task Register_RejectsPrivilegedRoleForPublicRegistration()
    {
        await using var context = CreateContext();
        var controller = CreateController(context);

        var result = await controller.Register(new RegisterModel
        {
            Email = "candidate@example.com",
            Password = "ValidPass123",
            Role = "Teacher"
        });

        result.Should().BeOfType<BadRequestObjectResult>();
        (await context.Accounts.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task GetSsoToken_RejectsMalformedToken()
    {
        await using var context = CreateContext();
        var controller = CreateController(context);

        var result = await controller.GetSsoToken(new SsoTokenModel
        {
            Email = "person@example.com",
            SsoToken = "not-a-jwt"
        });

        result.Should().BeOfType<UnauthorizedObjectResult>();
    }

    private static ElsewedySchoolSysDbDevContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ElsewedySchoolSysDbDevContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ElsewedySchoolSysDbDevContext(options);
    }

    private static AuthController CreateController(ElsewedySchoolSysDbDevContext context)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = "test-signing-key-with-at-least-thirty-two-characters",
                ["Jwt:Issuer"] = "CAS.Api",
                ["Jwt:Audience"] = "CAS.Clients"
            })
            .Build();
        return new AuthController(context, configuration, NullLogger<AuthController>.Instance);
    }
}
