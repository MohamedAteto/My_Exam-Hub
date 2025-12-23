using System;
using System.Collections.Generic;

namespace QuizesApi.Models;

public partial class Subject
{
    public long Id { get; set; }

    public string SubjectName { get; set; } = null!;

    public string? Description { get; set; }

    public long StatusId { get; set; }

    public virtual Status Status { get; set; } = null!;

    public virtual ICollection<ExamDetail> ExamDetails { get; set; } = new List<ExamDetail>();
}



