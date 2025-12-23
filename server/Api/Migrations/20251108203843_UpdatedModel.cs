using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuizesApi.Migrations
{
    /// <inheritdoc />
    public partial class UpdatedModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Handle case where both Question_ID and QuestionId columns exist
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'Question_ID')
                AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                BEGIN
                    -- Both columns exist, drop Question_ID and all its dependencies
                    
                    -- Drop default constraint if it exists on Question_ID
                    DECLARE @DefaultConstraintName NVARCHAR(128);
                    SELECT @DefaultConstraintName = dc.name
                    FROM sys.default_constraints dc
                    INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
                    WHERE c.object_id = OBJECT_ID('StudentExamAnswer') AND c.name = 'Question_ID';
                    
                    IF @DefaultConstraintName IS NOT NULL
                    BEGIN
                        EXEC('ALTER TABLE [StudentExamAnswer] DROP CONSTRAINT [' + @DefaultConstraintName + ']');
                    END
                    
                    -- Drop indexes that depend on Question_ID
                    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentExamAnswer_QuestionId' AND object_id = OBJECT_ID('StudentExamAnswer'))
                    BEGIN
                        -- Check if index is on Question_ID
                        IF EXISTS (
                            SELECT 1 FROM sys.index_columns ic
                            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                            WHERE ic.object_id = OBJECT_ID('StudentExamAnswer') AND c.name = 'Question_ID' AND ic.index_id = (
                                SELECT index_id FROM sys.indexes WHERE name = 'IX_StudentExamAnswer_QuestionId' AND object_id = OBJECT_ID('StudentExamAnswer')
                            )
                        )
                        BEGIN
                            DROP INDEX [IX_StudentExamAnswer_QuestionId] ON [StudentExamAnswer];
                        END
                    END
                    
                    -- Drop unique constraint if it depends on Question_ID
                    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_StudentExamAnswer_AccountExamQuestion' AND object_id = OBJECT_ID('StudentExamAnswer'))
                    BEGIN
                        -- Check if unique constraint includes Question_ID
                        IF EXISTS (
                            SELECT 1 FROM sys.index_columns ic
                            INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                            WHERE ic.object_id = OBJECT_ID('StudentExamAnswer') AND c.name = 'Question_ID' AND ic.index_id = (
                                SELECT index_id FROM sys.indexes WHERE name = 'UQ_StudentExamAnswer_AccountExamQuestion' AND object_id = OBJECT_ID('StudentExamAnswer')
                            )
                        )
                        BEGIN
                            DROP INDEX [UQ_StudentExamAnswer_AccountExamQuestion] ON [StudentExamAnswer];
                        END
                    END
                    
                    -- Drop FK if it's on Question_ID
                    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_StudentExamAnswer_Question')
                    BEGIN
                        DECLARE @FKColumnName NVARCHAR(128);
                        SELECT @FKColumnName = COL_NAME(fc.parent_object_id, fc.parent_column_id)
                        FROM sys.foreign_keys AS f
                        INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
                        WHERE f.name = 'FK_StudentExamAnswer_Question' AND fc.parent_object_id = OBJECT_ID('StudentExamAnswer');
                        
                        IF @FKColumnName = 'Question_ID'
                        BEGIN
                            ALTER TABLE [StudentExamAnswer] DROP CONSTRAINT [FK_StudentExamAnswer_Question];
                            -- Recreate FK on QuestionId if it doesn't exist
                            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_StudentExamAnswer_Question')
                            BEGIN
                                ALTER TABLE [StudentExamAnswer]
                                ADD CONSTRAINT [FK_StudentExamAnswer_Question]
                                FOREIGN KEY ([QuestionId]) REFERENCES [Question_Bank] ([Question_ID]);
                            END
                        END
                    END
                    
                    -- Now drop Question_ID column
                    ALTER TABLE [StudentExamAnswer] DROP COLUMN [Question_ID];
                    
                    -- Recreate indexes on QuestionId if they don't exist
                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StudentExamAnswer_QuestionId' AND object_id = OBJECT_ID('StudentExamAnswer'))
                    BEGIN
                        CREATE INDEX [IX_StudentExamAnswer_QuestionId] ON [StudentExamAnswer] ([QuestionId]);
                    END
                    
                    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_StudentExamAnswer_AccountExamQuestion' AND object_id = OBJECT_ID('StudentExamAnswer'))
                    BEGIN
                        CREATE UNIQUE INDEX [UQ_StudentExamAnswer_AccountExamQuestion] ON [StudentExamAnswer] ([AccountId], [ExamId], [QuestionId]);
                    END
                END
                ELSE IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'Question_ID')
                AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                BEGIN
                    -- Only Question_ID exists, rename it
                    EXEC sp_rename 'StudentExamAnswer.Question_ID', 'QuestionId', 'COLUMN';
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Revert: Rename QuestionId back to Question_ID if QuestionId exists and Question_ID doesn't
            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'QuestionId')
                AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('StudentExamAnswer') AND name = 'Question_ID')
                BEGIN
                    EXEC sp_rename 'StudentExamAnswer.QuestionId', 'Question_ID', 'COLUMN';
                END
            ");
        }
    }
}
