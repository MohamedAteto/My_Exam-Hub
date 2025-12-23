using System;
using System.Collections.Generic;

namespace QuizesApi.Models;

public partial class Session
{
    public long Id { get; set; }

    public int? SessionNo { get; set; }

    public DateOnly? FromDate { get; set; }

    public DateOnly? ToDate { get; set; }

    public long StatusId { get; set; }

    public string? Note { get; set; }

    public virtual Status Status { get; set; } = null!;

    public virtual ICollection<SubordinateTicket> SubordinateTickets { get; set; } = new List<SubordinateTicket>();
}
