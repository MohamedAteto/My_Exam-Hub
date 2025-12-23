using System;
using System.Collections.Generic;

namespace QuizesApi.Models;

public partial class StudentExamAnswer
{
    public long Id { get; set; }

    public long AccountId { get; set; }

    public long ExamId { get; set; }

    public long QuestionId { get; set; }

    public string ChoosedAnswer { get; set; } = null!;

    public bool Score { get; set; }

    public virtual Account Account { get; set; } = null!;

    // Note: ExamId should reference ExamDetail, but the FK constraint points to ExamQuestion
    // We'll keep the navigation property but won't use it in the context configuration
    // public virtual ExamQuestion Exam { get; set; } = null!;

    public virtual QuestionBank Question { get; set; } = null!;
}
