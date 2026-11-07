# Backend Documentation

## Project Location
`server/Api/`

## Entry Point
`server/Api/Program.cs`

---

## Controllers

All controllers are in `server/Api/Controllers/`.

### AuthController
**File:** `server/Api/Controllers/AuthController.cs`  
**Route prefix:** `api/auth`  
**Injects:** `IAuthService`, `ILogger<AuthController>`

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `register` | Public | Create a new account |
| POST | `login` | Public | Authenticate and receive JWT |
| GET | `profile/{id}` | `[Authorize]` | Read own profile (admin can read any) |
| PUT | `profile/{id}` | `[Authorize]` | Update own profile (admin can update any) |

**Responsibilities:** Input validation, HTTP status codes, delegates all logic to `IAuthService`.

---

### ExamDetailController
**File:** `server/Api/Controllers/ExamDetailController.cs`  
**Route prefix:** `api/examdetail`  
**Injects:** `IExamRepo`, `ElsewedySchoolSysDbDevContext`, `ILogger<ExamDetailController>`  
**Class-level:** `[Authorize]`

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `` | All authenticated | List all exams (students filtered by class) |
| GET | `{id}` | All authenticated | Get one exam (students filtered by class) |
| POST | `` | Teacher/Admin/Board/Superadmin | Create exam |
| PUT | `{id}` | Teacher/Admin/Board/Superadmin | Update exam |
| DELETE | `{id}` | Admin/Board/Superadmin | Delete exam |
| GET | `subjects` | All authenticated | List exam subjects |

**Phase 2 protection:** `GetAll` and `GetById` call `MapToDto` for staff (includes `CorrectAnswer`) and `MapToDtoForStudent` for students (`CorrectAnswer = null`).

---

### QuestionBankController
**File:** `server/Api/Controllers/QuestionBankController.cs`  
**Route prefix:** `api/questionbank`  
**Injects:** `IQuestionBankRepo`  
**Class-level:** `[Authorize]`

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `` | Teacher/Admin/Board/Superadmin | List all questions |
| GET | `{id}` | Teacher/Admin/Board/Superadmin | Get one question |
| POST | `` | Teacher/Admin/Board/Superadmin | Create question |
| POST | `upload` | Teacher/Admin/Board/Superadmin | Bulk upload questions via Excel |
| PUT | `{id}` | Teacher/Admin/Board/Superadmin | Update question |
| DELETE | `{id}` | Admin/Board/Superadmin | Delete question |
| GET | `template` | Teacher/Admin/Board/Superadmin | Download Excel upload template |

---

### StudentExamAnswerController
**File:** `server/Api/Controllers/StudentExamAnswerController.cs`  
**Route prefix:** `api/studentexamanswer`  
**Injects:** `IStudentExamService`  
**Class-level:** `[Authorize]`

| Method | Route | Role | Description |
|---|---|---|---|
| GET | `student/{accountId}/exams` | All authenticated | Student's completed exams with scores |
| GET | `student/{accountId}/exam/{examId}` | All authenticated | Post-submission review (includes CorrectAnswer) |
| GET | `student/{accountId}/exam/{examId}/questions` | All authenticated | Safe exam-taking questions (NO CorrectAnswer) |
| POST | `submit` | Student only | Submit answers for grading |

**Security:** All endpoints validate that the authenticated user's `AccountId` from the JWT matches the URL parameter. Staff bypass ownership checks.

---

### DashboardController
**File:** `server/Api/Controllers/DashboardController.cs`  
**Route prefix:** `api/dashboard`  
**Injects:** `IDashboardRepo`, `ElsewedySchoolSysDbDevContext`, `ILogger<DashboardController>`

| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `lookup-data` | `[Authorize]` | Grades, classes, subjects, and exam list for filters |
| GET | `student/{id}` | `[Authorize]` (own data) | Student dashboard analytics |
| GET | `teacher/{id}` | `[Authorize]` (own data) | Teacher dashboard analytics |
| GET | `superadmin` | Admin/Board/Superadmin | System-wide dashboard |
| GET | `leaderboard/{examId}` | `[Authorize]` | Exam leaderboard |
| GET | `leaderboard/combined` | `[Authorize]` | Combined leaderboard across exams |
| GET | `exam/{examId}/stats` | `[Authorize]` | Statistics for one exam |
| GET | `teachers` | `[Authorize]` | List all teacher accounts |
| GET | `students` | Teacher/Admin/Board/Superadmin | List all students with performance |

---

## Services

All services are in `server/Api/Services/`.

### IAuthService / AuthService
**Files:**
- Interface: `server/Api/Services/IAuthService.cs`
- Implementation: `server/Api/Services/AuthService.cs`

**Methods:**

