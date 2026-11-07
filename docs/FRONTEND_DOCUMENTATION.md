# Frontend Documentation

## Project Location
`client/`

## Technology
- **React 19.1.1** with Vite 7.1.2 (ES modules)
- **React Router DOM 7.8.0** (browser-based routing)
- **Axios 1.12.2** (HTTP client)
- **Recharts 3.6.0** (charts and graphs)
- **Framer Motion 12.38.0** (animations)
- **Lucide React 0.562.0** (icons)

---

## Entry Point and Routing

### `client/src/main.jsx`
Application entry point. Creates the router and renders into `#root`.

```
Routes:
  /                → LoginPage        (public)
  /greeting        → GreetingPage     (public — splash screen)
  /student         → StudentPage      (Student role only)
  /teacher         → TeacherPage      (Teacher, Admin roles)
  /superadmin      → SuperAdminPage   (Admin, Superadmin, Board roles)
  /student-details → StudentDetailsPage (Admin, Superadmin, Board roles)
  *                → redirect to /
```

### `client/src/App.jsx`
Empty shell component (`return null`). Not used for routing or layout.

---

## Pages

### LoginPage
**File:** `client/src/pages/LoginPage.jsx`

**Purpose:** Authentication entry point. Full-screen card with email and password fields.

**Features:**
- Email and password validation (client-side format check)
- "Keep me signed in" checkbox → controls whether token goes to `localStorage` or `sessionStorage`
- Displays error/success toast messages
- On success: stores `token`, `userRole`, `userName` in storage; navigates to `/greeting`
- Role-based redirect on page load if already authenticated

**API calls:**
- `POST /api/auth/login` — submits credentials, receives JWT and user info

---

### GreetingPage
**File:** `client/src/pages/GreetingPage.jsx`

**Purpose:** Animated welcome splash screen after login.

**Features:**
- Displays the authenticated user's name from storage
- Dark background with animated entrance (`framer-motion`)
- Auto-dismisses after 3 seconds, then navigates to role-appropriate page
- Click anywhere to skip immediately
- No API calls made

---

### StudentPage
**File:** `client/src/pages/StudentPage.jsx`  
**Size:** ~1,500 lines

**Purpose:** Complete student exam experience. Single-page application within a page — manages all student sections via `currentSection` state.

**Sections (internal navigation):**
| `currentSection` | Displays |
|---|---|
| `dashboard` | `UnifiedDashboard` component |
| `available` | Available and upcoming exams grid |
| `completed` | Completed exams with scores and review |
| `quiz` | `QuizInterface` component (active exam or review mode) |
| `profile` | `UserProfile` component |

**Key state variables:**
- `currentExam` — the currently active or reviewed exam object
- `isExamActive` — boolean flag; controls timer and tab-switch protection
- `isReviewMode` — boolean; switches `QuizInterface` to read-only review
- `timeRemaining` — seconds countdown; triggers auto-submit at 0
- `examAnswers` — `{ [questionId]: string }` — controlled answer state (Phase 3)
- `markedForReview` — `Set<questionId>` — review-marked questions (Phase 3)
- `currentQuestionIndex` — 0-based index of visible question (Phase 3)
- `examAnswersRef` — `useRef` mirror of `examAnswers` for stale-closure-safe auto-submit

**Key functions:**
- `startExam(exam)` — calls safe questions endpoint, shuffles questions, restores sessionStorage session
- `submitExam(autoSubmit)` — collects answers from `examAnswersRef`, POSTs to submit endpoint, clears sessionStorage on success only
- `reviewExam(exam)` — calls review endpoint (includes `CorrectAnswer`), sets review mode
- `handleExitActiveExam()` — shows confirmation dialog before clearing exam state
- `saveExamSession / loadExamSession / clearExamSession` — sessionStorage helpers

**API calls:**
- `GET /api/examdetail` — available exams list
- `GET /api/studentexamanswer/student/{userId}/exams` — completed exams
- `GET /api/studentexamanswer/student/{userId}/exam/{examId}/questions` — safe exam start
- `GET /api/studentexamanswer/student/{userId}/exam/{examId}` — post-submission review
- `POST /api/studentexamanswer/submit` — submit answers
- `GET /api/auth/profile/{userId}` — display student name

---

### TeacherPage
**File:** `client/src/pages/TeacherPage.jsx`  
**Size:** ~2,900 lines

**Purpose:** Full exam and question bank management for teachers.

**Sections:**
| `currentSection` | Displays |
|---|---|
| `main` | `UnifiedDashboard` |
| `my-quizzes` | Exam list with create/edit/delete controls |
| `quiz-editor` | Exam creation/editing form |
| `quiz-viewer` | Read-only exam preview |
| `question-banks` | Question bank list |
| `bank-editor` | Create/edit question bank |
| `bank-viewer` | Read-only bank preview |
| `question-bank-selector` | Modal to pick a bank when adding questions to exam |
| `question-bank-questions-selector` | Select questions from a bank to add to exam |
| `students` | `StudentsDataGrid` component |
| `student-detail` | Individual student performance |
| `profile` | `UserProfile` |

**API calls:**
- `GET /api/examdetail` — list exams
- `POST /api/examdetail` — create exam
- `PUT /api/examdetail/{id}` — update exam
- `DELETE /api/examdetail/{id}` — delete exam
- `GET /api/questionbank` — list all questions
- `POST /api/questionbank` — create question
- `PUT /api/questionbank/{id}` — update question
- `DELETE /api/questionbank/{id}` — delete question
- `GET /api/dashboard/lookup-data` — grades, classes, subjects
- `GET /api/dashboard/students` — student performance data

---

### SuperAdminPage
**File:** `client/src/pages/SuperAdminPage.jsx`  
**Size:** ~500 lines

