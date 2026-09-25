using FluentAssertions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using QuizesApi.Controllers;
using QuizesApi.Models;

namespace QuizesApi.Tests.Controllers;

public class QuestionBankControllerTests
{
    [Fact]
    public void Controller_RestrictsQuestionBankManagementToStaffRoles()
    {
        var authorization = typeof(QuestionBankController)
            .GetCustomAttributes(typeof(AuthorizeAttribute), true)
            .Cast<AuthorizeAttribute>()
            .Single();

        authorization.Roles.Should().Be("Teacher,Admin,Superadmin,Board");
    }

    [Fact]
    public async Task Upload_RejectsFilesOverTenMegabytes()
    {
        var repository = new Mock<IQuestionBankRepo>();
        var controller = new QuestionBankController(repository.Object, NullLogger<QuestionBankController>.Instance);
        var file = new Mock<IFormFile>();
        file.SetupGet(upload => upload.Length).Returns(11 * 1024 * 1024);

        var result = await controller.Upload(file.Object, null, null);

        result.Result.Should().BeOfType<BadRequestObjectResult>();
        repository.Verify(repo => repo.AddAsync(It.IsAny<QuestionBank>()), Times.Never);
    }
}
