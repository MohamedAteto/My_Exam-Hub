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
    public class StudentExamAnswerController : ControllerBase
    {
        private readonly ElsewedySchoolContext _context;

        public StudentExamAnswerController(ElsewedySchoolContext context)
        {
            _context = context;
        }

        [HttpGet("student/{accountId}/exams")]
        public async Task<ActionResult> GetStudentExams(long accountId)
        {
            // Get all student answers with questions
            var studentAnswers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId)
                .Include(sea => sea.Question)
                .ToListAsync();

            // Get all exam details and match with student answers via questions
            var allExams = await _context.ExamDetails
                .Include(e => e.Subject)
                .Include(e => e.Grade)
                .Include(e => e.Class)
                .Include(e => e.ExamQuestionBanks)
                .ThenInclude(eq => eq.Question)
                .ToListAsync();

            // Group answers by exam (must match both ExamId and QuestionId)
            // Only mark exam as completed if student has answered ALL questions for that specific exam
            var examAnswers = allExams.Select(exam =>
            {
                // Get all question IDs for this exam (filter out nulls)
                var examQuestionIds = exam.ExamQuestionBanks
                    .Where(eq => eq.QuestionId.HasValue)
                    .Select(eq => eq.QuestionId.Value)
                    .ToList();
                
                // Only get answers that match this specific exam's ExamId AND are for questions in this exam
                var answers = studentAnswers
                    .Where(a => a.ExamId == exam.ExamId && examQuestionIds.Contains(a.QuestionId))
                    .ToList();

                // Debug logging
                if (exam.Title == "test" || true) 
                {
                   /* Console.WriteLine($"Exam: {exam.Title} ({exam.ExamId})");
                    Console.WriteLine($"  Questions: {examQuestionIds.Count}");
                    Console.WriteLine($"  Answers Found: {answers.Count}");
                    foreach(var a in answers) {
                        Console.WriteLine($"    Ans: Q{a.QuestionId} Exam:{a.ExamId} Val:{a.ChoosedAnswer}");
                    }*/
                }

                // Only return exam as completed if student has answers for ALL questions in this exam
                // This ensures answers from other exams (even with same questions) don't mark this exam as completed
                if (examQuestionIds.Count == 0 || answers.Count == 0 || answers.Count < examQuestionIds.Count) return null;

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

                return new
                {
                    ExamId = exam.ExamId,
                    Title = exam.Title,
                    ExamSubject = exam.Subject?.SubjectName ?? string.Empty,
                    ExamDescription = exam.ExamDescription,
                    StartDate = exam.StartDate,
                    EndDate = exam.EndDate,
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
                    ea.ExamSubject,
                    ea.ExamDescription,
                    ea.StartDate,
                    ea.EndDate,
                    ea.TotalMarks,
                    ea.EarnedMarks,
                    ea.Score,
                    Questions = exam.ExamQuestionBanks
                        .Where(eq => eq.QuestionId.HasValue)
                        .Select(eq =>
                        {
                            // Match answer by QuestionId - answers are already filtered by ExamId, so this is scoped to this exam
                            var answer = ea.Answers.FirstOrDefault(a => a.QuestionId == eq.QuestionId.Value);
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
            var exam = await _context.ExamDetails
                .Where(e => e.ExamId == examId)
                .Include(e => e.Subject)
                .Include(e => e.Grade)
                .Include(e => e.Class)
                .Include(e => e.ExamQuestionBanks)
                .ThenInclude(eq => eq.Question)
                .FirstOrDefaultAsync();

            if (exam == null) return NotFound();

            // Get all question IDs for this exam (filter out nulls)
            var questionIds = exam.ExamQuestionBanks
                .Where(eq => eq.QuestionId.HasValue)
                .Select(eq => eq.QuestionId.Value)
                .ToList();
            
            // Only get answers for this specific exam (filter by ExamId, AccountId, and QuestionId)
            // This ensures we only get answers that were submitted for THIS exam, not other exams with the same questions
            var answers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId && sea.ExamId == examId && questionIds.Contains(sea.QuestionId))
                .Include(sea => sea.Question)
                .ToListAsync();

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a => 
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

            var result = new
            {
                ExamId = exam.ExamId,
                Title = exam.Title,
                ExamSubject = exam.Subject?.SubjectName ?? string.Empty,
                ExamDescription = exam.ExamDescription,
                StartDate = exam.StartDate,
                EndDate = exam.EndDate,
                TotalMarks = totalMarks,
                EarnedMarks = earnedMarks,
                Score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0,
                Questions = exam.ExamQuestionBanks
                    .Where(eq => eq.QuestionId.HasValue)
                    .Select(eq =>
                    {
                        // Match answer by QuestionId - answers are already filtered by ExamId in the query above (line 137-138)
                        // This ensures we only get answers for THIS specific exam, not other exams with the same questions
                        var answer = answers.FirstOrDefault(a => a.QuestionId == eq.QuestionId.Value);
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
        public async Task<ActionResult> SubmitStudentAnswers([FromBody] StudentAnswerSubmitDto dto)
        {
            if (dto == null)
            {
                return BadRequest(new { message = "Request body is required." });
            }

            // Extract account ID from JWT token
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            long accountId = 0;
            if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
            {
                accountId = tokenAccountId;
            }
            else if (dto.AccountId > 0)
            {
                accountId = dto.AccountId;
            }

            if (accountId <= 0)
            {
                return BadRequest(new { message = "Unable to determine account ID. Please log in again." });
            }

            if (dto.ExamId <= 0)
            {
                return BadRequest(new { message = "Invalid exam ID." });
            }

            // Validate that the account exists
            var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
            if (!accountExists)
            {
                return BadRequest(new { message = $"Account with ID {accountId} does not exist. Please log in again." });
            }

            // Validate exam exists
            var exam = await _context.ExamDetails
                .Include(e => e.ExamQuestionBanks)
                .ThenInclude(eq => eq.Question)
                .FirstOrDefaultAsync(e => e.ExamId == dto.ExamId);

            if (exam == null)
            {
                return NotFound(new { message = "Exam not found." });
            }

            // Check if student already submitted answers for this exam
            var existingAnswers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == accountId && sea.ExamId == dto.ExamId)
                .ToListAsync();

            if (existingAnswers.Any())
            {
                return BadRequest(new { message = "You have already submitted answers for this exam." });
            }

            // Validate answers - allow partial answers (unanswered questions will be marked as incorrect)
            var questionIds = exam.ExamQuestionBanks
                .Where(eq => eq.QuestionId.HasValue)
                .Select(eq => eq.QuestionId.Value)
                .ToList();
            
            // If no answers submitted, return error
            if (dto.Answers == null || dto.Answers.Count == 0)
            {
                return BadRequest(new { message = "No answers submitted. Please answer at least one question." });
            }
            
            var submittedQuestionIds = dto.Answers.Select(a => a.QuestionId).ToList();
            
            // Check if all submitted question IDs are valid
            if (submittedQuestionIds.Any(qid => !questionIds.Contains(qid)))
            {
                return BadRequest(new { message = $"Invalid answers. Some question IDs are not valid for this exam. Valid IDs: {string.Join(", ", questionIds)}. Submitted IDs: {string.Join(", ", submittedQuestionIds)}" });
            }
            
            // Ensure we process all questions, even if not answered
            // Add missing questions with empty answers
            var missingQuestionIds = questionIds.Where(qid => !submittedQuestionIds.Contains(qid)).ToList();
            foreach (var missingQid in missingQuestionIds)
            {
                dto.Answers.Add(new AnswerDto { QuestionId = missingQid, Answer = string.Empty });
            }

            // Process and save answers - include all questions, even unanswered ones
            var studentAnswers = new List<StudentExamAnswer>();
            
            // Process submitted answers
            foreach (var answerDto in dto.Answers)
            {
                if (answerDto.QuestionId <= 0)
                {
                    return BadRequest(new { message = $"Invalid question ID: {answerDto.QuestionId}. Question IDs must be greater than 0." });
                }

                var question = exam.ExamQuestionBanks
                    .FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == answerDto.QuestionId)?.Question;

                if (question == null)
                {
                    return BadRequest(new { message = $"Question with ID {answerDto.QuestionId} not found in this exam. Valid question IDs: {string.Join(", ", questionIds)}" });
                }
                
                // Handle empty answers
                string chosenAnswer = answerDto.Answer?.ToString()?.Trim() ?? string.Empty;

                // Determine if answer is correct
                bool isCorrect = false;
                string correctAnswer = question.CorrectAnswer?.Trim() ?? string.Empty;
                
                // If answer is empty, mark as incorrect
                if (string.IsNullOrEmpty(chosenAnswer))
                {
                    isCorrect = false;
                }
                else
                {

                if (question.OptionC != null && question.OptionD != null)
                {
                    // MCQ - correct answer might be stored as "A", "B", "C", "D" or as option text
                    // Check if correct answer is a letter (A, B, C, D)
                    if (correctAnswer.Length == 1 && char.IsLetter(correctAnswer[0]))
                    {
                        // Convert letter to option index (A=0, B=1, C=2, D=3)
                        int correctIndex = char.ToUpper(correctAnswer[0]) - 'A';
                        var optionsList = new List<string>();
                        if (!string.IsNullOrEmpty(question.OptionA)) optionsList.Add(question.OptionA);
                        if (!string.IsNullOrEmpty(question.OptionB)) optionsList.Add(question.OptionB);
                        if (!string.IsNullOrEmpty(question.OptionC)) optionsList.Add(question.OptionC);
                        if (!string.IsNullOrEmpty(question.OptionD)) optionsList.Add(question.OptionD);
                        string[] options = optionsList.ToArray();
                        
                        if (correctIndex >= 0 && correctIndex < options.Length)
                        {
                            // Compare with the option text
                            isCorrect = chosenAnswer.Trim().Equals(options[correctIndex].Trim(), StringComparison.OrdinalIgnoreCase);
                        }
                    }
                    else
                    {
                        // Compare directly with correct answer text
                        isCorrect = chosenAnswer.Trim().Equals(correctAnswer, StringComparison.OrdinalIgnoreCase);
                    }
                }
                else if (question.OptionA != null && question.OptionB != null && question.OptionC == null)
                {
                    // True/False
                    isCorrect = chosenAnswer.Trim().Equals(correctAnswer, StringComparison.OrdinalIgnoreCase);
                }
                else
                {
                    // Fill in the blank - compare text (case-insensitive)
                    isCorrect = chosenAnswer.Trim().Equals(correctAnswer, StringComparison.OrdinalIgnoreCase);
                }
                }

                var studentAnswer = new StudentExamAnswer
                {
                    AccountId = accountId,
                    ExamId = dto.ExamId,
                    QuestionId = answerDto.QuestionId,
                    ChoosedAnswer = chosenAnswer,
                    Score = isCorrect
                };

                studentAnswers.Add(studentAnswer);
            }
            
            // Add unanswered questions as incorrect (already handled above, but keeping for safety)
            // This is now redundant since we add missing questions above, but keeping for clarity

            // Save all answers
            // Note: The ExamId FK constraint may point to ExamQuestion, but we're using ExamDetail.ExamId
            // We'll try to save and handle any FK constraint errors
            try
            {
                await _context.StudentExamAnswers.AddRangeAsync(studentAnswers);
                await _context.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
            {
                // Check if it's a FK constraint violation
                var innerEx = ex.GetBaseException();
                if (innerEx != null && (innerEx.Message.Contains("FK_StudentExamAnswer_ExamQuestion") || 
                    innerEx.Message.Contains("FOREIGN KEY constraint") ||
                    innerEx.Message.Contains("The INSERT statement conflicted")))
                {
                    // The ExamId FK constraint points to ExamQuestion, but we need it to point to ExamDetail
                    // We need to drop the old FK and create a new one pointing to ExamDetail
                    // For now, return a helpful error message
                    return BadRequest(new { 
                        message = $"Foreign key constraint error. The ExamId foreign key constraint needs to be updated to reference ExamDetail instead of ExamQuestion. Please run a database migration to fix this.",
                        details = innerEx.Message
                    });
                }
                throw;
            }

            // Calculate total marks
            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
            var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

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

