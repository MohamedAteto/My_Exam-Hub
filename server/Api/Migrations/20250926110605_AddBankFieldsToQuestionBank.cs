using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class AddBankFieldsToQuestionBank : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankDescription",
                table: "Question_Bank",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankKey",
                table: "Question_Bank",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankTitle",
                table: "Question_Bank",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Grade",
                table: "Question_Bank",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankDescription",
                table: "Question_Bank");

            migrationBuilder.DropColumn(
                name: "BankKey",
                table: "Question_Bank");

            migrationBuilder.DropColumn(
                name: "BankTitle",
                table: "Question_Bank");

            migrationBuilder.DropColumn(
                name: "Grade",
                table: "Question_Bank");
        }
    }
}