| Method | Description |
|---|---|
| `RegisterAsync(RegisterModel)` | Creates account, assigns role, creates Login and AccountRole entries. Hashes password with BCrypt. |
| `LoginAsync(LoginModel)` | Looks up account, verifies password (BCrypt → SHA256 → plaintext fallback), loads roles from `AccountRoles WHERE BusinessEntityName='Exams'`, generates JWT. |
| `GetProfileAsync(long accountId)` | Returns profile data for account. |
| `UpdateProfileAsync(long accountId, UpdateProfileModel)` | Updates name, email, phone fields. |
| `GenerateJwtToken(Account, roles)` | Private. Creates JWT with `sub=accountId`, `email`, and role claims. 8-hour expiry. |
| `ValidatePasswordStrength(string)` | Public static. Min 8 chars, requires uppercase, lowercase, digit. |
| `ComputeSha256Hash(string)` | Private. Legacy password hash comparison. |

**Result types defined in `IAuthService.cs`:**
- `RegisterResult(long AccountId)`
- `LoginResult(Token, Roles, AccountId, Email, FullNameEn, FullNameAr, Role)`
- `AccountProfileDto(Id, Email, FullNameEn, FullNameAr, Phone, IsActive, CreatedAt, UpdatedAt)`

---

### IStudentExamService / StudentExamService
**Files:**
- Interface: `server/Api/Services/IStudentExamService.cs`
- Implementation: `server/Api/Services/StudentExamService.cs`

**Methods:**

| Method | Description |
|---|---|
| `GetStudentExamsAsync(long accountId)` | Returns all completed exams with per-question answers, correct answers, and scores. |
| `GetStudentExamAnswersAsync(long accountId, long examId)` | Returns a single exam with submitted answers and correct answers (review endpoint). |
| `GetExamQuestionsForStudentAsync(long accountId, long examId, bool isStaff)` | Returns safe exam-taking data. No `CorrectAnswer`. Enforces class assignment and blocks re-access after submission. Returns `(ExamForStudentDto?, errorMessage, statusCode)`. |
| `SubmitStudentAnswersAsync(long accountId, StudentAnswerSubmitDto)` | Validates, grades, and persists answers. Prevents double submission. Fills blank answers for unanswered questions. Returns `SubmitExamResultDto`. |
| `PopulateExamQuestionsAsync(List<ExamDetail>)` | Private. Batched loading of `ExamQuestionBank` links and `QuestionBank` entities. |
| `IsAnswerCorrect(QuestionBank, string)` | Private static. Grades one answer: MCQ letter-map, then direct comparison. |

**Result type:** `SubmitExamResultDto(ExamId, TotalMarks, EarnedMarks, Score)`

---

## Repositories

All repositories are in `server/Api/Repositories/`.

### ExamRepo
**Interface:** `server/Api/Repositories/Interfaces/IExamRepo.cs`  
**Implementation:** `server/Api/Repositories/Implementation/ExamRepo.cs`

| Method | Description | Query count |
|---|---|---|
| `GetAllAsync()` | Loads all exams with Subject, then filters links and questions by exam IDs. | 3 queries |
| `GetByIdAsync(long id)` | Loads one exam, then batches all question loading in one query. | 3 queries |
| `AddAsync(ExamDetail, questionIds, classIds)` | Saves exam, then creates `ExamQuestionBank` links. | 2 `SaveChangesAsync` calls |
| `UpdateAsync(ExamDetail, questionIds, classIds)` | Updates exam fields, syncs question links (add/remove). | — |
| `DeleteAsync(long id)` | Removes question links, then removes exam. | — |
| `SaveChangesAsync()` | Delegates to DbContext. | — |

**Phase 5 optimization:** `GetAllAsync` and `GetByIdAsync` use `WHERE ExamId IN (...)` and `WHERE QuestionId IN (...)` to avoid full-table scans.

---

### QuestionBankRepo
**Interface:** `server/Api/Repositories/Interfaces/IQuestionBankRepo.cs`  
**Implementation:** `server/Api/Repositories/Implementation/QuestionBankRepo.cs`

Thin CRUD wrapper. Methods: `GetAllAsync`, `GetByIdAsync`, `AddAsync`, `UpdateAsync`, `DeleteAsync`, `SaveChangesAsync`.

---

### DashboardRepo
**Interface:** `server/Api/Repositories/Interfaces/IDashboardRepo.cs`  
**Implementation:** `server/Api/Repositories/Implementation/DashboardRepo.cs`  
**Size:** ~1,075 lines

**Note:** `DashboardRepo` contains complex analytics logic beyond typical repository responsibilities. It was intentionally not refactored in Phase 4 to preserve its working caching strategy.

| Method | Description |
|---|---|
| `GetStudentDashboardAsync(long studentId, filters)` | Student analytics: score distributions, recent exams, pass rates, leaderboard. Cached 2 minutes. |
| `GetTeacherDashboardAsync(long teacherId, filters)` | Teacher analytics: exam breakdowns, pass/fail rates, unique students. Cached 2 minutes. |
| `GetSuperadminDashboardAsync(filters)` | System-wide analytics: total students/teachers, top performers, recent activity. Cached 2 minutes. |
| `GetLeaderboardAsync(long examId, filters)` | Per-exam or per-class leaderboard. Cached 2 minutes. |
| `GetExamStatsAsync(long examId)` | Pass/fail/average for one exam. |
| `GetStudentsAsync()` | All students with quiz scores per exam. |
| `GetCombinedLeaderboardAsync(filters)` | Aggregate leaderboard across multiple exams. Cached 2 minutes. |
| `GetTeachersAsync()` | All teacher accounts with exam counts. |

