using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.DTOs.Student;
using QuizesApi.Models;

namespace QuizesApi.Services;

/// <summary>
/// Implements all student exam business logic:
///   - Loading exam questions
///   - Post-submission review data
///   - Safe exam-taking data (no correct answers)
///   - Answer grading and persistence
///
/// This service must never make HTTP-specific decisions (status codes, headers).
/// It communicates results through return values and exceptions, and the controller
/// translates those into HTTP responses.
/// </summary>
public class StudentExamService : IStudentExamService
{
    private readonly ElsewedySchoolSysDbDevContext _context;

    public StudentExamService(ElsewedySchoolSysDbDevContext context)
    {
        _context = context;
    }

    // -------------------------------------------------------------------------
    // Data-loading helper
    // -------------------------------------------------------------------------

    /// <summary>
    /// Loads ExamQuestionBank links and the associated QuestionBank records
    /// for a list of exams.  Mutates each ExamDetail's ExamQuestionBanks
    /// collection in-place.
    ///
    /// Uses a single batched query per resource type rather than N+1 queries.
    /// </summary>
    private async Task PopulateExamQuestionsAsync(List<ExamDetail> exams)
    {
        var examIds = exams.Select(e => e.ExamId).ToList();
        if (!examIds.Any()) return;

        var links = await _context.ExamQuestionBanks
            .Where(eq => eq.ExamId.HasValue && examIds.Contains(eq.ExamId.Value))
            .ToListAsync();

        var qIds = links
            .Where(l => l.QuestionId.HasValue)
            .Select(l => l.QuestionId!.Value)
            .Distinct()
            .ToList();

        var questions = await _context.QuestionBanks
            .Where(q => qIds.Contains(q.QuestionId))
            .ToDictionaryAsync(q => q.QuestionId);

        foreach (var exam in exams)
        {
            var examLinks = links.Where(l => l.ExamId == exam.ExamId).ToList();
            foreach (var link in examLinks)
            {
                if (link.QuestionId.HasValue && questions.TryGetValue(link.QuestionId.Value, out var q))
                {
                    link.Question = q;
                    exam.ExamQuestionBanks.Add(link);
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // GetStudentExamsAsync
    // -------------------------------------------------------------------------

    public async Task<object> GetStudentExamsAsync(long accountId)
    {
        var studentAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == accountId)
            .ToListAsync();

        var allExams = await _context.ExamDetails.Include(e => e.Subject).ToListAsync();
        await PopulateExamQuestionsAsync(allExams);

        var examAnswers = allExams.Select(exam =>
        {
            var examQuestionIds = exam.ExamQuestionBanks
                .Where(eq => eq.QuestionId.HasValue)
                .Select(eq => eq.QuestionId!.Value)
                .ToList();

            var answers = studentAnswers
                .Where(a => a.ExamDetailsId.HasValue &&
                            a.ExamDetailsId.Value == exam.ExamId &&
                            a.QuestionBankId.HasValue &&
                            examQuestionIds.Contains(a.QuestionBankId.Value))
                .ToList();

            if (examQuestionIds.Count == 0 || answers.Count == 0 || answers.Count < examQuestionIds.Count)
                return null;

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks
                    .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)
                    ?.Question?.Mark ?? 0);

            return new
            {
                ExamId = exam.ExamId,
                Title = exam.Title,
                ExamDescription = exam.ExamDescription,
                StartDate = DateTime.SpecifyKind(exam.StartDate.GetValueOrDefault(), DateTimeKind.Utc),
                EndDate = DateTime.SpecifyKind(exam.EndDate.GetValueOrDefault(), DateTimeKind.Utc),
                TotalMarks = totalMarks,
                EarnedMarks = earnedMarks,
                Score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0,
                Answers = answers
            };
        }).Where(x => x != null).ToList();

        var result = examAnswers.Select(ea =>
        {
            var exam = allExams.First(e => e.ExamId == ea!.ExamId);
            return new
            {
                ea!.ExamId,
                ea.Title,
                SubjectName = exam.Subject?.StatusName ?? exam.ExamSubject,
                ea.ExamDescription,
                StartDate = DateTime.SpecifyKind(ea.StartDate, DateTimeKind.Utc),
                EndDate = DateTime.SpecifyKind(ea.EndDate, DateTimeKind.Utc),
                ea.TotalMarks,
                ea.EarnedMarks,
                ea.Score,
                Questions = exam.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq =>
                    {
                        var answer = ea.Answers.FirstOrDefault(a => a.QuestionBankId == eq.Question!.QuestionId);
                        return new
                        {
                            QuestionId       = eq.Question!.QuestionId,
                            QuestionTitle    = eq.Question.QuestionTitle,
                            OptionA          = eq.Question.OptionA,
                            OptionB          = eq.Question.OptionB,
                            OptionC          = eq.Question.OptionC,
                            OptionD          = eq.Question.OptionD,
                            CorrectAnswer    = eq.Question.CorrectAnswer,
                            Mark             = eq.Question.Mark ?? 0,
                            UserAnswer       = answer?.ChoosedAnswer ?? string.Empty,
                            IsCorrect        = answer?.Score ?? false
                        };
                    }).ToList()
            };
        }).ToList();

        return result;
    }

