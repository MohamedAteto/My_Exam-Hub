# Features Documentation

## Feature Status Legend
- ✅ **Implemented and build-verified** — code exists, compiles, logic verified by inspection
- ⚠️ **Implemented, not runtime-verified** — code exists but live execution not confirmed
- ❌ **Not implemented** — planned or referenced but absent from codebase

---

## Student Features

### Login and Authentication
**Status:** ✅ Implemented  
**Roles:** All  
**How it works:**
1. Student visits `/` (LoginPage)
2. Enters email and password
3. POST to `/api/auth/login` → receives JWT, role, and name
4. Token stored in localStorage/sessionStorage (based on "Remember Me")
5. Auto-redirected to `/greeting` (animated splash), then to `/student`

**Files:**
- Frontend: `client/src/pages/LoginPage.jsx`
- Backend: `server/Api/Controllers/AuthController.cs`, `server/Api/Services/AuthService.cs`

**Database entities:** `Account`, `Login`, `AccountRole`, `Roles`

---

### View Profile
**Status:** ✅ Implemented  
**Roles:** Student (own profile), Staff (any profile)  
**How it works:** Student navigates to Profile section in sidebar → `GET /api/auth/profile/{userId}` → displays name, email, phone.

**Files:**
- Frontend: `client/src/components/UserProfile.jsx`
- Backend: `server/Api/Controllers/AuthController.cs`, `server/Api/Services/AuthService.cs` → `GetProfileAsync`

---

### View Available Exams
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:**
1. `StudentPage` on mount calls `GET /api/examdetail` and `GET /api/studentexamanswer/student/{id}/exams`
2. Exams are filtered: not already completed, not expired, has started
3. Displayed as cards in the "Available Exams" section
4. Each card shows title, subject, question count, deadline countdown

**Files:**
- Frontend: `client/src/pages/StudentPage.jsx` (lines 113–220)
- Backend: `server/Api/Controllers/ExamDetailController.cs` → `GetAll()`

**Database entities:** `Exam_Details`, `StudentExtension`, `StudentExamAnswer`

---

### Take an Exam (One Question at a Time)
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:**
1. Student clicks "Start" on an exam card
2. `startExam()` calls `GET /api/studentexamanswer/student/{id}/exam/{examId}/questions`
3. Questions are shuffled randomly (once per session)
4. Session restored from `sessionStorage` if returning after refresh
5. Questions displayed one at a time via `QuizInterface`
6. Timer counts down from exam `EndDate - now`

**Files:**
- Frontend: `client/src/pages/StudentPage.jsx` → `startExam()`; `client/src/components/QuizInterface.jsx`
- Backend: `server/Api/Controllers/StudentExamAnswerController.cs` → `GetExamQuestionsForStudent()`; `server/Api/Services/StudentExamService.cs` → `GetExamQuestionsForStudentAsync()`
- DTO: `server/Api/DTOs/ExamForStudentDto.cs` (no CorrectAnswer)

**Database entities:** `Exam_Details`, `ExamQuestionBank`, `QuestionBank`, `StudentExtension`

---

### Question Navigation (Previous / Next)
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:** `QuizInterface` renders one question at a time driven by `currentQuestionIndex` state. Previous/Next buttons update the index. Previous is disabled on Q1; Next is disabled on last question.

**Files:** `client/src/components/QuizInterface.jsx` (ActiveAnswerInput, nav row)

---

### Answer Persistence
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:**
- Answers stored in `examAnswers` React state keyed by question ID (not array index)
- Controlled inputs (`checked={isSelected}`) — not DOM-based FormData
- Persisted to `sessionStorage` on every change
- Restored on page refresh via `loadExamSession()`

**Files:**
- `client/src/pages/StudentPage.jsx` → `examAnswers` state, `handleAnswerChange()`, `saveExamSession()`, `loadExamSession()`

---

### Mark for Review
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:**
- Per-question "Mark for Review" toggle button
- `markedForReview` is a `Set<questionId>` stored in StudentPage state
- Persisted to `sessionStorage`
- Question grid shows amber dot for marked questions
- Marked count shown in progress bar

**Files:** `client/src/pages/StudentPage.jsx` (markedForReview state), `client/src/components/QuizInterface.jsx` (mark button, grid dots)

---

### Progress Indicator
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:** Above the question card, shows:
- "Question N of M"
- Answered count (green)
- Unanswered count
- Review count (amber, if any)
- Animated gradient fill progress bar

**Files:** `client/src/components/QuizInterface.jsx` (progress bar section)

---

### Question Grid
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:** Toggled by "⊞ Questions" button. Shows all questions as numbered dots:
- 🟢 Green = answered
- 🟡 Amber = marked for review
- ⬜ Grey = unanswered
- 🔴 Red = currently active

Clicking any dot navigates to that question.

**Files:** `client/src/components/QuizInterface.jsx` (grid panel)

---

### Exam Submission
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:**
1. Student clicks "Finish Exam"
2. `SubmitConfirmDialog` appears with summary (answered/unanswered/review counts)
3. If issues exist, shows warning and links to navigate to unanswered/review questions
4. On confirm: `submitExam(false)` called
5. Answers collected from `examAnswersRef.current` (latest state, safe for auto-submit)
6. `POST /api/studentexamanswer/submit` with `{examId, accountId, answers}`
7. Server grades answers, saves `StudentExamAnswer` rows
8. Session storage cleared on success
9. Success modal shown with score
10. Exam moves to completed list