**Private helpers:** `PopulateExamQuestions` (single + list overloads), `FormatClassName`, `ApplyFilters`, `BuildClassStatisticMeta`, `BuildStudentStatisticMeta`.

---

## Helpers

### ClaimsHelper
**File:** `server/Api/Helpers/ClaimsHelper.cs`  
**Namespace:** `QuizesApi.Helpers`

Static class. Centralises JWT identity extraction used by multiple controllers.

| Method | Description |
|---|---|
| `GetRequesterInfo(ClaimsPrincipal user)` | Returns `(long AccountId, List<string> Roles)`. Reads from `ClaimTypes.NameIdentifier` (mapped from JWT `sub`), falls back to `"sub"` and `"id"` claims. |
| `IsStaff(IEnumerable<string> roles)` | Returns `true` if roles contain Teacher, Admin, Board, or Superadmin. |
| `IsAdmin(IEnumerable<string> roles)` | Returns `true` if roles contain Admin, Board, or Superadmin. |

---

## DTOs

All DTOs are in `server/Api/DTOs/`.

| File | Classes | Namespace |
|---|---|---|
| `ExamReadDTO.cs` | `ExamReadDto` | `QuizesApi.DTOs` |
| `ExamCreateDto.cs` | `ExamCreateDto` | `QuizesApi.DTOs` |
| `ExamUpdateDto.cs` | `ExamUpdateDto` | `QuizesApi.DTOs` |
| `ExamForStudentDto.cs` | `ExamForStudentDto`, `QuestionForStudentDto` | `QuizesApi.DTOs` |
| `QuestionBankReadDto.cs` | `QuestionBankReadDto` | `QuizesApi.DTOs` |
| `QuestionBankCreateDto.cs` | `QuestionBankCreateDto` | `QuizesApi.DTOs` |
| `QuestionBankUpdateDto.cs` | `QuestionBankUpdateDto` | `QuizesApi.DTOs` |
| `QuestionUploadResultDto.cs` | `QuestionUploadResultDto` | `QuizesApi.DTOs` |
| `DashboardDTOs.cs` | 20+ dashboard DTOs | `QuizesApi.DTOs` |
| `Student/StudentAnswerSubmitDto.cs` | `StudentAnswerSubmitDto`, `AnswerDto` | `QuizesApi.DTOs.Student` |

**Phase 2 security note:** `ExamForStudentDto` and `QuestionForStudentDto` intentionally omit `CorrectAnswer`, `IsCorrect`, `Score`, `UserAnswer`, and `EarnedMarks`.

---

## Models

All EF Core entity models are in `server/Api/Models/`. Key entities:

| Model file | Table | Description |
|---|---|---|
| `Account.cs` | `Account` | User account (email, password hash, name, role) |
| `AccountRole.cs` | `AccountRole` | Many-to-many: account ↔ role per business entity |
| `Role.cs` | `Roles` | Role definitions per BusinessEntity |
| `ExamDetail.cs` | `Exam_Details` | Exam header (title, dates, grade, class IDs) |
| `ExamQuestionBank.cs` | `ExamQuestionBank` | Link table: exam ↔ question |
| `QuestionBank.cs` | `QuestionBank` | Individual questions with options and correct answer |
| `StudentExamAnswer.cs` | `StudentExamAnswer` | Student's answer records (one row per question per attempt) |
| `StudentExtension.cs` | `StudentExtension` | Student's class and grade assignment |
| `TblClass.cs` | `Tbl_Class` | Class definitions |
| `Grade.cs` | `Grades` | Grade/year definitions |
| `Status.cs` | `Statuses` | Status lookup (BusinessEntity scoped) |
| `Login.cs` | `Login` | Login table (email + password hash, primary for auth) |
| `AuthModels.cs` | — | Request models: `RegisterModel`, `LoginModel`, `UpdateProfileModel` |

---

## Dependency Injection Summary

Registered in `server/Api/Program.cs`:

```csharp
// Database
AddDbContext<ElsewedySchoolSysDbDevContext>(UseSqlServer(...))

// Caching
AddMemoryCache()

// Authentication
AddAuthentication(JwtBearer).AddJwtBearer(...)

// Authorization Policies
AddAuthorization(options => {
    options.AddPolicy("StudentOnly", ...)
    options.AddPolicy("TeacherOnly", ...)
    options.AddPolicy("SuperadminOnly", ...)
    options.AddPolicy("TeacherOrAdmin", ...)
})

// Repositories (Scoped)
AddScoped<IExamRepo, ExamRepo>()
AddScoped<IQuestionBankRepo, QuestionBankRepo>()
AddScoped<IDashboardRepo, DashboardRepo>()

// Services (Scoped)
AddScoped<IStudentExamService, StudentExamService>()
AddScoped<IAuthService, AuthService>()
```
