namespace QuizesApi.DTOs.Student;

/// <summary>
/// Request body for POST /api/studentexamanswer/submit.
/// </summary>
public class StudentAnswerSubmitDto
{
    public long ExamId { get; set; }

    /// <summary>
    /// Kept for API compatibility with the existing frontend.
    /// This value is NEVER used for authorization — the server always derives
    /// the student's identity from the JWT token.
    /// </summary>
    public long AccountId { get; set; }

    public List<AnswerDto> Answers { get; set; } = new();
}

/// <summary>
/// A single question-answer pair inside a submission request.
/// </summary>
public class AnswerDto
{
    public long QuestionId { get; set; }
    public object Answer { get; set; } = null!;
}
