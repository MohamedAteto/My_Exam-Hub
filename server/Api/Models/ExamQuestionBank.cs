using System;
using System.Collections.Generic;

namespace QuizesApi.Models;

public partial class ExamQuestionBank
{
    public int Id { get; set; }

    public long? ExamId { get; set; }
    public ExamDetail? Exam { get; set; }
    public long? QuestionId { get; set; }

    public QuestionBank? Question { get; set; }
}
