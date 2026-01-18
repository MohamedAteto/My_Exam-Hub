using System.ComponentModel.DataAnnotations.Schema;

namespace QuizesApi.Models;

public partial class ExamDetail
{
    [NotMapped]
    public virtual ICollection<ExamQuestionBank> ExamQuestionBanks { get; set; } = new List<ExamQuestionBank>();

    // ExamClasses now properly mapped to Exam_Class junction table
    public virtual ICollection<ExamClass> ExamClasses { get; set; } = new List<ExamClass>(); 
}

// Defining ExamClass if it is missing, just to satisfy compilation of legacy code before I remove it,
// OR ideally I should remove the legacy code.
// But ExamDetailController uses ExamClasses heavily. 
// I will define a DUMMY ExamClass class if it's missing, but better to Refactor Controller to NOT use it.
// However, adding it here as a property allows compilation of the Controller's "references" until I fix the Controller.
