using QuizesApi.DTOs;
using QuizesApi.DTOs.Student;

namespace QuizesApi.Services;

/// <summary>
/// Business-logic contract for student exam operations.
/// The controller is responsible for HTTP concerns (routing, auth attributes,
/// HTTP status codes).  This service is responsible for data access,
/// business rules, grading, and answer validation.
/// </summary>
public interface IStudentExamService
{
    /// <summary>
    /// Returns all completed exam results for a student,
    /// including per-question answers and scores.
    /// </summary>
    Task<object> GetStudentExamsAsync(long accountId);

    /// <summary>
    /// Returns a single exam's questions with the student's submitted answers
    /// and correct answers — used for the post-submission review view.
    /// </summary>
    Task<object?> GetStudentExamAnswersAsync(long accountId, long examId);

    /// <summary>
    /// Returns the questions for an active exam in a student-safe form
    /// (no CorrectAnswer, IsCorrect, Score, or grading data).
    /// Enforces class-assignment and blocks re-access after submission.
    /// </summary>
    Task<(ExamForStudentDto? Dto, string? ErrorMessage, int StatusCode)>
        GetExamQuestionsForStudentAsync(long accountId, long examId, bool isStaff);

    /// <summary>
    /// Grades and persists a student's submitted answers.
    /// Returns the exam ID, total marks, earned marks, and score percentage.
    /// Throws InvalidOperationException for business-rule violations
    /// (double submission, invalid question IDs, etc.).
    /// </summary>
    Task<SubmitExamResultDto> SubmitStudentAnswersAsync(long accountId, StudentAnswerSubmitDto dto);
}

/// <summary>Result returned by SubmitStudentAnswersAsync.</summary>
public record SubmitExamResultDto(
    long ExamId,
    decimal TotalMarks,
    decimal EarnedMarks,
    double Score);
