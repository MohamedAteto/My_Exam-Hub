using QuizesApi.Models;

namespace QuizesApi.Repositories.Interfaces
{
    public interface IExamRepo
    {
        Task<IEnumerable<ExamDetail>> GetAllAsync();
        Task<ExamDetail?> GetByIdAsync(long id);
        Task AddAsync(ExamDetail exam, List<long> questionIds);
        Task UpdateAsync(ExamDetail exam, List<long> questionIds);
        Task DeleteAsync(long id);
        Task SaveChangesAsync();
    }
}