**Auto-submit:** When `timeRemaining` reaches 0, `submitExam(true)` fires automatically.

**Files:**
- Frontend: `client/src/pages/StudentPage.jsx` → `submitExam()`, `client/src/components/QuizInterface.jsx` → `SubmitConfirmDialog`
- Backend: `server/Api/Controllers/StudentExamAnswerController.cs` → `SubmitStudentAnswers()`, `server/Api/Services/StudentExamService.cs` → `SubmitStudentAnswersAsync()`

---

### Exit Active Exam
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:** If student clicks "back" during an active exam, `handleExitActiveExam()` shows a confirmation dialog. Dismissing preserves all answers and session data. Confirming clears session and returns to available exams.

**Files:** `client/src/pages/StudentPage.jsx` → `handleExitActiveExam()`

---

### View Results and Review
**Status:** ✅ Implemented  
**Roles:** Student (own exams)  
**How it works:**
1. Student navigates to "Completed Exams"
2. Clicks "Review" on any completed exam
3. `reviewExam()` calls `GET /api/studentexamanswer/student/{id}/exam/{examId}` (review endpoint — includes CorrectAnswer)
4. `QuizInterface` renders in `isReviewMode=true`
5. All questions shown at once (scrollable list) with correct/incorrect highlighting

**Files:**
- Frontend: `client/src/pages/StudentPage.jsx` → `reviewExam()`, `client/src/components/QuizInterface.jsx` → review mode
- Backend: `server/Api/Services/StudentExamService.cs` → `GetStudentExamAnswersAsync()`

---

### Student Dashboard
**Status:** ✅ Implemented  
**Roles:** Student  
**How it works:** `UnifiedDashboard` component calls `GET /api/dashboard/student/{id}` and displays score distributions, recent exam history, pass rates, and leaderboard.

---

## Teacher Features

### Login and Dashboard
**Status:** ✅ Implemented  
**Roles:** Teacher, Admin  
Routes to `/teacher` after greeting.

---

### Create Exam
**Status:** ✅ Implemented  
**Roles:** Teacher, Admin, Board, Superadmin  
**How it works:**
1. Teacher goes to "My Quizzes" → "Create New"
2. Fills exam form (title, subject, grade, classes, dates)
3. Opens "Question Bank Selector" to browse and add questions
4. Saves → `POST /api/examdetail` with `{title, questionIds, classIds, ...}`

**Files:**
- Frontend: `client/src/pages/TeacherPage.jsx` → quiz-editor section, `saveQuiz()`
- Backend: `server/Api/Controllers/ExamDetailController.cs` → `Create()`, `server/Api/Repositories/Implementation/ExamRepo.cs` → `AddAsync()`

---

### Edit and Delete Exam
**Status:** ✅ Implemented  
**Roles:** Teacher/Admin (edit), Admin/Board/Superadmin (delete)  
**API:** `PUT /api/examdetail/{id}`, `DELETE /api/examdetail/{id}`

---

### Create / Edit Question Bank
**Status:** ✅ Implemented  
**Roles:** Teacher, Admin, Board, Superadmin  
**How it works:** Teacher goes to "Question Banks" → creates bank and adds questions manually with rich text support for formulas and images.

**Files:** `client/src/pages/TeacherPage.jsx` → bank-editor section; `server/Api/Controllers/QuestionBankController.cs`

---

### Bulk Upload Questions via Excel
**Status:** ✅ Implemented  
**Roles:** Teacher, Admin, Board, Superadmin  
**API:** `POST /api/questionbank/upload`  
**Files:** `client/src/components/FileUpload.jsx`, `server/Api/Controllers/QuestionBankController.cs` → `Upload()`

---

### View Student Performance
**Status:** ✅ Implemented  
**Roles:** Teacher, Admin, Board, Superadmin  
**Files:** `client/src/components/Teacher/StudentsDataGrid.jsx`, `server/Api/Controllers/DashboardController.cs` → `GetStudents()`

---

### Teacher Analytics Dashboard
**Status:** ✅ Implemented  
**Roles:** Teacher  
**API:** `GET /api/dashboard/teacher/{id}`  
**Files:** `client/src/components/UnifiedDashboard.jsx`

---

## Admin / Board / Superadmin Features

### System Dashboard
**Status:** ✅ Implemented  
**Roles:** Admin, Board, Superadmin  
**API:** `GET /api/dashboard/superadmin`

---

### View All Exams
**Status:** ✅ Implemented  
**Roles:** Admin, Board, Superadmin (read-only view with filters)

---

### View All Students
**Status:** ✅ Implemented  
**Roles:** Teacher, Admin, Board, Superadmin  
**API:** `GET /api/dashboard/students`

---

### View All Teachers
**Status:** ✅ Implemented  
**Roles:** All authenticated  
**API:** `GET /api/dashboard/teachers`

---

## Features NOT Implemented

| Feature | Notes |
|---|---|
| Password reset / forgot password | Link exists in UI but has no action |
| Account registration via UI | Only possible via API (`POST /api/auth/register`) |
| Email notifications | No email service configured |
| Announcements | Referenced in imports but no implementation found |
| File attachments to questions | Image embedding via markdown in question text only |
| Token refresh | No refresh endpoint; tokens expire after 8 hours |
| Audit logging | No action logging beyond standard HTTP logs |
