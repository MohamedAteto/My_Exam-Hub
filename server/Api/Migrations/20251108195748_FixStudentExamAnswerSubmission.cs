using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class FixStudentExamAnswerSubmission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StudentExamAnswer_ExamQuestion",
                table: "StudentExamAnswer");

            migrationBuilder.AddColumn<long>(
                name: "ExamQuestionId",
                table: "StudentExamAnswer",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Exam_Class",
                columns: table => new
                {
                    Exam_ID = table.Column<long>(type: "bigint", nullable: false),
                    Class_ID = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Exam_Class", x => new { x.Exam_ID, x.Class_ID });
                    table.ForeignKey(
                        name: "FK_ExamClass_Class",
                        column: x => x.Class_ID,
                        principalTable: "Tbl_Class",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ExamClass_Exam",
                        column: x => x.Exam_ID,
                        principalTable: "Exam_Details",
                        principalColumn: "Exam_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentExamAnswer_ExamQuestionId",
                table: "StudentExamAnswer",
                column: "ExamQuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_Exam_Class_Class_ID",
                table: "Exam_Class",
                column: "Class_ID");

            migrationBuilder.AddForeignKey(
                name: "FK_StudentExamAnswer_ExamQuestion_ExamQuestionId",
                table: "StudentExamAnswer",
                column: "ExamQuestionId",
                principalTable: "ExamQuestion",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StudentExamAnswer_ExamQuestion_ExamQuestionId",
                table: "StudentExamAnswer");

            migrationBuilder.DropTable(
                name: "Exam_Class");

            migrationBuilder.DropIndex(
                name: "IX_StudentExamAnswer_ExamQuestionId",
                table: "StudentExamAnswer");

            migrationBuilder.DropColumn(
                name: "ExamQuestionId",
                table: "StudentExamAnswer");

            migrationBuilder.AddForeignKey(
                name: "FK_StudentExamAnswer_ExamQuestion",
                table: "StudentExamAnswer",
                column: "ExamId",
                principalTable: "ExamQuestion",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
