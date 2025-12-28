using Microsoft.EntityFrameworkCore;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;

namespace QuizesApi.Repositories.Implementation;

public class DashboardRepo : IDashboardRepo
{
    private readonly ElsewedySchoolSysDbDevContext _context;
    private const double PassThreshold = 50.0; 

    public DashboardRepo(ElsewedySchoolSysDbDevContext context)
    {
        _context = context;
    }

    private async Task PopulateExamQuestions(ExamDetail exam)
    {
        var links = await _context.ExamQuestionBanks.Where(eq => eq.ExamId == exam.ExamId).ToListAsync();
        foreach (var link in links)
        {
            if (link.QuestionId.HasValue)
            {
                link.Question = await _context.QuestionBanks.FindAsync(link.QuestionId.Value);
                if (link.Question != null)
                {
                    exam.ExamQuestionBanks.Add(link);
                }
            }
        }
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

    public async Task<StudentDashboardDto?> GetStudentDashboardAsync(long studentId, LeaderboardFilterDto? filters = null)
    {
        var student = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == studentId);
        if (student == null) return null;

        var examsQuery = _context.ExamDetails.AsQueryable();
        examsQuery = await ApplyFiltersAsync(examsQuery, filters);
        var exams = await examsQuery.ToListAsync();
        
        await PopulateExamQuestions(exams);

        var filteredExamIds = exams.Select(e => e.ExamId).ToList();
        var studentExams = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == studentId && filteredExamIds.Contains(sea.ExamId))
            .Select(sea => sea.ExamId)
            .Distinct()
            .ToListAsync();

