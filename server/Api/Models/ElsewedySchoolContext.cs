using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace QuizesApi.Models;

public partial class ElsewedySchoolContext : IdentityDbContext<AppUser>
{
    public ElsewedySchoolContext()
    {
    }

    public ElsewedySchoolContext(DbContextOptions<ElsewedySchoolContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AbsenceRecord> AbsenceRecords { get; set; }

    public virtual DbSet<Account> Accounts { get; set; }

    public virtual DbSet<AccountRole> AccountRoles { get; set; }

    public virtual DbSet<Achievement> Achievements { get; set; }

    public virtual DbSet<AdmissionProfile> AdmissionProfiles { get; set; }

    public virtual DbSet<AdmissionQuizMath> AdmissionQuizMaths { get; set; }

    public virtual DbSet<AttendanceRecord> AttendanceRecords { get; set; }

    public virtual DbSet<BehaviorNote> BehaviorNotes { get; set; }

    public virtual DbSet<CapstoneSupervisorExtension> CapstoneSupervisorExtensions { get; set; }

    public virtual DbSet<EmailSetting> EmailSettings { get; set; }

    public virtual DbSet<EmploymentRequest> EmploymentRequests { get; set; }

    public virtual DbSet<ExamDetail> ExamDetails { get; set; }

    public virtual DbSet<ExamClass> ExamClasses { get; set; }

    public virtual DbSet<ExamQuestion> ExamQuestions { get; set; }

    public virtual DbSet<ExamQuestionBank> ExamQuestionBanks { get; set; }

    public virtual DbSet<ExamQuestionMath> ExamQuestionMaths { get; set; }

    public virtual DbSet<Grade> Grades { get; set; }

    public virtual DbSet<InterviewScore> InterviewScores { get; set; }

    public virtual DbSet<Login> Logins { get; set; }

    public virtual DbSet<Notification> Notifications { get; set; }

    public virtual DbSet<Project> Projects { get; set; }

    public virtual DbSet<QuestionBank> QuestionBanks { get; set; }

    public virtual DbSet<Report> Reports { get; set; }

    public virtual DbSet<ReportSpecialist> ReportSpecialists { get; set; }

    public virtual DbSet<ReviewerSupervisorExtension> ReviewerSupervisorExtensions { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<Scholarship> Scholarships { get; set; }

    public virtual DbSet<Section> Sections { get; set; }

    public virtual DbSet<Session> Sessions { get; set; }

    public virtual DbSet<Subject> Subjects { get; set; }

    public virtual DbSet<Sheet1> Sheet1s { get; set; }

    public virtual DbSet<Staff> Staff { get; set; }

    public virtual DbSet<Status> Statuses { get; set; }

    public virtual DbSet<StudentExamAnswer> StudentExamAnswers { get; set; }

    public virtual DbSet<StudentExamResult> StudentExamResults { get; set; }

    public virtual DbSet<StudentExtension> StudentExtensions { get; set; }

    public virtual DbSet<StudentProfile> StudentProfiles { get; set; }

    public virtual DbSet<StudentTask> StudentTasks { get; set; }

    public virtual DbSet<SubordinateTicket> SubordinateTickets { get; set; }

    public virtual DbSet<SuperAdminExtension> SuperAdminExtensions { get; set; }

    public virtual DbSet<TaskSubmission> TaskSubmissions { get; set; }

    public virtual DbSet<TblClass> TblClasses { get; set; }

    public virtual DbSet<TblTask> TblTasks { get; set; }

    public virtual DbSet<Team> Teams { get; set; }

    public virtual DbSet<TeamMember> TeamMembers { get; set; }

    public virtual DbSet<TicketType> TicketTypes { get; set; }

   
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.UseCollation("Arabic_100_CI_AI");

        modelBuilder.Entity<AbsenceRecord>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__AbsenceR__3214EC0794E16F35");

            entity.HasIndex(e => e.ClassId, "IX_AbsenceRecords_ClassId");

            entity.HasIndex(e => e.StudentId, "IX_AbsenceRecords_StudentId");

            entity.Property(e => e.Date).HasColumnType("datetime");
            entity.Property(e => e.StudentName).HasMaxLength(255);

            entity.HasOne(d => d.Class).WithMany(p => p.AbsenceRecords)
                .HasForeignKey(d => d.ClassId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AbsenceRecords_Class");

            entity.HasOne(d => d.Student).WithMany(p => p.AbsenceRecords)
                .HasForeignKey(d => d.StudentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AbsenceRecords_Account");
        });

        modelBuilder.Entity<Account>(entity =>
        {
            entity.ToTable("Account");

            entity.HasIndex(e => e.RoleId, "IX_Account_RoleId");

            entity.HasIndex(e => e.StatusId, "IX_Account_StatusId");

            entity.HasIndex(e => e.Email, "UQ__Account__A9D10534CCE8DFA0").IsUnique();

            entity.HasIndex(e => e.NationalId, "UQ__Account__E9AA32FA70EBBAC3").IsUnique();

            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("Created_at");
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.FullNameAr).HasColumnName("FullNameAR");
            entity.Property(e => e.FullNameEn).HasColumnName("FullNameEN");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.NationalId).HasMaxLength(50);
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Role).WithMany(p => p.Accounts)
                .HasForeignKey(d => d.RoleId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Account_Roles");

            entity.HasOne(d => d.Status).WithMany(p => p.Accounts)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Account_Status");


        });

