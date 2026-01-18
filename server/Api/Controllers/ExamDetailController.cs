using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using System.Security.Claims;
using QuizesApi.DTOs;
using System.Linq;

namespace QuizesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExamDetailController : ControllerBase
    {
        private readonly IExamRepo _repo;
        private readonly ElsewedySchoolSysDbDevContext _context;

        public ExamDetailController(IExamRepo repo, ElsewedySchoolSysDbDevContext context)
        {
            _repo = repo;
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExamReadDto>>> GetAll()
        {
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            long? accountId = null;
            if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
            {
                accountId = tokenAccountId;
            }

            var exams = await _repo.GetAllAsync();

            if (accountId.HasValue)
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId.Value);
                
                if (studentExtension != null && studentExtension.ClassId.HasValue)
                {
                    // Filter using ClassId directly - students only see exams for their class
                    exams = exams.Where(e => e.ClassId == studentExtension.ClassId.Value);
                }
            }

            return Ok(exams.Select(e => new ExamReadDto
            {
                ExamId = e.ExamId,
                Title = e.Title,
                ExamSubject = e.ExamSubject ?? string.Empty,
                ExamDescription = e.ExamDescription,
                Grade = e.GradeId?.ToString() ?? string.Empty,
                Class = e.ClassId?.ToString() ?? string.Empty,
                GradeId = e.GradeId,
                ClassId = e.ClassId,
                StartDate = e.StartDate.GetValueOrDefault(),
                EndDate = e.EndDate.GetValueOrDefault(),
                Questions = e.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
                        OptionE = eq.Question.OptionE,
                        OptionF = eq.Question.OptionF,
                        OptionG = eq.Question.OptionG,
                        OptionH = eq.Question.OptionH,
                        UsedOptions = eq.Question.UsedOptions ?? 4,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList()
            }));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ExamReadDto>> GetById(long id)
        {
            var exam = await _repo.GetByIdAsync(id);
            if (exam == null) return NotFound();

            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            long? accountId = null;
            if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
            {
                accountId = tokenAccountId;
            }

            if (accountId.HasValue)
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId.Value);
                
                if (studentExtension != null && studentExtension.ClassId.HasValue)
                {
                    // Access check using ClassId
                    bool hasAccess = !exam.ClassId.HasValue || exam.ClassId == studentExtension.ClassId.Value;

                    if (!hasAccess)
                    {
                        return StatusCode(403, new { message = "You do not have access to this quiz. It is not assigned to your class." });
                    }
                }
            }

            return Ok(new ExamReadDto
            {
                ExamId = exam.ExamId,
                Title = exam.Title,
                ExamSubject = exam.ExamSubject ?? string.Empty,
                ExamDescription = exam.ExamDescription,
                Grade = exam.GradeId?.ToString() ?? string.Empty,
                Class = exam.ClassId?.ToString() ?? string.Empty,
                GradeId = exam.GradeId,
                ClassId = exam.ClassId,
                StartDate = exam.StartDate.GetValueOrDefault(),
                EndDate = exam.EndDate.GetValueOrDefault(),
                Questions = exam.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
                        OptionE = eq.Question.OptionE,
                        OptionF = eq.Question.OptionF,
                        OptionG = eq.Question.OptionG,
                        OptionH = eq.Question.OptionH,
                        UsedOptions = eq.Question.UsedOptions ?? 4,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList()
            });
        }

    [HttpPost]
    public async Task<ActionResult<ExamReadDto>> Create(ExamCreateDto dto)  
    {
        Console.WriteLine($"[DIAG] Create Exam called. Title={dto.Title}, GradeId={dto.GradeId}, ClassIds={dto.ClassIds?.Count}");
        try 
        {
                var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                    ?? User.FindFirst("sub")?.Value 
                    ?? User.FindFirst("id")?.Value;
                
                long accountId = 0;
                if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
                {
                    accountId = tokenAccountId;
                }
                else if (dto.CreatedBy_AccID > 0)
                {
                    accountId = dto.CreatedBy_AccID;
                }

                if (accountId <= 0)
                {
                    if (dto.CreatedBy.HasValue) accountId = dto.CreatedBy.Value;
                    if (accountId <= 0)
                        return BadRequest(new { message = "Unable to determine account ID. Please log in again." });
                }

                var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
                if (!accountExists)
                {
                    return BadRequest(new { message = $"Account with ID {accountId} does not exist." });
                }

                // Determine which classes to create exams for
                var classIdsToProcess = new List<long>();
                if (dto.ClassIds != null && dto.ClassIds.Count > 0)
                {
                    // Extract class IDs from the ClassIds list
                    foreach (var classIdValue in dto.ClassIds)
                    {
                        if (classIdValue is long longId)
                            classIdsToProcess.Add(longId);
                        else if (classIdValue is int intId)
                            classIdsToProcess.Add(intId);
                        else if (long.TryParse(classIdValue?.ToString(), out long parsedId))
                            classIdsToProcess.Add(parsedId);
                    }
                }
                else if (dto.ClassId.HasValue)
                {
                    // Fallback to single ClassId if ClassIds is empty
                    classIdsToProcess.Add(dto.ClassId.Value);
                }

                if (classIdsToProcess.Count == 0)
                {
                    return BadRequest(new { message = "At least one class must be selected." });
                }

                Console.WriteLine($"[DIAG] Creating {classIdsToProcess.Count} exam(s) for classes: {string.Join(", ", classIdsToProcess)}");

                var createdExams = new List<ExamDetail>();

                // Create one exam for each selected class
                foreach (var classId in classIdsToProcess)
                {
                    var newExam = new ExamDetail
                    {
                        Title = dto.Title,
                        ExamSubject = dto.ExamSubject,
                        ExamDescription = dto.ExamDescription,
                        GradeId = dto.GradeId, 
                        ClassId = classId,
                        StartDate = dto.StartDate,
                        EndDate = dto.EndDate,
                        CreatedBy_AccId = accountId,
                        SubjectId = dto.SubjectId
                    };
                    
                    await _repo.AddAsync(newExam, dto.QuestionIds);
                    createdExams.Add(newExam);
                }

                await _repo.SaveChangesAsync();

                // Return the first created exam for backward compatibility
                var firstExam = createdExams.First();
                var savedExam = await _repo.GetByIdAsync(firstExam.ExamId);
                if (savedExam == null) return NotFound();

                var examDto = new ExamReadDto
                {
                    ExamId = savedExam.ExamId,
                    Title = savedExam.Title,
                    ExamSubject = savedExam.ExamSubject ?? string.Empty,
                    ExamDescription = savedExam.ExamDescription,
                    Grade = savedExam.GradeId?.ToString() ?? string.Empty,
                    Class = savedExam.ClassId?.ToString() ?? string.Empty,
                    GradeId = savedExam.GradeId,
                    ClassId = savedExam.ClassId,
                    StartDate = savedExam.StartDate.GetValueOrDefault(),
                    EndDate = savedExam.EndDate.GetValueOrDefault(),
                    Questions = savedExam.ExamQuestionBanks
                        .Where(eq => eq.Question != null)
                        .Select(eq => new QuestionBankReadDto
                        {
                            QuestionId = eq.Question.QuestionId,
                            QuestionTitle = eq.Question.QuestionTitle,
                            OptionA = eq.Question.OptionA,
                            OptionB = eq.Question.OptionB,
                            OptionC = eq.Question.OptionC,
                            OptionD = eq.Question.OptionD,
                            OptionE = eq.Question.OptionE,
                            OptionF = eq.Question.OptionF,
                            OptionG = eq.Question.OptionG,
                            OptionH = eq.Question.OptionH,
                            UsedOptions = eq.Question.UsedOptions ?? 4,
                            CorrectAnswer = eq.Question.CorrectAnswer,
                            QuestionSubject = eq.Question.QuestionSubject,
                            Mark = eq.Question.Mark ?? 0
                        }).ToList()
                };

                return CreatedAtAction(nameof(GetById), new { id = firstExam.ExamId }, examDto);
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException?.Message ?? "No inner details";
                Console.WriteLine($"[ERROR] Quiz Creation failed: {ex.Message} | Inner: {innerMessage} | Stack: {ex.StackTrace}");
                return StatusCode(500, new { message = $"Error creating exam: {ex.Message} | Inner: {innerMessage}" });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ExamReadDto>> Update(long id, ExamUpdateDto dto)
        {
            var exam = await _repo.GetByIdAsync(id);
            if (exam == null) return NotFound();

            exam.Title = dto.Title;
            exam.ExamSubject = dto.ExamSubject;
            exam.ExamDescription = dto.ExamDescription;
            exam.GradeId = dto.GradeId;
            exam.ClassId = dto.ClassId;
            exam.StartDate = dto.StartDate;
            exam.EndDate = dto.EndDate;
            exam.SubjectId = dto.SubjectId;

            await _repo.UpdateAsync(exam, dto.QuestionIds);
            await _repo.SaveChangesAsync();

            var updatedExam = await _repo.GetByIdAsync(id);
            if (updatedExam == null) return NotFound();

             var examDto = new ExamReadDto
            {
                ExamId = updatedExam.ExamId,
                Title = updatedExam.Title,
                ExamSubject = updatedExam.ExamSubject ?? string.Empty,
                ExamDescription = updatedExam.ExamDescription,
                Grade = updatedExam.GradeId?.ToString() ?? string.Empty,
                Class = updatedExam.ClassId?.ToString() ?? string.Empty,
                GradeId = updatedExam.GradeId,
                ClassId = updatedExam.ClassId,
                StartDate = updatedExam.StartDate.GetValueOrDefault(),
                EndDate = updatedExam.EndDate.GetValueOrDefault(),
                Questions = updatedExam.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
                        OptionE = eq.Question.OptionE,
                        OptionF = eq.Question.OptionF,
                        OptionG = eq.Question.OptionG,
                        OptionH = eq.Question.OptionH,
                        UsedOptions = eq.Question.UsedOptions ?? 4,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList()
            };

            return Ok(examDto);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(long id)
        {
            await _repo.DeleteAsync(id);
            await _repo.SaveChangesAsync();
            return NoContent();
        }
    }
}
