using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using System.Security.Claims;

namespace QuizesApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardRepo _dashboardRepo;
    private readonly ElsewedySchoolSysDbDevContext _context;
    private readonly ILogger<DashboardController> _logger;

    public DashboardController(
        IDashboardRepo dashboardRepo,
        ElsewedySchoolSysDbDevContext context,
        ILogger<DashboardController> logger)
    {
        _dashboardRepo = dashboardRepo;
        _context = context;
        _logger = logger;
    }

    [HttpGet("lookup-data")]
    [Authorize]
    public async Task<ActionResult> GetLookupData()
    {
        var gradeRecords = await _context.Grades.AsNoTracking()
            .Where(g => AcademicLookup.SupportedGradeNames.Contains(g.GradeName.ToLower()))
            .OrderBy(g => g.Id)
            .ToListAsync();
        var gradePrefixes = gradeRecords.ToDictionary(g => g.Id, g => AcademicLookup.GetClassPrefix(g.GradeName));
        var gradeIds = gradeRecords.Select(g => g.Id).ToList();
        var classRecords = await _context.TblClasses.AsNoTracking()
            .Where(c => gradeIds.Contains(c.GradeId))
            .OrderBy(c => c.Id)
            .ToListAsync();
        var grades = gradeRecords
            .Select(g => new { id = g.Id, gradeName = g.GradeName })
            .ToList();
        var classes = classRecords
            .Where(c => gradePrefixes.TryGetValue(c.GradeId, out var prefix) &&
                        AcademicLookup.IsSupportedClassName(c.ClassName, prefix))
            .Select(c => new { id = c.Id, className = c.ClassName, gradeId = c.GradeId })
            .ToList();
        
        var exams = await _context.ExamDetails.ToListAsync();

        var mappedExams = exams.Select(e => {
            return new {
                e.ExamId,
                e.Title,
                GradeId = e.GradeId,
                ClassId = e.ClassId,
                Classes = !string.IsNullOrEmpty(e.ClassId) 
                    ? e.ClassId.Split(',', StringSplitOptions.RemoveEmptyEntries)
                               .Select(s => long.TryParse(s, out long id) ? id : 0)
                               .Where(id => id > 0)
                               .ToList()
                    : new List<long>()
            };
        });

        var subjects = await _context.Statuses
            .Where(s => s.BusinessEntity == "Exams")
            .Select(s => new { id = s.Id, statusName = s.StatusName })
            .ToListAsync();

        return Ok(new { grades, classes, subjects, exams = mappedExams });
    }

    /// <summary>
    /// Get dashboard data for a specific student
    /// </summary>
    /// <param name="id">Student account ID</param>
    /// <returns>Student dashboard with exam statistics and leaderboard</returns>
    [HttpGet("student/{id}")]
    [Authorize] // Requires authentication
    public async Task<ActionResult<StudentDashboardDto>> GetStudentDashboard(
        long id,
        [FromQuery] long? gradeId = null,
        [FromQuery] long? classId = null,
        [FromQuery] long? subjectId = null,
        [FromQuery] long? examId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            // Validate date range
            if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            {
                return BadRequest(new { message = "Start date must be before or equal to end date" });
            }

            var filters = new LeaderboardFilterDto
            {
                GradeId = gradeId,
                ClassId = classId,
                SubjectId = subjectId,
                ExamId = examId,
                StartDate = startDate,
                EndDate = endDate
            };
            // Optional: Verify the requesting user is the student or an admin
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            var isAdmin = roles.Contains("Superadmin") || roles.Contains("Admin") || roles.Contains("Board");
            var isSelf = accountIdClaim != null && long.TryParse(accountIdClaim, out long requesterId) && requesterId == id;

            if (!isAdmin && !isSelf)
            {
                return Forbid();
            }

            var dashboard = await _dashboardRepo.GetStudentDashboardAsync(id, filters);
            
            if (dashboard == null)
                return NotFound(new { message = "Student not found" });

            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve student dashboard for account {AccountId}", id);
            return StatusCode(500, new { message = "Unable to load the student dashboard" });
        }
    }

    /// <summary>
    /// Get dashboard data for a specific teacher
    /// </summary>
    /// <param name="id">Teacher account ID</param>
    /// <returns>Teacher dashboard with exam statistics and student performance</returns>
    [HttpGet("teacher/{id}")]
    [Authorize] // Requires authentication
    public async Task<ActionResult<TeacherDashboardDto>> GetTeacherDashboard(
        long id,
        [FromQuery] long? gradeId = null,
        [FromQuery] long? classId = null,
        [FromQuery] long? subjectId = null,
        [FromQuery] long? examId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            // Validate date range
            if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            {
                return BadRequest(new { message = "Start date must be before or equal to end date" });
            }

            var filters = new LeaderboardFilterDto
            {
                GradeId = gradeId,
                ClassId = classId,
                SubjectId = subjectId,
                ExamId = examId,
                StartDate = startDate,
                EndDate = endDate
            };
            // Optional: Verify the requesting user is the teacher or an admin
            var accountIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value 
                ?? User.FindFirst("sub")?.Value 
                ?? User.FindFirst("id")?.Value;
            
            var roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
            var isAdmin = roles.Contains("Superadmin") || roles.Contains("Admin") || roles.Contains("Board");
            var isSelf = accountIdClaim != null && long.TryParse(accountIdClaim, out long requesterId) && requesterId == id;

            if (!isAdmin && !isSelf)
            {
                return Forbid();
            }

            var dashboard = await _dashboardRepo.GetTeacherDashboardAsync(id, filters);
            
            if (dashboard == null)
                return NotFound(new { message = "Teacher not found" });

            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve teacher dashboard for account {AccountId}", id);
            return StatusCode(500, new { message = "Unable to load the teacher dashboard" });
        }
    }

    /// <summary>
    /// Get global dashboard data for superadmin
    /// </summary>
    /// <returns>Superadmin dashboard with global statistics</returns>
    [HttpGet("superadmin")]
    [Authorize(Roles = "Superadmin,Admin,Board")] // Only superadmin/admin/board can access
    public async Task<ActionResult<SuperadminDashboardDto>> GetSuperadminDashboard(
        [FromQuery] long? gradeId = null,
        [FromQuery] long? classId = null,
        [FromQuery] long? subjectId = null,
        [FromQuery] long? examId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null)
    {
        try
        {
            // Validate date range
            if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            {
                return BadRequest(new { message = "Start date must be before or equal to end date" });
            }

            var filters = new LeaderboardFilterDto
            {
                GradeId = gradeId,
                ClassId = classId,
                SubjectId = subjectId,
                ExamId = examId,
                StartDate = startDate,
                EndDate = endDate
            };

            var dashboard = await _dashboardRepo.GetSuperadminDashboardAsync(filters);
            return Ok(dashboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve the system dashboard");
            return StatusCode(500, new { message = "Unable to load the system dashboard" });
        }
    }

    /// <summary>
    /// Get leaderboard for a specific exam with optional filters
    /// </summary>
    /// <param name="examId">Exam ID</param>
    /// <param name="gradeId">Optional: Filter by grade</param>
    /// <param name="classId">Optional: Filter by class</param>
    /// <param name="startDate">Optional: Filter by start date</param>
    /// <param name="endDate">Optional: Filter by end date</param>
    /// <returns>Leaderboard with top students and highlighted performers</returns>
    [HttpGet("leaderboard/{examId}")]
    [Authorize] // Requires authentication
    public async Task<ActionResult<LeaderboardDto>> GetLeaderboard(
        long examId,
        [FromQuery] long? gradeId = null,
        [FromQuery] long? classId = null,
        [FromQuery] long? subjectId = null,
        [FromQuery] long? examIdParam = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string groupBy = "Student")
    {
        try
        {
            // Validate date range
            if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            {
                return BadRequest(new { message = "Start date must be before or equal to end date" });
            }

            var filters = new LeaderboardFilterDto
            {
                GradeId = gradeId,
                ClassId = classId,
                SubjectId = subjectId,
                ExamId = examIdParam ?? examId,
                StartDate = startDate,
                EndDate = endDate,
                GroupBy = groupBy
            };

            var leaderboard = await _dashboardRepo.GetLeaderboardAsync(examId, filters);
            
            if (leaderboard == null)
                return NotFound(new { message = "Exam not found" });

            return Ok(leaderboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve leaderboard for exam {ExamId}", examId);
            return StatusCode(500, new { message = "Unable to load the leaderboard" });
        }
    }

    /// <summary>
    /// Get combined leaderboard for a specific grade (aggregated scores from all exams)
    /// </summary>
    /// <param name="gradeId">Optional: Filter by grade</param>
    /// <returns>Combined leaderboard</returns>
    [HttpGet("leaderboard/combined")]
    [Authorize]
    public async Task<ActionResult<LeaderboardDto>> GetCombinedLeaderboard(
        [FromQuery] long? gradeId = null,
        [FromQuery] long? classId = null,
        [FromQuery] long? examId = null,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] string groupBy = "Student")
    {
        try
        {
            if (startDate.HasValue && endDate.HasValue && startDate.Value > endDate.Value)
            {
                return BadRequest(new { message = "Start date must be before or equal to end date" });
            }

            var filters = new LeaderboardFilterDto
            {
                GradeId = gradeId,
                ClassId = classId,
                ExamId = examId,
                StartDate = startDate,
                EndDate = endDate,
                GroupBy = groupBy
            };
            var leaderboard = await _dashboardRepo.GetCombinedLeaderboardAsync(filters);
            return Ok(leaderboard);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve combined leaderboard");
            return StatusCode(500, new { message = "Unable to load the leaderboard" });
        }
    }

    /// <summary>
    /// Get statistics for a specific exam
    /// </summary>
    /// <param name="examId">Exam ID</param>
    /// <returns>Exam statistics including pass/fail rates</returns>
    [HttpGet("exam/{examId}/stats")]
    [Authorize] // Requires authentication
    public async Task<ActionResult<ExamStatsDto>> GetExamStats(long examId)
    {
        try
        {
            var stats = await _dashboardRepo.GetExamStatsAsync(examId);
            
            if (stats == null)
                return NotFound(new { message = "Exam not found" });

            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve statistics for exam {ExamId}", examId);
            return StatusCode(500, new { message = "Unable to load exam statistics" });
        }
    }

    [HttpGet("teachers")]
    [Authorize(Roles = "Superadmin,Admin,Board")]
    public async Task<ActionResult<List<TeacherAccountDto>>> GetTeachers()
    {
        try
        {
            var teachers = await _dashboardRepo.GetTeachersAsync();
            return Ok(teachers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve teachers");
            return StatusCode(500, new { message = "Unable to load teachers" });
        }
    }

    [HttpGet("students")]
    [Authorize(Roles = "Teacher,Admin,Superadmin,Board")]
    public async Task<ActionResult<List<StudentPerformanceDto>>> GetStudents()
    {
        try
        {
            var students = await _dashboardRepo.GetStudentsAsync();
            return Ok(students);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to retrieve students");
            return StatusCode(500, new { message = "Unable to load students" });
        }
    }
}