        modelBuilder.Entity<AccountRole>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_AccountRoles_Account");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.AccountId).HasColumnName("AccountID");
            entity.Property(e => e.RoleId).HasColumnName("RoleID");
        });

        modelBuilder.Entity<AdmissionProfile>(entity =>
        {
            entity.HasKey(e => e.AccountId);

            entity.ToTable("AdmissionProfile");

            entity.HasIndex(e => e.StatusId, "IX_AdmissionProfile_StatusId");

            entity.Property(e => e.AccountId).ValueGeneratedNever();
            entity.Property(e => e.ArabicInterviewScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.EnglishInterviewScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.EnglishScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.HasIcdllicense).HasColumnName("HasICDLLicense");
            entity.Property(e => e.MathInterviewScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.MathScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.MinistryExamPercentage).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.ParentPhoneNumber).HasMaxLength(20);
            entity.Property(e => e.SoftwareInterviewScore).HasColumnType("decimal(5, 2)");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);
            entity.Property(e => e.ThirdPrepScore).HasColumnType("decimal(5, 2)");

            entity.HasOne(d => d.Account).WithOne(p => p.AdmissionProfile)
                .HasForeignKey<AdmissionProfile>(d => d.AccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AdmissionProfile_Account");

            entity.HasOne(d => d.Status).WithMany(p => p.AdmissionProfiles)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AdmissionProfile_Status");
        });

        modelBuilder.Entity<AdmissionQuizMath>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("AdmissionQuiz_MATH");

            entity.Property(e => e.A)
                .HasMaxLength(4000)
                .IsUnicode(false)
                .HasColumnName("a");
            entity.Property(e => e.Answer)
                .HasMaxLength(4000)
                .IsUnicode(false);
            entity.Property(e => e.B)
                .HasMaxLength(4000)
                .IsUnicode(false)
                .HasColumnName("b");
            entity.Property(e => e.C)
                .HasMaxLength(4000)
                .IsUnicode(false)
                .HasColumnName("c");
            entity.Property(e => e.CorrectAnswerTxt)
                .HasMaxLength(4000)
                .IsUnicode(false)
                .HasColumnName("CorrectAnswer_Txt");
            entity.Property(e => e.D)
                .HasMaxLength(4000)
                .IsUnicode(false)
                .HasColumnName("d");
            entity.Property(e => e.Question)
                .HasMaxLength(4000)
                .IsUnicode(false);
        });

        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Attendan__3214EC0723E966C3");

            entity.HasIndex(e => e.NoteId, "IX_AttendanceRecords_NoteId");

            entity.HasIndex(e => e.StudentId, "IX_AttendanceRecords_StudentId");

            entity.Property(e => e.Date).HasColumnType("datetime");

            entity.HasOne(d => d.Note).WithMany(p => p.AttendanceRecords)
                .HasForeignKey(d => d.NoteId)
                .HasConstraintName("FK_AttendanceRecords_BehaviorNotes");

            entity.HasOne(d => d.Student).WithMany(p => p.AttendanceRecords)
                .HasForeignKey(d => d.StudentId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AttendanceRecords_Account");
        });

        modelBuilder.Entity<BehaviorNote>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Behavior__3214EC07452FA35F");

            entity.HasIndex(e => e.AttendanceRecordId, "IX_BehaviorNotes_AttendanceRecordId");

            entity.Property(e => e.Gen).HasColumnName("gen");
            entity.Property(e => e.ImageUrl).HasMaxLength(255);
            entity.Property(e => e.NoteType).HasMaxLength(50);
            entity.Property(e => e.Title).HasMaxLength(255);

            entity.HasOne(d => d.AttendanceRecord).WithMany(p => p.BehaviorNotes)
                .HasForeignKey(d => d.AttendanceRecordId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_BehaviorNotes_AttendanceRecords");
        });

        modelBuilder.Entity<CapstoneSupervisorExtension>(entity =>
        {
            entity.HasKey(e => e.AccountId);

            entity.ToTable("CapstoneSupervisorExtension");

            entity.HasIndex(e => e.StatusId, "IX_CapstoneSupervisorExtension_StatusId");

            entity.Property(e => e.AccountId).ValueGeneratedNever();
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Account).WithOne(p => p.CapstoneSupervisorExtension)
                .HasForeignKey<CapstoneSupervisorExtension>(d => d.AccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CapstoneSupervisorExtension_Account");

            entity.HasOne(d => d.Status).WithMany(p => p.CapstoneSupervisorExtensions)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CapstoneSupervisorExtension_Status");
        });

        modelBuilder.Entity<EmploymentRequest>(entity =>
        {
            entity.HasIndex(e => e.StatusId, "IX_EmploymentRequests_StatusId");

            entity.Property(e => e.RequestDate).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.EmploymentRequests)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_EmploymentRequests_Status");
        });

        modelBuilder.Entity<Subject>(entity =>
        {
            entity.ToTable("Subject");

            entity.HasIndex(e => e.SubjectName, "UQ_Subject_SubjectName").IsUnique();

            entity.Property(e => e.SubjectName).HasMaxLength(100);

            entity.HasOne(d => d.Status).WithMany()
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Subject_Status");
        });

        modelBuilder.Entity<ExamDetail>(entity =>
        {
            entity.HasKey(e => e.ExamId).HasName("PK__Exam_Det__C782CA79487C7372");

            entity.ToTable("Exam_Details");

            entity.Property(e => e.ExamId).HasColumnName("Exam_ID");
            entity.Property(e => e.ExamDescription).HasColumnName("Exam_Description");
            entity.Property(e => e.SubjectId).HasColumnName("Subject_ID");
            entity.Property(e => e.GradeId).HasColumnName("Grade_ID");
            entity.Property(e => e.ClassId).HasColumnName("Class_ID");
            entity.Property(e => e.CreatedBy_AccID).HasColumnName("CreatedBy_AccID");

            entity.HasOne(d => d.Subject).WithMany(p => p.ExamDetails)
                .HasForeignKey(d => d.SubjectId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_ExamDetail_Subject");

            entity.HasOne(d => d.Grade).WithMany()
                .HasForeignKey(d => d.GradeId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_ExamDetail_Grade");

            entity.HasOne(d => d.Class).WithMany()
                .HasForeignKey(d => d.ClassId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_ExamDetail_Class");

            entity.HasOne(d => d.Creator).WithMany()
                .HasForeignKey(d => d.CreatedBy_AccID)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK__Exam_Deta__Creat__7849DB76");
        });

        modelBuilder.Entity<ExamClass>(entity =>
        {
            entity.HasKey(e => new { e.ExamId, e.ClassId });

            entity.ToTable("Exam_Class");

            entity.Property(e => e.ExamId).HasColumnName("Exam_ID");
            entity.Property(e => e.ClassId).HasColumnName("Class_ID");

            entity.HasOne(d => d.Exam).WithMany(p => p.ExamClasses)
                .HasForeignKey(d => d.ExamId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_ExamClass_Exam");

            entity.HasOne(d => d.Class).WithMany()
                .HasForeignKey(d => d.ClassId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_ExamClass_Class");
        });

        modelBuilder.Entity<ExamQuestion>(entity =>
        {
            entity.ToTable("ExamQuestion");
        });

        modelBuilder.Entity<ExamQuestionBank>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Exam_Que__3214EC275A2735A7");

            entity.ToTable("Exam_QuestionBank");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.ExamId).HasColumnName("Exam_ID");
            entity.Property(e => e.QuestionId).HasColumnName("Question_ID");
        });

        modelBuilder.Entity<ExamQuestionMath>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("ExamQuestion_Math");

            entity.Property(e => e.CorrectAnswer)
                .HasMaxLength(255)
                .HasColumnName("Correct Answer");
            entity.Property(e => e.CorrectAnswerTxt).HasColumnName("CorrectAnswer_Txt");
            entity.Property(e => e.OptionA).HasColumnName("Option A");
            entity.Property(e => e.OptionB).HasColumnName("Option B");
            entity.Property(e => e.OptionC).HasColumnName("Option C");
            entity.Property(e => e.OptionD).HasColumnName("Option D");
            entity.Property(e => e.SectionId).HasColumnName("SectionID");
        });

        modelBuilder.Entity<Grade>(entity =>
        {
            entity.ToTable("Grade");

            entity.HasIndex(e => e.AdminAccountId, "IX_Grade_AdminAccountId");

            entity.HasIndex(e => e.StatusId, "IX_Grade_StatusId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.AdminAccount).WithMany(p => p.Grades)
                .HasForeignKey(d => d.AdminAccountId)
                .HasConstraintName("FK_Grade_AdminAccount");

            entity.HasOne(d => d.Status).WithMany(p => p.Grades)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Grade_Status");
        });

        modelBuilder.Entity<InterviewScore>(entity =>
        {
            entity.ToTable("InterviewScore");

            entity.HasIndex(e => e.AccountId, "IX_InterviewScore_AccountId");

            entity.HasIndex(e => e.InterviewerId, "IX_InterviewScore_InterviewerId");

            entity.Property(e => e.Score).HasColumnType("decimal(5, 2)");

            entity.HasOne(d => d.Account).WithMany(p => p.InterviewScoreAccounts)
                .HasForeignKey(d => d.AccountId)
                .HasConstraintName("FK_InterviewScore_Student_Account");

            entity.HasOne(d => d.Interviewer).WithMany(p => p.InterviewScoreInterviewers)
                .HasForeignKey(d => d.InterviewerId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_InterviewScore_Admin_Account");
        });

        modelBuilder.Entity<Login>(entity =>
        {
            entity.ToTable("Login");

            entity.HasIndex(e => e.AccountId, "IX_Login_AccountId");

            entity.HasIndex(e => e.StatusId, "IX_Login_StatusId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Account).WithMany(p => p.Logins)
                .HasForeignKey(d => d.AccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Login_Account");

            entity.HasOne(d => d.Status).WithMany(p => p.Logins)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Login_Status");
        });

        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Notifica__3214EC278015B410");

            entity.HasIndex(e => e.AccountId, "IX_Notifications_AccountId");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.ReadStatusId)
                .HasDefaultValue(0L)
                .HasColumnName("Read_statusID");

            entity.HasOne(d => d.Account).WithMany(p => p.Notifications)
                .HasForeignKey(d => d.AccountId)
                .HasConstraintName("FK_Notifications_Account");
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("Project");

            entity.HasIndex(e => e.StatusId, "IX_Project_StatusId");

            entity.HasIndex(e => e.SupervisorAccountId, "IX_Project_SupervisorAccountId");

            entity.Property(e => e.CompanyName).HasDefaultValue("ELSEWEDY");
            entity.Property(e => e.DateOfCreation).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.NameAr).HasColumnName("NameAR");
            entity.Property(e => e.NameEn).HasColumnName("NameEN");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.Projects)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Project_Status");

            entity.HasOne(d => d.SupervisorAccount).WithMany(p => p.Projects)
                .HasForeignKey(d => d.SupervisorAccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Project_SupervisorAccount");
        });

        modelBuilder.Entity<QuestionBank>(entity =>
        {
            entity.HasKey(e => e.QuestionId).HasName("PK__Question__B0B2E4C6902349E6");

            entity.ToTable("Question_Bank");

            entity.Property(e => e.QuestionId).HasColumnName("Question_ID");
            entity.Property(e => e.AccountId).HasColumnName("AccountId");
            entity.Property(e => e.BankKey).HasColumnName("BankKey");
            entity.Property(e => e.BankTitle).HasColumnName("BankTitle");
            entity.Property(e => e.BankDescription).HasColumnName("BankDescription");
            entity.Property(e => e.Grade).HasColumnName("Grade");
            entity.Property(e => e.QuestionTitle).HasColumnName("Question_Title");
            entity.Property(e => e.OptionA).HasColumnName("OptionA");
            entity.Property(e => e.OptionB).HasColumnName("OptionB");
            entity.Property(e => e.OptionC).HasColumnName("OptionC");
            entity.Property(e => e.OptionD).HasColumnName("OptionD");
            entity.Property(e => e.OptionE).HasColumnName("OptionE");
            entity.Property(e => e.OptionF).HasColumnName("OptionF");
            entity.Property(e => e.OptionG).HasColumnName("OptionG");
            entity.Property(e => e.OptionH).HasColumnName("OptionH");
            entity.Property(e => e.UsedOptions).HasColumnName("UsedOptions");
            entity.Property(e => e.CorrectAnswer).HasColumnName("CorrectAnswer");
            entity.Property(e => e.QuestionSubject).HasColumnName("Question_Subject");
            entity.Property(e => e.Mark).HasColumnType("decimal(5, 2)");
        });

        modelBuilder.Entity<Report>(entity =>
        {
            entity.ToTable("Report");

            entity.HasIndex(e => e.StatusId, "IX_Report_StatusId");

            entity.HasIndex(e => e.SubmitterAccountId, "IX_Report_SubmitterAccountId");

            entity.Property(e => e.ReviewerId).HasColumnName("Reviewer_ID");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);
            entity.Property(e => e.SubmissionDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Status).WithMany(p => p.Reports)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Report_Status");

            entity.HasOne(d => d.SubmitterAccount).WithMany(p => p.Reports)
                .HasForeignKey(d => d.SubmitterAccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Report_SubmitterAccount");
        });

        modelBuilder.Entity<ReportSpecialist>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__ReportSp__3214EC077E928D74");

            entity.ToTable("ReportSpecialist");

            entity.HasIndex(e => e.StatusId, "IX_ReportSpecialist_StatusId");

            entity.Property(e => e.DateReport)
                .HasColumnType("datetime")
                .HasColumnName("date_report");

            entity.HasOne(d => d.Status).WithMany(p => p.ReportSpecialists)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReportSpecialist_Status");
        });

        modelBuilder.Entity<ReviewerSupervisorExtension>(entity =>
        {
            entity.HasKey(e => e.AccountId);

            entity.ToTable("ReviewerSupervisorExtension");

            entity.HasIndex(e => e.AssignedClassId, "IX_ReviewerSupervisorExtension_AssignedClassId");

            entity.HasIndex(e => e.StatusId, "IX_ReviewerSupervisorExtension_StatusId");

            entity.Property(e => e.AccountId).ValueGeneratedNever();
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Account).WithOne(p => p.ReviewerSupervisorExtension)
                .HasForeignKey<ReviewerSupervisorExtension>(d => d.AccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReviewerSupervisorExtension_Account");

            entity.HasOne(d => d.AssignedClass).WithMany(p => p.ReviewerSupervisorExtensions)
                .HasForeignKey(d => d.AssignedClassId)
                .HasConstraintName("FK_ReviewerSupervisorExtension_Class");

            entity.HasOne(d => d.Status).WithMany(p => p.ReviewerSupervisorExtensions)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ReviewerSupervisorExtension_Status");
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(e => e.RoleName, "NonClusteredIndex-20250911-154853");

            entity.Property(e => e.RoleName).HasMaxLength(50);
        });

        modelBuilder.Entity<Scholarship>(entity =>
        {
            entity.ToTable("Scholarship");

            entity.HasIndex(e => e.StatusId, "IX_Scholarship_StatusId");

            entity.Property(e => e.Amount).HasColumnType("money");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.Scholarships)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Scholarship_Status");
        });

        modelBuilder.Entity<Section>(entity =>
        {
            entity.ToTable("Section");

            entity.HasIndex(e => e.SectionName, "UQ_Section_SectionName").IsUnique();

            entity.Property(e => e.SectionName).HasMaxLength(100);
        });

        modelBuilder.Entity<Session>(entity =>
        {
            entity.ToTable("Session");

            entity.HasIndex(e => e.StatusId, "IX_Session_StatusId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.Sessions)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Session_Status");
        });

        modelBuilder.Entity<Sheet1>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("Sheet1$");

            entity.Property(e => e.F1).HasColumnType("datetime");
        });

        modelBuilder.Entity<Staff>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Staff__3214EC079AEB1B59");

            entity.Property(e => e.CheckInTime).HasColumnType("datetime");
            entity.Property(e => e.CreatedAt).HasColumnType("datetime");
            entity.Property(e => e.DateStaff).HasColumnType("datetime");
            entity.Property(e => e.UpdatedAt).HasColumnType("datetime");
        });

        modelBuilder.Entity<Status>(entity =>
        {
            entity.ToTable("Status");
        });

        modelBuilder.Entity<StudentExamAnswer>(entity =>
        {
            entity.ToTable("StudentExamAnswer");

            entity.HasIndex(e => e.ExamId, "IX_StudentExamAnswer_ExamId");

            entity.HasIndex(e => e.QuestionId, "IX_StudentExamAnswer_QuestionId");

            entity.HasIndex(e => new { e.AccountId, e.ExamId, e.QuestionId }, "UQ_StudentExamAnswer_AccountExamQuestion").IsUnique();

            // Map QuestionId property - try QuestionId first (without underscore) as error suggests
            // If this doesn't work, change back to "Question_ID" (with underscore)
            entity.Property(e => e.QuestionId).HasColumnName("QuestionId");

            entity.HasOne(d => d.Account).WithMany(p => p.StudentExamAnswers)
                .HasForeignKey(d => d.AccountId)
                .HasConstraintName("FK_StudentExamAnswer_Account");

            // Note: ExamId should reference ExamDetail, but the FK constraint points to ExamQuestion
            // We'll ignore the navigation property and just use ExamId directly
            // entity.HasOne(d => d.Exam).WithMany(p => p.StudentExamAnswers)
            //     .HasForeignKey(d => d.ExamId)
            //     .HasConstraintName("FK_StudentExamAnswer_ExamQuestion");

            entity.HasOne(d => d.Question).WithMany()
                .HasForeignKey(d => d.QuestionId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_StudentExamAnswer_Question");
        });

        modelBuilder.Entity<StudentExamResult>(entity =>
        {
            entity.HasKey(e => e.AccountId);

            entity.ToTable("StudentExamResult");

            entity.Property(e => e.AccountId).ValueGeneratedNever();

            entity.HasOne(d => d.Account).WithOne(p => p.StudentExamResult)
                .HasForeignKey<StudentExamResult>(d => d.AccountId)
                .HasConstraintName("FK_StudentExamResult_Account");
        });

        modelBuilder.Entity<StudentExtension>(entity =>
        {
            entity.HasKey(e => e.AccountId);

            entity.ToTable("StudentExtension");

            entity.HasIndex(e => e.ClassId, "IX_StudentExtension_ClassId");

            entity.HasIndex(e => e.StatusId, "IX_StudentExtension_StatusId");

            entity.Property(e => e.AccountId).ValueGeneratedNever();
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Account).WithOne(p => p.StudentExtension)
                .HasForeignKey<StudentExtension>(d => d.AccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_StudentExtension_Account");

            entity.HasOne(d => d.Class).WithMany(p => p.StudentExtensions)
                .HasForeignKey(d => d.ClassId)
                .HasConstraintName("FK_StudentExtension_Class");

            entity.HasOne(d => d.Status).WithMany(p => p.StudentExtensions)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_StudentExtension_Status");
        });

        modelBuilder.Entity<StudentProfile>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__StudentP__3214EC0762A3C91F");

            entity.ToTable("StudentProfile");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.BadNotesJson).HasMaxLength(1);
            entity.Property(e => e.City).HasMaxLength(100);
            entity.Property(e => e.Country).HasMaxLength(100);
            entity.Property(e => e.CreatedAt).HasColumnType("datetime");
            entity.Property(e => e.Email).HasMaxLength(255);
            entity.Property(e => e.GoodNotesJson).HasMaxLength(1);
            entity.Property(e => e.Name).HasMaxLength(255);
            entity.Property(e => e.PhoneNumber).HasMaxLength(50);
        });

        modelBuilder.Entity<StudentTask>(entity =>
        {
            entity.ToTable("StudentTask");

            entity.HasIndex(e => e.StatusId, "IX_StudentTask_StatusId");

            entity.HasIndex(e => e.StudentAccountId, "IX_StudentTask_StudentAccountId");

            entity.HasIndex(e => e.TaskId, "IX_StudentTask_TaskId");

            entity.Property(e => e.CompletedAt).HasColumnType("datetime");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.StudentTasks)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_StudentTask_Status");

            entity.HasOne(d => d.StudentAccount).WithMany(p => p.StudentTasks)
                .HasForeignKey(d => d.StudentAccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_StudentTask_StudentAccount");

            entity.HasOne(d => d.Task).WithMany(p => p.StudentTasks)
                .HasForeignKey(d => d.TaskId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_StudentTask_Task");
        });

        modelBuilder.Entity<SubordinateTicket>(entity =>
        {
            entity.ToTable("SubordinateTicket");

            entity.HasIndex(e => e.ClassId, "IX_SubordinateTicket_ClassId");

            entity.HasIndex(e => e.GradeId, "IX_SubordinateTicket_GradeId");

            entity.HasIndex(e => e.SessionId, "IX_SubordinateTicket_SessionId");

            entity.HasIndex(e => e.StatusId, "IX_SubordinateTicket_StatusId");

            entity.HasIndex(e => e.SubordinateAccountId, "IX_SubordinateTicket_SubordinateAccountId");

            entity.HasIndex(e => e.SupervisorAccountId, "IX_SubordinateTicket_SupervisorAccountId");

            entity.HasIndex(e => e.TicketTypeId, "IX_SubordinateTicket_TicketTypeId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Class).WithMany(p => p.SubordinateTickets)
                .HasForeignKey(d => d.ClassId)
                .HasConstraintName("FK_SubordinateTicket_Class");

            entity.HasOne(d => d.Grade).WithMany(p => p.SubordinateTickets)
                .HasForeignKey(d => d.GradeId)
                .HasConstraintName("FK_SubordinateTicket_Grade");

            entity.HasOne(d => d.Session).WithMany(p => p.SubordinateTickets)
                .HasForeignKey(d => d.SessionId)
                .HasConstraintName("FK_SubordinateTicket_Session");

            entity.HasOne(d => d.Status).WithMany(p => p.SubordinateTickets)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SubordinateTicket_Status");

            entity.HasOne(d => d.SubordinateAccount).WithMany(p => p.SubordinateTicketSubordinateAccounts)
                .HasForeignKey(d => d.SubordinateAccountId)
                .HasConstraintName("FK_SubordinateTicket_SubordinateAccount");

            entity.HasOne(d => d.SupervisorAccount).WithMany(p => p.SubordinateTicketSupervisorAccounts)
                .HasForeignKey(d => d.SupervisorAccountId)
                .HasConstraintName("FK_SubordinateTicket_SupervisorAccount");

            entity.HasOne(d => d.TicketType).WithMany(p => p.SubordinateTickets)
                .HasForeignKey(d => d.TicketTypeId)
                .HasConstraintName("FK_SubordinateTicket_TicketType");
        });

        modelBuilder.Entity<SuperAdminExtension>(entity =>
        {
            entity.HasKey(e => e.AccountId);

            entity.ToTable("SuperAdminExtension");

            entity.HasIndex(e => e.StatusId, "IX_SuperAdminExtension_StatusId");

            entity.Property(e => e.AccountId).ValueGeneratedNever();
            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Account).WithOne(p => p.SuperAdminExtension)
                .HasForeignKey<SuperAdminExtension>(d => d.AccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SuperAdminExtension_Account");

            entity.HasOne(d => d.Status).WithMany(p => p.SuperAdminExtensions)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_SuperAdminExtension_Status");
        });

        modelBuilder.Entity<TaskSubmission>(entity =>
        {
            entity.HasKey(e => e.TaskSubmissionId).HasName("PK__TaskSubm__39F484D072E29E3A");

            entity.ToTable("TaskSubmission");

            entity.HasIndex(e => e.GradeId, "IX_TaskSubmission_Grade_ID");

            entity.HasIndex(e => e.TaskId, "IX_TaskSubmission_Task_ID");

            entity.HasIndex(e => e.TeamLeaderId, "IX_TaskSubmission_TeamLeader_ID");

            entity.HasIndex(e => e.TeamId, "IX_TaskSubmission_Team_ID");

            entity.Property(e => e.TaskSubmissionId).HasColumnName("TaskSubmission_ID");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("Created_At");
            entity.Property(e => e.Glink)
                .HasMaxLength(255)
                .HasColumnName("GLink");
            entity.Property(e => e.GradeId).HasColumnName("Grade_ID");
            entity.Property(e => e.ReviewerId).HasColumnName("Reviewer_ID");
            entity.Property(e => e.StatusId)
                .HasDefaultValue(1L)
                .HasColumnName("Status_ID");
            entity.Property(e => e.TaskId).HasColumnName("Task_ID");
            entity.Property(e => e.TeamId).HasColumnName("Team_ID");
            entity.Property(e => e.TeamLeaderId).HasColumnName("TeamLeader_ID");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("Updated_At");

            entity.HasOne(d => d.Grade).WithMany(p => p.TaskSubmissions)
                .HasForeignKey(d => d.GradeId)
                .HasConstraintName("FK_TaskSubmission_Grade");

            entity.HasOne(d => d.Task).WithMany(p => p.TaskSubmissions)
                .HasForeignKey(d => d.TaskId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TaskSubmission_Task");

            entity.HasOne(d => d.Team).WithMany(p => p.TaskSubmissions)
                .HasForeignKey(d => d.TeamId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TaskSubmission_Team");

            entity.HasOne(d => d.TeamLeader).WithMany(p => p.TaskSubmissions)
                .HasForeignKey(d => d.TeamLeaderId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TaskSubmission_TeamLeader");
        });

        modelBuilder.Entity<TblClass>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Class");

            entity.ToTable("Tbl_Class");

            entity.HasIndex(e => e.GradeId, "IX_Tbl_Class_GradeId");

            entity.HasIndex(e => e.StatusId, "IX_Tbl_Class_StatusId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Grade).WithMany(p => p.TblClasses)
                .HasForeignKey(d => d.GradeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Class_Grade");

            entity.HasOne(d => d.Status).WithMany(p => p.TblClasses)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Class_Status");
        });

        modelBuilder.Entity<TblTask>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_Task");

            entity.ToTable("Tbl_Task");

            entity.HasIndex(e => e.AdminAccountId, "IX_Tbl_Task_AdminAccountId");

            entity.HasIndex(e => e.GradeId, "IX_Tbl_Task_GradeId");

            entity.HasIndex(e => e.StatusId, "IX_Tbl_Task_StatusId");

            entity.Property(e => e.AssignedById).HasColumnName("AssignedByID");
            entity.Property(e => e.AssignedToId).HasColumnName("AssignedToID");
            entity.Property(e => e.ClassId).HasColumnName("Class_Id");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("(getdate())");
            entity.Property(e => e.StatusId).HasDefaultValue(1L);
            entity.Property(e => e.TaskDeadline).HasColumnType("datetime");
            entity.Property(e => e.TeamId).HasColumnName("Team_Id");

            entity.HasOne(d => d.AdminAccount).WithMany(p => p.TblTasks)
                .HasForeignKey(d => d.AdminAccountId)
                .HasConstraintName("FK_Task_AdminAccount");

            entity.HasOne(d => d.Grade).WithMany(p => p.TblTasks)
                .HasForeignKey(d => d.GradeId)
                .HasConstraintName("FK_Task_Grade");

            entity.HasOne(d => d.Status).WithMany(p => p.TblTasks)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Task_Status");
        });

        modelBuilder.Entity<Team>(entity =>
        {
            entity.ToTable("Team");

            entity.HasIndex(e => e.ClassId, "IX_Team_ClassId");

            entity.HasIndex(e => e.ProjectId, "IX_Team_ProjectId");

            entity.HasIndex(e => e.StatusId, "IX_Team_StatusId");

            entity.HasIndex(e => e.SupervisorAccountId, "IX_Team_SupervisorAccountId");

            entity.HasIndex(e => e.TeamLeaderAccountId, "IX_Team_TeamLeaderAccountId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Class).WithMany(p => p.Teams)
                .HasForeignKey(d => d.ClassId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Team_Class");

            entity.HasOne(d => d.Project).WithMany(p => p.Teams)
                .HasForeignKey(d => d.ProjectId)
                .HasConstraintName("FK_Team_Project");

            entity.HasOne(d => d.Status).WithMany(p => p.Teams)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_Team_Status");

            entity.HasOne(d => d.SupervisorAccount).WithMany(p => p.TeamSupervisorAccounts)
                .HasForeignKey(d => d.SupervisorAccountId)
                .HasConstraintName("FK_Team_SupervisorAccount");

            entity.HasOne(d => d.TeamLeaderAccount).WithMany(p => p.TeamTeamLeaderAccounts)
                .HasForeignKey(d => d.TeamLeaderAccountId)
                .HasConstraintName("FK_Team_TeamLeaderAccount");
        });

        modelBuilder.Entity<TeamMember>(entity =>
        {
            entity.ToTable("TeamMember");

            entity.HasIndex(e => e.StatusId, "IX_TeamMember_StatusId");

            entity.HasIndex(e => e.TeamId, "IX_TeamMember_TeamId");

            entity.HasIndex(e => e.TeamMemberAccountId, "IX_TeamMember_TeamMemberAccountId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TeamMember_Status");

            entity.HasOne(d => d.Team).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.TeamId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TeamMember_Team");

            entity.HasOne(d => d.TeamMemberAccount).WithMany(p => p.TeamMembers)
                .HasForeignKey(d => d.TeamMemberAccountId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TeamMember_TeamMemberAccount");
        });

        modelBuilder.Entity<TicketType>(entity =>
        {
            entity.ToTable("TicketType");

            entity.HasIndex(e => e.StatusId, "IX_TicketType_StatusId");

            entity.Property(e => e.StatusId).HasDefaultValue(1L);

            entity.HasOne(d => d.Status).WithMany(p => p.TicketTypes)
                .HasForeignKey(d => d.StatusId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_TicketType_Status");



            modelBuilder.Entity<ExamQuestionBank>()
    .HasKey(eq => new { eq.ExamId, eq.QuestionId });

            modelBuilder.Entity<ExamQuestionBank>()
                .HasOne(eq => eq.Exam)
                .WithMany(e => e.ExamQuestionBanks)
                .HasForeignKey(eq => eq.ExamId);

            modelBuilder.Entity<ExamQuestionBank>()
                .HasOne(eq => eq.Question)
                .WithMany(q => q.ExamQuestionBanks)
                .HasForeignKey(eq => eq.QuestionId);

        });

        OnModelCreatingPartial(modelBuilder);
    }


    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
