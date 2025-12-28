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

            string? studentClassName = null;

            if (accountId.HasValue)
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId.Value);
                
                if (studentExtension != null && studentExtension.ClassId.HasValue)
                {
                    var cls = await _context.TblClasses.FindAsync(studentExtension.ClassId.Value);
                    if (cls != null)
                    {
                        studentClassName = cls.ClassName;
                    }
                }
                    
                if (!string.IsNullOrEmpty(studentClassName))
                {
                    exams = exams.Where(e => e.Class == studentClassName);
                }
            }

            return Ok(exams.Select(e => new ExamReadDto
            {
                ExamId = e.ExamId,
                Title = e.Title,
                ExamSubject = e.ExamSubject ?? string.Empty,
                ExamDescription = e.ExamDescription,
                Grade = e.Grade ?? string.Empty,
                Class = e.Class ?? string.Empty,
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
                    var cls = await _context.TblClasses.FindAsync(studentExtension.ClassId.Value);
                    if (cls != null)
                    {
                        var studentClassName = cls.ClassName;
                        bool hasAccess = string.IsNullOrEmpty(exam.Class) || exam.Class == studentClassName;

                        if (!hasAccess)
                        {
                            return StatusCode(403, new { message = "You do not have access to this quiz. It is not assigned to your class." });
                        }
                    }
                }
            }

            return Ok(new ExamReadDto
            {
                ExamId = exam.ExamId,
                Title = exam.Title,
                ExamSubject = exam.ExamSubject ?? string.Empty,
                ExamDescription = exam.ExamDescription,
                Grade = exam.Grade ?? string.Empty,
                Class = exam.Class ?? string.Empty,
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

            var newExam = new ExamDetail
            {
                Title = dto.Title,
                ExamSubject = dto.ExamSubject,
                ExamDescription = dto.ExamDescription,
                Grade = dto.Grade,
                Class = dto.Class,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate
            };
            
            await _repo.AddAsync(newExam, dto.QuestionIds);
            await _repo.SaveChangesAsync();

            var savedExam = await _repo.GetByIdAsync(newExam.ExamId);
            if (savedExam == null) return NotFound();

            var examDto = new ExamReadDto
            {
                ExamId = savedExam.ExamId,
                Title = savedExam.Title,
                ExamSubject = savedExam.ExamSubject ?? string.Empty,
                ExamDescription = savedExam.ExamDescription,
                Grade = savedExam.Grade ?? string.Empty,
                Class = savedExam.Class ?? string.Empty,
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

            return CreatedAtAction(nameof(GetById), new { id = newExam.ExamId }, examDto);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ExamReadDto>> Update(long id, ExamUpdateDto dto)
        {
            var exam = await _repo.GetByIdAsync(id);
            if (exam == null) return NotFound();

            exam.Title = dto.Title;
            exam.ExamSubject = dto.ExamSubject;
            exam.ExamDescription = dto.ExamDescription;
            exam.Grade = dto.Grade;
            exam.Class = dto.Class;
            exam.StartDate = dto.StartDate;
            exam.EndDate = dto.EndDate;

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
                Grade = updatedExam.Grade ?? string.Empty,
                Class = updatedExam.Class ?? string.Empty,
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
