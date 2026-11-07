# Development History

This document provides a detailed technical record of all five development phases completed on Exam-Hub. Each section covers the original problem, what was changed, and the resulting state of the codebase.

---

## Phase 1 — Security & Authorization

### Original Problem

The entire backend had no authentication protection. Every endpoint was publicly accessible without a token:

- `StudentExamAnswerController` had **no `[Authorize]` attribute** — unauthenticated callers could retrieve any student's answers or submit answers on behalf of any student.
- `ExamDetailController` and `QuestionBankController` had **no `[Authorize]` attribute** — anyone could create, edit, or delete exams and questions.
- `AuthController.GetProfile` and `AuthController.UpdateProfile` had **no `[Authorize]` attribute** — anyone could read or overwrite any user's profile by guessing an ID.
- `DashboardController` had its ownership checks commented out: `// return Forbid(); // for easier testing in dev`.
- `StudentExamAnswerController.SubmitStudentAnswers` fell back to trusting the `AccountId` field in the request body if the JWT claim was absent — a critical identity spoofing vulnerability.
- `GetRequesterInfo()`, `IsStaff()`, and identity helpers were **duplicated independently** in each controller.

### Objective

Protect all backend endpoints with proper authentication and role-based authorization, implement ownership validation for student data, and remove client-provided identity trust.

### What Was Implemented

**Authorization attributes added:**

| Controller | Before | After |
|---|---|---|
| `StudentExamAnswerController` | No `[Authorize]` | `[Authorize]` on class; `[Authorize(Roles="Student")]` on submit |
| `ExamDetailController` | No `[Authorize]` | `[Authorize]` on class; role restrictions per action |
| `QuestionBankController` | No `[Authorize]` | `[Authorize]` on class; role restrictions per action |
| `AuthController.GetProfile` | No `[Authorize]` | `[Authorize]` + ownership check |
| `AuthController.UpdateProfile` | No `[Authorize]` | `[Authorize]` + ownership check |
| `DashboardController` | `Forbid()` commented out | `Forbid()` reinstated for student/teacher dashboards |

**IDOR fixes (all three student answer endpoints):**
```csharp
// Ownership check added to every endpoint
if (!IsStaff(roles) && requesterId != accountId)
    return StatusCode(403, "You are not authorised...");
```

**AccountId body fallback removed from `SubmitStudentAnswers`:**
```csharp
// BEFORE (vulnerable): fell back to dto.AccountId if JWT was missing
// AFTER: identity comes exclusively from the JWT token
var (accountId, _) = GetRequesterInfo();
if (accountId <= 0) return Unauthorized(...);
```

**`IsAnswerCorrect` extracted** out of the submission loop into a documented private static method with clear rules for MCQ letter-format, full-text MCQ, True/False, and fill-in-the-blank.

**`DashboardController` `isAdmin` expanded:**
- Student dashboard: added `Teacher` to the allowed staff roles
- Teacher dashboard: added `Board` to the allowed staff roles

### Technical Decisions

- `GetRequesterInfo()` reads `ClaimTypes.NameIdentifier` (which ASP.NET Core maps from JWT `sub`) first, then falls back to `"sub"` and `"id"`. This handles the default JWT middleware mapping without needing `MapInboundClaims = false`.
- `AccountId` is kept in `StudentAnswerSubmitDto` for API compatibility with the frontend but is **explicitly documented as ignored for authorization**.
- `Program.cs` was not modified in this phase — no DI changes needed.

### Files Modified
- `server/Api/Controllers/StudentExamAnswerController.cs`
- `server/Api/Controllers/ExamDetailController.cs`
- `server/Api/Controllers/QuestionBankController.cs`
- `server/Api/Controllers/AuthController.cs`
- `server/Api/Controllers/DashboardController.cs`

### Build Result
`Build succeeded — 0 errors, 40 warnings` (all pre-existing nullable reference warnings)

### Remaining Limitations
- `ExamDetailController` still directly injects `DbContext` for student class checks and subjects list (addressed in Phase 4).
- Plaintext password fallback deferred pending password-format investigation.

---

## Phase 2 — Correct Answer Protection

### Original Problem

The frontend called the same endpoint to **start an exam** and to **review results after submission** — an endpoint that returned `CorrectAnswer` for every question. A student could open browser DevTools → Network tab and read every correct answer before submitting.

