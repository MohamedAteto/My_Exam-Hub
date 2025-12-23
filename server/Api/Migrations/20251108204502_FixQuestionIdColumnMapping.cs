using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class FixQuestionIdColumnMapping : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The database has both Question_ID and QuestionId columns
            // We need to drop Question_ID and ensure QuestionId is properly configured
            // First, drop the foreign key constraint on Question_ID if it exists
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_StudentExamAnswer_Question' AND parent_object_id = OBJECT_ID('StudentExamAnswer'))
                BEGIN
                    -- Check which column the FK is on
                    DECLARE @FKColumnName NVARCHAR(128);
                    SELECT @FKColumnName = COL_NAME(fc.parent_object_id, fc.parent_column_id)
                    FROM sys.foreign_keys AS f
                    INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
                    WHERE f.name = 'FK_StudentExamAnswer_Question' AND fc.parent_object_id = OBJECT_ID('StudentExamAnswer');
                    
                    -- If FK is on Question_ID, we need to recreate it on QuestionId
                    IF @FKColumnName = 'Question_ID'
                    BEGIN
                        ALTER TABLE [StudentExamAnswer] DROP CONSTRAINT [FK_StudentExamAnswer_Question];
                        
                        -- Recreate FK on QuestionId if QuestionId column exists
                        IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                        BEGIN
                            ALTER TABLE [StudentExamAnswer]
                            ADD CONSTRAINT [FK_StudentExamAnswer_Question]
                            FOREIGN KEY ([QuestionId]) REFERENCES [Question_Bank] ([Question_ID]);
                        END
                    END
                END
            ");

            // Drop Question_ID column if it exists and QuestionId also exists
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'Question_ID')
                AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                BEGIN
                    -- Drop index on Question_ID if it exists
                    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentExamAnswer_QuestionId' AND object_id = OBJECT_ID('StudentExamAnswer'))
                    BEGIN
                        -- Index might be on QuestionId, check and drop if on Question_ID
                        DECLARE @IndexName NVARCHAR(128) = 'IX_StudentExamAnswer_QuestionId';
                        -- We'll let EF Core recreate the index if needed
                    END
                    
                    -- Drop the Question_ID column
                    ALTER TABLE [StudentExamAnswer] DROP COLUMN [Question_ID];
                END
            ");

            // Ensure QuestionId column exists and is NOT NULL
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                BEGIN
                    -- Create QuestionId column if it doesn't exist
                    ALTER TABLE [StudentExamAnswer]
                    ADD [QuestionId] BIGINT NOT NULL DEFAULT 0;
                    
                    -- Create foreign key
                    ALTER TABLE [StudentExamAnswer]
                    ADD CONSTRAINT [FK_StudentExamAnswer_Question]
                    FOREIGN KEY ([QuestionId]) REFERENCES [Question_Bank] ([Question_ID]);
                END
                ELSE
                BEGIN
                    -- Ensure QuestionId is NOT NULL
                    ALTER TABLE [StudentExamAnswer]
                    ALTER COLUMN [QuestionId] BIGINT NOT NULL;
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert: Create Question_ID column if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'Question_ID')
                AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                BEGIN
                    -- Copy data from QuestionId to Question_ID
                    ALTER TABLE [StudentExamAnswer]
                    ADD [Question_ID] BIGINT NOT NULL DEFAULT 0;
                    
                    UPDATE [StudentExamAnswer]
                    SET [Question_ID] = [QuestionId];
                    
                    -- Drop FK on QuestionId
                    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_StudentExamAnswer_Question')
                    BEGIN
                        ALTER TABLE [StudentExamAnswer] DROP CONSTRAINT [FK_StudentExamAnswer_Question];
                    END
                    
                    -- Recreate FK on Question_ID
                    ALTER TABLE [StudentExamAnswer]
                    ADD CONSTRAINT [FK_StudentExamAnswer_Question]
                    FOREIGN KEY ([Question_ID]) REFERENCES [Question_Bank] ([Question_ID]);
                    
                    -- Drop QuestionId
                    ALTER TABLE [StudentExamAnswer] DROP COLUMN [QuestionId];
                END
            ");
        }
    }
}
