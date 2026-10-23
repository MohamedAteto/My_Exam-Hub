using System;
using System.Collections.Generic;

namespace QuizesApi.Models;

public partial class StudentExamAnswer
{
    public long Id { get; set; }

    public long AccountId { get; set; }

    public long? ExamQuestionId { get; set; }
    public long? ExamDetailsId { get; set; }

    public string ChoosedAnswer { get; set; } = null!;

    public bool Score { get; set; }

    public long? QuestionBankId { get; set; }

    // FEATURE: AUTOMATIC ANSWER SAVING
    // Differentiates between in-progress draft answers and finalized exam submissions
    public bool IsSubmitted { get; set; } = true;
    public DateTime? LastSavedAt { get; set; }

    public virtual Account Account { get; set; } = null!;

    public virtual ExamDetail? ExamDetailNav { get; set; }

    public virtual QuestionBank? QuestionBank { get; set; }
}
