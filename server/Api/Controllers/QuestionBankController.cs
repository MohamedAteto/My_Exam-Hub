using System;
using Microsoft.AspNetCore.Mvc;
using QuizesApi.Models;
using QuizesApi.Repositories.Interfaces;
using ClosedXML.Excel;
using QuizesApi.DTOs;
namespace QuizesApi.Controllers
{
        [ApiController]
        [Route("api/[controller]")]
        public class QuestionBankController : ControllerBase
        {
            private readonly IQuestionBankRepo _repo;

            public QuestionBankController(IQuestionBankRepo repo)
            {
                _repo = repo;
            }

            [HttpGet]
            public async Task<ActionResult<IEnumerable<QuestionBankReadDto>>> GetAll()
            {
                var questions = await _repo.GetAllAsync();
                return Ok(questions.Select(q => new QuestionBankReadDto
                {
                    AccountId = q.AccountId,
                    BankKey = q.BankKey,
                    BankTitle = q.BankTitle ?? string.Empty,
                    BankDescription = q.BankDescription,
                    Grade = q.Grade,
                    QuestionId = q.QuestionId,
                    QuestionTitle = q.QuestionTitle,
                    OptionA = q.OptionA,
                    OptionB = q.OptionB,
                    OptionC = q.OptionC,
                    OptionD = q.OptionD,
                    CorrectAnswer = q.CorrectAnswer,
                    QuestionSubject = q.QuestionSubject,
                    Mark = q.Mark ?? 0
                }));
            }

            [HttpGet("{id}")]
            public async Task<ActionResult<QuestionBankReadDto>> GetById(long id)
            {
                var question = await _repo.GetByIdAsync(id);
                if (question == null) return NotFound();

                return Ok(new QuestionBankReadDto
                {
                    AccountId = question.AccountId,
                    BankKey = question.BankKey,
                    BankTitle = question.BankTitle ?? string.Empty,
                    BankDescription = question.BankDescription,
                    Grade = question.Grade,
                    QuestionId = question.QuestionId,
                    QuestionTitle = question.QuestionTitle,
                    OptionA = question.OptionA,
                    OptionB = question.OptionB,
                    OptionC = question.OptionC,
                    OptionD = question.OptionD,
                    CorrectAnswer = question.CorrectAnswer,
                    QuestionSubject = question.QuestionSubject,
                    Mark = question.Mark ?? 0
                });
            }

            [HttpPost]
            public async Task<ActionResult> Create(QuestionBankCreateDto dto)
            {
                try
                {
                    if (dto.AccountId <= 0)
                        return BadRequest(new { message = "AccountId is required and must be greater than 0" });

                    if (string.IsNullOrWhiteSpace(dto.QuestionTitle))
                        return BadRequest(new { message = "Question title is required" });

                    var newQuestion = new QuestionBank
                    {
                        AccountId = dto.AccountId,
                        BankKey = string.IsNullOrWhiteSpace(dto.BankKey) ? Guid.NewGuid().ToString() : dto.BankKey,
                        BankTitle = dto.BankTitle,
                        BankDescription = dto.BankDescription,
                        Grade = dto.Grade,
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
                        Mark = dto.Mark
                    };

                    await _repo.AddAsync(newQuestion);
                    await _repo.SaveChangesAsync();

                    return CreatedAtAction(nameof(GetById), new { id = newQuestion.QuestionId }, newQuestion);
                }
                catch (Exception ex)
                {
                    return StatusCode(500, new { message = $"Error creating question: {ex.Message}" });
                }
            }

            [HttpPut("{id}")]
            public async Task<ActionResult> Update(long id, QuestionBankUpdateDto dto)
            {
                try
                {
                    var question = await _repo.GetByIdAsync(id);
                    if (question == null) return NotFound(new { message = $"Question with id {id} not found" });

                    if (string.IsNullOrWhiteSpace(dto.QuestionTitle))
                        return BadRequest(new { message = "Question title is required" });

                    question.BankKey = string.IsNullOrWhiteSpace(dto.BankKey) ? question.BankKey : dto.BankKey;
                    question.AccountId = dto.AccountId;
                    question.BankTitle = dto.BankTitle;
                    question.BankDescription = dto.BankDescription;
                    question.Grade = dto.Grade;
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

                    await _repo.UpdateAsync(question);
                    await _repo.SaveChangesAsync();

                    return NoContent();
                }
                catch (Exception ex)
                {
                    return StatusCode(500, new { message = $"Error updating question: {ex.Message}" });
                }
            }

