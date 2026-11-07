using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using System.Linq;

namespace QuizesApi.Repositories.Implementation;

public class ExamRepo : IExamRepo
{
    private readonly ElsewedySchoolSysDbDevContext _context;

    public ExamRepo(ElsewedySchoolSysDbDevContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ExamDetail>> GetAllAsync()
    {
        var exams = await _context.ExamDetails
            .Include(e => e.Subject)
            .ToListAsync();

        // Early exit — nothing to populate if no exams were returned
        if (!exams.Any()) return exams;

        // Collect the IDs of the exams we actually loaded, then ask SQL Server
        // for ONLY the link rows and question rows that belong to those exams.
        // This replaces the previous full-table loads of ExamQuestionBanks and
        // QuestionBanks, which retrieved every row in both tables regardless of
        // which exams were needed.
        var examIds = exams.Select(e => e.ExamId).ToList();

        var links = await _context.ExamQuestionBanks
            .Where(eq => eq.ExamId.HasValue && examIds.Contains(eq.ExamId.Value))
            .ToListAsync();

        var qIds = links
            .Where(l => l.QuestionId.HasValue)
            .Select(l => l.QuestionId!.Value)
            .Distinct()
            .ToList();

        var questions = await _context.QuestionBanks
            .Where(q => qIds.Contains(q.QuestionId))
            .ToDictionaryAsync(q => q.QuestionId);

        // In-memory assembly — unchanged from the original implementation
        foreach (var exam in exams)
        {
            var examLinks = links.Where(l => l.ExamId == exam.ExamId).ToList();
            foreach (var link in examLinks)
            {
                if (link.QuestionId.HasValue && questions.TryGetValue(link.QuestionId.Value, out var question))
                {
                    link.Question = question;
                    exam.ExamQuestionBanks.Add(link);
                }
            }
        }

        return exams;
    }

    public async Task<ExamDetail?> GetByIdAsync(long id)
    {
        var exam = await _context.ExamDetails
            .Include(e => e.Subject)
            .FirstOrDefaultAsync(e => e.ExamId == id);

        if (exam == null) return null;

        var links = await _context.ExamQuestionBanks
            .Where(eq => eq.ExamId == id)
            .ToListAsync();

        // Collect all question IDs from the links in one pass, then issue a
        // single batched SELECT … WHERE QuestionId IN (…) instead of the
        // previous loop that called FindAsync once per link (N+1 pattern).
        var qIds = links
            .Where(l => l.QuestionId.HasValue)
            .Select(l => l.QuestionId!.Value)
            .Distinct()
            .ToList();

        var questions = await _context.QuestionBanks
            .Where(q => qIds.Contains(q.QuestionId))
            .ToDictionaryAsync(q => q.QuestionId);

        // In-memory assembly — unchanged from the original implementation
        foreach (var link in links)
        {
            if (link.QuestionId.HasValue && questions.TryGetValue(link.QuestionId.Value, out var question))
            {
                link.Question = question;
                exam.ExamQuestionBanks.Add(link);
            }
        }

        return exam;
    }

    public async Task AddAsync(ExamDetail exam, List<long> questionIds, List<long>? classIds = null)
    {
        if (classIds != null && classIds.Any())
        {
            exam.ClassId = "," + string.Join(",", classIds) + ",";
        }

        await _context.ExamDetails.AddAsync(exam);
        await _context.SaveChangesAsync(); // Save to get ExamId
        
        foreach (var qId in questionIds)
        {
            var link = new ExamQuestionBank
            {
                QuestionId = qId,
                ExamId = exam.ExamId
            };
            await _context.ExamQuestionBanks.AddAsync(link);
        }
        
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(ExamDetail exam, List<long> questionIds, List<long>? classIds = null)
    {
        if (classIds != null && classIds.Any())
        {
            exam.ClassId = "," + string.Join(",", classIds) + ",";
        }

        // Update ExamDetail fields
        _context.ExamDetails.Update(exam);

        // SYNC ExamQuestionBanks
        var currentLinks = await _context.ExamQuestionBanks.Where(eq => eq.ExamId == exam.ExamId).ToListAsync();
        var currentQIds = currentLinks.Select(l => l.QuestionId ?? 0).ToList();

        // Identify removal
        var linksToRemove = currentLinks.Where(l => l.QuestionId.HasValue && !questionIds.Contains(l.QuestionId.Value)).ToList();
        if (linksToRemove.Any())
        {
            _context.ExamQuestionBanks.RemoveRange(linksToRemove);
        }

        // Identify additions
        var qIdsToAdd = questionIds.Where(id => !currentQIds.Contains(id)).Distinct().ToList();
        foreach (var qId in qIdsToAdd)
        {
            await _context.ExamQuestionBanks.AddAsync(new ExamQuestionBank
            {
                ExamId = exam.ExamId,
                QuestionId = qId
            });
        }
    }

    public async Task DeleteAsync(long id)
    {
        var entity = await _context.ExamDetails.FindAsync(id);
        if (entity != null)
        {
            // Manual specific cascade delete if needed
            var links = await _context.ExamQuestionBanks.Where(eq => eq.ExamId == id).ToListAsync();
            _context.ExamQuestionBanks.RemoveRange(links);
            
            _context.ExamDetails.Remove(entity);
        }
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
