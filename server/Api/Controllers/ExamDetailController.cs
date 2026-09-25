using Microsoft.AspNetCore.Authorization;
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
    [Authorize]
    public class ExamDetailController : ControllerBase
    {
        private readonly IExamRepo _repo;
        private readonly ElsewedySchoolSysDbDevContext _context;
        private readonly ILogger<ExamDetailController> _logger;

        public ExamDetailController(
            IExamRepo repo,
            ElsewedySchoolSysDbDevContext context,
            ILogger<ExamDetailController> logger)
        {
            _repo = repo;
            _context = context;
            _logger = logger;
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

            if (User.IsInRole("Student"))
            {
                if (!accountId.HasValue) return Forbid();

                var studentExtension = await _context.StudentExtensions.AsNoTracking()
                    .FirstOrDefaultAsync(se => se.AccountId == accountId.Value);
                
                // If account is found in StudentExtensions, strictly filter by class
                if (studentExtension != null)
                {
                    if (studentExtension.ClassId.HasValue)
                    {
                        // Students see exams assigned to their class (multi-class support)
                        var filterClassId = studentExtension.ClassId.Value.ToString();
                        exams = exams.Where(e => !string.IsNullOrEmpty(e.ClassId) && 
                            e.ClassId.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(filterClassId));
                    }
                    else exams = Enumerable.Empty<ExamDetail>();
                }
                else exams = Enumerable.Empty<ExamDetail>();
            }

            return Ok(exams.Select(exam => MapToDto(exam, !User.IsInRole("Student"))));
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

            if (User.IsInRole("Student"))
            {
                if (!accountId.HasValue) return Forbid();
                var studentClassId = await _context.StudentExtensions.AsNoTracking()
                    .Where(se => se.AccountId == accountId.Value)
                    .Select(se => se.ClassId)
                    .FirstOrDefaultAsync();
                if (!studentClassId.HasValue || string.IsNullOrWhiteSpace(exam.ClassId) ||
                    !exam.ClassId.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(studentClassId.Value.ToString()))
                    return Forbid();
            }

            return Ok(MapToDto(exam, !User.IsInRole("Student")));
        }

    [HttpPost]
    [Authorize(Roles = "Teacher,Admin,Superadmin,Board")]
    public async Task<ActionResult<ExamReadDto>> Create(ExamCreateDto dto)  
    {
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
                if (accountId <= 0)
                {
                    return Unauthorized(new { message = "Unable to determine account ID. Please log in again." });
                }

                var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
                if (!accountExists)
                {
                    return BadRequest(new { message = $"Account with ID {accountId} does not exist." });
                }

                // Determine which classes to assign
                var classIdsToProcess = new List<long>();
                if (dto.ClassIds != null && dto.ClassIds.Count > 0)
                {
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
                    classIdsToProcess.Add(dto.ClassId.Value);
                }

                if (classIdsToProcess.Count == 0)
                {
                    return BadRequest(new { message = "At least one class must be selected." });
                }

                // Validate question IDs exist
                if (dto.QuestionIds != null && dto.QuestionIds.Any())
                {
                    var existingQuestionIds = await _context.QuestionBanks
                        .Where(q => dto.QuestionIds.Contains(q.QuestionId))
                        .Select(q => q.QuestionId)
                        .ToListAsync();
                        
                    var missingIds = dto.QuestionIds.Except(existingQuestionIds).ToList();
                    if (missingIds.Any())
                    {
                        return BadRequest(new { message = $"The following question IDs do not exist: {string.Join(", ", missingIds)}" });
                    }
                }
                else
                {
                    return BadRequest(new { message = "At least one question must be selected for the exam." });
                }

                // Create SINGLE exam linked to multiple classes
                var newExam = new ExamDetail
                {
                    Title = dto.Title,
                    ExamSubject = dto.ExamSubject,
                    ExamDescription = dto.ExamDescription,
                    GradeId = dto.GradeId, 
                    // ClassId will be set in AddAsync
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    CreatedBy_AccId = accountId,
                    SubjectId = dto.SubjectId
                };
                
                await _repo.AddAsync(newExam, dto.QuestionIds, classIdsToProcess);

                var savedExam = await _repo.GetByIdAsync(newExam.ExamId);
                if (savedExam == null) return NotFound();

                var examDto = MapToDto(savedExam);

                return CreatedAtAction(nameof(GetById), new { id = savedExam.ExamId }, examDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create exam");
                return StatusCode(500, new { message = "Unable to create the exam" });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Teacher,Admin,Superadmin,Board")]
        public async Task<ActionResult<ExamReadDto>> Update(long id, ExamUpdateDto dto)
        {
            try
            {
                var exam = await _repo.GetByIdAsync(id);
                if (exam == null) return NotFound();

                exam.Title = dto.Title;
                exam.ExamSubject = dto.ExamSubject;
                exam.ExamDescription = dto.ExamDescription;
                exam.GradeId = dto.GradeId;
                exam.StartDate = dto.StartDate;
                exam.EndDate = dto.EndDate;
                exam.SubjectId = dto.SubjectId;
                
                List<long> classIds = new List<long>();
                if (dto.ClassIds != null && dto.ClassIds.Any())
                {
                    classIds.AddRange(dto.ClassIds);
                }
                else if (dto.ClassId.HasValue)
                {
                    classIds.Add(dto.ClassId.Value);
                }


                await _repo.UpdateAsync(exam, dto.QuestionIds, classIds);
                await _repo.SaveChangesAsync();

                var updatedExam = await _repo.GetByIdAsync(id);
                if (updatedExam == null) return NotFound();

                 var examDto = MapToDto(updatedExam);

                return Ok(examDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update exam {ExamId}", id);
                return StatusCode(500, new { message = "Unable to save the exam" });
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Teacher,Admin,Superadmin,Board")]
        public async Task<ActionResult> Delete(long id)
        {
            await _repo.DeleteAsync(id);
            await _repo.SaveChangesAsync();
            return NoContent();
        }

        private ExamReadDto MapToDto(ExamDetail e, bool includeCorrectAnswers = true)
        {
            return new ExamReadDto
            {
                ExamId = e.ExamId,
                Title = e.Title,
                SubjectName = e.Subject?.StatusName ?? e.ExamSubject,
                ExamDescription = e.ExamDescription,
                GradeId = e.GradeId,
                SubjectId = e.SubjectId,
                ClassId = e.ClassId,
                StartDate = e.StartDate.HasValue 
                    ? DateTime.SpecifyKind(e.StartDate.Value, DateTimeKind.Utc) 
                    : DateTime.UtcNow,
                EndDate = e.EndDate.HasValue 
                    ? DateTime.SpecifyKind(e.EndDate.Value, DateTimeKind.Utc) 
                    : DateTime.UtcNow.AddDays(7),
                Questions = (e.ExamQuestionBanks ?? Enumerable.Empty<ExamQuestionBank>())
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
                        CorrectAnswer = includeCorrectAnswers ? eq.Question.CorrectAnswer : null,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList(),
                TotalMarks = (e.ExamQuestionBanks ?? Enumerable.Empty<ExamQuestionBank>())
                    .Sum(eq => eq.Question?.Mark ?? 0)
            };
        }

        [HttpGet("subjects")]
        public async Task<ActionResult<IEnumerable<object>>> GetSubjects()
        {
            var subjects = await _context.Statuses
                .Where(s => s.BusinessEntity == "Exams")
                .Select(s => new { id = s.Id, statusName = s.StatusName })
                .ToListAsync();
            return Ok(subjects);
        }
    }
}