    // -------------------------------------------------------------------------
    // GetStudentExamAnswersAsync
    // -------------------------------------------------------------------------

    public async Task<object?> GetStudentExamAnswersAsync(long accountId, long examId)
    {
        var exam = await _context.ExamDetails
            .Include(e => e.Subject)
            .FirstOrDefaultAsync(e => e.ExamId == examId);

        if (exam == null) return null;

        await PopulateExamQuestionsAsync(new List<ExamDetail> { exam });

        var questionIds = exam.ExamQuestionBanks
            .Where(eq => eq.QuestionId.HasValue)
            .Select(eq => eq.QuestionId!.Value)
            .ToList();

        var answers = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == accountId &&
                          sea.ExamDetailsId == examId &&
                          sea.QuestionBankId.HasValue &&
                          questionIds.Contains(sea.QuestionBankId.Value))
            .ToListAsync();

        var totalMarks  = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
        var earnedMarks = answers.Where(a => a.Score).Sum(a =>
            exam.ExamQuestionBanks
                .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)
                ?.Question?.Mark ?? 0);

        return new
        {
            ExamId          = exam.ExamId,
            Title           = exam.Title,
            SubjectName     = exam.Subject?.StatusName ?? exam.ExamSubject,
            ExamDescription = exam.ExamDescription,
            StartDate       = DateTime.SpecifyKind(exam.StartDate.GetValueOrDefault(), DateTimeKind.Utc),
            EndDate         = DateTime.SpecifyKind(exam.EndDate.GetValueOrDefault(), DateTimeKind.Utc),
            TotalMarks      = totalMarks,
            EarnedMarks     = earnedMarks,
            Score           = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0,
            Questions = exam.ExamQuestionBanks
                .Where(eq => eq.Question != null)
                .Select(eq =>
                {
                    var answer = answers.FirstOrDefault(a => a.QuestionBankId == eq.Question!.QuestionId);
                    return new
                    {
                        QuestionId    = eq.Question!.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA       = eq.Question.OptionA,
                        OptionB       = eq.Question.OptionB,
                        OptionC       = eq.Question.OptionC,
                        OptionD       = eq.Question.OptionD,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        Mark          = eq.Question.Mark ?? 0,
                        UserAnswer    = answer?.ChoosedAnswer ?? string.Empty,
                        IsCorrect     = answer?.Score ?? false
                    };
                }).ToList()
        };
    }

    // -------------------------------------------------------------------------
    // GetExamQuestionsForStudentAsync
    // -------------------------------------------------------------------------

    public async Task<(ExamForStudentDto? Dto, string? ErrorMessage, int StatusCode)>
        GetExamQuestionsForStudentAsync(long accountId, long examId, bool isStaff)
    {
        var exam = await _context.ExamDetails
            .Include(e => e.Subject)
            .FirstOrDefaultAsync(e => e.ExamId == examId);

        if (exam == null)
            return (null, "Exam not found.", 404);

        // Students: enforce class-assignment and submission-state checks
        if (!isStaff)
        {
            var studentExtension = await _context.StudentExtensions
                .FirstOrDefaultAsync(se => se.AccountId == accountId);

            if (studentExtension != null && studentExtension.ClassId.HasValue)
            {
                var studentClassId = studentExtension.ClassId.Value.ToString();
                bool hasClassAccess = string.IsNullOrEmpty(exam.ClassId) ||
                    exam.ClassId.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                .Contains(studentClassId);

                if (!hasClassAccess)
                    return (null, "This exam is not assigned to your class.", 403);
            }

            // Submission check — see Phase 2 rationale in original controller
            bool alreadySubmitted = await _context.StudentExamAnswers
                .AnyAsync(sea => sea.AccountId == accountId && sea.ExamDetailsId == examId);

            if (alreadySubmitted)
                return (null, "You have already submitted this exam. Use the review endpoint to see your results.", 403);
        }

        await PopulateExamQuestionsAsync(new List<ExamDetail> { exam });

        // Build the safe DTO — QuestionForStudentDto has no CorrectAnswer field
        var dto = new ExamForStudentDto
        {
            ExamId          = exam.ExamId,
            Title           = exam.Title ?? string.Empty,
            SubjectName     = exam.Subject?.StatusName ?? exam.ExamSubject,
            ExamDescription = exam.ExamDescription,
            StartDate       = DateTime.SpecifyKind(exam.StartDate.GetValueOrDefault(), DateTimeKind.Utc),
            EndDate         = DateTime.SpecifyKind(exam.EndDate.GetValueOrDefault(), DateTimeKind.Utc),
            TotalMarks      = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0),
            Questions = exam.ExamQuestionBanks
                .Where(eq => eq.Question != null)
                .Select(eq => new QuestionForStudentDto
                {
                    QuestionId    = eq.Question!.QuestionId,
                    QuestionTitle = eq.Question.QuestionTitle,
                    OptionA       = eq.Question.OptionA,
                    OptionB       = eq.Question.OptionB,
                    OptionC       = eq.Question.OptionC,
                    OptionD       = eq.Question.OptionD,
                    OptionE       = eq.Question.OptionE,
                    OptionF       = eq.Question.OptionF,
                    OptionG       = eq.Question.OptionG,
                    OptionH       = eq.Question.OptionH,
                    UsedOptions   = eq.Question.UsedOptions ?? 4,
                    Mark          = eq.Question.Mark ?? 0
                    // CorrectAnswer intentionally absent — Phase 2 security contract
                }).ToList()
        };

        return (dto, null, 200);
    }

    // -------------------------------------------------------------------------
    // SubmitStudentAnswersAsync
    // -------------------------------------------------------------------------

    public async Task<SubmitExamResultDto> SubmitStudentAnswersAsync(
        long accountId, StudentAnswerSubmitDto dto)
    {
        // Account existence check
        var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
        if (!accountExists)
            throw new KeyNotFoundException($"Account with ID {accountId} does not exist.");

        var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == dto.ExamId);
        if (exam == null)
            throw new KeyNotFoundException("Exam not found.");

        await PopulateExamQuestionsAsync(new List<ExamDetail> { exam });

        // Double-submission protection
        var existingAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == accountId && sea.ExamDetailsId == dto.ExamId)
            .ToListAsync();

        if (existingAnswers.Any())
            throw new InvalidOperationException("You have already submitted answers for this exam.");

        var questionIds = exam.ExamQuestionBanks
            .Where(eq => eq.QuestionId.HasValue)
            .Select(eq => eq.QuestionId!.Value)
            .ToList();

        if (dto.Answers == null || dto.Answers.Count == 0)
            throw new ArgumentException("No answers submitted.");

        // Reject answers for questions not in this exam
        var submittedQuestionIds = dto.Answers.Select(a => a.QuestionId).ToList();
        var invalidIds = submittedQuestionIds.Where(qid => !questionIds.Contains(qid)).ToList();
        if (invalidIds.Any())
            throw new ArgumentException("Submitted answers contain question IDs that do not belong to this exam.");

        // Fill blank answers for unanswered questions
        var missingQuestionIds = questionIds.Where(qid => !submittedQuestionIds.Contains(qid)).ToList();
        foreach (var missingQid in missingQuestionIds)
            dto.Answers.Add(new AnswerDto { QuestionId = missingQid, Answer = string.Empty });

        // Grade each answer
        var studentAnswers = new List<StudentExamAnswer>();
        foreach (var answerDto in dto.Answers)
        {
            var question = exam.ExamQuestionBanks
                .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == answerDto.QuestionId)
                ?.Question;

            if (question == null) continue;

            bool isCorrect = IsAnswerCorrect(question, answerDto.Answer?.ToString()?.Trim() ?? string.Empty);

            studentAnswers.Add(new StudentExamAnswer
            {
                AccountId     = accountId,
                ExamQuestionId = null,
                ExamDetailsId = dto.ExamId,
                QuestionBankId = answerDto.QuestionId,
                ChoosedAnswer = answerDto.Answer?.ToString()?.Trim() ?? string.Empty,
                Score         = isCorrect
            });
        }

        await _context.StudentExamAnswers.AddRangeAsync(studentAnswers);
        await _context.SaveChangesAsync();

        var totalMarks  = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
        var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
            exam.ExamQuestionBanks
                .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)
                ?.Question?.Mark ?? 0);

        var score = totalMarks > 0
            ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2)
            : 0.0;

        return new SubmitExamResultDto(dto.ExamId, totalMarks, earnedMarks, score);
    }

    // -------------------------------------------------------------------------
    // Grading helper — preserved exactly from original controller
    // -------------------------------------------------------------------------

    /// <summary>
    /// Determines whether a student's chosen answer matches the correct answer.
    ///
    /// Grading rules (in priority order):
    ///   1. Empty / blank answer → always incorrect.
    ///   2. MCQ with a letter correct-answer (A/B/C/D):
    ///      Map the letter to the corresponding option text, then compare
    ///      case-insensitively.
    ///   3. All other types (True/False, Fill-in-the-blank, full-text MCQ):
    ///      direct case-insensitive comparison.
    /// </summary>
    private static bool IsAnswerCorrect(QuestionBank question, string chosenAnswer)
    {
        if (string.IsNullOrWhiteSpace(chosenAnswer))
            return false;

        var correctAnswer = question.CorrectAnswer?.Trim() ?? string.Empty;

        bool isLetterAnswer = correctAnswer.Length == 1 && char.IsLetter(correctAnswer[0]);
        bool hasFourOptions = question.OptionC != null && question.OptionD != null;

        if (hasFourOptions && isLetterAnswer)
        {
            int correctIndex = char.ToUpper(correctAnswer[0]) - 'A';
            var options = new List<string?> { question.OptionA, question.OptionB, question.OptionC, question.OptionD };

            if (correctIndex >= 0 && correctIndex < options.Count && options[correctIndex] != null)
                return chosenAnswer.Equals(options[correctIndex]!.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        return chosenAnswer.Equals(correctAnswer, StringComparison.OrdinalIgnoreCase);
    }
}
