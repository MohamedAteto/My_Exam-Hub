using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using System.Security.Claims;
using System.Linq;

namespace QuizesApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ExamDetailController : ControllerBase
    {
        private readonly IExamRepo _repo;
        private readonly ElsewedySchoolContext _context;

        public ExamDetailController(IExamRepo repo, ElsewedySchoolContext context)
        {
            _repo = repo;
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ExamReadDto>>> GetAll()
        {
            // Extract account ID from JWT token
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            long? accountId = null;
            if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
            {
                accountId = tokenAccountId;
            }

            IQueryable<ExamDetail> examsQuery = _context.ExamDetails
                .Include(e => e.Subject)
                .Include(e => e.Grade)
                .Include(e => e.Class)
                .Include(e => e.Creator)
                .Include(e => e.ExamQuestionBanks)
                    .ThenInclude(eq => eq.Question)
                .Include(e => e.ExamClasses)
                    .ThenInclude(ec => ec.Class);

            // If user is a student, filter by their class using database-level join
            long? studentClassId = null;
            if (accountId.HasValue)
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId.Value);
                
                if (studentExtension != null && studentExtension.ClassId.HasValue)
                {
                    studentClassId = studentExtension.ClassId.Value;
                    
                    // Log for debugging
                    Console.WriteLine($"[Quiz Visibility] Student AccountId: {accountId}, ClassId: {studentClassId}");
                    
                    // Query: Get all exams where the student's ClassId matches ANY of the quiz's ExamClasses
                    // This uses a proper database join to filter at the database level
                    examsQuery = examsQuery
                        .Where(e => 
                            // Check if quiz is assigned to student's class via ExamClasses (many-to-many)
                            e.ExamClasses.Any(ec => ec.ClassId == studentClassId) ||
                            // Backward compatibility: check legacy ClassId field
                            (e.ClassId.HasValue && e.ClassId.Value == studentClassId)
                        )
                        .Distinct(); // Ensure no duplicates if a quiz is linked to multiple classes
                }
                else
                {
                    Console.WriteLine($"[Quiz Visibility] Student AccountId: {accountId} has no ClassId assigned - returning all quizzes");
                }
            }
            else
            {
                Console.WriteLine("[Quiz Visibility] No account ID found - returning all quizzes (likely teacher/admin)");
            }

            var exams = await examsQuery.ToListAsync();

            // Log which quizzes are being returned (after query execution)
            if (studentClassId.HasValue)
            {
                var examIds = exams.Select(e => e.ExamId).ToList();
                Console.WriteLine($"[Quiz Visibility] Returning {examIds.Count} quiz(es) for Student AccountId {accountId} (ClassId {studentClassId.Value}): [{string.Join(", ", examIds)}]");
                
                // Log which classes each quiz is assigned to (for debugging)
                foreach (var exam in exams)
                {
                    var assignedClassIds = exam.ExamClasses.Select(ec => ec.ClassId).ToList();
                    Console.WriteLine($"[Quiz Visibility]   Quiz {exam.ExamId} '{exam.Title}' assigned to classes: [{string.Join(", ", assignedClassIds)}]");
                }
            }

            return Ok(exams.Select(e => new ExamReadDto
            {
                ExamId = e.ExamId,
                Title = e.Title,
                ExamSubject = e.Subject?.SubjectName ?? string.Empty,
                ExamDescription = e.ExamDescription,
                Grade = e.Grade?.GradeName ?? string.Empty,
                Class = e.Class?.ClassName ?? string.Empty,
                StartDate = e.StartDate,
                EndDate = e.EndDate,
                Questions = e.ExamQuestionBanks
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
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

            // Extract account ID from JWT token
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            long? accountId = null;
            if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
            {
                accountId = tokenAccountId;
            }

            // If user is a student, check if they have access to this quiz
            if (accountId.HasValue)
            {
                var studentExtension = await _context.StudentExtensions
                    .FirstOrDefaultAsync(se => se.AccountId == accountId.Value);
                
                if (studentExtension != null && studentExtension.ClassId.HasValue)
                {
                    var studentClassId = studentExtension.ClassId.Value;
                    // Check if quiz is assigned to student's class
                    var hasAccess = exam.ExamClasses.Any(ec => ec.ClassId == studentClassId) ||
                                   (exam.ClassId.HasValue && exam.ClassId.Value == studentClassId); // Backward compatibility
                    
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
                ExamSubject = exam.Subject?.SubjectName ?? string.Empty,
                ExamDescription = exam.ExamDescription,
                Grade = exam.Grade?.GradeName ?? string.Empty,
                Class = exam.Class?.ClassName ?? string.Empty,
                StartDate = exam.StartDate,
                EndDate = exam.EndDate,
                Questions = exam.ExamQuestionBanks
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList()
            });
        }


        [HttpPost]
        public async Task<ActionResult<ExamReadDto>> Create(ExamCreateDto dto)  
        {
            // Extract account ID from JWT token
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
            else if (dto.CreatedBy.HasValue && dto.CreatedBy.Value > 0)
            {
                accountId = dto.CreatedBy.Value;
            }

            if (accountId <= 0)
            {
                return BadRequest(new { message = "Unable to determine account ID. Please log in again." });
            }

            // Validate that the account exists
            var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
            if (!accountExists)
            {
                return BadRequest(new { message = $"Account with ID {accountId} does not exist. Please log in again." });
            }

            // Resolve SubjectId from name if needed
            long? subjectId = dto.SubjectId;
            if (!subjectId.HasValue && !string.IsNullOrEmpty(dto.ExamSubject))
            {
                var subject = await _context.Subjects.FirstOrDefaultAsync(s => s.SubjectName == dto.ExamSubject);
                subjectId = subject?.Id;
            }

            // Resolve GradeId from name if needed
            long? gradeId = dto.GradeId;
            if (!gradeId.HasValue && !string.IsNullOrEmpty(dto.Grade))
            {
                var grade = await _context.Grades.FirstOrDefaultAsync(g => g.GradeName == dto.Grade);
                gradeId = grade?.Id;
            }

            // Resolve ClassId from name if needed (for backward compatibility)
            long? classId = dto.ClassId;
            if (!classId.HasValue && !string.IsNullOrEmpty(dto.Class))
            {
                var classEntity = await _context.TblClasses.FirstOrDefaultAsync(c => c.ClassName == dto.Class);
                classId = classEntity?.Id;
            }

            // Build list of class IDs (support multiple classes)
            var classIds = new List<long>();
            if (dto.ClassIds != null && dto.ClassIds.Count > 0)
            {
                // Convert class names to IDs if needed
                foreach (var classValue in dto.ClassIds)
                {
                    if (classValue is string className)
                    {
                        var classEntity = await _context.TblClasses.FirstOrDefaultAsync(c => c.ClassName == className);
                        if (classEntity != null && !classIds.Contains(classEntity.Id))
                        {
                            classIds.Add(classEntity.Id);
                        }
                    }
                    else if (classValue is long cId && !classIds.Contains(cId))
                    {
                        classIds.Add(cId);
                    }
                }
            }
            // Add single ClassId for backward compatibility if not already in list
            if (classId.HasValue && !classIds.Contains(classId.Value))
            {
                classIds.Add(classId.Value);
            }

            var newExam = new ExamDetail
            {
                Title = dto.Title,
                SubjectId = subjectId,
                ExamDescription = dto.ExamDescription,
                GradeId = gradeId,
                ClassId = classId, // Keep for backward compatibility
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                CreatedBy_AccID = accountId
            };

            // Add multiple classes using navigation property (EF Core will set ExamId automatically)
            foreach (var cId in classIds)
            {
                newExam.ExamClasses.Add(new ExamClass
                {
                    Exam = newExam, // Use navigation property - EF Core will set ExamId after save
                    ClassId = cId
                });
            }

            // Log class assignments for debugging
            if (classIds.Count > 0)
            {
                Console.WriteLine($"[Quiz Creation] Creating quiz '{dto.Title}' assigned to {classIds.Count} class(es): [{string.Join(", ", classIds)}]");
            }

            await _repo.AddAsync(newExam, dto.QuestionIds);
            await _repo.SaveChangesAsync();
            
            // Verify ExamClasses were saved correctly
            var savedExamClasses = await _context.ExamClasses
                .Where(ec => ec.ExamId == newExam.ExamId)
                .Select(ec => ec.ClassId)
                .ToListAsync();
            Console.WriteLine($"[Quiz Creation] Quiz {newExam.ExamId} saved with {savedExamClasses.Count} class assignment(s): [{string.Join(", ", savedExamClasses)}]");

            var savedExam = await _repo.GetByIdAsync(newExam.ExamId);
            if (savedExam == null) return NotFound();  

            var examDto = new ExamReadDto
            {
                ExamId = savedExam.ExamId,
                Title = savedExam.Title,
                ExamSubject = savedExam.Subject?.SubjectName ?? string.Empty,
                ExamDescription = savedExam.ExamDescription,
                Grade = savedExam.Grade?.GradeName ?? string.Empty,
                Class = savedExam.Class?.ClassName ?? string.Empty,
                StartDate = savedExam.StartDate,
                EndDate = savedExam.EndDate,
                Questions = savedExam.ExamQuestionBanks
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList()
            };

            return CreatedAtAction(nameof(GetById), new { id = newExam.ExamId }, examDto);
        }


        [HttpPut("{id}")]
        public async Task<ActionResult<ExamReadDto>> Update(long id, ExamUpdateDto dto)  // Change return type
        {
            var exam = await _repo.GetByIdAsync(id);
            if (exam == null) return NotFound();

            // Extract account ID from JWT token
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            long accountId = exam.CreatedBy_AccID; // Keep existing if token doesn't have it
            if (!string.IsNullOrEmpty(accountIdClaim) && long.TryParse(accountIdClaim, out long tokenAccountId))
            {
                accountId = tokenAccountId;
            }
            else if (dto.CreatedBy_AccID > 0)
            {
                accountId = dto.CreatedBy_AccID;
            }
            else if (dto.CreatedBy.HasValue && dto.CreatedBy.Value > 0)
            {
                accountId = dto.CreatedBy.Value;
            }

            // Validate that the account exists
            var accountExists = await _context.Accounts.AnyAsync(a => a.Id == accountId);
            if (!accountExists)
            {
                return BadRequest(new { message = $"Account with ID {accountId} does not exist. Please log in again." });
            }

            // Resolve SubjectId from name if needed
            long? subjectId = dto.SubjectId;
            if (!subjectId.HasValue && !string.IsNullOrEmpty(dto.ExamSubject))
            {
                var subject = await _context.Subjects.FirstOrDefaultAsync(s => s.SubjectName == dto.ExamSubject);
                subjectId = subject?.Id;
            }

            // Resolve GradeId from name if needed
            long? gradeId = dto.GradeId;
            if (!gradeId.HasValue && !string.IsNullOrEmpty(dto.Grade))
            {
                var grade = await _context.Grades.FirstOrDefaultAsync(g => g.GradeName == dto.Grade);
                gradeId = grade?.Id;
            }

            // Resolve ClassId from name if needed (for backward compatibility)
            long? classId = dto.ClassId;
            if (!classId.HasValue && !string.IsNullOrEmpty(dto.Class))
            {
                var classEntity = await _context.TblClasses.FirstOrDefaultAsync(c => c.ClassName == dto.Class);
                classId = classEntity?.Id;
            }

            // Build list of class IDs (support multiple classes)
            var classIds = new List<long>();
            if (dto.ClassIds != null && dto.ClassIds.Count > 0)
            {
                // Convert class names to IDs if needed
                foreach (var classValue in dto.ClassIds)
                {
                    if (classValue is string className)
                    {
                        var classEntity = await _context.TblClasses.FirstOrDefaultAsync(c => c.ClassName == className);
                        if (classEntity != null && !classIds.Contains(classEntity.Id))
                        {
                            classIds.Add(classEntity.Id);
                        }
                    }
                    else if (classValue is long cId && !classIds.Contains(cId))
                    {
                        classIds.Add(cId);
                    }
                }
            }
            // Add single ClassId for backward compatibility if not already in list
            if (classId.HasValue && !classIds.Contains(classId.Value))
            {
                classIds.Add(classId.Value);
            }

            exam.Title = dto.Title;
            exam.SubjectId = subjectId;
            exam.ExamDescription = dto.ExamDescription;
            exam.GradeId = gradeId;
            exam.ClassId = classId; // Keep for backward compatibility
            exam.StartDate = dto.StartDate;
            exam.EndDate = dto.EndDate;
            exam.CreatedBy_AccID = accountId;

            // Update multiple classes - remove old ones and add new ones
            var oldExamClasses = _context.ExamClasses.Where(ec => ec.ExamId == exam.ExamId).ToList();
            var oldClassIds = oldExamClasses.Select(ec => ec.ClassId).ToList();
            _context.ExamClasses.RemoveRange(oldExamClasses);
            
            // Log class assignment changes
            Console.WriteLine($"[Quiz Update] Updating quiz {exam.ExamId} '{dto.Title}' class assignments:");
            Console.WriteLine($"[Quiz Update]   Old classes: [{string.Join(", ", oldClassIds)}]");
            Console.WriteLine($"[Quiz Update]   New classes: [{string.Join(", ", classIds)}]");
            
            foreach (var cId in classIds)
            {
                exam.ExamClasses.Add(new ExamClass
                {
                    Exam = exam, // Use navigation property
                    ClassId = cId
                });
            }

            await _repo.UpdateAsync(exam, dto.QuestionIds);
            await _repo.SaveChangesAsync();

            // Fetch updated exam with includes
            var updatedExam = await _repo.GetByIdAsync(id);
            if (updatedExam == null) return NotFound();

            // Map to DTO (same as above)
            var examDto = new ExamReadDto
            {
                ExamId = updatedExam.ExamId,
                Title = updatedExam.Title,
                ExamSubject = updatedExam.Subject?.SubjectName ?? string.Empty,
                ExamDescription = updatedExam.ExamDescription,
                Grade = updatedExam.Grade?.GradeName ?? string.Empty,
                Class = updatedExam.Class?.ClassName ?? string.Empty,
                StartDate = updatedExam.StartDate,
                EndDate = updatedExam.EndDate,
                Questions = updatedExam.ExamQuestionBanks
                    .Select(eq => new QuestionBankReadDto
                    {
                        QuestionId = eq.Question.QuestionId,
                        QuestionTitle = eq.Question.QuestionTitle,
                        OptionA = eq.Question.OptionA,
                        OptionB = eq.Question.OptionB,
                        OptionC = eq.Question.OptionC,
                        OptionD = eq.Question.OptionD,
                        CorrectAnswer = eq.Question.CorrectAnswer,
                        QuestionSubject = eq.Question.QuestionSubject,
                        Mark = eq.Question.Mark ?? 0
                    }).ToList()
            };

            return Ok(examDto);  // Or CreatedAtAction if preferred
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
