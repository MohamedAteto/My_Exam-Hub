public class ExamReadDto
{
    public long ExamId { get; set; }
    public string Title { get; set; }
    public string ExamSubject { get; set; }
    public string ExamDescription { get; set; }
    public string Grade { get; set; }
    public string Class { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public List<QuestionBankReadDto> Questions { get; set; } = new();
}