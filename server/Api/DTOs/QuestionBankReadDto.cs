public class QuestionBankReadDto
{
    public long AccountId { get; set; }
    public string? BankKey { get; set; }
    public string BankTitle { get; set; }
    public string? BankDescription { get; set; }
    public string? Grade { get; set; }
    public long QuestionId { get; set; }
    public string QuestionTitle { get; set; }
    public string OptionA { get; set; }
    public string OptionB { get; set; }
    public string OptionC { get; set; }
    public string OptionD { get; set; }
    public string CorrectAnswer { get; set; }
    public string QuestionSubject { get; set; }
    public decimal Mark { get; set; }
}