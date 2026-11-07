using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.Helpers;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using System.Security.Claims;

namespace QuizesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // All endpoints require authentication as a baseline
    public class ExamDetailController : ControllerBase
    {
        private readonly IExamRepo _repo;
        private readonly ElsewedySchoolSysDbDevContext _context;
        private readonly ILogger<ExamDetailController> _logger;

        public ExamDetailController(IExamRepo repo, ElsewedySchoolSysDbDevContext context, ILogger<ExamDetailController> logger)
        {
            _repo = repo;
            _context = context;
            _logger = logger;
        }

        // ---------------------------------------------------------------------------
        // Internal helpers — delegate to ClaimsHelper to avoid duplication
        // ---------------------------------------------------------------------------

        private (long AccountId, List<string> Roles) GetRequesterInfo() =>
            ClaimsHelper.GetRequesterInfo(User);

        private static bool IsStaff(List<string> roles) =>
            ClaimsHelper.IsStaff(roles);

        // ---------------------------------------------------------------------------
        // GET /api/examdetail
        // Accessible by all authenticated users.
        // Students see only exams assigned to their class.
        // Staff (Teacher/Admin/Board/Superadmin) see all exams.
        // ---------------------------------------------------------------------------
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExamReadDto>>> GetAll()
        {
            var (accountId, roles) = GetRequesterInfo();

            var exams = await _repo.GetAllAsync();

            // Apply student-specific class filter
            if (accountId > 0 && !IsStaff(roles))
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId);

                if (studentExtension == null)
                {
                    // Student has no extension record — show all exams without class filtering.
                    // This is a safe fallback: the exam-start endpoint will enforce class checks
                    // independently. Showing exams in the listing does not grant access to them.
                }
                else if (!studentExtension.ClassId.HasValue)
                {
                    // Student has an extension record but no class assigned — show no exams
                    exams = Enumerable.Empty<ExamDetail>();
                }
                else
                {
                    var filterClassId = studentExtension.ClassId.Value.ToString();
                    exams = exams.Where(e =>
                        !string.IsNullOrEmpty(e.ClassId) &&
                        e.ClassId.Split(',', StringSplitOptions.RemoveEmptyEntries).Contains(filterClassId));
                }
            }

            return Ok(exams.Select(e => IsStaff(roles) ? MapToDto(e) : MapToDtoForStudent(e)));
        }

        // ---------------------------------------------------------------------------
        // GET /api/examdetail/{id}
        // Accessible by all authenticated users.
        // Students are blocked if the exam is not assigned to their class.
        // ---------------------------------------------------------------------------
        [HttpGet("{id}")]
        public async Task<ActionResult<ExamReadDto>> GetById(long id)
        {
            var exam = await _repo.GetByIdAsync(id);
            if (exam == null) return NotFound();

            var (accountId, roles) = GetRequesterInfo();

            // Student class-assignment check
            if (accountId > 0 && !IsStaff(roles))
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId);

                if (studentExtension != null && studentExtension.ClassId.HasValue)
                {
                    var studentClassId = studentExtension.ClassId.Value.ToString();
                    bool hasAccess = string.IsNullOrEmpty(exam.ClassId) ||
                                     exam.ClassId.Split(',', StringSplitOptions.RemoveEmptyEntries)
                                                 .Contains(studentClassId);

                    if (!hasAccess)
                        return StatusCode(403, new { message = "You do not have access to this exam. It is not assigned to your class." });
                }
            }

            return Ok(IsStaff(roles) ? MapToDto(exam) : MapToDtoForStudent(exam));
        }

        // ---------------------------------------------------------------------------
        // POST /api/examdetail
        // Only Teachers and Admin-level roles may create exams.
        // ---------------------------------------------------------------------------
        [HttpPost]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public async Task<ActionResult<ExamReadDto>> Create(ExamCreateDto dto)
        {
            _logger.LogInformation("[Create Exam] Title={Title}, GradeId={GradeId}, ClassIds={ClassIdsCount}",
                dto.Title, dto.GradeId, dto.ClassIds?.Count);
            try
            {
                var (accountId, _) = GetRequesterInfo();

                // For staff-created exams the creator is always the authenticated user.
                // We only fall back to the DTO value as a last resort for compatibility
                // with older clients, and only if it points to a real account.
                if (accountId <= 0 && dto.CreatedBy_AccID > 0)
                    accountId = dto.CreatedBy_AccID;

                if (accountId <= 0 && dto.CreatedBy.HasValue)
                    accountId = dto.CreatedBy.Value;

                if (accountId <= 0)
                    return BadRequest(new { message = "Unable to determine account ID. Please log in again." });

                var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
                if (!accountExists)
                    return BadRequest(new { message = $"Account with ID {accountId} does not exist." });

                // Resolve class IDs
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
                    return BadRequest(new { message = "At least one class must be selected." });

                _logger.LogInformation("[Create Exam] Creating exam for classes: {ClassIds}", string.Join(", ", classIdsToProcess));

                var newExam = new ExamDetail
                {
                    Title = dto.Title,
                    ExamSubject = dto.ExamSubject,
                    ExamDescription = dto.ExamDescription,
                    GradeId = dto.GradeId,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    CreatedBy_AccId = accountId,
                    SubjectId = dto.SubjectId
                };

                await _repo.AddAsync(newExam, dto.QuestionIds, classIdsToProcess);

                var savedExam = await _repo.GetByIdAsync(newExam.ExamId);
                if (savedExam == null) return NotFound();

                return CreatedAtAction(nameof(GetById), new { id = savedExam.ExamId }, MapToDto(savedExam));
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException?.Message ?? "No inner details";
                _logger.LogError(ex, "[Create Exam] Failed. Message={Message} | Inner={Inner}", ex.Message, innerMessage);
                return StatusCode(500, new { message = $"Error creating exam: {ex.Message}" });
            }
        }

        // ---------------------------------------------------------------------------
        // PUT /api/examdetail/{id}
        // Only Teachers and Admin-level roles may update exams.
        // ---------------------------------------------------------------------------
        [HttpPut("{id}")]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
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

                var classIds = new List<long>();
                if (dto.ClassIds != null && dto.ClassIds.Any())
                    classIds.AddRange(dto.ClassIds);
                else if (dto.ClassId.HasValue)
                    classIds.Add(dto.ClassId.Value);

                await _repo.UpdateAsync(exam, dto.QuestionIds, classIds);
                await _repo.SaveChangesAsync();

                var updatedExam = await _repo.GetByIdAsync(id);
                if (updatedExam == null) return NotFound();

                return Ok(MapToDto(updatedExam));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Update Exam] Failed for ExamId={ExamId}. Message={Message}", id, ex.Message);
                if (ex.InnerException != null)
                    _logger.LogError("[Update Exam] Inner exception: {Inner}", ex.InnerException.Message);

                return StatusCode(500, new { message = $"Failed to save exam: {ex.Message}" });
            }
        }

        // ---------------------------------------------------------------------------
        // DELETE /api/examdetail/{id}
        // Only Admin-level roles may delete exams.
        // ---------------------------------------------------------------------------
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Board,Superadmin")]
        public async Task<ActionResult> Delete(long id)
        {
            await _repo.DeleteAsync(id);
            await _repo.SaveChangesAsync();
            return NoContent();
        }

        // ---------------------------------------------------------------------------
        // GET /api/examdetail/subjects
        // Accessible by all authenticated users.
        // ---------------------------------------------------------------------------
        [HttpGet("subjects")]
        public async Task<ActionResult<IEnumerable<object>>> GetSubjects()
        {
            var subjects = await _context.Statuses
                .Where(s => s.BusinessEntity == "Exams")
                .Select(s => new { id = s.Id, statusName = s.StatusName })
                .ToListAsync();
            return Ok(subjects);
        }

        // ---------------------------------------------------------------------------
        // Mapping helpers
        // ---------------------------------------------------------------------------

        /// <summary>
        /// Full mapping used by Teachers and Admin-level roles.
        /// Includes CorrectAnswer so staff can manage and verify exam content.
        /// </summary>
        private static ExamReadDto MapToDto(ExamDetail e)
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
                StartDate = DateTime.SpecifyKind(e.StartDate.GetValueOrDefault(), DateTimeKind.Utc),
                EndDate = DateTime.SpecifyKind(e.EndDate.GetValueOrDefault(), DateTimeKind.Utc),
                Questions = e.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question!.QuestionId,
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
                        CorrectAnswer = eq.Question.CorrectAnswer,   // ← included for staff
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList(),
                TotalMarks = e.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0)
            };
        }

        /// <summary>
        /// Student-safe mapping.  Identical to MapToDto except CorrectAnswer is
        /// explicitly set to null so it is never serialised into the response.
        /// Used for GET /examdetail and GET /examdetail/{id} when the requester is a Student.
        ///
        /// NOTE: Students should start exams via the dedicated
        /// GET /studentexamanswer/student/{id}/exam/{id}/questions endpoint which uses the
        /// even more restrictive ExamForStudentDto.  This mapping covers the exam-listing
        /// page where questions are included in the list response for display purposes
        /// (question count, marks) but must not expose the correct answer.
        /// </summary>
        private static ExamReadDto MapToDtoForStudent(ExamDetail e)
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
                StartDate = DateTime.SpecifyKind(e.StartDate.GetValueOrDefault(), DateTimeKind.Utc),
                EndDate = DateTime.SpecifyKind(e.EndDate.GetValueOrDefault(), DateTimeKind.Utc),
                Questions = e.ExamQuestionBanks
                    .Where(eq => eq.Question != null)
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question!.QuestionId,
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
                        CorrectAnswer = null,    // ← never sent to students
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList(),
                TotalMarks = e.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0)
            };
        }
    }
}
