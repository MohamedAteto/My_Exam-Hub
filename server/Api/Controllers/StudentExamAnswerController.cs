using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizesApi.DTOs;
using QuizesApi.DTOs.Student;
using QuizesApi.Helpers;
using QuizesApi.Services;

namespace QuizesApi.Controllers;

/// <summary>
/// Handles HTTP concerns for student exam answer operations.
/// All business logic, data access, and grading are delegated to
/// IStudentExamService.  This controller is responsible only for:
///   - Routing and HTTP method binding
///   - Authentication and role-based authorization
///   - Identity extraction and ownership checks
///   - Translating service results/exceptions into HTTP responses
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize] // All endpoints require a valid JWT token
public class StudentExamAnswerController : ControllerBase
{
    private readonly IStudentExamService _examService;

    public StudentExamAnswerController(IStudentExamService examService)
    {
        _examService = examService;
    }

    // -------------------------------------------------------------------------
    // GET /api/studentexamanswer/student/{accountId}/exams
    // -------------------------------------------------------------------------
    /// <summary>
    /// Returns all completed exam results for a student.
    /// Students may only request their own data.
    /// Teachers, Admins, Board, and Superadmins may request any student's data.
    /// </summary>
    [HttpGet("student/{accountId}/exams")]
    public async Task<ActionResult> GetStudentExams(long accountId)
    {
        var (requesterId, roles) = ClaimsHelper.GetRequesterInfo(User);

        if (requesterId <= 0)
            return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

        if (!ClaimsHelper.IsStaff(roles) && requesterId != accountId)
            return StatusCode(403, new { message = "You are not authorised to view another student's exam results." });

        var result = await _examService.GetStudentExamsAsync(accountId);
        return Ok(result);
    }

    // -------------------------------------------------------------------------
    // GET /api/studentexamanswer/student/{accountId}/exam/{examId}
    // -------------------------------------------------------------------------
    /// <summary>
    /// Returns a single exam's questions with the student's submitted answers
    /// and correct answers — used for the post-submission review view.
    /// Students may only request their own data.
    /// </summary>
    [HttpGet("student/{accountId}/exam/{examId}")]
    public async Task<ActionResult> GetStudentExamAnswers(long accountId, long examId)
    {
        var (requesterId, roles) = ClaimsHelper.GetRequesterInfo(User);

        if (requesterId <= 0)
            return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

        if (!ClaimsHelper.IsStaff(roles) && requesterId != accountId)
            return StatusCode(403, new { message = "You are not authorised to view another student's exam answers." });

        var result = await _examService.GetStudentExamAnswersAsync(accountId, examId);

        if (result == null)
            return NotFound(new { message = "Exam not found." });

        return Ok(result);
    }

    // -------------------------------------------------------------------------
    // GET /api/studentexamanswer/student/{accountId}/exam/{examId}/questions
    // -------------------------------------------------------------------------
    /// <summary>
    /// Returns exam questions for active exam-taking.
    /// The response NEVER contains CorrectAnswer, IsCorrect, Score, or grading data.
    /// Students may only request their own exam session.
    /// Staff bypass ownership and submission-state checks.
    /// </summary>
    [HttpGet("student/{accountId}/exam/{examId}/questions")]
    public async Task<ActionResult<ExamForStudentDto>> GetExamQuestionsForStudent(
        long accountId, long examId)
    {
        var (requesterId, roles) = ClaimsHelper.GetRequesterInfo(User);

        if (requesterId <= 0)
            return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

        bool isStaff = ClaimsHelper.IsStaff(roles);

        if (!isStaff && requesterId != accountId)
            return StatusCode(403, new { message = "You are not authorised to access another student's exam." });

        var (dto, errorMessage, statusCode) =
            await _examService.GetExamQuestionsForStudentAsync(accountId, examId, isStaff);

        if (dto == null)
            return StatusCode(statusCode, new { message = errorMessage });

        return Ok(dto);
    }

    // -------------------------------------------------------------------------
    // POST /api/studentexamanswer/submit
    // -------------------------------------------------------------------------
    /// <summary>
    /// Submits a student's answers for grading.
    /// Identity is derived exclusively from the JWT token — the AccountId in the
    /// request body is accepted for API compatibility but is never used for auth.
    /// </summary>
    [HttpPost("submit")]
    [Authorize(Roles = "Student")] // Only Students can submit exam answers
    public async Task<ActionResult> SubmitStudentAnswers([FromBody] StudentAnswerSubmitDto dto)
    {
        if (dto == null)
            return BadRequest(new { message = "Request body is required." });

        var (accountId, _) = ClaimsHelper.GetRequesterInfo(User);

        if (accountId <= 0)
            return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

        if (dto.ExamId <= 0)
            return BadRequest(new { message = "Invalid exam ID." });

        try
        {
            var result = await _examService.SubmitStudentAnswersAsync(accountId, dto);

            return Ok(new
            {
                message      = "Answers submitted successfully.",
                examId       = result.ExamId,
                totalMarks   = result.TotalMarks,
                earnedMarks  = result.EarnedMarks,
                score        = result.Score
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                message = "An error occurred while saving your answers. Please try again.",
                details = ex.InnerException?.Message ?? ex.Message
            });
        }
    }
}
