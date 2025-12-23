namespace QuizesApi.Models;

public class ExamClass
{
    public long ExamId { get; set; }
    public long ClassId { get; set; }

    // Navigation properties
    public ExamDetail Exam { get; set; } = null!;
    public TblClass Class { get; set; } = null!;
}

