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
        exam.ExamQuestionBanks.Clear();
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
            exam.ExamQuestionBanks.Clear();
            try 
            {
                var examLinks = links.Where(l => l.ExamId == exam.ExamId).ToList();
                foreach (var link in examLinks)
                {
                    if (link.QuestionId.HasValue && questions.TryGetValue(link.QuestionId.Value, out var q))
                    {
                        link.Question = q;
                        if (exam.ExamQuestionBanks != null) 
                        {
                            exam.ExamQuestionBanks.Add(link);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                 Console.WriteLine($"[ERROR] Failed to populate questions for examid {exam.ExamId}: {ex.Message}");
            }
        }
    }

    public async Task<StudentDashboardDto?> GetStudentDashboardAsync(long studentId, LeaderboardFilterDto? filters = null)
    {
        var student = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == studentId);
        if (student == null) return null;

        var examsQuery = _context.ExamDetails.AsQueryable();
        examsQuery = ApplyFilters(examsQuery, filters);
        var exams = await examsQuery.ToListAsync();
        
        await PopulateExamQuestions(exams);

        var filteredExamIds = exams.Select(e => e.ExamId).ToList();
        var studentExams = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == studentId && sea.ExamDetailsId.HasValue && filteredExamIds.Contains(sea.ExamDetailsId.Value))
            .Select(sea => sea.ExamDetailsId!.Value)
            .Distinct()
            .ToListAsync();

        var totalExamsTaken = studentExams.Count;
        int passedExams = 0;
        int failedExams = 0;
        long? latestExamId = null;
        DateTime? latestExamDate = null;

        var allStudentAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.AccountId == studentId && sea.ExamDetailsId.HasValue && filteredExamIds.Contains(sea.ExamDetailsId.Value))
            .ToListAsync();

        foreach (var examId in studentExams)
        {
            var exam = exams.FirstOrDefault(e => e.ExamId == examId);
            if (exam == null) continue;

            var answers = allStudentAnswers.Where(sea => sea.ExamDetailsId == examId).ToList();

            var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = (double)answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

            var score = totalMarks > 0 ? (earnedMarks * 100.0 / totalMarks) : 0.0;

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

        // Build StudentRecentExamDto with score data for charts
        var recentExamsData = new List<StudentRecentExamDto>();
        var scoreBuckets = new Dictionary<string, int>
        {
            { "0-50%", 0 },
            { "50-70%", 0 },
            { "70-85%", 0 },
            { "85-100%", 0 }
        };

        // Pre-fetch all other student answers for average calculation
        var allExamsAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId.HasValue && studentExams.Contains(sea.ExamDetailsId.Value))
            .ToListAsync();

        foreach (var examId in studentExams)
        {
            var exam = exams.FirstOrDefault(e => e.ExamId == examId);
            if (exam == null) continue;

            var answers = allStudentAnswers.Where(sea => sea.ExamDetailsId == examId).ToList();

            var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = (double)answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

            var studentScore = totalMarks > 0 ? (earnedMarks * 100.0 / totalMarks) : 0.0;

            // Calculate average score for this exam using pre-fetched data
            var examAnswers = allExamsAnswers.Where(sea => sea.ExamDetailsId == examId).ToList();
            var uniqueStudentIds = examAnswers.Select(a => a.AccountId).Distinct();
            double totalScoreForExam = 0;
            int studentCount = 0;

            foreach (var sid in uniqueStudentIds)
            {
                var studentAns = examAnswers.Where(a => a.AccountId == sid).ToList();
                var earned = (double)studentAns.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);
                var scoreForStudent = totalMarks > 0 ? (earned * 100.0 / totalMarks) : 0.0;
                totalScoreForExam += scoreForStudent;
                studentCount++;
            }

            var averageScore = studentCount > 0 ? totalScoreForExam / studentCount : 0;

            // Track score distribution
            if (studentScore < 50) scoreBuckets["0-50%"]++;
            else if (studentScore < 70) scoreBuckets["50-70%"]++;
            else if (studentScore < 85) scoreBuckets["70-85%"]++;
            else scoreBuckets["85-100%"]++;

            recentExamsData.Add(new StudentRecentExamDto
            {
                ExamId = examId,
                Title = exam.Title ?? "Untitled Exam",
                StudentScore = studentScore,
                AverageScore = averageScore,
                Date = exam.EndDate ?? DateTime.Now
            });
        }

        var scoreDistribution = scoreBuckets.Select(b => new ChartDataPointDto 
        { 
            Name = b.Key, 
            Value = b.Value 
        }).ToList();

        return new StudentDashboardDto
        {
            StudentId = studentId,
            StudentName = student.FullNameEn,
            TotalExamsTaken = totalExamsTaken,
            PassPercentage = passPercentage,
            FailPercentage = failPercentage,
            LatestExamLeaderboard = latestExamLeaderboard,
            StudentRankInLatestExam = studentRank,
            RecentExams = recentExamsData.OrderByDescending(e => e.Date).Take(10).ToList(),
            ScoreDistribution = scoreDistribution
        };
    }

    public async Task<TeacherDashboardDto?> GetTeacherDashboardAsync(long teacherId, LeaderboardFilterDto? filters = null)
    {
        var teacher = await _context.Accounts.FirstOrDefaultAsync(a => a.Id == teacherId);
        if (teacher == null) return null;

        var examsQuery = _context.ExamDetails.AsQueryable().Where(e => e.CreatedBy_AccId == teacherId);
        
        // DEBUG LOGGING
        var countBeforeFilter = await examsQuery.CountAsync();
        Console.WriteLine($"[DashboardRepo] Teacher {teacherId} has {countBeforeFilter} total exams created.");

        examsQuery = ApplyFilters(examsQuery, filters);
        var exams = await examsQuery.ToListAsync();
        
        Console.WriteLine($"[DashboardRepo] After filtering: {exams.Count} exams found.");
        
        await PopulateExamQuestions(exams);

        var totalExamsCreated = exams.Count;
        var examBreakdown = new List<ExamStatsDto>();
        
        int totalPassedAcrossAllExams = 0;
        int totalFailedAcrossAllExams = 0;
        var uniqueStudents = new HashSet<long>();
        
        // Fetch all answers for these exams efficiently
        var examIds = exams.Select(e => e.ExamId).ToList();
        var allAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId.HasValue && examIds.Contains(sea.ExamDetailsId.Value))
            .ToListAsync();

        foreach (var exam in exams)
        {
            var examAnswers = allAnswers.Where(a => a.ExamDetailsId == exam.ExamId).ToList();
            var studentIds = examAnswers.Select(a => a.AccountId).Distinct();

            int examPassed = 0;
            int examFailed = 0;
            double examTotalScore = 0;

            foreach (var studentId in studentIds)
            {
                uniqueStudents.Add(studentId);
                var studentAnswers = examAnswers.Where(a => a.AccountId == studentId).ToList();

                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;
                examTotalScore += score;

                if (score >= PassThreshold) 
                {
                    examPassed++;
                    totalPassedAcrossAllExams++;
                }
                else 
                {
                    examFailed++;
                    totalFailedAcrossAllExams++;
                }
            }
            
            int totalStudents = studentIds.Count();
            examBreakdown.Add(new ExamStatsDto
            {
                ExamId = exam.ExamId,
                ExamTitle = exam.Title,
                TotalStudents = totalStudents,
                PassedStudents = examPassed,
                FailedStudents = examFailed,
                PassPercentage = totalStudents > 0 ? Math.Round((double)examPassed / totalStudents * 100, 2) : 0,
                FailPercentage = totalStudents > 0 ? Math.Round((double)examFailed / totalStudents * 100, 2) : 0,
                AverageScore = totalStudents > 0 ? Math.Round(examTotalScore / totalStudents, 2) : 0
            });
        }

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

        // Calculate Score Distribution for Charts
        var scoreDistribution = new List<ChartDataPointDto>();
        var scoreBuckets = new Dictionary<string, int>
        {
            { "0-50%", 0 },
            { "50-70%", 0 },
            { "70-85%", 0 },
            { "85-100%", 0 }
        };

        foreach (var exam in exams)
        {
            var examAnswers = allAnswers.Where(a => a.ExamDetailsId == exam.ExamId).ToList();
            var studentIds = examAnswers.Select(a => a.AccountId).Distinct();

            foreach (var studentId in studentIds)
            {
                var studentAnswers = examAnswers.Where(a => a.AccountId == studentId).ToList();
                var totalMarks = exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = studentAnswers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId.HasValue && eq.QuestionId.Value == a.QuestionBankId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? (double)(earnedMarks * 100m / totalMarks) : 0.0;

                // Skip if total marks is 0 (empty exam), don't count as failure
                if (totalMarks == 0) continue;

                if (score < 50) scoreBuckets["0-50%"]++;
                else if (score < 70) scoreBuckets["50-70%"]++;
                else if (score < 85) scoreBuckets["70-85%"]++;
                else scoreBuckets["85-100%"]++;
            }
        }

        foreach (var bucket in scoreBuckets)
        {
            scoreDistribution.Add(new ChartDataPointDto { Name = bucket.Key, Value = bucket.Value });
        }

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
            LatestExamLeaderboard = latestExamLeaderboard,
            ScoreDistribution = scoreDistribution
        };
    }

    public async Task<SuperadminDashboardDto> GetSuperadminDashboardAsync(LeaderboardFilterDto? filters = null)
    {
        var examsQuery = _context.ExamDetails.AsQueryable();
        examsQuery = ApplyFilters(examsQuery, filters);
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

        var filteredExamIds = allFilteredExams.Select(e => e.ExamId).ToList();
        var allStudentAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId.HasValue && filteredExamIds.Contains(sea.ExamDetailsId.Value))
            .ToListAsync();

        int totalPassed = 0;
        int totalFailed = 0;
        
        var scoreBuckets = new Dictionary<string, int>
        {
            { "0-50%", 0 },
            { "50-70%", 0 },
            { "70-85%", 0 },
            { "85-100%", 0 }
        };

        var examBreakdown = new List<ExamStatsDto>();

        foreach (var exam in allFilteredExams)
        {
            var answers = allStudentAnswers.Where(sea => sea.ExamDetailsId == exam.ExamId).ToList();
            var studentIds = answers.Select(a => a.AccountId).Distinct().ToList();
            
            int examPassed = 0;
            int examFailed = 0;
            double examTotalScore = 0;

            foreach (var studentId in studentIds)
            {
                var studentAnswers = answers.Where(a => a.AccountId == studentId).ToList();
                var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = (double)studentAnswers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? (earnedMarks * 100.0 / totalMarks) : 0.0;
                examTotalScore += score;

                if (score >= PassThreshold) 
                {
                    totalPassed++;
                    examPassed++;
                }
                else 
                {
                    totalFailed++;
                    examFailed++;
                }

                if (totalMarks > 0)
                {
                    if (score < 50) scoreBuckets["0-50%"]++;
                    else if (score < 70) scoreBuckets["50-70%"]++;
                    else if (score < 85) scoreBuckets["70-85%"]++;
                    else scoreBuckets["85-100%"]++;
                }
            }

            if (studentIds.Any())
            {
                examBreakdown.Add(new ExamStatsDto
                {
                    ExamId = exam.ExamId,
                    ExamTitle = exam.Title,
                    TotalStudents = studentIds.Count,
                    PassedStudents = examPassed,
                    FailedStudents = examFailed,
                    PassPercentage = Math.Round((double)examPassed / studentIds.Count * 100, 2),
                    FailPercentage = Math.Round((double)examFailed / studentIds.Count * 100, 2),
                    AverageScore = Math.Round(examTotalScore / studentIds.Count, 2)
                });
            }
        }

        int totalStudentExamInstances = totalPassed + totalFailed;
        double overallPassPercentage = totalStudentExamInstances > 0 ? Math.Round((double)totalPassed / totalStudentExamInstances * 100, 2) : 0;
        double overallFailPercentage = totalStudentExamInstances > 0 ? Math.Round(100 - overallPassPercentage, 2) : 0;

        var scoreDistribution = scoreBuckets.Select(b => new ChartDataPointDto { Name = b.Key, Value = b.Value }).ToList();
        var recentExams = allFilteredExams
            .OrderByDescending(e => e.StartDate)
            .Take(10)
            .Select(e => new ExamSelectionDto { ExamId = e.ExamId, Title = e.Title ?? "Untitled Exam" })
            .ToList();

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
            RecentActivity = recentActivity,
            RecentExams = recentExams,
            ScoreDistribution = scoreDistribution,
            ExamBreakdown = examBreakdown
        };
    }

    public async Task<LeaderboardDto?> GetLeaderboardAsync(long examId, LeaderboardFilterDto? filters = null)
    {
        var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == examId);
        if (exam == null) return null;
        
        await PopulateExamQuestions(exam);

        var studentAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId == examId)
            .ToListAsync();

        var studentIds = studentAnswers.Select(sa => sa.AccountId).Distinct().ToList();
        var students = await _context.Accounts.Where(a => studentIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id);

        var leaderboardEntries = new List<LeaderboardEntryDto>();

        foreach (var studentId in studentIds)
        {
            if (!students.TryGetValue(studentId, out var student)) continue;

            var answers = studentAnswers.Where(sa => sa.AccountId == studentId).ToList();
            
            var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = (double)answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

            var score = totalMarks > 0 ? Math.Round((earnedMarks * 100.0 / totalMarks), 2) : 0.0;

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

        var allAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId == examId)
            .ToListAsync();

        var studentIds = allAnswers.Select(sea => sea.AccountId).Distinct().ToList();

        int totalStudents = studentIds.Count;
        int passedStudents = 0;
        int failedStudents = 0;
        double totalScore = 0;

        foreach (var studentId in studentIds)
        {
            var answers = allAnswers.Where(sea => sea.AccountId == studentId).ToList();

            var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
            var earnedMarks = (double)answers.Where(a => a.Score).Sum(a =>
                exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

            var score = totalMarks > 0 ? (earnedMarks * 100.0 / totalMarks) : 0.0;
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
            .Where(id => id.HasValue)
            .Cast<long>()
            .Distinct()
            .ToListAsync();

        var allStudentAnswers = await _context.StudentExamAnswers
            .Where(sea => studentIds.Contains(sea.AccountId))
            .ToListAsync();

        var examIdsInvolved = allStudentAnswers
            .Where(a => a.ExamDetailsId.HasValue)
            .Select(a => a.ExamDetailsId!.Value)
            .Distinct()
            .ToList();

        var allExams = await _context.ExamDetails
            .Where(e => examIdsInvolved.Contains(e.ExamId))
            .ToListAsync();
        
        await PopulateExamQuestions(allExams);
        var examMap = allExams.ToDictionary(e => e.ExamId);
        var studentMap = await _context.Accounts.Where(a => studentIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id);

        var studentPerformances = new List<(long StudentId, string StudentName, double AverageScore)>();

        foreach (var studentId in studentIds)
        {
            if (!studentMap.TryGetValue(studentId, out var student)) continue;

            var studentAnswers = allStudentAnswers.Where(sea => sea.AccountId == studentId).ToList();
            var studentExamGroups = studentAnswers.Where(a => a.ExamDetailsId.HasValue).GroupBy(a => a.ExamDetailsId!.Value);

            if (!studentExamGroups.Any()) continue;

            double totalScore = 0;
            int examCount = 0;

            foreach (var group in studentExamGroups)
            {
                var examId = group.Key;
                if (!examMap.TryGetValue(examId, out var exam)) continue;

                var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                var earnedMarks = (double)group.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? (earnedMarks * 100.0 / totalMarks) : 0.0;
                totalScore += score;
                examCount++;
            }

            var averageScore = examCount > 0 ? totalScore / examCount : 0;
            studentPerformances.Add((student.Id, student.FullNameEn ?? "Unknown", averageScore));
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
                Timestamp = exam.StartDate ?? DateTime.MinValue,
                RelatedExamId = exam.ExamId,
                RelatedAccountId = 0
            });
        }

        var recentAnswerGroups = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId.HasValue)
            .GroupBy(sea => new { sea.ExamDetailsId, sea.AccountId })
            .Select(g => new { g.Key.ExamDetailsId, g.Key.AccountId, LatestAnswerId = g.Max(sea => sea.Id) })
            .OrderByDescending(x => x.LatestAnswerId)
            .Take(count / 2)
            .ToListAsync();

        var answerExamIds = recentAnswerGroups.Select(x => x.ExamDetailsId!.Value).Distinct().ToList();
        var answerStudentIds = recentAnswerGroups.Select(x => x.AccountId).Distinct().ToList();

        var exams = await _context.ExamDetails.Where(e => answerExamIds.Contains(e.ExamId)).ToDictionaryAsync(e => e.ExamId);
        var students = await _context.Accounts.Where(a => answerStudentIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id);

        foreach (var answer in recentAnswerGroups)
        {
            if (exams.TryGetValue(answer.ExamDetailsId!.Value, out var exam) && 
                students.TryGetValue(answer.AccountId, out var student))
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

    private IQueryable<ExamDetail> ApplyFilters(IQueryable<ExamDetail> query, LeaderboardFilterDto? filters)
    {
        if (filters == null) return query;

        if (filters.GradeId.HasValue)
        {
            query = query.Where(e => e.GradeId == filters.GradeId.Value);
        }

        if (filters.ClassId.HasValue)
        {
            var filterClassId = "," + filters.ClassId.Value + ",";
            query = query.Where(e => e.ClassId != null && EF.Functions.Like(e.ClassId, "%" + filterClassId + "%"));
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
        // 1. Fetch students
        var students = await _context.Accounts
            .Include(a => a.StudentExtension)
            .Where(a => a.Role.RoleName == "Student")
            .ToListAsync();

        // 2. Fetch all required data in batches to avoid N+1
        var studentIds = students.Select(s => s.Id).ToList();
        
        // Fetch all answers for these students
        var allAnswers = await _context.StudentExamAnswers
            .Where(sea => studentIds.Contains(sea.AccountId))
            .ToListAsync();

        // Fetch all exams involved
        var examIds = allAnswers
            .Where(a => a.ExamDetailsId.HasValue)
            .Select(a => a.ExamDetailsId!.Value)
            .Distinct()
            .ToList();

        var exams = await _context.ExamDetails
            .Where(e => examIds.Contains(e.ExamId))
            .ToListAsync();

        // Populate questions for these exams in one go
        await PopulateExamQuestions(exams);

        // Prefetch classes and grades
        var classes = await _context.TblClasses.ToListAsync();
        var grades = await _context.Grades.ToListAsync();
        
        var gradeMap = grades.ToDictionary(g => g.Id, g => g.GradeName);
        var classMap = classes.ToDictionary(c => c.Id, c => c);
        var examMap = exams.ToDictionary(e => e.ExamId);

        var result = new List<StudentPerformanceDto>();

        foreach (var student in students)
        {
            var studentAnswers = allAnswers.Where(a => a.AccountId == student.Id).ToList();
            var studentScores = new Dictionary<string, double>();

            var studentExamGroups = studentAnswers
                .Where(a => a.ExamDetailsId.HasValue)
                .GroupBy(a => a.ExamDetailsId!.Value);

            foreach (var group in studentExamGroups)
            {
                var examId = group.Key;
                if (!examMap.TryGetValue(examId, out var exam)) continue;

                var answers = group.ToList();
                var totalMarks = (double)exam.ExamQuestionBanks.Sum(eq => eq.Question?.Mark ?? 0);
                
                var earnedMarks = (double)answers.Where(a => a.Score).Sum(a =>
                    exam.ExamQuestionBanks.FirstOrDefault(eq => eq.QuestionId == a.QuestionBankId)?.Question?.Mark ?? 0);

                var score = totalMarks > 0 ? Math.Round((earnedMarks * 100.0 / totalMarks), 2) : 0.0;
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