Additionally:
- `GET /api/examdetail/{id}` returned `CorrectAnswer` to any authenticated user, including students.
- `GET /api/dashboard/students` was only `[Authorize]` (any role), allowing students to see all other students' data.

### Objective

Ensure students cannot access correct answers before submission. Maintain full correct-answer access for teachers and admins. Preserve the post-submission review flow.

### What Was Implemented

**1. New safe exam-taking endpoint:**
`GET /api/studentexamanswer/student/{accountId}/exam/{examId}/questions`

Returns `ExamForStudentDto` which **structurally cannot contain** `CorrectAnswer` (the field is absent from the DTO class). Enforces:
- Ownership check
- Class-assignment check (student must be in the exam's assigned class)
- Submission-state check (blocks re-access after submission using `StudentExamAnswers.AnyAsync`)

**2. New safe DTOs created:**
- `server/Api/DTOs/ExamForStudentDto.cs` → `ExamForStudentDto` + `QuestionForStudentDto`

`QuestionForStudentDto` has no `CorrectAnswer` property at all — the compiler prevents it from ever being serialized.

**3. ExamDetailController: role-aware mapping:**
```csharp
// Students receive MapToDtoForStudent (CorrectAnswer = null)
// Staff receive MapToDto (CorrectAnswer = eq.Question.CorrectAnswer)
return Ok(IsStaff(roles) ? MapToDto(exam) : MapToDtoForStudent(exam));
```

Two separate private helpers added: `MapToDto` and `MapToDtoForStudent`.

**4. Dashboard students endpoint restricted:**
`GET /api/dashboard/students` changed from `[Authorize]` to `[Authorize(Roles = "Teacher,Admin,Board,Superadmin")]`.

**5. Frontend exam-start updated:**
```javascript
// BEFORE: called review endpoint (returned CorrectAnswer)
api.get(`/studentexamanswer/student/${userId}/exam/${exam.examId}/questions`) // ← /questions added
```

### Submission-State Check Design

The `StudentExamAnswer` table has no `IsSubmitted` column. The submission indicator used:
```csharp
bool alreadySubmitted = await _context.StudentExamAnswers
    .AnyAsync(sea => sea.AccountId == accountId && sea.ExamDetailsId == examId);
```

This is reliable because `SubmitStudentAnswers` always inserts one row per exam question atomically in a single `SaveChangesAsync` call.

### Files Created
- `server/Api/DTOs/ExamForStudentDto.cs`

### Files Modified
- `server/Api/Controllers/StudentExamAnswerController.cs` (new endpoint, `using QuizesApi.DTOs`)
- `server/Api/Controllers/ExamDetailController.cs` (`MapToDtoForStudent`, role-aware `GetAll`/`GetById`)
- `server/Api/Controllers/DashboardController.cs` (role restriction on `GetStudents`)
- `client/src/pages/StudentPage.jsx` (`startExam` API call changed to `/questions` endpoint)

### Build Result
`Build succeeded — 0 errors, 47 warnings` (7 new CS8601/CS8625 in `MapToDtoForStudent` — same nullable pattern as existing `MapToDto`)

### Remaining Limitations
- Review endpoints still return `CorrectAnswer` for completed exams — this is intentional and correct.
- No automated test infrastructure exists to verify JSON serialization at runtime.

---

## Phase 3 — Student Exam UI

### Original Problem

The student exam page rendered **all questions simultaneously** in a long scrollable form. Answers were collected from the DOM via `FormData` — which would return `null` for any question not currently rendered (breaking with a one-question-at-a-time layout). There was no Mark for Review feature, no progress tracking, no submission confirmation, and no answer persistence across navigation.

### Objective

Replace the long-form exam layout with a professional one-question-at-a-time navigation system, add Mark for Review, progress indicator, question grid, and pre-submission confirmation.

### What Was Implemented

**QuizInterface.jsx — complete rewrite of active exam mode:**

| Feature | Implementation |
|---|---|
| One question at a time | `currentQuestionIndex` state in `StudentPage`; `questions[currentQuestionIndex]` in `QuizInterface` |
| Previous / Next | Disabled on first/last question; `onNavigate(index)` callback |
| Controlled inputs | `checked={isSelected}`, `onChange={() => onAnswerChange(qid, option)}` — not `defaultChecked` |
| Mark for Review | `markedForReview: Set<questionId>` in `StudentPage`; amber toggle button in `QuizInterface` |
| Progress bar | Animated gradient fill, `answeredCount / totalQuestions * 100%` |
| Progress label | "Question N of M · ✓ X Answered · Y Unanswered · 🔖 Z Review" |
| Question grid | Colour-coded dots (answered/review/unanswered/current); jump-to-question |
| Submission dialog | `SubmitConfirmDialog` component: summary table, warnings, "Go to first unanswered" link |
| Review mode | Preserved as separate `if (isReviewMode)` branch — `ReviewQuestionCard` + `ReviewAnswerDisplay` |

**Review mode components (extracted from original helper functions):**
- `ReviewQuestionCard` — read-only question wrapper
- `ReviewAnswerDisplay` — correct/incorrect highlighting (logic identical to original)

**StudentPage.jsx additions:**

New state:
```javascript
const [examAnswers, setExamAnswers] = useState({})           // keyed by questionId
const [markedForReview, setMarkedForReview] = useState(new Set())
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
const examAnswersRef = useRef({})                            // stale-closure-safe
```

sessionStorage persistence (namespaced `exam_answers_{userId}_{examId}`):
```javascript
saveExamSession(userId, examId, answers, reviewSet, index, questions)
loadExamSession(userId, examId)   // restores shuffled order by questionId
clearExamSession(userId, examId)  // called on success only
```

Answer collection changed from DOM to state:
```javascript
// BEFORE: new FormData(document.getElementById('quiz-form'))
// AFTER:
const answers = currentExam.questions.map(q => ({
    questionId: q.id,
    answer: (examAnswersRef.current[q.id] ?? '').toString().trim()
}))
```

Exit guard:
```javascript
async function handleExitActiveExam() {
    const confirmed = await showModal('Exit Exam?', '...')
    if (!confirmed) return  // preserves all answers
    // clears sessionStorage and state only on confirm
}
```

Six new props passed to `QuizInterface`: `answers`, `onAnswerChange`, `markedForReview`, `onToggleReview`, `currentQuestionIndex`, `onNavigate`.

### Files Modified
- `client/src/components/QuizInterface.jsx` (full rewrite)
- `client/src/pages/StudentPage.jsx` (new state, sessionStorage helpers, prop updates)

### Build Result (Frontend)
`vite build — ✓ 2828 modules, 0 errors`

### Remaining Limitations
- Question shuffle is non-deterministic. If sessionStorage is cleared before a refresh, the question order changes.
- No automated test infrastructure. All verification was by code inspection.
- Yellow profile background artifact not fixed (out of scope for Phase 3).

---

## Phase 4 — Backend Refactoring

### Original Problem

The backend had significant code organization issues:

1. `StudentExamAnswerController` was 578 lines containing the entire exam business workflow, grading logic, data access, and two DTOs declared at the bottom of the controller file.
2. `AuthController` contained JWT generation, password hashing, BCrypt verification, and SHA256 hashing — all inside the controller.
3. `GetRequesterInfo()` and `IsStaff()` were duplicated identically in `ExamDetailController` and `StudentExamAnswerController`, with a third inline implementation in `DashboardController`.
4. Five DTO/model files had no `namespace` declarations.
5. `StudentAnswerSubmitDto` and `AnswerDto` were declared inside `StudentExamAnswerController.cs`.
6. `ExamDto.cs` (orphaned — zero references) remained in the DTOs folder.
7. `Console.WriteLine` was used for logging in two controllers instead of `ILogger`.

### Objective

Introduce a service layer for business logic, centralise identity helpers, fix namespaces, clean up DTOs, and replace Console logging — without changing any API contracts, business rules, or database behavior.

### Stage 1 — Namespace and Logging Cleanup

**Namespaces added to:**
- `server/Api/DTOs/ExamCreateDto.cs` → `namespace QuizesApi.DTOs;`
- `server/Api/DTOs/ExamUpdateDto.cs` → `namespace QuizesApi.DTOs;`
- `server/Api/Models/AuthModels.cs` → `namespace QuizesApi.Models;`
- `server/Api/Repositories/Interfaces/IQuestionBankRepo.cs` → `namespace QuizesApi.Repositories.Interfaces;`
- `server/Api/Repositories/Implementation/ExamRepo.cs` → `namespace QuizesApi.Repositories.Implementation;`

**Deleted:** `server/Api/DTOs/ExamDto.cs` (zero references confirmed)

**`Console.WriteLine` replaced with `ILogger<T>` in:**
- `server/Api/Controllers/ExamDetailController.cs` (5 calls)
- `server/Api/Controllers/DashboardController.cs` (4 calls)

---

### Stage 2 — Move DTOs Out of Controller

**Created:** `server/Api/DTOs/Student/StudentAnswerSubmitDto.cs`

Moved `StudentAnswerSubmitDto` and `AnswerDto` from the bottom of `StudentExamAnswerController.cs` to the new file with `namespace QuizesApi.DTOs.Student`.

---

### Stage 3 — Shared ClaimsHelper

**Created:** `server/Api/Helpers/ClaimsHelper.cs`

```csharp
public static class ClaimsHelper
{
    public static (long AccountId, List<string> Roles) GetRequesterInfo(ClaimsPrincipal user)
    public static bool IsStaff(IEnumerable<string> roles)
    public static bool IsAdmin(IEnumerable<string> roles)
}
```

**Replaced inline implementations in:**
- `ExamDetailController` — now delegates: `ClaimsHelper.GetRequesterInfo(User)`
- `StudentExamAnswerController` — same delegation
- `DashboardController` — two inline `FindFirst`/`FindAll` blocks replaced with `ClaimsHelper` calls; `using System.Security.Claims` removed

---

### Stage 4 — StudentExamService

**Created:** `server/Api/Services/IStudentExamService.cs` + `server/Api/Services/StudentExamService.cs`

All business logic extracted from `StudentExamAnswerController` into `StudentExamService`:
- `GetStudentExamsAsync`
- `GetStudentExamAnswersAsync`
- `GetExamQuestionsForStudentAsync` (returns tuple `(dto, errorMessage, statusCode)`)
- `SubmitStudentAnswersAsync`
- `PopulateExamQuestionsAsync` (private)
- `IsAnswerCorrect` (private static)

`StudentExamAnswerController` reduced to ~140 lines. No `_context` injection. All four routes preserved.

Registered in `Program.cs`:
```csharp
builder.Services.AddScoped<IStudentExamService, StudentExamService>();
```

---

### Stage 5 — AuthService

**Created:** `server/Api/Services/IAuthService.cs` + `server/Api/Services/AuthService.cs`

All auth logic extracted from `AuthController` into `AuthService`:
- `RegisterAsync` (full account/role/login creation)
- `LoginAsync` (BCrypt → SHA256 → plaintext, role loading, JWT generation)
- `GetProfileAsync`
- `UpdateProfileAsync`
- `GenerateJwtToken` (private — identical JWT claims and 8-hour expiry)
- `ValidatePasswordStrength` (public static — unchanged rules)
- `ComputeSha256Hash` (private static)

`AuthController` reduced to ~160 lines. No `_db` or `IConfiguration` injection. All four routes preserved.

`AccountProfileDto.CreatedAt` correctly typed as `DateOnly?` (matching `Account.CreatedAt` column type).

Registered in `Program.cs`:
```csharp
builder.Services.AddScoped<IAuthService, AuthService>();
```

---

### Architecture Before vs After Phase 4

**Before:**
```
Controller → (DbContext directly + business logic + DTOs + JWT + password + identity helpers)
```

**After:**
```
Controller (thin: HTTP routing, [Authorize], ClaimsHelper, delegates to service)
    ↓
Service (business rules, grading, JWT, password, data orchestration)
    ↓
Repository / DbContext (data access)
```

### Files Created
- `server/Api/Helpers/ClaimsHelper.cs`
- `server/Api/DTOs/Student/StudentAnswerSubmitDto.cs`
- `server/Api/Services/IStudentExamService.cs`
- `server/Api/Services/StudentExamService.cs`
- `server/Api/Services/IAuthService.cs`
- `server/Api/Services/AuthService.cs`

### Files Modified
- `server/Api/Controllers/AuthController.cs`
- `server/Api/Controllers/DashboardController.cs`
- `server/Api/Controllers/ExamDetailController.cs`
- `server/Api/Controllers/StudentExamAnswerController.cs`
- `server/Api/DTOs/ExamCreateDto.cs`
- `server/Api/DTOs/ExamUpdateDto.cs`
- `server/Api/Models/AuthModels.cs`
- `server/Api/Program.cs`
- `server/Api/Repositories/Implementation/ExamRepo.cs`
- `server/Api/Repositories/Interfaces/IQuestionBankRepo.cs`

### Files Deleted
- `server/Api/DTOs/ExamDto.cs`

### Build Result
`Build succeeded — 0 errors, 43 warnings` (all pre-existing nullable warnings)

---

## Phase 5 — Performance Optimization

### Original Problem

`ExamRepo.GetAllAsync()` loaded the **entire `ExamQuestionBanks` table** and the **entire `QuestionBanks` table** into memory on every call, regardless of which exams were being fetched:

```csharp
// BEFORE — two full-table loads:
var allLinks = await _context.ExamQuestionBanks.ToListAsync();          // ALL rows
var allQuestions = await _context.QuestionBanks.ToDictionaryAsync(...); // ALL rows
```

`ExamRepo.GetByIdAsync()` had an **N+1 query pattern** — one `FindAsync` database call per question in the exam:

```csharp
// BEFORE — loop with one query per question:
foreach (var link in links)
{
    var question = await _context.QuestionBanks.FindAsync(link.QuestionId.Value); // N queries
```

For an exam with 20 questions, this made 22 database round-trips.

### Objective

Fix both query patterns to reduce data transferred from SQL Server and eliminate serial N+1 queries. Preserve entity tracking (required by the `UpdateAsync` flow). Preserve all existing method signatures and return types.

### What Was Implemented

**`GetAllAsync()` — filter by exam IDs:**

```csharp
// AFTER — 3 queries, all filtered:
var examIds = exams.Select(e => e.ExamId).ToList();

var links = await _context.ExamQuestionBanks
    .Where(eq => eq.ExamId.HasValue && examIds.Contains(eq.ExamId.Value))
    .ToListAsync();

var qIds = links.Where(l => l.QuestionId.HasValue)
    .Select(l => l.QuestionId!.Value).Distinct().ToList();

var questions = await _context.QuestionBanks
    .Where(q => qIds.Contains(q.QuestionId))
    .ToDictionaryAsync(q => q.QuestionId);
```

An early-exit guard avoids unnecessary queries when no exams exist:
```csharp
if (!exams.Any()) return exams;
```

**`GetByIdAsync()` — single batched question query:**

```csharp
// AFTER — 3 queries total regardless of question count:
var qIds = links.Where(l => l.QuestionId.HasValue)
    .Select(l => l.QuestionId!.Value).Distinct().ToList();

var questions = await _context.QuestionBanks
    .Where(q => qIds.Contains(q.QuestionId))
    .ToDictionaryAsync(q => q.QuestionId);

foreach (var link in links)
{
    if (link.QuestionId.HasValue && questions.TryGetValue(link.QuestionId.Value, out var question))
    {
        link.Question = question;
        exam.ExamQuestionBanks.Add(link);
    }
}
```

### Query Count Comparison

| Method | Before | After |
|---|---|---|
| `GetAllAsync` query count | 3 | 3 |
| `GetAllAsync` link data volume | ALL rows | Filtered by exam IDs |
| `GetAllAsync` question data volume | ALL rows | Filtered by linked question IDs |
| `GetByIdAsync` (exam with N questions) | 2 + N | 3 |
| `GetByIdAsync` (20 questions) | 22 queries | 3 queries |

### Important Design Decision: No `AsNoTracking()`

`AsNoTracking()` was **intentionally not added** to `GetByIdAsync`. The reason:

The `ExamDetailController.Update` action calls `GetByIdAsync` → mutates the entity → passes it to `UpdateAsync` which calls `_context.ExamDetails.Update(exam)`. If `AsNoTracking()` were added, EF Core would throw when `Update` attempted to track a detached entity.

`AsNoTracking()` could safely be added to `GetAllAsync` (which is read-only), but was left out to keep the change minimal.

### SQL Server Parameter Limit

EF Core translates `Contains(list)` to `WHERE Id IN (@p0, @p1, ...)`. SQL Server allows 2,100 parameters per statement. In a school exam system:
- Exam count: tens to low hundreds → safe
- Questions per exam: tens → safe

EF Core 7+ also automatically batches `Contains` queries that exceed the limit as an additional safety net.

### Files Modified
- `server/Api/Repositories/Implementation/ExamRepo.cs` (only `GetAllAsync` and `GetByIdAsync`)

### Files NOT Modified
- `DashboardRepo` — untouched (has its own `PopulateExamQuestions` with different optimisation characteristics)
- All controllers, services, DTOs, interfaces, frontend files

### Build Result
`Build succeeded — 0 errors, 43 warnings` (unchanged from Phase 4)

### Runtime Testing Status
Performance improvement verified by code inspection. Query count reduction at runtime requires EF Core query logging against a running database — not executed.
