using System.Collections.Generic;

namespace QuizesApi.DTOs
{
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
        public long? GradeId { get; set; }
        public long? ClassId { get; set; }
        public List<long> ClassIds { get; set; } = new();
        public List<string> ClassNames { get; set; } = new();

        public List<QuestionBankReadDto> Questions { get; set; } = new();
        public decimal TotalMarks { get; set; }
    }
}