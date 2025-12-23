using Microsoft.EntityFrameworkCore;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;

public class ExamRepo : IExamRepo
{
    private readonly ElsewedySchoolContext _context;

    public ExamRepo(ElsewedySchoolContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ExamDetail>> GetAllAsync()
    {
        return await _context.ExamDetails
            .Include(e => e.Subject)
            .Include(e => e.Grade)
            .Include(e => e.Class)
            .Include(e => e.Creator)
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .Include(e => e.ExamClasses)
            .ThenInclude(ec => ec.Class)
            .ToListAsync();
    }

    public async Task<ExamDetail?> GetByIdAsync(long id)
    {
        return await _context.ExamDetails
            .Include(e => e.Subject)
            .Include(e => e.Grade)
            .Include(e => e.Class)
            .Include(e => e.Creator)
            .Include(e => e.ExamQuestionBanks)
            .ThenInclude(eq => eq.Question)
            .Include(e => e.ExamClasses)
            .ThenInclude(ec => ec.Class)
            .FirstOrDefaultAsync(e => e.ExamId == id);
    }

    public async Task AddAsync(ExamDetail exam, List<long> questionIds)
    {
        foreach (var qId in questionIds)
        {
            exam.ExamQuestionBanks.Add(new ExamQuestionBank
            {
                QuestionId = qId,
                Exam = exam
            });
        }

        await _context.ExamDetails.AddAsync(exam);
    }

    public async Task UpdateAsync(ExamDetail exam, List<long> questionIds)
    {
        // remove old links
        var oldLinks = _context.ExamQuestionBanks.Where(eq => eq.ExamId == exam.ExamId);
        _context.ExamQuestionBanks.RemoveRange(oldLinks);

        // add new links
        foreach (var qId in questionIds)
        {
            exam.ExamQuestionBanks.Add(new ExamQuestionBank
            {
                ExamId = exam.ExamId,
                QuestionId = qId
            });
        }

        _context.ExamDetails.Update(exam);
    }

    public async Task DeleteAsync(long id)
    {
        var entity = await GetByIdAsync(id);
        if (entity != null)
            _context.ExamDetails.Remove(entity);
    }

    public async Task SaveChangesAsync()
    {
        await _context.SaveChangesAsync();
    }
}
