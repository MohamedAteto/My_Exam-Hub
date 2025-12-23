using System;
using System.Collections.Generic;

namespace QuizesApi.Models;

public partial class AbsenceRecord
{
    public long Id { get; set; }

    public long StudentId { get; set; }

    public string StudentName { get; set; } = null!;

    public DateTime Date { get; set; }

    public int Session { get; set; }

    public long ClassId { get; set; }

    public virtual TblClass Class { get; set; } = null!;

    public virtual Account Student { get; set; } = null!;
}
