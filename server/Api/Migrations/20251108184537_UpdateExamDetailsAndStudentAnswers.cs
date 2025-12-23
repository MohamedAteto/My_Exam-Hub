using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdateExamDetailsAndStudentAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop index only if it exists
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_StudentExamAnswer_AccountExam' AND object_id = OBJECT_ID('StudentExamAnswer'))
                    DROP INDEX [UQ_StudentExamAnswer_AccountExam] ON [StudentExamAnswer];
            ");

            // Drop columns only if they exist
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exam_Details') AND name = 'Class')
                    ALTER TABLE [Exam_Details] DROP COLUMN [Class];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exam_Details') AND name = 'Exam_Subject')
                    ALTER TABLE [Exam_Details] DROP COLUMN [Exam_Subject];
            ");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exam_Details') AND name = 'Grade')
                    ALTER TABLE [Exam_Details] DROP COLUMN [Grade];
            ");

            // Rename column only if it exists
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Exam_Details') AND name = 'CreatedBy')
                BEGIN
                    EXEC sp_rename 'Exam_Details.CreatedBy', 'CreatedBy_AccID', 'COLUMN';
                END
            ");

            // Rename index only if it exists
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Exam_Details_CreatedBy' AND object_id = OBJECT_ID('Exam_Details'))
                BEGIN
                    EXEC sp_rename 'Exam_Details.IX_Exam_Details_CreatedBy', 'IX_Exam_Details_CreatedBy_AccID', 'INDEX';
                END
            ");

            migrationBuilder.AddColumn<long>(
                name: "Question_ID",
                table: "StudentExamAnswer",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "Class_ID",
                table: "Exam_Details",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Grade_ID",
                table: "Exam_Details",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Subject_ID",
                table: "Exam_Details",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Subject",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubjectName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StatusId = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Subject", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Subject_Status",
                        column: x => x.StatusId,
                        principalTable: "Status",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_StudentExamAnswer_QuestionId",
                table: "StudentExamAnswer",
                column: "Question_ID");

            migrationBuilder.CreateIndex(
                name: "UQ_StudentExamAnswer_AccountExamQuestion",
                table: "StudentExamAnswer",
                columns: new[] { "AccountId", "ExamId", "Question_ID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Exam_Details_Class_ID",
                table: "Exam_Details",
                column: "Class_ID");

            migrationBuilder.CreateIndex(
                name: "IX_Exam_Details_Grade_ID",
                table: "Exam_Details",
                column: "Grade_ID");

            migrationBuilder.CreateIndex(
                name: "IX_Exam_Details_Subject_ID",
                table: "Exam_Details",
                column: "Subject_ID");

            migrationBuilder.CreateIndex(
                name: "IX_Subject_StatusId",
                table: "Subject",
                column: "StatusId");

            migrationBuilder.CreateIndex(
                name: "UQ_Subject_SubjectName",
                table: "Subject",
                column: "SubjectName",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ExamDetail_Class",
                table: "Exam_Details",
                column: "Class_ID",
                principalTable: "Tbl_Class",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ExamDetail_Grade",
                table: "Exam_Details",
                column: "Grade_ID",
                principalTable: "Grade",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_ExamDetail_Subject",
                table: "Exam_Details",
                column: "Subject_ID",
                principalTable: "Subject",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_StudentExamAnswer_Question",
                table: "StudentExamAnswer",
                column: "Question_ID",
                principalTable: "Question_Bank",
                principalColumn: "Question_ID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ExamDetail_Class",
                table: "Exam_Details");

            migrationBuilder.DropForeignKey(
                name: "FK_ExamDetail_Grade",
                table: "Exam_Details");

            migrationBuilder.DropForeignKey(
                name: "FK_ExamDetail_Subject",
                table: "Exam_Details");

            migrationBuilder.DropForeignKey(
                name: "FK_StudentExamAnswer_Question",
                table: "StudentExamAnswer");

            migrationBuilder.DropTable(
                name: "Subject");

            migrationBuilder.DropIndex(
                name: "IX_StudentExamAnswer_QuestionId",
                table: "StudentExamAnswer");

            migrationBuilder.DropIndex(
                name: "UQ_StudentExamAnswer_AccountExamQuestion",
                table: "StudentExamAnswer");

            migrationBuilder.DropIndex(
                name: "IX_Exam_Details_Class_ID",
                table: "Exam_Details");

            migrationBuilder.DropIndex(
                name: "IX_Exam_Details_Grade_ID",
                table: "Exam_Details");

            migrationBuilder.DropIndex(
                name: "IX_Exam_Details_Subject_ID",
                table: "Exam_Details");

            migrationBuilder.DropColumn(
                name: "Question_ID",
                table: "StudentExamAnswer");

            migrationBuilder.DropColumn(
                name: "Class_ID",
                table: "Exam_Details");

            migrationBuilder.DropColumn(
                name: "Grade_ID",
                table: "Exam_Details");

            migrationBuilder.DropColumn(
                name: "Subject_ID",
                table: "Exam_Details");

            migrationBuilder.RenameColumn(
                name: "CreatedBy_AccID",
                table: "Exam_Details",
                newName: "CreatedBy");

            migrationBuilder.RenameIndex(
                name: "IX_Exam_Details_CreatedBy_AccID",
                table: "Exam_Details",
                newName: "IX_Exam_Details_CreatedBy");

            migrationBuilder.AddColumn<string>(
                name: "Class",
                table: "Exam_Details",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Exam_Subject",
                table: "Exam_Details",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Grade",
                table: "Exam_Details",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "UQ_StudentExamAnswer_AccountExam",
                table: "StudentExamAnswer",
                columns: new[] { "AccountId", "ExamId" },
                unique: true);
        }
    }
}