        var totalExamsTaken = studentExams.Count;
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

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question?.Mark ?? 0);

            var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;

            if (score >= PassThreshold) passedExams++;
            else failedExams++;

            if (latestExamDate == null || (exam.EndDate.HasValue && exam.EndDate > latestExamDate))
            {
                latestExamDate = exam.EndDate;
                latestExamId = examId;
            }
        }

        double passPercentage = totalExamsTaken > 0 ? Math.Round((double)passedExams / totalExamsTaken * 100, 2) : 0;
        double failPercentage = totalExamsTaken > 0 ? Math.Round(100 - passPercentage, 2) : 0;

        LeaderboardDto? latestExamLeaderboard = null;
        int? studentRank = null;

        if (latestExamId.HasValue)
        {
            latestExamLeaderboard = await GetLeaderboardAsync(latestExamId.Value, filters);
            studentRank = latestExamLeaderboard?.TopStudents.FirstOrDefault(s => s.StudentId == studentId)?.Rank;
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
                    Title = e.Title ?? "Untitled Exam"
                })
                .ToList()
        };
    }

    public async Task<TeacherDashboardDto?> GetTeacherDashboardAsync(long teacherId, LeaderboardFilterDto? filters = null)
    {
        var teacher = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == teacherId);
        if (teacher == null) return null;

        var exams = new List<ExamDetail>(); 
        var totalExamsCreated = exams.Count;
        var examBreakdown = new List<ExamStatsDto>();
        
        int totalPassedAcrossAllExams = 0;
        int totalFailedAcrossAllExams = 0;
        var uniqueStudents = new HashSet<long>();

        int totalStudentExamInstances = totalPassedAcrossAllExams + totalFailedAcrossAllExams;
        double avgPassPercentage = totalStudentExamInstances > 0 ? Math.Round((double)totalPassedAcrossAllExams / totalStudentExamInstances * 100, 2) : 0;
        double avgFailPercentage = totalStudentExamInstances > 0 ? Math.Round(100 - avgPassPercentage, 2) : 0;

        var recentExams = exams
            .OrderByDescending(e => e.EndDate)
            .Take(10)
            .Select(e => new ExamSelectionDto
            {
                ExamId = e.ExamId,
                Title = e.Title ?? "Untitled Exam"
            })
            .ToList();

        LeaderboardDto? latestExamLeaderboard = null;

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
        var examsQuery = _context.ExamDetails.AsQueryable();
        examsQuery = await ApplyFiltersAsync(examsQuery, filters);
        var allFilteredExams = await examsQuery.ToListAsync();
        await PopulateExamQuestions(allFilteredExams);

        var totalExams = allFilteredExams.Count;
        
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
            var answers = await _context.StudentExamAnswers
                .Where(sea => sea.ExamId == exam.ExamId)
                .ToListAsync();
            
            var studentIds = answers.Select(a => a.AccountId).Distinct();
            
            foreach (var studentId in studentIds)
            {
                var studentAnswers = answers.Where(a => a.AccountId == studentId).ToList();
                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;

                if (score >= PassThreshold) totalPassed++;
                else totalFailed++;
            }
        }

        int totalStudentExamInstances = totalPassed + totalFailed;
        double overallPassPercentage = totalStudentExamInstances > 0 ? Math.Round((double)totalPassed / totalStudentExamInstances * 100, 2) : 0;
        double overallFailPercentage = totalStudentExamInstances > 0 ? Math.Round(100 - overallPassPercentage, 2) : 0;

        var topStudents = await GetTopPerformingStudentsAsync(10);
        var topTeachers = new List<TopTeacherDto>(); 
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
        var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == examId);
        if (exam == null) return null;
        
        await PopulateExamQuestions(exam);

        var studentAnswersQuery = _context.StudentExamAnswers
            .Where(sea => sea.ExamId == examId)
            .Include(sea => sea.Account)
            .AsQueryable();

        if (filters != null)
        {
            if (filters.GradeId.HasValue)
            {
                 var grade = await _context.Grades.FindAsync(filters.GradeId.Value);
                 if (grade != null && exam.Grade != grade.GradeName)
                 {
                      return new LeaderboardDto { ExamId = examId, ExamTitle = exam.Title, TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
                 }
            }

            if (filters.ClassId.HasValue)
            {
                var studentIdsInClass = await _context.StudentExtensions
                    .Where(se => se.ClassId == filters.ClassId.Value)
                    .Select(se => se.AccountId)
                    .ToListAsync();

                studentAnswersQuery = studentAnswersQuery.Where(sea => studentIdsInClass.Contains(sea.AccountId));
            }

            if (filters.StartDate.HasValue && exam.EndDate.HasValue && exam.EndDate < filters.StartDate.Value)
                return new LeaderboardDto { ExamId = examId, ExamTitle = exam.Title, TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
            if (filters.EndDate.HasValue && exam.StartDate.HasValue && exam.StartDate > filters.EndDate.Value)
                return new LeaderboardDto { ExamId = examId, ExamTitle = exam.Title, TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
        }

        var studentAnswers = await studentAnswersQuery.ToListAsync();
        var studentIds = studentAnswers.Select(sa => sa.AccountId).Distinct().ToList();

        var leaderboardEntries = new List<LeaderboardEntryDto>();

        foreach (var studentId in studentIds)
        {
            var student = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == studentId);
            if (student == null) continue;

            var answers = studentAnswers.Where(sa => sa.AccountId == studentId).ToList();
            
            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question?.Mark ?? 0);

            var score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0;

            leaderboardEntries.Add(new LeaderboardEntryDto
            {
                StudentId = studentId,
                StudentName = student.FullNameEn,
                Score = score,
                TotalMarks = (int)totalMarks,
                EarnedMarks = (int)earnedMarks,
                Rank = 0 
            });
        }

        leaderboardEntries = leaderboardEntries.OrderByDescending(e => e.Score).ToList();
        for (int i = 0; i < leaderboardEntries.Count; i++) leaderboardEntries[i].Rank = i + 1;

        return new LeaderboardDto
        {
            ExamId = examId,
            ExamTitle = exam.Title,
            TopStudents = leaderboardEntries.Take(10).ToList(),
            HighlightedStudents = leaderboardEntries.Take(3).ToList(),
            TotalParticipants = leaderboardEntries.Count
        };
    }

    public async Task<ExamStatsDto?> GetExamStatsAsync(long examId)
    {
        var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == examId);
        if (exam == null) return null;
        
        await PopulateExamQuestions(exam);

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

            var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question?.Mark ?? 0);

            var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;
            totalScore += score;

            if (score >= PassThreshold) passedStudents++;
            else failedStudents++;
        }

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
                var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == examId);
                if (exam == null) continue;
                await PopulateExamQuestions(exam);

                var answers = await _context.StudentExamAnswers
                    .Where(sea => sea.AccountId == studentId && sea.ExamId == examId)
                    .ToListAsync();

                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question?.Mark ?? 0);

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
         return new List<TopTeacherDto>();
    }

    private async Task<List<RecentActivityDto>> GetRecentActivityAsync(int count)
    {
        var activities = new List<RecentActivityDto>();

        var recentExams = await _context.ExamDetails
            .OrderByDescending(e => e.StartDate)
            .Take(count / 2)
            .ToListAsync();

        foreach (var exam in recentExams)
        {
            activities.Add(new RecentActivityDto
            {
                ActivityType = "ExamCreated",
                Description = $"Exam '{exam.Title}' created",
                Timestamp = exam.StartDate ?? DateTime.MinValue, // Fix Type mismatch
                RelatedExamId = exam.ExamId,
                RelatedAccountId = 0
            });
        }

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
                    Timestamp = exam.EndDate ?? DateTime.MinValue,
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

    private async Task<IQueryable<ExamDetail>> ApplyFiltersAsync(IQueryable<ExamDetail> query, LeaderboardFilterDto? filters)
    {
        if (filters == null) return query;

        if (filters.GradeId.HasValue)
        {
            var grade = await _context.Grades.FindAsync(filters.GradeId.Value);
            if (grade != null)
                query = query.Where(e => e.Grade == grade.GradeName);
            else 
                query = query.Where(e => false);
        }

        if (filters.ClassId.HasValue)
        {
            var cls = await _context.TblClasses.FindAsync(filters.ClassId.Value);
             if (cls != null)
                query = query.Where(e => e.Class == cls.ClassName); 
            else 
                query = query.Where(e => false);
        }

        if (filters.StartDate.HasValue)
        {
            var date = filters.StartDate.Value;
            query = query.Where(e => e.StartDate >= date);
        }

        if (filters.EndDate.HasValue)
        {
            var date = filters.EndDate.Value;
            query = query.Where(e => e.EndDate <= date);
        }

        return query;
    }

    public async Task<List<StudentPerformanceDto>> GetStudentsAsync()
    {
        var students = await _context.Accounts
            .Include(a => a.StudentExtension)
            .Where(a => a.Role.RoleName == "Student")
            .ToListAsync();

        // Prefetch classes and grades
        var classes = await _context.TblClasses.ToListAsync(); // Grade nav prop likely missing on TblClass
        var grades = await _context.Grades.ToListAsync();
        
        var gradeMap = grades.ToDictionary(g => g.Id, g => g.GradeName);
        var classMap = classes.ToDictionary(c => c.Id, c => c);

        var result = new List<StudentPerformanceDto>();

        foreach (var student in students)
        {
            var studentScores = new Dictionary<string, double>();
            var examIds = await _context.StudentExamAnswers
                .Where(sea => sea.AccountId == student.Id)
                .Select(sea => sea.ExamId)
                .Distinct()
                .ToListAsync();

            foreach (var examId in examIds)
            {
                var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == examId);

                if (exam == null) continue;
                await PopulateExamQuestions(exam);

                var answers = await _context.StudentExamAnswers
                    .Where(sea => sea.AccountId == student.Id && sea.ExamId == examId)
                    .ToListAsync();

                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = answers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? Math.Round((double)(earnedMarks * 100m / totalMarks), 2) : 0.0;
                studentScores[examId.ToString()] = score;
            }

            var initials = string.IsNullOrWhiteSpace(student.FullNameEn) 
                ? "NA" 
                : string.Join("", student.FullNameEn.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(s => s[0])).ToUpper();
            if (initials.Length > 2) initials = initials.Substring(0, 2);

            var className = "N/A";
            var gradeName = "N/A";
            if (student.StudentExtension?.ClassId != null && classMap.TryGetValue(student.StudentExtension.ClassId.Value, out var cls))
            {
                className = cls.ClassName;
                if (gradeMap.TryGetValue(cls.GradeId, out var gName))
                {
                    gradeName = gName;
                }
            }

            result.Add(new StudentPerformanceDto
            {
                Id = student.Id,
                Name = student.FullNameEn,
                Initials = initials,
                Grade = gradeName,
                Class = className,
                QuizScores = studentScores
            });
        }

        return result;
    }
}
