using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class EnsureQuestionBankColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add AccountId column if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'AccountId')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [AccountId] bigint NOT NULL DEFAULT 0;
                END
            ");

            // Add Grade column if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'Grade')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [Grade] nvarchar(max) NULL;
                END
            ");

            // Add BankKey column if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'BankKey')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [BankKey] nvarchar(max) NULL;
                END
            ");

            // Add BankTitle column if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'BankTitle')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [BankTitle] nvarchar(max) NULL;
                END
            ");

            // Add BankDescription column if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'BankDescription')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [BankDescription] nvarchar(max) NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Note: We don't drop columns in Down to avoid data loss
            // If you need to rollback, manually drop the columns
        }
    }
}
