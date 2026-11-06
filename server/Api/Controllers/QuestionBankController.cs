using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuizesApi.DTOs;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using ClosedXML.Excel;
using System.Security.Claims;

namespace QuizesApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // All endpoints require authentication as a baseline
    public class QuestionBankController : ControllerBase
    {
        private readonly IQuestionBankRepo _repo;

        public QuestionBankController(IQuestionBankRepo repo)
        {
            _repo = repo;
        }

        // ---------------------------------------------------------------------------
        // Internal helper
        // ---------------------------------------------------------------------------

        /// <summary>
        /// Reads the authenticated user's AccountId from their JWT claims.
        /// </summary>
        private long GetRequesterAccountId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("id")?.Value;

            long.TryParse(claim, out long accountId);
            return accountId;
        }

        // ---------------------------------------------------------------------------
        // GET /api/questionbank
        // Teachers and Admin-level roles may view all questions.
        // ---------------------------------------------------------------------------
        [HttpGet]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public async Task<ActionResult<IEnumerable<QuestionBankReadDto>>> GetAll()
        {
            var questions = await _repo.GetAllAsync();
            return Ok(questions.Select(MapToDto));
        }

        // ---------------------------------------------------------------------------
        // GET /api/questionbank/{id}
        // Teachers and Admin-level roles may view a single question.
        // ---------------------------------------------------------------------------
        [HttpGet("{id}")]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public async Task<ActionResult<QuestionBankReadDto>> GetById(long id)
        {
            var q = await _repo.GetByIdAsync(id);
            if (q == null) return NotFound();
            return Ok(MapToDto(q));
        }

        // ---------------------------------------------------------------------------
        // POST /api/questionbank
        // Teachers and Admin-level roles may create questions.
        // ---------------------------------------------------------------------------
        [HttpPost]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public async Task<ActionResult> Create(QuestionBankCreateDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.QuestionTitle))
                    return BadRequest(new { message = "Question title is required." });

                var accountId = GetRequesterAccountId();

                var newQuestion = new QuestionBank
                {
                    QuestionTitle = dto.QuestionTitle,
                    OptionA = dto.OptionA,
                    OptionB = dto.OptionB,
                    OptionC = dto.OptionC,
                    OptionD = dto.OptionD,
                    OptionE = dto.OptionE,
                    OptionF = dto.OptionF,
                    OptionG = dto.OptionG,
                    OptionH = dto.OptionH,
                    UsedOptions = dto.UsedOptions,
                    CorrectAnswer = dto.CorrectAnswer,
                    QuestionSubject = dto.QuestionSubject,
                    Mark = dto.Mark,
                    AccountId = accountId > 0 ? accountId : null,
                    GradeId = dto.GradeId,
                    ClassId = dto.ClassId,
                    BankTitle = dto.BankTitle,
                    BankDescription = dto.BankDescription,
                    BankKey = dto.BankKey
                };

                await _repo.AddAsync(newQuestion);
                await _repo.SaveChangesAsync();

                return CreatedAtAction(nameof(GetById), new { id = newQuestion.QuestionId }, MapToDto(newQuestion));
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException?.Message ?? "No inner details";
                return StatusCode(500, new { message = $"Error creating question: {ex.Message} | Inner: {innerMessage}" });
            }
        }

        // ---------------------------------------------------------------------------
        // POST /api/questionbank/upload
        // Teachers and Admin-level roles may bulk-upload questions via Excel.
        // ---------------------------------------------------------------------------
        [HttpPost("upload")]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public async Task<ActionResult<QuestionUploadResultDto>> Upload(
            IFormFile file,
            [FromQuery] long? gradeId,
            [FromQuery] long? classId)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "File is empty or not provided." });

            if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Invalid file format. Please upload an .xlsx file." });

            var accountId = GetRequesterAccountId();

            var result = new QuestionUploadResultDto();
            var addedEntities = new List<QuestionBank>();

            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                using var workbook = new XLWorkbook(stream);
                var worksheet = workbook.Worksheets.First();

                if (!worksheet.RowsUsed().Any())
                    return BadRequest(new { message = "Excel file is empty." });

                var rows = worksheet.RangeUsed().RowsUsed().Skip(1); // Skip header row

                foreach (var row in rows)
                {
                    result.TotalProcessed++;
                    try
                    {
                        var qText = row.Cell(2).GetValue<string>();
                        if (string.IsNullOrWhiteSpace(qText)) continue;

                        var correct = row.Cell(3).GetValue<string>();
                        var marksString = row.Cell(4).GetValue<string>();
                        decimal.TryParse(marksString, out decimal marks);
                        if (marks == 0) marks = 1;

                        if (string.IsNullOrWhiteSpace(correct))
                            throw new Exception("Missing Correct Answer.");

                        var q = new QuestionBank
                        {
                            QuestionTitle = qText,
                            CorrectAnswer = correct,
                            Mark = marks,
                            OptionA = row.Cell(5).GetValue<string>(),
                            OptionB = row.Cell(6).GetValue<string>(),
                            OptionC = row.Cell(7).GetValue<string>(),
                            OptionD = row.Cell(8).GetValue<string>(),
                            UsedOptions = 4,
                            QuestionSubject = "Uploaded",
                            AccountId = accountId > 0 ? accountId : null,
                            GradeId = gradeId,
                            ClassId = classId
                        };

                        await _repo.AddAsync(q);
                        addedEntities.Add(q);
                        result.SuccessCount++;
                    }
                    catch (Exception ex)
                    {
                        result.FailureCount++;
                        result.Errors.Add($"Row {row.RowNumber()}: {ex.Message}");
                    }
                }

                await _repo.SaveChangesAsync();

                result.AddedQuestions = addedEntities.Select(MapToDto).ToList();
                return Ok(result);
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException?.Message ?? "No inner details";
                return StatusCode(500, new { message = $"Error processing file: {ex.Message} | Inner: {innerMessage}" });
            }
        }

        // ---------------------------------------------------------------------------
        // PUT /api/questionbank/{id}
        // Teachers and Admin-level roles may update questions.
        // ---------------------------------------------------------------------------
        [HttpPut("{id}")]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public async Task<ActionResult> Update(long id, QuestionBankUpdateDto dto)
        {
            try
            {
                var question = await _repo.GetByIdAsync(id);
                if (question == null)
                    return NotFound(new { message = $"Question with ID {id} not found." });

                if (string.IsNullOrWhiteSpace(dto.QuestionTitle))
                    return BadRequest(new { message = "Question title is required." });

                question.QuestionTitle = dto.QuestionTitle;
                question.OptionA = dto.OptionA;
                question.OptionB = dto.OptionB;
                question.OptionC = dto.OptionC;
                question.OptionD = dto.OptionD;
                question.OptionE = dto.OptionE;
                question.OptionF = dto.OptionF;
                question.OptionG = dto.OptionG;
                question.OptionH = dto.OptionH;
                question.UsedOptions = dto.UsedOptions;
                question.CorrectAnswer = dto.CorrectAnswer;
                question.QuestionSubject = dto.QuestionSubject;
                question.Mark = dto.Mark;
                question.GradeId = dto.GradeId ?? question.GradeId;
                question.ClassId = dto.ClassId ?? question.ClassId;
                question.BankTitle = dto.BankTitle ?? question.BankTitle;
                question.BankDescription = dto.BankDescription ?? question.BankDescription;
                question.BankKey = dto.BankKey ?? question.BankKey;

                if (dto.AccountId.HasValue && dto.AccountId.Value > 0)
                    question.AccountId = dto.AccountId;

                await _repo.UpdateAsync(question);
                await _repo.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                var innerMessage = ex.InnerException?.Message ?? "No inner details";
                return StatusCode(500, new { message = $"Error updating question: {ex.Message} | Inner: {innerMessage}" });
            }
        }

        // ---------------------------------------------------------------------------
        // DELETE /api/questionbank/{id}
        // Only Admin-level roles may delete questions.
        // ---------------------------------------------------------------------------
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Board,Superadmin")]
        public async Task<ActionResult> Delete(long id)
        {
            await _repo.DeleteAsync(id);
            await _repo.SaveChangesAsync();
            return NoContent();
        }

        // ---------------------------------------------------------------------------
        // GET /api/questionbank/template
        // Teachers and Admin-level roles may download the upload template.
        // ---------------------------------------------------------------------------
        [HttpGet("template")]
        [Authorize(Roles = "Teacher,Admin,Board,Superadmin")]
        public ActionResult DownloadTemplate()
        {
            try
            {
                using var workbook = new XLWorkbook();
                var worksheet = workbook.Worksheets.Add("Questions Template");

                // Headers
                worksheet.Cell(1, 1).Value = "Question Type";
                worksheet.Cell(1, 2).Value = "Question Text";
                worksheet.Cell(1, 3).Value = "Correct Answer";
                worksheet.Cell(1, 4).Value = "Marks";
                worksheet.Cell(1, 5).Value = "Option A";
                worksheet.Cell(1, 6).Value = "Option B";
                worksheet.Cell(1, 7).Value = "Option C";
                worksheet.Cell(1, 8).Value = "Option D";

                var headerRange = worksheet.Range("A1:H1");
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

                // Sample rows
                worksheet.Cell(2, 1).Value = "MCQ";
                worksheet.Cell(2, 2).Value = "What is the capital of France?";
                worksheet.Cell(2, 3).Value = "Paris";
                worksheet.Cell(2, 4).Value = 1;
                worksheet.Cell(2, 5).Value = "London";
                worksheet.Cell(2, 6).Value = "Paris";
                worksheet.Cell(2, 7).Value = "Berlin";
                worksheet.Cell(2, 8).Value = "Madrid";

                worksheet.Cell(3, 1).Value = "True/False";
                worksheet.Cell(3, 2).Value = "The earth is flat.";
                worksheet.Cell(3, 3).Value = "False";
                worksheet.Cell(3, 4).Value = 1;

                worksheet.Cell(4, 1).Value = "Fill Blank";
                worksheet.Cell(4, 2).Value = "H2O is the chemical formula for ____.";
                worksheet.Cell(4, 3).Value = "Water";
                worksheet.Cell(4, 4).Value = 1;

                using var stream = new MemoryStream();
                workbook.SaveAs(stream);
                return File(stream.ToArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "Questions_Template.xlsx");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error generating template: {ex.Message}" });
            }
        }

        // ---------------------------------------------------------------------------
        // Mapping helper
        // ---------------------------------------------------------------------------

        private static QuestionBankReadDto MapToDto(QuestionBank q) => new QuestionBankReadDto
        {
            QuestionId = q.QuestionId,
            QuestionTitle = q.QuestionTitle,
            OptionA = q.OptionA,
            OptionB = q.OptionB,
            OptionC = q.OptionC,
            OptionD = q.OptionD,
            OptionE = q.OptionE,
            OptionF = q.OptionF,
            OptionG = q.OptionG,
            OptionH = q.OptionH,
            UsedOptions = q.UsedOptions ?? 4,
            CorrectAnswer = q.CorrectAnswer,
            QuestionSubject = q.QuestionSubject,
            Mark = q.Mark ?? 0,
            BankTitle = q.BankTitle,
            BankDescription = q.BankDescription,
            BankKey = q.BankKey,
            GradeId = q.GradeId,
            AccountId = q.AccountId,
            ClassId = q.ClassId
        };
    }
}