**Purpose:** Administrative dashboard for Board/Superadmin/Admin roles.

**Sections:**
| `currentSection` | Displays |
|---|---|
| `main` | `UnifiedDashboard` (system-wide) |
| `my-quizzes` | All exams (read-only view with filters) |
| `teachers` | Teacher accounts grid with search |
| `students` | `StudentsDataGrid` |
| `student-detail` | Individual student profile |
| `profile` | `UserProfile` |

**API calls:**
- `GET /api/examdetail`
- `GET /api/dashboard/lookup-data`
- `GET /api/dashboard/students`
- `GET /api/dashboard/teachers`

---

### StudentDetailsPage
**File:** `client/src/pages/StudentDetailsPage.jsx`

**Purpose:** Detailed student profile view for administrators. Receives student data via React Router `location.state` or falls back to `sessionStorage`.

---

## Components

All components are in `client/src/components/`.

### Core / Layout

| Component | File | Description |
|---|---|---|
| `Sidebar` | `Sidebar.jsx` + `Sidebar.css` | Navigation sidebar, role-aware, blocks nav during active exam |
| `ProtectedRoute` | `ProtectedRoute.jsx` | Route guard; parses JWT payload to check roles |
| `ErrorBoundary` | `ErrorBoundary.jsx` | React error boundary wrapper |
| `QuizModal` | `QuizModal.jsx` | Confirmation/alert modal dialog (promise-based) |
| `LoadingSpinner` | `LoadingSpinner.jsx` | Loading indicator |

### Exam / Quiz

| Component | File | Description |
|---|---|---|
| `QuizInterface` | `QuizInterface.jsx` | One-question-at-a-time exam UI (Phase 3) |

`QuizInterface` sub-components (defined in same file):
- `ActiveAnswerInput` — controlled inputs for MCQ, True/False, Fill-in-the-blank
- `ReviewQuestionCard` — read-only question card for review mode
- `ReviewAnswerDisplay` — correct/incorrect highlighting for review
- `SubmitConfirmDialog` — pre-submission summary modal

### Dashboard

| Component | File | Description |
|---|---|---|
| `UnifiedDashboard` | `UnifiedDashboard.jsx` | Main dashboard container, role-aware |
| `DashboardView` | `DashboardView.jsx` | Legacy dashboard view |
| `DashboardCards` | `DashboardCards.jsx` | Metric summary cards |
| `DashboardCharts` | `DashboardCharts.jsx` | Chart container |
| `DashboardFilters` | `DashboardFilters.jsx` | Grade/class/date filter controls |
| `DashboardLeaderboard` | `DashboardLeaderboard.jsx` | Leaderboard display |
| `TeacherWelcomeCard` | `TeacherWelcomeCard.jsx` | Teacher dashboard header card |

### Charts

| Component | File |
|---|---|
| `StatsBarChart` | `charts/StatsBarChart.jsx` |
| `StatsLineChart` | `charts/StatsLineChart.jsx` |
| `StatsPieChart` | `charts/StatsPieChart.jsx` |

### Profile / User

| Component | File | Description |
|---|---|---|
| `UserProfile` | `UserProfile.jsx` | Authenticated user profile view/edit |
| `ProfilePage` | `ProfilePage.jsx` | Profile page wrapper |

### Forms / Input

| Component | File | Description |
|---|---|---|
| `FileUpload` | `FileUpload.jsx` | Excel file upload for bulk question import |
| `RichTextEditor` | `RichTextEditor.jsx` | Rich text editor for question content |
| `MultiSelectDropdown` | `MultiSelectDropdown.jsx` | Multi-select class picker |
| `ModernSelect` | `ModernSelect.jsx` | Styled select dropdown |
| `ModernDatePicker` | `ModernDatePicker.jsx` | Date picker |
| `ModernDateRangePicker` | `ModernDateRangePicker.jsx` | Date range picker |

### Teacher-Specific

| Component | File | Description |
|---|---|---|
| `StudentsDataGrid` | `Teacher/StudentsDataGrid.jsx` | Student performance grid with filtering |

---

## API Communication

**File:** `client/src/api/axios.js`

All API calls use the singleton `api` Axios instance:
- `baseURL`: `http://localhost:5051/api` (from `VITE_API_BASE_URL` env var)
- `timeout`: 15,000 ms
- **Request interceptor:** Attaches `Authorization: Bearer <token>` header
- **Response interceptor:** On 401, clears token from storage and redirects to `/`

---

## Storage Utility

**File:** `client/src/utils/storage.js`

Abstraction over `localStorage` / `sessionStorage`. Controlled by a `auth_persist` flag:
- `setItem(key, value, persist)` — writes to localStorage if persist=true, else sessionStorage
- `getItem(key)` — checks both storages
- `removeItem(key)` — removes from both
- `clear()` — removes `token`, `userRole`, `userName` from both

---

## sessionStorage — Exam Session (Phase 3)

Exam answers persist across page refreshes using keys namespaced by user and exam:

| Key pattern | Contents |
|---|---|
| `exam_answers_{userId}_{examId}` | `{ [questionId]: answerString }` |
| `exam_review_{userId}_{examId}` | Array of question IDs marked for review |
| `exam_index_{userId}_{examId}` | Current question index (number) |
| `exam_questions_{userId}_{examId}` | Array of question IDs in shuffled order |

Data is saved on every navigation/answer/review change and cleared only on successful submission or confirmed exit.

---

## Environment Configuration

| File | `VITE_API_BASE_URL` |
|---|---|
| `.env` | `http://localhost:5051/api` |
| `.env.development` | `http://localhost:5051/api` |
| `.env.production` | `https://192.168.10.32:5004/api` |

The production URL suggests deployment to an internal school network (192.168.x.x).
