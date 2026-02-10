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

    private string FormatClassName(string className)
    {
        if (string.IsNullOrEmpty(className)) return className;
        
        // Map J1-J4 to Junior 1-4
        if (className.StartsWith("J", StringComparison.OrdinalIgnoreCase) && className.Length > 1 && char.IsDigit(className[1]))
            return $"Junior {className.Substring(1)}";
            
        // Map S1-S4 to Senior 1-4
        if (className.StartsWith("S", StringComparison.OrdinalIgnoreCase) && className.Length > 1 && char.IsDigit(className[1]))
            return $"Senior {className.Substring(1)}";
            
        // Map W1-W4 to Wheeler 1-4
        if (className.StartsWith("W", StringComparison.OrdinalIgnoreCase) && className.Length > 1 && char.IsDigit(className[1]))
            return $"Wheeler {className.Substring(1)}";
        
        return className;
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
        
        // AsNoTracking
        var exams = await examsQuery.AsNoTracking().ToListAsync();
        
        await PopulateExamQuestions(exams);

        // Pre-calculate exam marks
        var examTotalMarks = new Dictionary<long, double>();
        var examQuestionMarks = new Dictionary<long, Dictionary<long, double>>();

        foreach (var exam in exams)
        {
            var qMarks = new Dictionary<long, double>();
            double total = 0;
            foreach (var eq in exam.ExamQuestionBanks)
            {
                if (eq.QuestionId.HasValue)
                {
                    double mark = (double)(eq.Question?.Mark ?? 0);
                    qMarks[eq.QuestionId.Value] = mark;
                    total += mark;
                }
            }
            examQuestionMarks[exam.ExamId] = qMarks;
            examTotalMarks[exam.ExamId] = total;
        }

        var filteredExamIds = exams.Select(e => e.ExamId).ToList();
        
        // Get all answers for this student for filtered exams
        // We need to know which exams the student took
        var allStudentAnswers = await _context.StudentExamAnswers
            .AsNoTracking()
            .Where(sea => sea.AccountId == studentId && sea.ExamDetailsId.HasValue && filteredExamIds.Contains(sea.ExamDetailsId.Value))
            .ToListAsync();
            
        var studentExams = allStudentAnswers
            .Where(sea => sea.ExamDetailsId.HasValue)
            .Select(sea => sea.ExamDetailsId!.Value)
            .Distinct()
            .ToList();

        var totalExamsTaken = studentExams.Count;
        int passedExams = 0;
        int failedExams = 0;
        long? latestExamId = null;
        DateTime? latestExamDate = null;
        
        var scoreBuckets = new Dictionary<string, int>
        {
            { "0-50%", 0 }, { "50-70%", 0 }, { "70-85%", 0 }, { "85-100%", 0 }
        };
        var recentExamsData = new List<StudentRecentExamDto>();

        // We need average score for these exams. Fetching ALL answers for ALL exams is too heavy.
        // Instead, we can do a simplified aggregation query for just these exams
        
        // 1. Get raw scores per student per exam for the relevant exams
        // This query groups by Exam and Student, sums the score marks (requires join with QuestionBank/ExamQuestionBank for Marks)
        // Since Mark is in QuestionBank, this complex aggregation is hard in simple LINQ-to-Entities without navigation properties set up perfectly.
        // Or we can fetch minimal data: keys and scores. 
        // But we need MARKS. 
        // Alternative: Approximate or use cached averages? No, must be accurate.
        
        // Optimization: Fetch only necessary fields for ALL students who took these exams.
        // It might still be large but better than full entities.
        var allExamsAnswers = await _context.StudentExamAnswers
            .AsNoTracking()
            .Where(sea => sea.ExamDetailsId.HasValue && studentExams.Contains(sea.ExamDetailsId.Value))
            .Select(sea => new { sea.ExamDetailsId, sea.AccountId, sea.QuestionBankId, sea.Score })
            .ToListAsync();
            
        // Process averages in memory
        var examAverages = new Dictionary<long, double>(); // ExamId -> Average Score
        
        var answersByExam = allExamsAnswers
            .GroupBy(a => a.ExamDetailsId!.Value);

        foreach (var examGroup in answersByExam)
        {
            long examId = examGroup.Key;
            if (!examTotalMarks.TryGetValue(examId, out double maxMarks) || maxMarks == 0) continue;
            var qMarks = examQuestionMarks[examId];

            var studentScores = new List<double>();
            var studentsGroup = examGroup.GroupBy(a => a.AccountId);
            
            foreach (var sg in studentsGroup)
            {
                double earned = 0;
                foreach (var ans in sg)
                {
                    if (ans.Score && ans.QuestionBankId.HasValue && qMarks.TryGetValue(ans.QuestionBankId.Value, out double mark))
                    {
                        earned += mark;
                    }
                }
                studentScores.Add(earned * 100.0 / maxMarks);
            }
            
            if (studentScores.Any())
                examAverages[examId] = studentScores.Average();
        }

        // Now process student's own performance
        var studentAnswersByExam = allStudentAnswers.GroupBy(a => a.ExamDetailsId!.Value);
        
        foreach (var examGroup in studentAnswersByExam)
        {
            long examId = examGroup.Key;
            var exam = exams.FirstOrDefault(e => e.ExamId == examId);
            if (exam == null) continue;
            
            if (!examTotalMarks.TryGetValue(examId, out double maxMarks)) maxMarks = 0;
            var qMarks = examQuestionMarks[examId];
            
            double earned = 0;
             foreach (var ans in examGroup)
             {
                 if (ans.Score && ans.QuestionBankId.HasValue && qMarks.TryGetValue(ans.QuestionBankId.Value, out double mark))
                 {
                     earned += mark;
                 }
             }

            var score = maxMarks > 0 ? (earned * 100.0 / maxMarks) : 0.0;

            if (score >= PassThreshold) passedExams++;
            else failedExams++;

            if (latestExamDate == null || (exam.EndDate.HasValue && exam.EndDate > latestExamDate))
            {
                latestExamDate = exam.EndDate;
                latestExamId = examId;
            }
            
            if (score < 50) scoreBuckets["0-50%"]++;
            else if (score < 70) scoreBuckets["50-70%"]++;
            else if (score < 85) scoreBuckets["70-85%"]++;
            else scoreBuckets["85-100%"]++;
            
            recentExamsData.Add(new StudentRecentExamDto
            {
                ExamId = examId,
                Title = exam.Title ?? "Untitled Exam",
                StudentScore = score,
                AverageScore = examAverages.ContainsKey(examId) ? examAverages[examId] : 0,
                Date = exam.EndDate ?? DateTime.Now
            });
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
        examsQuery = ApplyFilters(examsQuery, filters);
        
        // Use AsNoTracking for read-only optimization
        var exams = await examsQuery.AsNoTracking().ToListAsync();
        
        await PopulateExamQuestions(exams);

        // Pre-calculate Total Marks per Exam and Question Marks Map for O(1) lookup
        var examTotalMarks = new Dictionary<long, double>();
        var examQuestionMarks = new Dictionary<long, Dictionary<long, double>>();

        foreach (var exam in exams)
        {
            var qMarks = new Dictionary<long, double>();
            double total = 0;
            // exam.ExamQuestionBanks is populated by PopulateExamQuestions
            foreach (var eq in exam.ExamQuestionBanks)
            {
                if (eq.QuestionId.HasValue)
                {
                    double mark = (double)(eq.Question?.Mark ?? 0);
                    qMarks[eq.QuestionId.Value] = mark;
                    total += mark;
                }
            }
            examQuestionMarks[exam.ExamId] = qMarks;
            examTotalMarks[exam.ExamId] = total;
        }

        var totalExamsCreated = exams.Count;
        var examBreakdown = new List<ExamStatsDto>();
        
        int totalPassedAcrossAllExams = 0;
        int totalFailedAcrossAllExams = 0;
        var uniqueStudents = new HashSet<long>();
        
        var examIds = exams.Select(e => e.ExamId).ToList();
        
        // Optimize Answer Fetching: Avoid large IN clauses for students if possible
        var answersQuery = _context.StudentExamAnswers.AsNoTracking()
            .Where(sea => sea.ExamDetailsId.HasValue && examIds.Contains(sea.ExamDetailsId.Value));

        List<StudentExamAnswer> allAnswers;

        if (filters?.GradeId.HasValue == true || filters?.ClassId.HasValue == true)
        {
             // Join to filter by student properties efficiently
             var joinQuery = answersQuery
                .Join(_context.StudentExtensions, 
                      ans => ans.AccountId, 
                      ext => ext.AccountId, 
                      (ans, ext) => new { ans, ext })
                .Where(x => x.ext.ClassId.HasValue);

             if (filters.GradeId.HasValue)
             {
                 long gId = filters.GradeId.Value;
                 // Use subquery for database-side filtering
                 var classIds = _context.TblClasses.Where(c => c.GradeId == gId).Select(c => c.Id);
                 joinQuery = joinQuery.Where(x => classIds.Contains(x.ext.ClassId!.Value));
             }
             
             if (filters.ClassId.HasValue)
             {
                 long cId = filters.ClassId.Value;
                 joinQuery = joinQuery.Where(x => x.ext.ClassId == cId);
             }

             // Projection to minimize data transfer
             allAnswers = await joinQuery.Select(x => new StudentExamAnswer {
                 AccountId = x.ans.AccountId,
                 ExamDetailsId = x.ans.ExamDetailsId,
                 QuestionBankId = x.ans.QuestionBankId,
                 Score = x.ans.Score
             }).ToListAsync();
        }
        else 
        {
            allAnswers = await answersQuery.Select(sea => new StudentExamAnswer {
                 AccountId = sea.AccountId,
                 ExamDetailsId = sea.ExamDetailsId,
                 QuestionBankId = sea.QuestionBankId,
                 Score = sea.Score
            }).ToListAsync();
        }

        var scoreBuckets = new Dictionary<string, int>
        {
            { "0-50%", 0 },
            { "50-70%", 0 },
            { "70-85%", 0 },
            { "85-100%", 0 }
        };

        // Group by Exam -> Student for fast processing
        var answersByExamAndStudent = allAnswers
            .GroupBy(a => a.ExamDetailsId!.Value)
            .ToDictionary(g => g.Key, g => g.GroupBy(a => a.AccountId));

        foreach (var exam in exams)
        {
            if (!answersByExamAndStudent.TryGetValue(exam.ExamId, out var studentGroups)) 
            {
                examBreakdown.Add(new ExamStatsDto { 
                    ExamId = exam.ExamId, 
                    ExamTitle = exam.Title, 
                    TotalStudents = 0,
                    PassedStudents = 0,
                    FailedStudents = 0,
                    PassPercentage = 0,
                    FailPercentage = 0,
                    AverageScore = 0
                });
                continue;
            }

            var qMarks = examQuestionMarks[exam.ExamId];
            var maxMarks = examTotalMarks[exam.ExamId];

            int examPassed = 0;
            int examFailed = 0;
            double examTotalScore = 0;
            int studentCount = 0;

            foreach (var studentGroup in studentGroups)
            {
                 long studentId = studentGroup.Key;
                 uniqueStudents.Add(studentId);
                 studentCount++;

                 double earned = 0;
                 foreach (var ans in studentGroup)
                 {
                     if (ans.Score && ans.QuestionBankId.HasValue && qMarks.TryGetValue(ans.QuestionBankId.Value, out double mark))
                     {
                         earned += mark;
                     }
                 }

                 double score = maxMarks > 0 ? (earned * 100.0 / maxMarks) : 0.0;
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
                 
                 // Update buckets
                 if (maxMarks > 0)
                 {
                     if (score < 50) scoreBuckets["0-50%"]++;
                     else if (score < 70) scoreBuckets["50-70%"]++;
                     else if (score < 85) scoreBuckets["70-85%"]++;
                     else scoreBuckets["85-100%"]++;
                 }
            }

            examBreakdown.Add(new ExamStatsDto
            {
                ExamId = exam.ExamId,
                ExamTitle = exam.Title,
                TotalStudents = studentCount,
                PassedStudents = examPassed,
                FailedStudents = examFailed,
                PassPercentage = studentCount > 0 ? Math.Round((double)examPassed / studentCount * 100, 2) : 0,
                FailPercentage = studentCount > 0 ? Math.Round((double)examFailed / studentCount * 100, 2) : 0,
                AverageScore = studentCount > 0 ? Math.Round(examTotalScore / studentCount, 2) : 0
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

        var scoreDistribution = scoreBuckets.Select(b => new ChartDataPointDto { Name = b.Key, Value = b.Value }).ToList();
        
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
            LatestExamLeaderboard = null,
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
        
        var studentQuery = _context.AccountRoles
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Student" && x.AccountId.HasValue)
            .Select(x => x.AccountId!.Value);

        if (filters?.GradeId.HasValue == true || filters?.ClassId.HasValue == true)
        {
            var studentExtQuery = _context.StudentExtensions.AsQueryable();
            if (filters.GradeId.HasValue)
            {
                var classIds = await _context.TblClasses.Where(c => c.GradeId == filters.GradeId.Value).Select(c => c.Id).ToListAsync();
                studentExtQuery = studentExtQuery.Where(se => se.ClassId.HasValue && classIds.Contains(se.ClassId.Value));
            }
            if (filters.ClassId.HasValue)
                studentExtQuery = studentExtQuery.Where(se => se.ClassId == filters.ClassId.Value);

            var validStudentIds = await studentExtQuery.Select(se => se.AccountId).ToListAsync();
            studentQuery = studentQuery.Where(id => validStudentIds.Contains(id));
        }

        var totalStudents = await studentQuery.Distinct().CountAsync();
        var validStudentIdsList = await studentQuery.Distinct().ToListAsync();

        var totalTeachers = await _context.AccountRoles
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Teacher")
            .Select(x => x.AccountId)
            .Distinct()
            .CountAsync();

        var filteredExamIds = allFilteredExams.Select(e => e.ExamId).ToList();
        var allStudentAnswers = await _context.StudentExamAnswers
            .Where(sea => sea.ExamDetailsId.HasValue && filteredExamIds.Contains(sea.ExamDetailsId.Value) && validStudentIdsList.Contains(sea.AccountId))
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

        // Pre-calculate marks map
        var questionMarks = new Dictionary<long, double>();
        double totalExamMarks = 0;
        foreach (var eq in exam.ExamQuestionBanks)
        {
            if (eq.QuestionId.HasValue)
            {
                double mark = (double)(eq.Question?.Mark ?? 0);
                questionMarks[eq.QuestionId.Value] = mark;
                totalExamMarks += mark;
            }
        }

        var studentAnswers = await _context.StudentExamAnswers
            .AsNoTracking()
            .Where(sea => sea.ExamDetailsId == examId)
            .ToListAsync();

        var studentIds = studentAnswers.Select(sa => sa.AccountId).Distinct().ToList();
        var students = await _context.Accounts
            .AsNoTracking()
            .Include(a => a.StudentExtension)
            .Where(a => studentIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        // Prepare for filtering
        HashSet<long>? validClassIdsForGrade = null;
        if (filters?.GradeId.HasValue == true)
        {
            validClassIdsForGrade = (await _context.TblClasses
                .Where(c => c.GradeId == filters.GradeId.Value)
                .Select(c => c.Id)
                .ToListAsync())
                .ToHashSet();
        }

        var leaderboardEntries = new List<LeaderboardEntryDto>();
        var answersByStudent = studentAnswers.GroupBy(a => a.AccountId);

        foreach (var group in answersByStudent)
        {
            var studentId = group.Key;
            
            if (!students.TryGetValue(studentId, out var student)) continue;

            // Apply Filters
            if (filters != null)
            {
                if (filters.ClassId.HasValue)
                {
                    if (student.StudentExtension?.ClassId != filters.ClassId.Value) continue;
                }

                if (filters.GradeId.HasValue)
                {
                    if (student.StudentExtension?.ClassId == null || 
                        validClassIdsForGrade == null || 
                        !validClassIdsForGrade.Contains(student.StudentExtension.ClassId.Value))
                    {
                        continue;
                    }
                }
            }

            double earnedMarks = 0;
            foreach (var ans in group)
            {
                if (ans.Score && ans.QuestionBankId.HasValue && questionMarks.TryGetValue(ans.QuestionBankId.Value, out double mark))
                {
                    earnedMarks += mark;
                }
            }

            var score = totalExamMarks > 0 ? Math.Round((earnedMarks * 100.0 / totalExamMarks), 2) : 0.0;

            leaderboardEntries.Add(new LeaderboardEntryDto
            {
                StudentId = studentId,
                StudentName = student.FullNameEn ?? "Unknown Student",
                Score = score,
                TotalMarks = (int)totalExamMarks,
                EarnedMarks = (int)earnedMarks,
                Rank = 0 
            });
        }

        leaderboardEntries = leaderboardEntries.OrderByDescending(e => e.Score).ToList();
        for (int i = 0; i < leaderboardEntries.Count; i++) leaderboardEntries[i].Rank = i + 1;

        if (string.Equals(filters?.GroupBy, "Class", StringComparison.OrdinalIgnoreCase))
        {
            // 1. Get all classes for the grade of this exam
            var examGradeId = exam.GradeId;
            var classesForGrade = await _context.TblClasses
                .AsNoTracking()
                .Where(c => c.GradeId == examGradeId)
                .ToListAsync();
            
            // 2. Map existing leaderboard entries to their classes
            var studentClassMap = students.Values
                .Where(s => s.StudentExtension?.ClassId != null)
                .ToDictionary(s => s.Id, s => s.StudentExtension!.ClassId!.Value);

            var classScores = leaderboardEntries
                .Where(le => studentClassMap.ContainsKey(le.StudentId))
                .GroupBy(le => studentClassMap[le.StudentId])
                .ToDictionary(g => g.Key, g => g.Average(x => x.Score));

            // 3. Build the final list including ALL classes for this grade
            var classResults = classesForGrade.Select(c => {
                var avgScore = classScores.ContainsKey(c.Id) ? Math.Round(classScores[c.Id], 2) : 0.0;
                return new LeaderboardEntryDto
                {
                    StudentId = c.Id,
                    StudentName = FormatClassName(c.ClassName ?? $"Class {c.Id}"),
                    Score = avgScore,
                    Rank = 0
                };
            })
            .OrderByDescending(e => e.Score)
            .ToList();

            for (int i = 0; i < classResults.Count; i++) classResults[i].Rank = i + 1;

            return new LeaderboardDto
            {
                ExamId = examId,
                ExamTitle = exam.Title ?? "Untitled Exam",
                TopStudents = classResults.Take(10).ToList(),
                HighlightedStudents = classResults.Take(3).ToList(),
                TotalParticipants = classResults.Count
            };
        }

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
            .AsNoTracking()
            .Join(_context.Roles, ar => ar.RoleId, r => r.Id, (ar, r) => new { ar.AccountId, r.RoleName })
            .Where(x => x.RoleName == "Student")
            .Select(x => x.AccountId)
            .Where(id => id.HasValue)
            .Cast<long>()
            .Distinct()
            .ToListAsync();

        var allStudentAnswers = await _context.StudentExamAnswers
            .AsNoTracking()
            .Where(sea => studentIds.Contains(sea.AccountId))
            .Select(sea => new { sea.AccountId, sea.ExamDetailsId, sea.QuestionBankId, sea.Score })
            .ToListAsync();

        var examIdsInvolved = allStudentAnswers
            .Where(a => a.ExamDetailsId.HasValue)
            .Select(a => a.ExamDetailsId!.Value)
            .Distinct()
            .ToList();

        var allExams = await _context.ExamDetails
            .AsNoTracking()
            .Where(e => examIdsInvolved.Contains(e.ExamId))
            .ToListAsync();
        
        await PopulateExamQuestions(allExams);

        // Pre-calculate Total Marks per Exam and Question Marks Map
        var examTotalMarksMap = new Dictionary<long, double>();
        var examQuestionMarksMap = new Dictionary<long, Dictionary<long, double>>();

        foreach (var exam in allExams)
        {
            var qMarks = new Dictionary<long, double>();
            double total = 0;
            foreach (var eq in exam.ExamQuestionBanks)
            {
                if (eq.QuestionId.HasValue)
                {
                    double mark = (double)(eq.Question?.Mark ?? 0);
                    qMarks[eq.QuestionId.Value] = mark;
                    total += mark;
                }
            }
            examQuestionMarksMap[exam.ExamId] = qMarks;
            examTotalMarksMap[exam.ExamId] = total;
        }

        var studentMap = await _context.Accounts
            .AsNoTracking()
            .Where(a => studentIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id);

        var studentPerformances = new List<(long StudentId, string StudentName, double AverageScore)>();
        var studentAnswerGroups = allStudentAnswers.GroupBy(a => a.AccountId);

        foreach (var group in studentAnswerGroups)
        {
            var studentId = group.Key;
            if (!studentMap.TryGetValue(studentId, out var student)) continue;

            var studentExamGroups = group.Where(a => a.ExamDetailsId.HasValue).GroupBy(a => a.ExamDetailsId!.Value);
            if (!studentExamGroups.Any()) continue;

            double totalPercentage = 0;
            int examCount = 0;

            foreach (var examGroup in studentExamGroups)
            {
                var examId = examGroup.Key;
                if (!examTotalMarksMap.TryGetValue(examId, out var maxMarks) || maxMarks <= 0) continue;
                var qMarks = examQuestionMarksMap[examId];

                double earned = 0;
                foreach (var ans in examGroup)
                {
                    if (ans.Score && ans.QuestionBankId.HasValue && qMarks.TryGetValue(ans.QuestionBankId.Value, out var mark))
                    {
                        earned += mark;
                    }
                }

                totalPercentage += (earned / maxMarks) * 100.0;
                examCount++;
            }

            if (examCount > 0)
            {
                studentPerformances.Add((student.Id, student.FullNameEn ?? "Unknown", totalPercentage / examCount));
            }
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

        if (filters.ExamId.HasValue)
        {
            query = query.Where(e => e.ExamId == filters.ExamId.Value);
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
            .Where(a => a.Role.RoleName == "Student" && a.StudentExtension != null && a.StudentExtension.ClassId.HasValue)
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
                Name = student.FullNameEn ?? string.Empty,
                Initials = initials,
                Grade = gradeName,
                Class = className,
                QuizScores = studentScores
            });
        }

        return result;
    }

    public async Task<LeaderboardDto> GetCombinedLeaderboardAsync(LeaderboardFilterDto? filters)
    {
        var gradeId = filters?.GradeId;
        Console.WriteLine($"[DEBUG] GetCombinedLeaderboardAsync called for gradeId: {gradeId}, GroupBy: {filters?.GroupBy}");
        try
        {
            // 1. Get All Exams for this Grade (or all if gradeId is null)
            var examsQuery = _context.ExamDetails.AsNoTracking();
            examsQuery = ApplyFilters(examsQuery, filters);
            
            var exams = await examsQuery.ToListAsync();
            Console.WriteLine($"[DEBUG] Found {exams.Count} exams for filter");
            
            if (!exams.Any())
            {
                return new LeaderboardDto { ExamTitle = "Overall Performance", TopStudents = new(), HighlightedStudents = new(), TotalParticipants = 0 };
            }

            await PopulateExamQuestions(exams);
            
            var examIds = exams.Select(e => e.ExamId).ToList();

            // Pre-calculate Total Marks per Exam and Question Marks Map for O(1) lookup
            var examTotalMarksMap = new Dictionary<long, double>();
            var examQuestionMarksMap = new Dictionary<long, Dictionary<long, double>>();

            foreach (var exam in exams)
            {
                var qMarks = new Dictionary<long, double>();
                double total = 0;
                foreach (var eq in exam.ExamQuestionBanks)
                {
                    if (eq.QuestionId.HasValue)
                    {
                        double mark = (double)(eq.Question?.Mark ?? 0);
                        qMarks[eq.QuestionId.Value] = mark;
                        total += mark;
                    }
                }
                examQuestionMarksMap[exam.ExamId] = qMarks;
                examTotalMarksMap[exam.ExamId] = total;
            }

            // 2. Get all answers for these exams - Optimize Projection
            var allAnswers = await _context.StudentExamAnswers
                .AsNoTracking()
                .Where(sea => sea.ExamDetailsId.HasValue && examIds.Contains(sea.ExamDetailsId.Value))
                .Select(sea => new { sea.AccountId, sea.ExamDetailsId, sea.QuestionBankId, sea.Score })
                .ToListAsync();

            Console.WriteLine($"[DEBUG] Total answers found: {allAnswers.Count}");

            // 3. Group answers by student for efficient processing
            var studentAnswerGroups = allAnswers.GroupBy(a => a.AccountId).ToList();
            var involvedStudentIds = studentAnswerGroups.Select(g => g.Key).ToList();

            // Fetch involved students with their extensions
            var students = await _context.Accounts
                .AsNoTracking()
                .Include(a => a.StudentExtension)
                .Where(a => involvedStudentIds.Contains(a.Id))
                .ToDictionaryAsync(a => a.Id);

            var leaderboardEntries = new List<LeaderboardEntryDto>();

            foreach (var group in studentAnswerGroups)
            {
                var studentId = group.Key;
                if (!students.TryGetValue(studentId, out var student)) continue;

                // Apply manual student-level filters (ClassId)
                if (filters?.ClassId.HasValue == true && student.StudentExtension?.ClassId != filters.ClassId.Value) 
                    continue;

                var studentExamGroups = group.GroupBy(a => a.ExamDetailsId!.Value);

                double totalPercentage = 0;
                int validExamCount = 0;

                foreach (var examGroup in studentExamGroups)
                {
                    var eId = examGroup.Key;
                    if (!examTotalMarksMap.TryGetValue(eId, out var maxMarks) || maxMarks <= 0) continue;
                    var qMarks = examQuestionMarksMap[eId];

                    double earned = 0;
                    foreach (var ans in examGroup)
                    {
                        if (ans.Score && ans.QuestionBankId.HasValue && qMarks.TryGetValue(ans.QuestionBankId.Value, out var mark))
                        {
                            earned += mark;
                        }
                    }

                    totalPercentage += (earned / maxMarks) * 100.0;
                    validExamCount++;
                }

                if (validExamCount == 0) continue;

                leaderboardEntries.Add(new LeaderboardEntryDto
                {
                    StudentId = studentId,
                    StudentName = student.FullNameEn ?? "Unknown Student",
                    Score = Math.Round(totalPercentage / validExamCount, 2),
                    TotalMarks = validExamCount * 100,
                    EarnedMarks = (int)totalPercentage,
                    Rank = 0
                });
            }

            // 5. Rank
            leaderboardEntries = leaderboardEntries.OrderByDescending(e => e.Score).ToList();
            for (int i = 0; i < leaderboardEntries.Count; i++) leaderboardEntries[i].Rank = i + 1;

            if (string.Equals(filters?.GroupBy, "Class", StringComparison.OrdinalIgnoreCase))
            {
                var classesQuery = _context.TblClasses.AsNoTracking();
                if (gradeId.HasValue) classesQuery = classesQuery.Where(c => c.GradeId == gradeId.Value);
                var classesForFilter = await classesQuery.ToListAsync();

                var studentClassMap = students.Values
                    .Where(s => s.StudentExtension?.ClassId != null)
                    .ToDictionary(s => s.Id, s => s.StudentExtension!.ClassId!.Value);

                var classScores = leaderboardEntries
                    .Where(le => studentClassMap.ContainsKey(le.StudentId))
                    .GroupBy(le => studentClassMap[le.StudentId])
                    .ToDictionary(g => g.Key, g => g.Average(x => x.Score));

                var classResults = classesForFilter.Select(c => {
                    var avgScore = (classScores.ContainsKey(c.Id) && !double.IsNaN(classScores[c.Id])) 
                        ? Math.Round(classScores[c.Id], 2) 
                        : 0.0;
                    return new LeaderboardEntryDto
                    {
                        StudentId = c.Id,
                        StudentName = FormatClassName(c.ClassName ?? $"Class {c.Id}"),
                        Score = avgScore,
                        Rank = 0
                    };
                })
                .OrderByDescending(e => e.Score)
                .ThenBy(e => e.StudentName)
                .ToList();

                for (int i = 0; i < classResults.Count; i++) classResults[i].Rank = i + 1;

                return new LeaderboardDto
                {
                    ExamId = 0,
                    ExamTitle = "Overall Class Performance",
                    TopStudents = classResults.Take(20).ToList(),
                    HighlightedStudents = classResults.Take(3).ToList(),
                    TotalParticipants = classResults.Count
                };
            }

            return new LeaderboardDto
            {
                ExamId = 0,
                ExamTitle = "Overall Performance",
                TopStudents = leaderboardEntries.Take(10).ToList(),
                HighlightedStudents = leaderboardEntries.Take(3).ToList(),
                TotalParticipants = leaderboardEntries.Count
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DEBUG] ERROR in GetCombinedLeaderboardAsync: {ex.Message}");
            throw;
        }
    }

    public async Task<List<TeacherAccountDto>> GetTeachersAsync()
    {
        // Get all role IDs that are named "Teacher" (case-insensitive)
        var teacherRoleIds = await _context.Roles
            .Where(r => r.RoleName.ToLower() == "teacher")
            .Select(r => r.Id)
            .ToListAsync();

        if (!teacherRoleIds.Any())
        {
            return new List<TeacherAccountDto>();
        }

        // Find accounts that have this role either directly
        var accountsWithDirectRole = _context.Accounts
            .Where(a => teacherRoleIds.Contains(a.RoleId));

        // Find accounts that have this role via the join table
        var accountsWithJoinRole = _context.AccountRoles
            .Where(ar => ar.RoleId.HasValue && teacherRoleIds.Contains(ar.RoleId.Value) && ar.AccountId.HasValue)
            .Join(_context.Accounts, ar => ar.AccountId, a => a.Id, (ar, a) => a);

        // Union both sets to get all teachers
        var teachers = await accountsWithDirectRole
            .Union(accountsWithJoinRole)
            .Select(a => new TeacherAccountDto
            {
                Id = a.Id,
                FullNameEn = a.FullNameEn,
                FullNameAr = a.FullNameAr,
                Email = a.Email,
                IsActive = a.IsActive,
                TotalExams = _context.ExamDetails.Count(e => e.CreatedBy_AccId == a.Id)
            })
            .Distinct()
            .ToListAsync();

        return teachers;
    }
}
