# Database Documentation

## Database Server
- **Server:** DESKTOP-4E7TU9R (Windows integrated authentication)
- **Database name:** ElsewedySchoolSysDB
- **Engine:** Microsoft SQL Server
- **Access:** Read/Write (Trusted Connection, no SSL)

> **Security note:** The connection string is stored in `appsettings.json`. In production, connection strings should be moved to environment variables or a secrets manager. This document does not reproduce credentials.

## EF Core Context

**File:** `server/Api/Models/ElsewedySchoolSysDbDevContext.cs`  
**DbContext class:** `ElsewedySchoolSysDbDevContext`

This is a large, auto-generated EF Core context with approximately 60+ `DbSet<T>` properties. Only the tables directly used by the Exam-Hub application are documented here.

---

## Core Application Tables

### Account
**EF Entity:** `Account` (`server/Api/Models/Account.cs`)  
**Table:** `Account`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key, identity |
| `Email` | `nvarchar` | Unique login email |
| `PasswordHash` | `nvarchar` | BCrypt hash (or legacy SHA256/plaintext) |
| `FullNameEn` | `nvarchar` | English full name |
| `FullNameAr` | `nvarchar` | Arabic full name |
| `NationalId` | `nvarchar` | National ID (auto-generated on register) |
| `RoleId` | `bigint` | FK → Roles.Id (direct role reference) |
| `StatusId` | `bigint` | FK → Statuses.Id |
| `IsActive` | `bit` | Account active flag |
| `Phone` | `nvarchar?` | Optional phone number |
| `CreatedAt` | `date?` | Account creation date |

**Navigation properties:**
- `Role` → `Role`
- `StudentExtension` → `StudentExtension`
- `StudentExamAnswers` → `ICollection<StudentExamAnswer>`
- `AccountRoles` → `ICollection<AccountRole>`

---

### AccountRole
**EF Entity:** `AccountRole` (`server/Api/Models/AccountRole.cs`)  
**Table:** `AccountRole`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `AccountId` | `bigint?` | FK → Account.Id |
| `RoleId` | `bigint?` | FK → Roles.Id |
| `BusinessEntityName` | `nvarchar?` | e.g. `"Exams"` or `"Quizes System"` |

**Purpose:** Links an account to a role within a specific business entity. The login flow queries `WHERE BusinessEntityName = 'Exams'` to determine which roles to include in the JWT.

---

### Roles
**EF Entity:** `Role` (`server/Api/Models/Role.cs`)  
**Table:** `Roles`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `RoleName` | `nvarchar(50)` | e.g. Student, Teacher, Board, Admin |
| `BusinessEntity` | `nvarchar?` | e.g. `"Exams"`, `"Quizes System"` |
| `OrderNo` | `int?` | Display ordering |

**Known values in Exams entity:** `Student`, `Teacher`, `Board`  
**Known values in Quizes System entity (seed):** `Student`, `Teacher`, `Admin`

---

### Login
**EF Entity:** `Login` (`server/Api/Models/Login.cs`)  
**Table:** `Login`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `AccountId` | `bigint?` | FK → Account.Id |
| `Email` | `nvarchar?` | Login email (duplicated from Account for lookup speed) |
| `PasswordHash` | `nvarchar?` | Password hash (may differ from Account if updated) |
| `StatusId` | `bigint` | FK → Statuses.Id |

**Purpose:** Primary login lookup table. The auth flow checks `Login` first, falls back to `Account` for legacy accounts.

---

### Exam_Details (ExamDetail)
**EF Entity:** `ExamDetail` (`server/Api/Models/ExamDetail.cs` + `ExamDetailPartials.cs`)  
**Table:** `Exam_Details`

| Column | Type | Notes |
|---|---|---|
| `ExamId` | `bigint` | Primary key, identity |
| `Title` | `nvarchar?` | Exam title |
| `ExamSubject` | `nvarchar?` | Subject name (legacy, may be replaced by SubjectId) |
| `SubjectId` | `bigint?` | FK → Statuses.Id (subject lookup) |
| `ExamDescription` | `nvarchar?` | Exam description |
| `GradeId` | `bigint?` | FK → Grades.Id |
| `Class_ID` | `nvarchar?` | Comma-separated class IDs: `",5,8,12,"` |
| `StartDate` | `datetime?` | Exam availability start |
| `EndDate` | `datetime?` | Exam availability end |
| `CreatedBy_AccId` | `bigint?` | FK → Account.Id (creator) |

**Navigation properties:**
- `Subject` → `Status` (subject name via `Statuses` table)
- `ExamQuestionBanks` → `ICollection<ExamQuestionBank>` (manually populated — not lazy loaded)
- `StudentExamAnswers` → `ICollection<StudentExamAnswer>`

**Note on ClassId:** The `Class_ID` column stores a comma-delimited list of class IDs with leading and trailing commas (e.g. `",5,8,12,"`). This pattern is used throughout the application to check class membership via string contains operations.

---

### ExamQuestionBank
**EF Entity:** `ExamQuestionBank` (`server/Api/Models/ExamQuestionBank.cs` + `ExamQuestionBankPartials.cs`)  
**Table:** `ExamQuestionBank`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key, identity |
| `ExamId` | `bigint?` | FK → Exam_Details.ExamId |
| `QuestionId` (mapped as `QuestionBankID`) | `bigint?` | FK → QuestionBank.QuestionId |

**Navigation properties:**
- `Exam` → `ExamDetail`
- `Question` → `QuestionBank` (manually populated in repos/service)

---

