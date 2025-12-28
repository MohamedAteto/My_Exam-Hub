using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;

public class ExamRepo : IExamRepo
{
    private readonly ElsewedySchoolSysDbDevContext _context;

    public ExamRepo(ElsewedySchoolSysDbDevContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ExamDetail>> GetAllAsync()
    {
        var exams = await _context.ExamDetails.ToListAsync();
        
        // Manual population of ExamQuestionBanks
        var allLinks = await _context.ExamQuestionBanks.ToListAsync();
        var allQuestions = await _context.QuestionBanks.ToDictionaryAsync(q => q.QuestionId);

        foreach (var exam in exams)
        {
            var links = allLinks.Where(l => l.ExamId == exam.ExamId).ToList();
            foreach (var link in links)
            {
                if (link.QuestionId.HasValue && allQuestions.TryGetValue(link.QuestionId.Value, out var question))
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
        var exam = await _context.ExamDetails.FirstOrDefaultAsync(e => e.ExamId == id);
        if (exam == null) return null;

        // Manual population
        var links = await _context.ExamQuestionBanks.Where(eq => eq.ExamId == id).ToListAsync();
        foreach (var link in links)
        {
            if (link.QuestionId.HasValue)
            {
                var question = await _context.QuestionBanks.FindAsync(link.QuestionId.Value);
                if (question != null)
                {
                    link.Question = question;
                    exam.ExamQuestionBanks.Add(link);
                }
            }
        }
        
        return exam;
    }

    public async Task AddAsync(ExamDetail exam, List<long> questionIds)
    {
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
    }

    public async Task UpdateAsync(ExamDetail exam, List<long> questionIds)
    {
        // Update ExamDetail fields
        _context.ExamDetails.Update(exam);

        // Update Links
        var oldLinks = await _context.ExamQuestionBanks.Where(eq => eq.ExamId == exam.ExamId).ToListAsync();
        _context.ExamQuestionBanks.RemoveRange(oldLinks);

        foreach (var qId in questionIds)
        {
            var link = new ExamQuestionBank
            {
                ExamId = exam.ExamId,
                QuestionId = qId
            };
            await _context.ExamQuestionBanks.AddAsync(link);
        }
    }

    public async Task DeleteAsync(long id)
    {
        var entity = await _context.ExamDetails.FindAsync(id);
        if (entity != null)
        {
            // Manual specific cascade delete if needed, usually DB handles it or we should remove links
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
