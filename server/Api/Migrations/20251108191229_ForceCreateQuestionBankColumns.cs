using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class ForceCreateQuestionBankColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Force create AccountId column - rename if exists with wrong name, otherwise create
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'AccountId')
                BEGIN
                    -- Rename if exists with different name
                    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'Account_ID')
                    BEGIN
                        EXEC sp_rename 'Question_Bank.Account_ID', 'AccountId', 'COLUMN';
                    END
                    ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'AccountID')
                    BEGIN
                        EXEC sp_rename 'Question_Bank.AccountID', 'AccountId', 'COLUMN';
                    END
                    ELSE
                    BEGIN
                        -- Create the column if it doesn't exist at all
                        ALTER TABLE [Question_Bank] ADD [AccountId] bigint NOT NULL DEFAULT 0;
                    END
                END
            ");

            // Force create Grade column
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'Grade')
                BEGIN
                    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'Grade_Name')
                    BEGIN
                        EXEC sp_rename 'Question_Bank.Grade_Name', 'Grade', 'COLUMN';
                    END
                    ELSE
                    BEGIN
                        ALTER TABLE [Question_Bank] ADD [Grade] nvarchar(max) NULL;
                    END
                END
            ");

            // Force create Question_Subject column
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'Question_Subject')
                BEGIN
                    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'QuestionSubject')
                    BEGIN
                        EXEC sp_rename 'Question_Bank.QuestionSubject', 'Question_Subject', 'COLUMN';
                    END
                    ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'Subject')
                    BEGIN
                        EXEC sp_rename 'Question_Bank.Subject', 'Question_Subject', 'COLUMN';
                    END
                    ELSE
                    BEGIN
                        ALTER TABLE [Question_Bank] ADD [Question_Subject] nvarchar(max) NULL;
                    END
                END
            ");

            // Force create BankKey column
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'BankKey')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [BankKey] nvarchar(max) NULL;
                END
            ");

            // Force create BankTitle column
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Question_Bank') AND name = 'BankTitle')
                BEGIN
                    ALTER TABLE [Question_Bank] ADD [BankTitle] nvarchar(max) NULL;
                END
            ");

            // Force create BankDescription column
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
            // Note: We don't reverse these changes to avoid data loss
        }
    }
}
