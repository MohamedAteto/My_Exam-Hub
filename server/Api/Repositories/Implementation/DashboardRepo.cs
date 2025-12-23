using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;

namespace QuizesApi.Repositories.Implementation;

public class DashboardRepo : IDashboardRepo
{
    private readonly ElsewedySchoolContext _context;
    private const double PassThreshold = 50.0; // 50% or higher is a pass

    public DashboardRepo(ElsewedySchoolContext context)
    {
        _context = context;
    }

    public async Task<StudentDashboardDto?> GetStudentDashboardAsync(long studentId, LeaderboardFilterDto? filters = null)
    {
        // Verify student exists
        var student = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Id == studentId);
        
        if (student == null)
            return null;

        // Get all exams
        var examsQuery = _context.ExamDetails
            .Include(e => e.Grade)
            .Include(e => e.Class)
            .Include(e => e.ExamClasses)
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .AsQueryable();

        // Apply filters
        examsQuery = ApplyFilters(examsQuery, filters);

        var exams = await examsQuery.ToListAsync();
        var filteredExamIds = exams.Select(e => e.ExamId).ToList();

        // Get student's taken exams within the filtered set
        var studentExams = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == studentId && filteredExamIds.Contains(sea.ExamId))
            .Select(sea => sea.ExamId)
            .Distinct()
            .ToListAsync();

        var totalExamsTaken = studentExams.Count;

        // Calculate pass/fail statistics
        int passedExams = 0;
        int failedExams = 0;
        long? latestExamId = null;
        DateTime? latestExamDate = null;

        foreach (var examId in studentExams)
        {
            var exam = exams.FirstOrDefault(e => e.ExamId == examId);
            if (exam == null) continue;

            var answers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == studentId && sea.ExamId == examId)
                .ToListAsync();

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

            var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;

            if (score >= PassThreshold)
                passedExams++;
            else
                failedExams++;

            // Track latest exam
            if (latestExamDate == null || exam.EndDate > latestExamDate)
            {
                latestExamDate = exam.EndDate;
                latestExamId = examId;
            }
        }

        // Calculate percentages ensuring they sum to 100%
        double passPercentage = totalExamsTaken > 0 ? Math.Round((double)passedExams / totalExamsTaken * 100, 2) : 0;
        double failPercentage = totalExamsTaken > 0 ? Math.Round(100 - passPercentage, 2) : 0;

        // Get leaderboard for latest exam
        LeaderboardDto? latestExamLeaderboard = null;
        int? studentRank = null;

        if (latestExamId.HasValue)
        {
            latestExamLeaderboard = await GetLeaderboardAsync(latestExamId.Value, filters);
            studentRank = latestExamLeaderboard?.TopStudents
                .FirstOrDefault(s => s.StudentId == studentId)?.Rank;
        }

        return new StudentDashboardDto
        {
            StudentId = studentId,
            StudentName = student.FullNameEn,
            TotalExamsTaken = totalExamsTaken,
            PassPercentage = passPercentage,
            FailPercentage = failPercentage,
            LatestExamLeaderboard = latestExamLeaderboard,
            StudentRankInLatestExam = studentRank,
            RecentExams = exams
                .Where(e => studentExams.Contains(e.ExamId))
                .OrderByDescending(e => e.EndDate)
                .Take(10)
                .Select(e => new ExamSelectionDto
                {
                    ExamId = e.ExamId,
                    Title = e.Title
                })
                .ToList()
        };
    }

    public async Task<TeacherDashboardDto?> GetTeacherDashboardAsync(long teacherId, LeaderboardFilterDto? filters = null)
    {
        // Verify teacher exists
        var teacher = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Id == teacherId);
        
        if (teacher == null)
            return null;

        // Get all exams created by this teacher
        var examsQuery = _context.ExamDetails
            .Where(e => e.CreatedBy_AccID == teacherId)
            .Include(e => e.Grade)
            .Include(e => e.Class)
            .Include(e => e.ExamClasses)
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .AsQueryable();

        // Apply filters
        examsQuery = ApplyFilters(examsQuery, filters);

        var exams = await examsQuery.ToListAsync();

        var totalExamsCreated = exams.Count;
        var examBreakdown = new List<ExamStatsDto>();
        
        int totalPassedAcrossAllExams = 0;
        int totalFailedAcrossAllExams = 0;
        var uniqueStudents = new HashSet<long>();

        foreach (var exam in exams)
        {
            var stats = await GetExamStatsAsync(exam.ExamId);
            if (stats != null)
            {
                examBreakdown.Add(stats);
                totalPassedAcrossAllExams += stats.PassedStudents;
                totalFailedAcrossAllExams += stats.FailedStudents;

                // Track unique students
                var studentsInExam = await _context.StudentExamAnswers
                    .Where(sea => sea.ExamId == exam.ExamId)
                    .Select(sea => sea.AccountId)
                    .Distinct()
                    .ToListAsync();
                
                foreach (var studentId in studentsInExam)
                    uniqueStudents.Add(studentId);
            }
        }

        // Calculate average percentages ensuring they sum to 100%
        int totalStudentExamInstances = totalPassedAcrossAllExams + totalFailedAcrossAllExams;
        double avgPassPercentage = totalStudentExamInstances > 0 
            ? Math.Round((double)totalPassedAcrossAllExams / totalStudentExamInstances * 100, 2) 
            : 0;
        double avgFailPercentage = totalStudentExamInstances > 0 
            ? Math.Round(100 - avgPassPercentage, 2) 
            : 0;

        // Get recent exams for dropdown (last 10)
        var recentExams = exams
            .OrderByDescending(e => e.EndDate)
            .Take(10)
            .Select(e => new ExamSelectionDto
            {
                ExamId = e.ExamId,
                Title = e.Title
            })
            .ToList();

        // Get leaderboard for the latest exam
        LeaderboardDto? latestExamLeaderboard = null;
        var latestExam = exams.OrderByDescending(e => e.EndDate).FirstOrDefault();
        if (latestExam != null)
        {
            latestExamLeaderboard = await GetLeaderboardAsync(latestExam.ExamId, filters);
        }

        return new TeacherDashboardDto
        {
            TeacherId = teacherId,
            TeacherName = teacher.FullNameEn,
            TotalExamsCreated = totalExamsCreated,
            AveragePassPercentage = avgPassPercentage,
            AverageFailPercentage = avgFailPercentage,
            TotalStudentsWhoTookExams = uniqueStudents.Count,
            ExamBreakdown = examBreakdown,
            RecentExams = recentExams,
            LatestExamLeaderboard = latestExamLeaderboard
        };
    }

    public async Task<SuperadminDashboardDto> GetSuperadminDashboardAsync(LeaderboardFilterDto? filters = null)
    {
        // Get all exams
        var examsQuery = _context.ExamDetails
            .Include(e => e.Grade)
            .Include(e => e.Class)
            .Include(e => e.ExamClasses)
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .AsQueryable();

        // Apply filters
        var filteredExamsQuery = ApplyFilters(examsQuery, filters);

        var allFilteredExams = await filteredExamsQuery.ToListAsync();
        var totalExams = allFilteredExams.Count;
        
        var filteredExamIds = allFilteredExams.Select(e => e.ExamId).ToList();

        // Get total counts of students and teachers who took these filtered exams
        // If we want "all students in system", we don't filter them. But user said "filters should apply"
        // Let's assume stats cards (total exams, pass/fail) should be filtered.
        
        var totalStudents = await _context.AccountRoles
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Student")
            .Select(x => x.AccountId)
            .Distinct()
            .CountAsync();

        var totalTeachers = await _context.AccountRoles
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Teacher")
            .Select(x => x.AccountId)
            .Distinct()
            .CountAsync();

        int totalPassed = 0;
        int totalFailed = 0;

        foreach (var exam in allFilteredExams)
        {
            var stats = await GetExamStatsAsync(exam.ExamId);
            if (stats != null)
            {
                totalPassed += stats.PassedStudents;
                totalFailed += stats.FailedStudents;
            }
        }

        int totalStudentExamInstances = totalPassed + totalFailed;
        double overallPassPercentage = totalStudentExamInstances > 0 
            ? Math.Round((double)totalPassed / totalStudentExamInstances * 100, 2) 
            : 0;
        double overallFailPercentage = totalStudentExamInstances > 0 
            ? Math.Round(100 - overallPassPercentage, 2) 
            : 0;

        // Get top performing students (top 10)
        var topStudents = await GetTopPerformingStudentsAsync(10);

        // Get top performing teachers
        var topTeachers = await GetTopPerformingTeachersAsync(10);

        // Get recent activity
        var recentActivity = await GetRecentActivityAsync(20);

        return new SuperadminDashboardDto
        {
            TotalExams = totalExams,
            TotalStudents = totalStudents,
            TotalTeachers = totalTeachers,
            OverallPassPercentage = overallPassPercentage,
            OverallFailPercentage = overallFailPercentage,
            TopPerformingStudents = topStudents,
            TopPerformingTeachers = topTeachers,
            RecentActivity = recentActivity
        };
    }

    public async Task<LeaderboardDto?> GetLeaderboardAsync(long examId, LeaderboardFilterDto? filters = null)
    {
        var exam = await _context.ExamDetails
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .FirstOrDefaultAsync(e => e.ExamId == examId);

        if (exam == null)
            return null;

        // Create a separate query for answers to apply class filter
        var studentAnswersQuery = _context.StudentExamAnswers
            .Where(sea => sea.ExamId == examId)
            .Include(sea => sea.Account)
            .AsQueryable();

        // Apply filters to participants
        if (filters != null)
        {
            if (filters.GradeId.HasValue && exam.GradeId != filters.GradeId.Value)
            {
                // If the exam itself doesn't match the grade filter, return empty leaderboard
                return new LeaderboardDto { ExamId = examId, ExamTitle = exam.Title, TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
            }

            if (filters.ClassId.HasValue)
            {
                // Filter students by class
                var studentIdsInClass = await _context.StudentExtensions
                    .Where(se => se.ClassId == filters.ClassId.Value)
                    .Select(se => se.AccountId)
                    .ToListAsync();

                studentAnswersQuery = studentAnswersQuery.Where(sea => studentIdsInClass.Contains(sea.AccountId));
            }

            // Note: Date filters for leaderboard usually apply to the exam's date range, 
            // but the exam is already selected here. If we want to be strict:
            if (filters.StartDate.HasValue && exam.EndDate < filters.StartDate.Value)
                return new LeaderboardDto { ExamId = examId, ExamTitle = exam.Title, TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
            if (filters.EndDate.HasValue && exam.StartDate > filters.EndDate.Value)
                return new LeaderboardDto { ExamId = examId, ExamTitle = exam.Title, TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
        }

        var studentAnswers = await studentAnswersQuery.ToListAsync();
        var studentIds = studentAnswers.Select(sa => sa.AccountId).Distinct().ToList();

        // Calculate scores for each student
        var leaderboardEntries = new List<LeaderboardEntryDto>();

        foreach (var studentId in studentIds)
        {
            var student = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == studentId);
            if (student == null) continue;

            var answers = studentAnswers.Where(sa => sa.AccountId == studentId).ToList();
            
            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

            var score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0;

            leaderboardEntries.Add(new LeaderboardEntryDto
            {
                StudentId = studentId,
                StudentName = student.FullNameEn,
                Score = score,
                TotalMarks = (int)totalMarks,
                EarnedMarks = (int)earnedMarks,
                Rank = 0 // Will be set after sorting
            });
        }

        // Sort by score descending and assign ranks
        leaderboardEntries = leaderboardEntries.OrderByDescending(e => e.Score).ToList();
        for (int i = 0; i < leaderboardEntries.Count; i++)
        {
            leaderboardEntries[i].Rank = i + 1;
        }

        // Get top 5-10 students
        var topStudents = leaderboardEntries.Take(10).ToList();

        // Get top 3 highlighted students (highest scores)
        var highlightedStudents = leaderboardEntries.Take(3).ToList();

        return new LeaderboardDto
        {
            ExamId = examId,
            ExamTitle = exam.Title,
            TopStudents = topStudents,
            HighlightedStudents = highlightedStudents,
            TotalParticipants = leaderboardEntries.Count
        };
    }

    public async Task<ExamStatsDto?> GetExamStatsAsync(long examId)
    {
        var exam = await _context.ExamDetails
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .FirstOrDefaultAsync(e => e.ExamId == examId);

        if (exam == null)
            return null;

        // Get all students who took this exam
        var studentIds = await _context.StudentExamAnswers
            .Where(sea => sea.ExamId == examId)
            .Select(sea => sea.AccountId)
            .Distinct()
            .ToListAsync();

        int totalStudents = studentIds.Count;
        int passedStudents = 0;
        int failedStudents = 0;
        double totalScore = 0;

        foreach (var studentId in studentIds)
        {
            var answers = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == studentId && sea.ExamId == examId)
                .ToListAsync();

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

            var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;
            totalScore += score;

            if (score >= PassThreshold)
                passedStudents++;
            else
                failedStudents++;
        }

        // Calculate percentages ensuring they sum to 100%
        double passPercentage = totalStudents > 0 ? Math.Round((double)passedStudents / totalStudents * 100, 2) : 0;
        double failPercentage = totalStudents > 0 ? Math.Round(100 - passPercentage, 2) : 0;
        double averageScore = totalStudents > 0 ? Math.Round(totalScore / totalStudents, 2) : 0;

        return new ExamStatsDto
        {
            ExamId = examId,
            ExamTitle = exam.Title,
            TotalStudents = totalStudents,
            PassedStudents = passedStudents,
            FailedStudents = failedStudents,
            PassPercentage = passPercentage,
            FailPercentage = failPercentage,
            AverageScore = averageScore
        };
    }

    private async Task<List<LeaderboardEntryDto>> GetTopPerformingStudentsAsync(int count)
    {
        // Get all students
        var studentIds = await _context.AccountRoles
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Student")
            .Select(x => x.AccountId)
            .Distinct()
            .ToListAsync();

        var studentPerformances = new List<(long StudentId, string StudentName, double AverageScore)>();

        foreach (var studentId in studentIds)
        {
            var student = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == studentId);
            if (student == null) continue;

            var examIds = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == studentId)
                .Select(sea => sea.ExamId)
                .Distinct()
                .ToListAsync();

            if (examIds.Count == 0) continue;

            double totalScore = 0;
            int examCount = 0;

            foreach (var examId in examIds)
            {
                var exam = await _context.ExamDetails
                    .Include(e => e.ExamQuestionBanks)
                    .ThenInclude(eq => eq.Question)
                    .FirstOrDefaultAsync(e => e.ExamId == examId);

                if (exam == null) continue;

                var answers = await _context.StudentExamAnswers
                    .Where(sea => sea.AccountId == studentId && sea.ExamId == examId)
                    .ToListAsync();

                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
                var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

                var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;
                totalScore += score;
                examCount++;
            }

            var averageScore = examCount > 0 ? totalScore / examCount : 0;
            if (studentId.HasValue)
                studentPerformances.Add((studentId.Value, student.FullNameEn, averageScore));
        }

        return studentPerformances
            .OrderByDescending(sp => sp.AverageScore)
            .Take(count)
            .Select((sp, index) => new LeaderboardEntryDto
            {
                StudentId = sp.StudentId,
                StudentName = sp.StudentName,
                Score = Math.Round(sp.AverageScore, 2),
                Rank = index + 1,
                TotalMarks = 0,
                EarnedMarks = 0
            })
            .ToList();
    }

    private async Task<List<TopTeacherDto>> GetTopPerformingTeachersAsync(int count)
    {
        var teacherIds = await _context.AccountRoles
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Teacher")
            .Select(x => x.AccountId)
            .Distinct()
            .ToListAsync();

        var teacherPerformances = new List<TopTeacherDto>();

        foreach (var teacherId in teacherIds)
        {
            var teacher = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == teacherId);
            if (teacher == null) continue;

            var exams = await _context.ExamDetails
                .Where(e => e.CreatedBy_AccID == teacherId)
                .Include(e => e.ExamQuestionBanks)
                .ThenInclude(eq => eq.Question)
                .ToListAsync();

            if (exams.Count == 0) continue;

            double totalScore = 0;
            int totalStudents = 0;

            foreach (var exam in exams)
            {
                var studentIds = await _context.StudentExamAnswers
                    .Where(sea => sea.ExamId == exam.ExamId)
                    .Select(sea => sea.AccountId)
                    .Distinct()
                    .ToListAsync();

                foreach (var studentId in studentIds)
                {
                    var answers = await _context.StudentExamAnswers
                        .Where(sea => sea.AccountId == studentId && sea.ExamId == exam.ExamId)
                        .ToListAsync();

                    var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
                    var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                        exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

                    var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;
                    totalScore += score;
                    totalStudents++;
                }
            }

            var averageScore = totalStudents > 0 ? totalScore / totalStudents : 0;

            teacherPerformances.Add(new TopTeacherDto
            {
                TeacherId = teacherId.HasValue ? teacherId.Value : 0,
                TeacherName = teacher.FullNameEn,
                TotalExams = exams.Count,
                AverageStudentScore = Math.Round(averageScore, 2),
                TotalStudents = totalStudents
            });
        }

        return teacherPerformances
            .OrderByDescending(tp => tp.AverageStudentScore)
            .Take(count)
            .ToList();
    }

    private async Task<List<RecentActivityDto>> GetRecentActivityAsync(int count)
    {
        var activities = new List<RecentActivityDto>();

        // Get recent exams created
        var recentExams = await _context.ExamDetails
            .OrderByDescending(e => e.StartDate)
            .Take(count / 2)
            .ToListAsync();

        foreach (var exam in recentExams)
        {
            var creator = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == exam.CreatedBy_AccID);
            activities.Add(new RecentActivityDto
            {
                ActivityType = "ExamCreated",
                Description = $"Exam '{exam.Title}' created by {creator?.FullNameEn ?? "Unknown"}",
                Timestamp = exam.StartDate,
                RelatedExamId = exam.ExamId,
                RelatedAccountId = exam.CreatedBy_AccID
            });
        }

        // Get recent exam completions (approximate by looking at recent answers)
        var recentAnswers = await _context.StudentExamAnswers
            .GroupBy(sea => new { sea.ExamId, sea.AccountId })
            .Select(g => new { g.Key.ExamId, g.Key.AccountId, LatestAnswer = g.Max(sea => sea.Id) })
            .OrderByDescending(x => x.LatestAnswer)
            .Take(count / 2)
            .ToListAsync();

        foreach (var answer in recentAnswers)
        {
            var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == answer.ExamId);
            var student = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == answer.AccountId);
            
            if (exam != null && student != null)
            {
                activities.Add(new RecentActivityDto
                {
                    ActivityType = "ExamCompleted",
                    Description = $"{student.FullNameEn} completed exam '{exam.Title}'",
                    Timestamp = exam.EndDate,
                    RelatedExamId = exam.ExamId,
                    RelatedAccountId = answer.AccountId
                });
            }
        }

        return activities
            .OrderByDescending(a => a.Timestamp)
            .Take(count)
            .ToList();
    }

    private IQueryable<ExamDetail> ApplyFilters(IQueryable<ExamDetail> query, LeaderboardFilterDto? filters)
    {
        if (filters == null) return query;

        Console.WriteLine($"[APPLY_FILTER] Start count: {query.Count()}");

        if (filters.GradeId.HasValue)
        {
            query = query.Where(e => e.GradeId == filters.GradeId.Value);
            Console.WriteLine($"[APPLY_FILTER] After Grade({filters.GradeId}): {query.Count()}");
        }

        if (filters.ClassId.HasValue)
        {
            query = query.Where(e => e.ClassId == filters.ClassId.Value || e.ExamClasses.Any(ec => ec.ClassId == filters.ClassId.Value));
            Console.WriteLine($"[APPLY_FILTER] After Class({filters.ClassId}): {query.Count()}");
        }

        if (filters.StartDate.HasValue)
        {
            query = query.Where(e => e.StartDate >= filters.StartDate.Value);
            Console.WriteLine($"[APPLY_FILTER] After StartDate: {query.Count()}");
        }

        if (filters.EndDate.HasValue)
        {
            query = query.Where(e => e.EndDate <= filters.EndDate.Value);
            Console.WriteLine($"[APPLY_FILTER] After EndDate: {query.Count()}");
        }

        return query;
    }

    public async Task<List<StudentPerformanceDto>> GetStudentsAsync()
    {
        var students = await _context.Accounts
            .Include(a => a.StudentExtension)
                .ThenInclude(se => se.Class)
                    .ThenInclude(c => c.Grade)
            .Where(a => a.Role.RoleName == "Student")
            .ToListAsync();

        var result = new List<StudentPerformanceDto>();

        foreach (var student in students)
        {
            var studentScores = new Dictionary<string, double>();
            
            // Get all exams this student has taken
            var examIds = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == student.Id)
                .Select(sea => sea.ExamId)
                .Distinct()
                .ToListAsync();

            foreach (var examId in examIds)
            {
                var exam = await _context.ExamDetails
                    .Include(e => e.ExamQuestionBanks)
                    .ThenInclude(eq => eq.Question)
                    .FirstOrDefaultAsync(e => e.ExamId == examId);

                if (exam == null) continue;

                var answers = await _context.StudentExamAnswers
                    .Where(sea => sea.AccountId == student.Id && sea.ExamId == examId)
                    .ToListAsync();

                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question.Mark ?? 0);
                var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question.Mark ?? 0);

                var score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0;
                studentScores[examId.ToString()] = score;
            }

            var initials = string.IsNullOrWhiteSpace(student.FullNameEn) 
                ? "NA" 
                : string.Join("", student.FullNameEn.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(s => s[0])).ToUpper();
            
            if (initials.Length > 2) initials = initials.Substring(0, 2);

            result.Add(new StudentPerformanceDto
            {
                Id = student.Id,
                Name = student.FullNameEn,
                Initials = initials,
                Grade = student.StudentExtension?.Class?.Grade?.GradeName ?? "N/A",
                Class = student.StudentExtension?.Class?.ClassName ?? "N/A",
                QuizScores = studentScores
            });
        }

        return result;
    }
}
