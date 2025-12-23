using QuizesApi.Models;

public class ExamDetail
{
    public long ExamId { get; set; }

    public required string Title { get; set; }
    public long? SubjectId { get; set; }
    public required string ExamDescription { get; set; }
    public long? GradeId { get; set; }
    public long? ClassId { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public long CreatedBy_AccID { get; set; }

    // Navigation properties
    public Subject? Subject { get; set; }
    public Grade? Grade { get; set; }
    public TblClass? Class { get; set; } // Keep for backward compatibility
    public Account Creator { get; set; } = null!;

    public ICollection<ExamQuestionBank> ExamQuestionBanks { get; set; } = new List<ExamQuestionBank>();
    public ICollection<ExamClass> ExamClasses { get; set; } = new List<ExamClass>(); // Multiple classes support
}
