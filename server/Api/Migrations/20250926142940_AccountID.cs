using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class AccountID : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "AccountId",
                table: "Question_Bank",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "Question_Bank");
        }
    }
}