### QuestionBank
**EF Entity:** `QuestionBank` (`server/Api/Models/QuestionBank.cs`)  
**Table:** `QuestionBank`

| Column | Type | Notes |
|---|---|---|
| `QuestionId` | `bigint` | Primary key, identity |
| `QuestionTitle` | `nvarchar?` | Question text (supports rich-text markdown-style) |
| `OptionA` | `nvarchar?` | First option |
| `OptionB` | `nvarchar?` | Second option |
| `OptionC` | `nvarchar?` | Third option (MCQ) |
| `OptionD` | `nvarchar?` | Fourth option (MCQ) |
| `OptionE–H` | `nvarchar?` | Extended options (up to 8) |
| `UsedOptions` | `int?` | Number of active options (2=T/F, 4=MCQ, 0=fill) |
| `CorrectAnswer` | `nvarchar?` | Correct answer (letter A–D or full text) |
| `QuestionSubject` | `nvarchar?` | Subject for this question |
| `Mark` | `decimal?` | Points awarded for correct answer |
| `AccountId` | `bigint?` | FK → Account.Id (creator) |
| `GradeId` | `bigint?` | FK → Grades.Id |
| `ClassId` | `bigint?` | FK → Tbl_Class.Id |
| `BankTitle` | `nvarchar?` | Question bank grouping title |
| `BankDescription` | `nvarchar?` | Bank description |
| `BankKey` | `nvarchar?` | Bank identifier key |

---

### StudentExamAnswer
**EF Entity:** `StudentExamAnswer` (`server/Api/Models/StudentExamAnswer.cs`)  
**Table:** `StudentExamAnswer`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key, identity |
| `AccountId` | `bigint` | FK → Account.Id (the student) |
| `ExamDetailsId` (mapped as `ExamDetailsID`) | `bigint?` | FK → Exam_Details.ExamId |
| `QuestionBankId` (mapped as `QuestionBankID`) | `bigint?` | FK → QuestionBank.QuestionId |
| `ExamQuestionId` (mapped as `ExamQuestionID`) | `bigint?` | FK → ExamQuestionBank.Id (legacy, often null) |
| `ChoosedAnswer` | `nvarchar(max)` | The student's submitted answer text |
| `Score` | `bit` | `true` = correct, `false` = incorrect |

**Unique constraint:** `(AccountId, ExamDetailsId, QuestionBankId)` — one answer row per student per exam per question.

**Submission indicator:** The presence of any `StudentExamAnswer` row for a `(AccountId, ExamDetailsId)` pair indicates the student has submitted that exam. The submit action writes one row per question atomically.

---

### StudentExtension
**EF Entity:** `StudentExtension` (`server/Api/Models/StudentExtension.cs`)  
**Table:** `StudentExtension`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `AccountId` | `bigint?` | FK → Account.Id |
| `ClassId` | `bigint?` | FK → Tbl_Class.Id |
| `GradeId` | `bigint?` | FK → Grades.Id |

**Purpose:** Associates a student account with their class. Used by the backend to filter exams shown to each student (`exam.ClassId` must contain `studentExtension.ClassId`).

---

### Tbl_Class
**EF Entity:** `TblClass` (`server/Api/Models/TblClass.cs`)  
**Table:** `Tbl_Class`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `ClassName` | `nvarchar?` | Class name (e.g. J1, S2, W3) |
| `GradeId` | `bigint` | FK → Grades.Id |

---

### Grades
**EF Entity:** `Grade` (`server/Api/Models/Grade.cs`)  
**Table:** `Grades`

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `GradeName` | `nvarchar?` | Grade display name |

---

### Statuses
**EF Entity:** `Status` (`server/Api/Models/Status.cs`)  
**Table:** `Statuses`

Multi-purpose lookup table, scoped by `BusinessEntity`.

| Column | Type | Notes |
|---|---|---|
| `Id` | `bigint` | Primary key |
| `StatusName` | `nvarchar?` | Display name (also used as subject name) |
| `BusinessEntity` | `nvarchar?` | e.g. `"Exams"` for subjects |
| `OrderNo` | `int?` | Display order |

**Used for:** Exam subjects (`WHERE BusinessEntity = 'Exams'`), account statuses.

---

## Key Relationships Diagram

```
Grades ←──── TblClass ←──── StudentExtension ←──── Account
                                                       │
                                              AccountRole ←── Role
                                                       │
                                                     Login

Exam_Details ──► ExamQuestionBank ──► QuestionBank
     │
     └──► StudentExamAnswer ◄── Account (students)

Exam_Details.SubjectId ──► Statuses (exam subjects)
```

---

## How the Application Accesses the Database

1. **All data access** goes through `ElsewedySchoolSysDbDevContext` (injected via DI).
2. **Repositories** (`ExamRepo`, `QuestionBankRepo`, `DashboardRepo`) handle standard CRUD and complex queries.
3. **Services** (`StudentExamService`, `AuthService`) access `_context` directly for operations not covered by repositories.
4. **Controllers** (`ExamDetailController`, `DashboardController`) access `_context` directly for simple lookups (class filters, subjects list).
5. **No lazy loading** — navigation properties are always loaded explicitly (via `Include()` or manual population).
6. **Migrations exist** in `server/Api/Migrations/` but are **not applied automatically**. The existing production database is used directly.

---

## Important Constraints

- `StudentExamAnswer` has a unique constraint on `(AccountId, ExamDetailsId, QuestionBankId)` — prevents duplicate answers.
- `Account.Email` is unique.
- `ExamDetail.Class_ID` stores multiple classes as a comma-delimited string — not a normalized relation. This is an accepted limitation of the existing schema.
