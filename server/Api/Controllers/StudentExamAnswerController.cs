using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using System.Security.Claims;

namespace QuizesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // All endpoints require a valid JWT token
    public class StudentExamAnswerController : ControllerBase
    {
        private readonly ElsewedySchoolSysDbDevContext _context;

        public StudentExamAnswerController(ElsewedySchoolSysDbDevContext context)
        {
            _context = context;
        }

        // ---------------------------------------------------------------------------
        // Internal helpers
        // ---------------------------------------------------------------------------

        /// <summary>
        /// Reads the authenticated user's AccountId and role list from their JWT claims.
        /// Never trusts any value supplied by the client in the request body or URL.
        /// Returns (0, empty list) when the token does not contain a recognisable subject claim.
        /// </summary>
        private (long AccountId, List<string> Roles) GetRequesterInfo()
        {
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("id")?.Value;

            long.TryParse(accountIdClaim, out long accountId);
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            return (accountId, roles);
        }

        /// <summary>
        /// Returns true when the requester holds an elevated role that is allowed
        /// to access any student's data (Teacher, Admin, Board, Superadmin).
        /// </summary>
        private static bool IsStaff(List<string> roles) =>
            roles.Contains("Teacher") ||
            roles.Contains("Admin") ||
            roles.Contains("Board") ||
            roles.Contains("Superadmin");

        /// <summary>
        /// Loads the question bank links and their associated QuestionBank records
        /// for a set of exams.  Mutates each ExamDetail's ExamQuestionBanks collection.
        /// </summary>
        private async Task PopulateExamQuestions(List<ExamDetail> exams)
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

        // ---------------------------------------------------------------------------
        // GET /api/studentexamanswer/student/{accountId}/exams
        // ---------------------------------------------------------------------------
        /// <summary>
        /// Returns all completed exam results for a student.
        /// Students may only request their own data.
        /// Teachers, Admins, Board, and Superadmins may request any student's data.
        /// </summary>
        [HttpGet("student/{accountId}/exams")]
        public async Task<ActionResult> GetStudentExams(long accountId)
        {
            var (requesterId, roles) = GetRequesterInfo();

            if (requesterId <= 0)
                return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

            // Ownership check: a Student can only read their own results.
            if (!IsStaff(roles) && requesterId != accountId)
                return StatusCode(403, new { message = "You are not authorised to view another student's exam results." });

            var studentAnswers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId)
                .ToListAsync();

            var allExams = await _context.ExamDetails.Include(e => e.Subject).ToListAsync();
            await PopulateExamQuestions(allExams);

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
                                QuestionId = eq.Question!.QuestionId,
                                QuestionTitle = eq.Question.QuestionTitle,
                                OptionA = eq.Question.OptionA,
                                OptionB = eq.Question.OptionB,
                                OptionC = eq.Question.OptionC,
                                OptionD = eq.Question.OptionD,
                                CorrectAnswer = eq.Question.CorrectAnswer,
                                Mark = eq.Question.Mark ?? 0,
                                UserAnswer = answer?.ChoosedAnswer ?? string.Empty,
                                IsCorrect = answer?.Score ?? false
                            };
                        }).ToList()
                };
            }).ToList();

            return Ok(result);
        }

        // ---------------------------------------------------------------------------
        // GET /api/studentexamanswer/student/{accountId}/exam/{examId}
        // ---------------------------------------------------------------------------
        /// <summary>
        /// Returns a single exam's questions together with the student's submitted answers
        /// and the correct answers (used for post-submission review).
        /// Students may only request their own data.
        /// Teachers, Admins, Board, and Superadmins may request any student's data.
        /// </summary>
        [HttpGet("student/{accountId}/exam/{examId}")]
        public async Task<ActionResult> GetStudentExamAnswers(long accountId, long examId)
        {
            var (requesterId, roles) = GetRequesterInfo();

            if (requesterId <= 0)
                return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

            // Ownership check
            if (!IsStaff(roles) && requesterId != accountId)
                return StatusCode(403, new { message = "You are not authorised to view another student's exam answers." });

            var exam = await _context.ExamDetails
                .Include(e => e.Subject)
                .FirstOrDefaultAsync(e => e.ExamId == examId);

            if (exam == null)
                return NotFound(new { message = "Exam not found." });

            await PopulateExamQuestions(new List<ExamDetail> { exam });

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

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks
                    .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)
                    ?.Question?.Mark ?? 0);

            var result = new
            {
                ExamId = exam.ExamId,
                Title = exam.Title,
                SubjectName = exam.Subject?.StatusName ?? exam.ExamSubject,
                ExamDescription = exam.ExamDescription,
                StartDate = DateTime.SpecifyKind(exam.StartDate.GetValueOrDefault(), DateTimeKind.Utc),
                EndDate = DateTime.SpecifyKind(exam.EndDate.GetValueOrDefault(), DateTimeKind.Utc),
                TotalMarks = totalMarks,
                EarnedMarks = earnedMarks,
                Score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0,
                Questions = exam.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq =>
                    {
                        var answer = answers.FirstOrDefault(a => a.QuestionBankId == eq.Question!.QuestionId);
                        return new
                        {
                            QuestionId = eq.Question!.QuestionId,
                            QuestionTitle = eq.Question.QuestionTitle,
                            OptionA = eq.Question.OptionA,
                            OptionB = eq.Question.OptionB,
                            OptionC = eq.Question.OptionC,
                            OptionD = eq.Question.OptionD,
                            CorrectAnswer = eq.Question.CorrectAnswer,
                            Mark = eq.Question.Mark ?? 0,
                            UserAnswer = answer?.ChoosedAnswer ?? string.Empty,
                            IsCorrect = answer?.Score ?? false
                        };
                    }).ToList()
            };

            return Ok(result);
        }

        // ---------------------------------------------------------------------------
        // POST /api/studentexamanswer/submit
        // ---------------------------------------------------------------------------
        /// <summary>
        /// Submits a student's answers for grading.
        /// The student's identity is derived exclusively from the JWT token.
        /// The AccountId field in the request body is accepted for API compatibility
        /// but is NEVER used for authorization — the token identity always takes precedence.
        /// </summary>
        [HttpPost("submit")]
        [Authorize(Roles = "Student")] // Only Students can submit exam answers
        public async Task<ActionResult> SubmitStudentAnswers([FromBody] StudentAnswerSubmitDto dto)
        {
            if (dto == null)
                return BadRequest(new { message = "Request body is required." });

            var (accountId, _) = GetRequesterInfo();

            // Identity must come from the token — never from the request body.
            if (accountId <= 0)
                return Unauthorized(new { message = "Unable to identify the requesting user. Please log in again." });

            if (dto.ExamId <= 0)
                return BadRequest(new { message = "Invalid exam ID." });

            var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
            if (!accountExists)
                return BadRequest(new { message = $"Account with ID {accountId} does not exist." });

            var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == dto.ExamId);
            if (exam == null)
                return NotFound(new { message = "Exam not found." });

            await PopulateExamQuestions(new List<ExamDetail> { exam });

            // Prevent double submission
            var existingAnswers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId && sea.ExamDetailsId == dto.ExamId)
                .ToListAsync();

            if (existingAnswers.Any())
                return BadRequest(new { message = "You have already submitted answers for this exam." });

            var questionIds = exam.ExamQuestionBanks
                .Where(eq => eq.QuestionId.HasValue)
                .Select(eq => eq.QuestionId!.Value)
                .ToList();

            if (dto.Answers == null || dto.Answers.Count == 0)
                return BadRequest(new { message = "No answers submitted." });

            // Reject any answer that references a question not in this exam
            var submittedQuestionIds = dto.Answers.Select(a => a.QuestionId).ToList();
            var invalidIds = submittedQuestionIds.Where(qid => !questionIds.Contains(qid)).ToList();
            if (invalidIds.Any())
                return BadRequest(new { message = $"Submitted answers contain question IDs that do not belong to this exam." });

            // Fill in blank answers for any question the student did not answer
            var missingQuestionIds = questionIds.Where(qid => !submittedQuestionIds.Contains(qid)).ToList();
            foreach (var missingQid in missingQuestionIds)
            {
                dto.Answers.Add(new AnswerDto { QuestionId = missingQid, Answer = string.Empty });
            }

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
                    AccountId = accountId,
                    ExamQuestionId = null,
                    ExamDetailsId = dto.ExamId,
                    QuestionBankId = answerDto.QuestionId,
                    ChoosedAnswer = answerDto.Answer?.ToString()?.Trim() ?? string.Empty,
                    Score = isCorrect
                });
            }

            try
            {
                await _context.StudentExamAnswers.AddRangeAsync(studentAnswers);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while saving your answers. Please try again.", details = ex.InnerException?.Message ?? ex.Message });
            }

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks
                    .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)
                    ?.Question?.Mark ?? 0);

            return Ok(new
            {
                message = "Answers submitted successfully.",
                examId = dto.ExamId,
                totalMarks,
                earnedMarks,
                score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0
            });
        }

        // ---------------------------------------------------------------------------
        // Grading helper
        // ---------------------------------------------------------------------------

        /// <summary>
        /// Determines whether a student's chosen answer matches the correct answer
        /// for a given question.
        ///
        /// Grading rules (in priority order):
        ///   1. Empty / blank answer → always incorrect.
        ///   2. MCQ with a letter correct-answer (A/B/C/D):
        ///      Map the letter to the corresponding option text, then compare
        ///      case-insensitively.  This handles the common database pattern where
        ///      CorrectAnswer stores "A" rather than the full option text.
        ///   3. All other question types (True/False, Fill-in-the-blank, MCQ with
        ///      full-text correct-answer): direct case-insensitive comparison.
        /// </summary>
        private static bool IsAnswerCorrect(QuestionBank question, string chosenAnswer)
        {
            if (string.IsNullOrWhiteSpace(chosenAnswer))
                return false;

            var correctAnswer = question.CorrectAnswer?.Trim() ?? string.Empty;

            // MCQ: correct answer stored as a single letter (A, B, C, D)
            bool isLetterAnswer = correctAnswer.Length == 1 && char.IsLetter(correctAnswer[0]);
            bool hasFourOptions = question.OptionC != null && question.OptionD != null;

            if (hasFourOptions && isLetterAnswer)
            {
                int correctIndex = char.ToUpper(correctAnswer[0]) - 'A'; // A→0, B→1, …

                var options = new List<string?>
                {
                    question.OptionA,
                    question.OptionB,
                    question.OptionC,
                    question.OptionD
                };

                if (correctIndex >= 0 && correctIndex < options.Count && options[correctIndex] != null)
                {
                    return chosenAnswer.Equals(options[correctIndex]!.Trim(), StringComparison.OrdinalIgnoreCase);
                }
            }

            // Fallback: direct comparison (True/False, Fill-in-the-blank, full-text MCQ)
            return chosenAnswer.Equals(correctAnswer, StringComparison.OrdinalIgnoreCase);
        }
    }

    // -------------------------------------------------------------------------------
    // DTOs for this controller
    // NOTE: These will be moved to the DTOs/Student/ folder in Phase 4 (refactoring).
    //       They are kept here for now to limit the scope of this security-only phase.
    // -------------------------------------------------------------------------------

    public class StudentAnswerSubmitDto
    {
        public long ExamId { get; set; }

        /// <summary>
        /// Kept for API compatibility with the existing frontend.
        /// This value is NEVER used for authorization — the server always derives
        /// the student's identity from the JWT token.
        /// </summary>
        public long AccountId { get; set; }

        public List<AnswerDto> Answers { get; set; } = new();
    }

    public class AnswerDto
    {
        public long QuestionId { get; set; }
        public object Answer { get; set; } = null!;
    }
}
