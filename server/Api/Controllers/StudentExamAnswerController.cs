using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using System.Security.Claims;
using System;
using System.Collections.Generic;
using System.Linq;

namespace QuizesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class StudentExamAnswerController : ControllerBase
    {
        private readonly ElsewedySchoolSysDbDevContext _context;
        private readonly ILogger<StudentExamAnswerController> _logger;

        public StudentExamAnswerController(
            ElsewedySchoolSysDbDevContext context,
            ILogger<StudentExamAnswerController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private long? GetCurrentAccountId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("id")?.Value;
            return long.TryParse(claim, out var accountId) ? accountId : null;
        }

        private bool CanAccessStudent(long accountId) =>
            User.IsInRole("Teacher") || User.IsInRole("Admin") || User.IsInRole("Superadmin") ||
            User.IsInRole("Board") || GetCurrentAccountId() == accountId;

        private static bool IsCorrectAnswer(QuestionBank question, string chosenAnswer)
        {
            var correctAnswer = question.CorrectAnswer?.Trim() ?? string.Empty;
            if (chosenAnswer.Length == 0 || correctAnswer.Length == 0) return false;

            var options = new[]
            {
                question.OptionA, question.OptionB, question.OptionC, question.OptionD,
                question.OptionE, question.OptionF, question.OptionG, question.OptionH
            }
            .Where(option => !string.IsNullOrWhiteSpace(option))
            .Select(option => option!.Trim())
            .ToArray();

            if (options.Length < 2)
            {
                return string.Equals(chosenAnswer, correctAnswer, StringComparison.OrdinalIgnoreCase);
            }

            var correctIndex = ResolveOptionIndex(correctAnswer, options);
            var chosenIndex = ResolveOptionIndex(chosenAnswer, options);
            if (correctIndex >= 0 && chosenIndex >= 0) return chosenIndex == correctIndex;

            return string.Equals(chosenAnswer, correctAnswer, StringComparison.OrdinalIgnoreCase);
        }

        private static int ResolveOptionIndex(string answer, string[] options)
        {
            var normalizedAnswer = answer.Trim();
            if (normalizedAnswer.Length == 1)
            {
                var letterIndex = char.ToUpperInvariant(normalizedAnswer[0]) - 'A';
                if (letterIndex >= 0 && letterIndex < options.Length) return letterIndex;
            }

            return Array.FindIndex(options, option =>
                string.Equals(option, normalizedAnswer, StringComparison.OrdinalIgnoreCase));
        }

        private async Task PopulateExamQuestions(List<ExamDetail> exams)
        {
            var examIds = exams.Select(e => e.ExamId).ToList();
            if (!examIds.Any()) return;

            var links = await _context.ExamQuestionBanks.Where(eq => eq.ExamId.HasValue && examIds.Contains(eq.ExamId.Value)).ToListAsync();
            var qIds = links.Where(l => l.QuestionId.HasValue).Select(l => l.QuestionId.Value).Distinct().ToList();
            var questions = await _context.QuestionBanks.Where(q => qIds.Contains(q.QuestionId)).ToDictionaryAsync(q => q.QuestionId);

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

        [HttpGet("student/{accountId}/exams")]
        public async Task<ActionResult> GetStudentExams(long accountId)
        {
            if (!CanAccessStudent(accountId)) return Forbid();

            var studentAnswers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId)
                .ToListAsync();

            var allExams = await _context.ExamDetails.Include(e => e.Subject).ToListAsync();
            await PopulateExamQuestions(allExams);

            var examAnswers = allExams.Select(exam =>
            {
                var examQuestionIds = exam.ExamQuestionBanks
                    .Where(eq => eq.QuestionId.HasValue)
                    .Select(eq => eq.QuestionId.Value)
                    .ToList();
                
                var answers = studentAnswers
                    .Where(a => a.ExamDetailsId.HasValue && 
                               a.ExamDetailsId.Value == exam.ExamId && 
                               a.QuestionBankId.HasValue && 
                               examQuestionIds.Contains(a.QuestionBankId.Value))
                    .ToList();

                if (examQuestionIds.Count == 0 || answers.Count == 0 || answers.Count < examQuestionIds.Count) return null;

                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)?.Question?.Mark ?? 0);

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
                var exam = allExams.First(e => e.ExamId == ea.ExamId);
                return new
                {
                    ea.ExamId,
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
                            var answer = ea.Answers.FirstOrDefault(a => a.QuestionBankId == eq.Question.QuestionId);
                            return new
                            {
                                QuestionId = eq.Question.QuestionId,
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

        [HttpGet("student/{accountId}/exam/{examId}")]
        public async Task<ActionResult> GetStudentExamAnswers(long accountId, long examId)
        {
            if (!CanAccessStudent(accountId)) return Forbid();

            var exam = await _context.ExamDetails.Include(e => e.Subject).FirstOrDefaultAsync(e => e.ExamId == examId);
            if (exam == null) return NotFound();

            // Strict Access Control for Teachers
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            if (long.TryParse(accountIdClaim, out long requesterId))
            {
                var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
                bool isTeacher = roles.Contains("Teacher");
                bool isAdmin = roles.Contains("Superadmin") || roles.Contains("Admin") || roles.Contains("Board");

                // Teachers can now see ANY exam's answers
                // No longer restricting by CreatedBy_AccId
            }

            await PopulateExamQuestions(new List<ExamDetail> { exam });

            var questionIds = (exam.ExamQuestionBanks ?? Enumerable.Empty<ExamQuestionBank>())
                .Where(eq => eq.QuestionId.HasValue)
                .Select(eq => eq.QuestionId.Value)
                .ToList();
            
            var answers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId && sea.ExamDetailsId == examId && sea.QuestionBankId.HasValue && questionIds.Contains(sea.QuestionBankId.Value))
                .ToListAsync();

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a => 
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)?.Question?.Mark ?? 0);

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
                        var answer = answers.FirstOrDefault(a => a.QuestionBankId == eq.Question.QuestionId);
                        return new
                        {
                            QuestionId = eq.Question.QuestionId,
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

        [HttpPost("submit")]
        [Authorize(Roles = "Student")]
        public async Task<ActionResult> SubmitStudentAnswers([FromBody] StudentAnswerSubmitDto dto)
        {
            if (dto == null) return BadRequest(new { message = "Request body is required." });

            var accountId = GetCurrentAccountId();
            if (!accountId.HasValue) return Unauthorized(new { message = "Unable to determine account ID. Please log in again." });
            if (dto.AccountId > 0 && dto.AccountId != accountId.Value) return Forbid();
            if (dto.ExamId <= 0) return BadRequest(new { message = "Invalid exam ID." });

            var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId.Value);
            if (!accountExists) return BadRequest(new { message = $"Account with ID {accountId} does not exist." });

            var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == dto.ExamId);
            if (exam == null) return NotFound(new { message = "Exam not found." });

            await PopulateExamQuestions(new List<ExamDetail> { exam });

            var questionIds = (exam.ExamQuestionBanks ?? Enumerable.Empty<ExamQuestionBank>())
                .Where(eq => eq.QuestionId.HasValue)
                .Select(eq => eq.QuestionId.Value)
                .ToList();
            
            var existingAnswers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId.Value && sea.ExamDetailsId == dto.ExamId)
                .ToListAsync();

            // Check for complete submission
            if (existingAnswers.Any())
            {
                var expectedCount = questionIds.Count;
                if (existingAnswers.Count >= expectedCount)
                {
                    return BadRequest(new { message = "You have already submitted answers for this exam." });
                }
                else
                {
                    // Allow resubmission if incomplete (e.g., network failure during first submit)
                    _logger.LogWarning(
                        "Student {AccountId} resubmitting incomplete exam {ExamId} with {ExistingCount} of {ExpectedCount} answers",
                        accountId.Value,
                        dto.ExamId,
                        existingAnswers.Count,
                        expectedCount);
                    _context.StudentExamAnswers.RemoveRange(existingAnswers);
                    await _context.SaveChangesAsync();
                }
            }
            
            if (dto.Answers == null || dto.Answers.Count == 0) return BadRequest(new { message = "No answers submitted." });
            
            var submittedQuestionIds = dto.Answers.Select(a => a.QuestionId).ToList();
            if (submittedQuestionIds.Count != submittedQuestionIds.Distinct().Count())
                return BadRequest(new { message = "Each question can only be answered once." });
            if (submittedQuestionIds.Any(qid => !questionIds.Contains(qid)))
            {
                return BadRequest(new { message = $"Invalid answers. IDs valid: {string.Join(", ", questionIds)}" });
            }
            
            var missingQuestionIds = questionIds.Where(qid => !submittedQuestionIds.Contains(qid)).ToList();
            foreach (var missingQid in missingQuestionIds)
            {
                dto.Answers.Add(new AnswerDto { QuestionId = missingQid, Answer = string.Empty });
            }



            var studentAnswers = new List<StudentExamAnswer>();
            
            foreach (var answerDto in dto.Answers)
            {
                var question = (exam.ExamQuestionBanks ?? Enumerable.Empty<ExamQuestionBank>())
                    .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == answerDto.QuestionId)?.Question;

                if (question == null) continue;
                
                string chosenAnswer = answerDto.Answer?.ToString()?.Trim() ?? string.Empty;
                bool isCorrect = IsCorrectAnswer(question, chosenAnswer);

                studentAnswers.Add(new StudentExamAnswer
                {
                    AccountId = accountId.Value,
                    ExamQuestionId = null,
                    ExamDetailsId = dto.ExamId,
                    QuestionBankId = answerDto.QuestionId,
                    ChoosedAnswer = chosenAnswer,
                    Score = isCorrect
                });
            }

            // Use transaction to ensure all-or-nothing save
            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                await _context.StudentExamAnswers.AddRangeAsync(studentAnswers);
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Failed to save answers for exam {ExamId} and account {AccountId}", dto.ExamId, accountId.Value);
                return StatusCode(500, new { message = "Unable to save answers. No answers were recorded." });
            }

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)?.Question?.Mark ?? 0);

            return Ok(new
            {
                message = "Answers submitted successfully.",
                examId = dto.ExamId,
                totalMarks,
                earnedMarks,
                score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0
            });
        }
    }

    public class StudentAnswerSubmitDto
    {
        public long ExamId { get; set; }
        public long AccountId { get; set; }
        public List<AnswerDto> Answers { get; set; } = new();
    }

    public class AnswerDto
    {
        public long QuestionId { get; set; }
        public object Answer { get; set; } = null!;
    }
}