            [HttpDelete("{id}")]
            public async Task<ActionResult> Delete(long id)
            {
                await _repo.DeleteAsync(id);
                await _repo.SaveChangesAsync();
                return NoContent();
            }
        [HttpPost("upload")]
        public async Task<ActionResult<QuestionUploadResultDto>> Upload(IFormFile file, [FromQuery] long accountId, [FromQuery] string? bankKey)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "File is empty or not provided." });

            if (!Path.GetExtension(file.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Invalid file format. Please upload an .xlsx file." });

            var result = new QuestionUploadResultDto();
            var addedEntities = new List<QuestionBank>();

            try
            {
                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                using var workbook = new XLWorkbook(stream);
                var worksheet = workbook.Worksheets.First();
                // Check if empty
                if (worksheet.RowsUsed().Count() == 0)
                     return BadRequest(new { message = "Excel file is empty." });

                var rows = worksheet.RangeUsed().RowsUsed().Skip(1); // Skip header

                // If bankKey is not provided, generate a new one for this batch (New Bank)
                string effectiveBankKey = !string.IsNullOrWhiteSpace(bankKey) ? bankKey : Guid.NewGuid().ToString();

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

                        var q = new QuestionBank
                        {
                            AccountId = accountId > 0 ? accountId : 1, 
                            BankKey = effectiveBankKey,
                            QuestionTitle = qText,
                            CorrectAnswer = correct,
                            Mark = marks,
                            OptionA = row.Cell(5).GetValue<string>(),
                            OptionB = row.Cell(6).GetValue<string>(),
                            OptionC = row.Cell(7).GetValue<string>(),
                            OptionD = row.Cell(8).GetValue<string>(),
                            UsedOptions = 4, 
                            QuestionSubject = "Uploaded"
                        };

                        if (string.IsNullOrWhiteSpace(q.CorrectAnswer))
                            throw new Exception("Missing Correct Answer");

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

                // Map to DTO
                result.AddedQuestions = addedEntities.Select(q => new QuestionBankReadDto
                {
                    AccountId = q.AccountId,
                    BankKey = q.BankKey,
                    BankTitle = q.BankTitle ?? string.Empty,
                    BankDescription = q.BankDescription,
                    Grade = q.Grade,
                    QuestionId = q.QuestionId,
                    QuestionTitle = q.QuestionTitle,
                    OptionA = q.OptionA,
                    OptionB = q.OptionB,
                    OptionC = q.OptionC,
                    OptionD = q.OptionD,
                    CorrectAnswer = q.CorrectAnswer,
                    QuestionSubject = q.QuestionSubject,
                    Mark = q.Mark ?? 0
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error processing file: {ex.Message}" });
            }
        }
        [HttpGet("template")]
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

                // Styling headers
                var headerRange = worksheet.Range("A1:H1");
                headerRange.Style.Font.Bold = true;
                headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

                // Sample Data - MCQ
                worksheet.Cell(2, 1).Value = "MCQ";
                worksheet.Cell(2, 2).Value = "What is the capital of France?";
                worksheet.Cell(2, 3).Value = "Paris";
                worksheet.Cell(2, 4).Value = 1;
                worksheet.Cell(2, 5).Value = "London";
                worksheet.Cell(2, 6).Value = "Paris";
                worksheet.Cell(2, 7).Value = "Berlin";
                worksheet.Cell(2, 8).Value = "Madrid";

                // Sample Data - True/False
                worksheet.Cell(3, 1).Value = "True/False";
                worksheet.Cell(3, 2).Value = "The earth is flat.";
                worksheet.Cell(3, 3).Value = "False";
                worksheet.Cell(3, 4).Value = 1;

                // Sample Data - Fill Blank
                worksheet.Cell(4, 1).Value = "Fill Blank";
                worksheet.Cell(4, 2).Value = "H2O is the chemical formula for ____.";
                worksheet.Cell(4, 3).Value = "Water";
                worksheet.Cell(4, 4).Value = 1;

                // worksheet.Columns().AdjustToContents();

                using var stream = new MemoryStream();
                workbook.SaveAs(stream);
                var content = stream.ToArray();

                return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Questions_Template.xlsx");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error generating template: {ex.Message}" });
            }
        }
    }
}
