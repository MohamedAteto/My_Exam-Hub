namespace QuizesApi.DTOs
{
    /// <summary>
    /// Safe exam-taking response sent to students BEFORE they submit.
    ///
    /// Security contract: this DTO must NEVER contain CorrectAnswer, IsCorrect,
    /// Score, UserAnswer, EarnedMarks, or any other field that reveals or implies
    /// which answer is correct.  If a new field is added here, review whether it
    /// could leak grading information before committing.
    /// </summary>
    public class ExamForStudentDto
    {
        public long ExamId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? SubjectName { get; set; }
        public string? ExamDescription { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal TotalMarks { get; set; }
        public List<QuestionForStudentDto> Questions { get; set; } = new();
    }

    /// <summary>
    /// A single question included in a student's exam-taking session.
    ///
    /// Security contract: CorrectAnswer is intentionally absent.
    /// Do not add it here — grading happens entirely on the server.
    /// </summary>
    public class QuestionForStudentDto
    {
        public long QuestionId { get; set; }
        public string? QuestionTitle { get; set; }

        // Answer options — only the options used by this question are populated.
        // Unused option slots are null so the frontend knows how many choices to render.
        public string? OptionA { get; set; }
        public string? OptionB { get; set; }
        public string? OptionC { get; set; }
        public string? OptionD { get; set; }
        public string? OptionE { get; set; }
        public string? OptionF { get; set; }
        public string? OptionG { get; set; }
        public string? OptionH { get; set; }

        /// <summary>
        /// Number of options actually used by this question (2 = True/False, 4 = standard MCQ,
        /// 0 = fill-in-the-blank).  Allows the UI to render the correct input type.
        /// </summary>
        public int UsedOptions { get; set; }

        /// <summary>
        /// Marks awarded for a correct answer.  Needed so the UI can show point values
        /// per question.  Does not reveal the correct answer.
        /// </summary>
        public decimal Mark { get; set; }
    }
}
