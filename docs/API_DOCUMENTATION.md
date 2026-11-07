# API Documentation

**Base URL (development):** `http://localhost:5051/api`  
**Authentication:** JWT Bearer token — `Authorization: Bearer <token>`  
**Response format:** JSON with camelCase property names

---

## Authentication API (`/api/auth`)

### POST /api/auth/register
**Auth:** Public  
**Description:** Create a new account.

**Request body:**
```json
{
  "email": "student@example.com",
  "password": "Password1",
  "role": "Student",
  "fullNameEn": "Ahmed Hassan",
  "fullNameAr": "أحمد حسن"
}
```
- `role` defaults to `"Student"` if omitted
- `"Admin"` and `"Superadmin"` are mapped to `"Board"` internally

**Response 200:**
```json
{ "message": "Account created", "accountId": 42 }
```

**Response 400:** Invalid role, weak password, or missing fields  
**Response 409:** Email already exists (duplicate constraint)

---

### POST /api/auth/login
**Auth:** Public  
**Description:** Authenticate and receive a JWT token.

**Request body:**
```json
{ "email": "teacher@example.com", "password": "Password1" }
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "roles": ["Teacher"],
  "accountId": 15,
  "email": "teacher@example.com",
  "fullNameEn": "Sara Ali",
  "fullNameAr": "سارة علي",
  "role": "Teacher"
}
```

**Response 400:** Missing fields  
**Response 401:** Invalid credentials

---

### GET /api/auth/profile/{id}
**Auth:** `[Authorize]` — users may only read their own profile; Admin/Board/Superadmin may read any  
**Description:** Retrieve account profile data.

**Response 200:**
```json
{
  "id": 42,
  "email": "student@example.com",
  "fullNameEn": "Ahmed Hassan",
  "fullNameAr": "أحمد حسن",
  "phone": null,
  "isActive": true,
  "createdAt": "2026-01-15",
  "updatedAt": "2026-11-07T..."
}
```

**Response 401:** No/invalid token  
**Response 403:** Attempting to read another user's profile without admin role  
**Response 404:** Account not found

---

### PUT /api/auth/profile/{id}
**Auth:** `[Authorize]` — own profile only; Admin/Board/Superadmin may update any  
**Description:** Update profile fields.

**Request body:**
```json
{
  "fullNameEn": "Ahmed Hassan Updated",
  "fullNameAr": null,
  "email": null,
  "phone": "01012345678"
}
```
Null fields are ignored (only non-null values are updated).

**Response 200:** Updated profile object (same shape as GET)  
**Response 401/403/404:** As above

---

## Exam Detail API (`/api/examdetail`)

All endpoints require `[Authorize]`.

### GET /api/examdetail
**Auth:** All authenticated roles  
**Description:** List all exams.  
- **Students:** Filtered to exams assigned to their class (`StudentExtension.ClassId`)  
- **Staff:** All exams returned  
- **Students:** `CorrectAnswer` is `null` in response (Phase 2 protection)  
- **Staff:** `CorrectAnswer` is included

**Query:** No parameters

**Response 200:** Array of `ExamReadDto`
```json
[{
  "examId": 5,
  "title": "Midterm Math Q1",
  "subjectName": "Mathematics",
  "examDescription": "First quarter midterm examination",
  "startDate": "2026-10-01T00:00:00Z",
  "endDate": "2026-10-15T00:00:00Z",
  "gradeId": 2,
  "subjectId": 8,
  "classId": ",5,8,",
  "questions": [{
    "questionId": 101,
    "questionTitle": "What is 2+2?",
    "optionA": "3", "optionB": "4", "optionC": "5", "optionD": "6",
    "usedOptions": 4,
    "correctAnswer": null,
    "mark": 2
  }],
  "totalMarks": 20
}]
```

---

### GET /api/examdetail/{id}
**Auth:** All authenticated roles  
**Description:** Get one exam by ID. Same CorrectAnswer protection as GET list.

**Response 200:** Single `ExamReadDto`  
**Response 403:** Student not in assigned class  
**Response 404:** Exam not found

---

### POST /api/examdetail
**Auth:** `Teacher, Admin, Board, Superadmin`  
**Description:** Create a new exam.

**Request body (ExamCreateDto):**
```json
{
  "title": "Final Math Exam",
  "subjectId": 8,
  "examDescription": "End-of-year final",
  "gradeId": 2,
  "classIds": [5, 8],
  "startDate": "2026-12-01T00:00:00",
  "endDate": "2026-12-15T00:00:00",
  "questionIds": [101, 102, 103]
}
```

**Response 201:** Created exam as `ExamReadDto`

---

### PUT /api/examdetail/{id}
**Auth:** `Teacher, Admin, Board, Superadmin`  
**Description:** Update an existing exam (title, dates, questions, classes).

**Request body (ExamUpdateDto):** Same shape as create DTO.

**Response 200:** Updated exam as `ExamReadDto`  
**Response 404:** Exam not found

---

### DELETE /api/examdetail/{id}
**Auth:** `Admin, Board, Superadmin`  
**Description:** Delete an exam and its question links.

**Response 204:** No content  

---

### GET /api/examdetail/subjects
**Auth:** All authenticated  
**Description:** List available exam subjects.

**Response 200:**
```json
[{ "id": 8, "statusName": "Mathematics" }, ...]
```

---

## Question Bank API (`/api/questionbank`)

All endpoints require `Teacher, Admin, Board, or Superadmin` role (except DELETE which requires Admin/Board/Superadmin).

### GET /api/questionbank
**Description:** List all questions (includes CorrectAnswer — staff only).

**Response 200:** Array of `QuestionBankReadDto`

---

### GET /api/questionbank/{id}
**Response 200:** Single `QuestionBankReadDto`  
**Response 404:** Not found

---

### POST /api/questionbank
**Description:** Create one question.

**Request body (QuestionBankCreateDto):**
```json
{
  "questionTitle": "What is photosynthesis?",
  "optionA": "Converting sunlight to food",
  "optionB": "Breaking down food",
  "optionC": "Cellular respiration",
  "optionD": "Water absorption",
  "usedOptions": 4,
  "correctAnswer": "A",
  "questionSubject": "Biology",
  "mark": 2,
  "gradeId": 2,
  "classId": 5
}
```

**Response 201:** Created `QuestionBankReadDto`

---

### POST /api/questionbank/upload
**Auth:** Teacher/Admin/Board/Superadmin  
**Description:** Bulk upload questions from Excel (.xlsx) file.

**Request:** `multipart/form-data` with `file` field  
**Query params:** `gradeId` (optional), `classId` (optional)

**Excel format:** Columns — Question Type, Question Text, Correct Answer, Marks, Option A, B, C, D

**Response 200:** `QuestionUploadResultDto`
```json
{
  "totalProcessed": 25,
  "successCount": 24,
  "failureCount": 1,
  "errors": ["Row 15: Missing Correct Answer."],
  "addedQuestions": [...]
}
```

---

### PUT /api/questionbank/{id}
**Description:** Update a question.

**Request body (QuestionBankUpdateDto):** Same fields as create DTO.

**Response 204:** No content  
**Response 404:** Not found

---

### DELETE /api/questionbank/{id}
**Auth:** Admin/Board/Superadmin only  
**Response 204:** No content

---

### GET /api/questionbank/template
**Description:** Download the Excel upload template.

**Response 200:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` file download

---

## Student Exam Answer API (`/api/studentexamanswer`)

All endpoints require `[Authorize]`.

### GET /api/studentexamanswer/student/{accountId}/exams
**Auth:** Student (own data only), Staff (any student)  
**Description:** All completed exams for a student with scores and question-level results (includes CorrectAnswer for review).

**Response 200:** Array of exam objects with questions, user answers, correct answers, marks.

---

### GET /api/studentexamanswer/student/{accountId}/exam/{examId}
**Auth:** Student (own data only), Staff (any student)  
**Description:** Single exam review — all questions with submitted answers and correct answers.

**Response 200:** Exam object with questions, userAnswer, correctAnswer, isCorrect per question.  
**Response 404:** Exam not found

---

### GET /api/studentexamanswer/student/{accountId}/exam/{examId}/questions ⭐
**Auth:** Student (own data only), Staff (any)  
**Description:** Safe exam-taking endpoint (Phase 2). Returns questions **without** CorrectAnswer, IsCorrect, Score, or UserAnswer.

**Student checks (skipped for staff):**
1. Student must be in the exam's assigned class
2. Student must not have already submitted (blocks re-access)

**Response 200 (ExamForStudentDto):**
```json
{
  "examId": 5,
  "title": "Midterm Math",
  "subjectName": "Mathematics",
  "examDescription": "...",
  "startDate": "...",
  "endDate": "...",
  "totalMarks": 20,
  "questions": [{
    "questionId": 101,
    "questionTitle": "What is 2+2?",
    "optionA": "3", "optionB": "4", "optionC": "5", "optionD": "6",
    "usedOptions": 4,
    "mark": 2
  }]
}
```

**Note:** `correctAnswer` is intentionally absent from this response.

**Response 403:** Not in class, or already submitted  
**Response 404:** Exam not found

---

### POST /api/studentexamanswer/submit
**Auth:** `Student` role only  
**Description:** Grade and save exam answers. Identity taken from JWT only (body `accountId` is ignored for auth).

**Request body (StudentAnswerSubmitDto):**
```json
{
  "examId": 5,
  "accountId": 42,
  "answers": [
    { "questionId": 101, "answer": "4" },
    { "questionId": 102, "answer": "True" }
  ]
}
```

**Response 200:**
```json
{
  "message": "Answers submitted successfully.",
  "examId": 5,
  "totalMarks": 20,
  "earnedMarks": 16,
  "score": 80.0
}
```

**Response 400:** Already submitted, invalid question IDs, no answers  
**Response 404:** Exam or account not found

---

## Dashboard API (`/api/dashboard`)

### GET /api/dashboard/lookup-data
**Auth:** `[Authorize]`  
**Description:** Returns grades, classes, subjects, and exam list for filter dropdowns.

**Response 200:**
```json
{
  "grades": [{ "id": 1, "gradeName": "Junior" }],
  "classes": [{ "id": 5, "className": "J1", "gradeId": 1 }],
  "subjects": [{ "id": 8, "statusName": "Mathematics" }],
  "exams": [{ "examId": 5, "title": "Midterm Math", "gradeId": 1, "classId": ",5," }]
}
```

---

### GET /api/dashboard/student/{id}
**Auth:** `[Authorize]` — own data; Staff may access any  
**Query params:** `gradeId`, `classId`, `examId`, `subjectId`, `startDate`, `endDate`  
**Description:** Student analytics dashboard with exam history, score distribution, pass rates, and leaderboard.

---

### GET /api/dashboard/teacher/{id}
**Auth:** `[Authorize]` — own data; Admin/Board/Superadmin may access any  
**Query params:** Same filters as student dashboard  
**Description:** Teacher analytics with exam breakdown, pass/fail rates per exam, student participation.

---

### GET /api/dashboard/superadmin
**Auth:** `Superadmin, Admin, Board`  
**Query params:** Same filters  
**Description:** System-wide analytics, top students, recent activity.

---

### GET /api/dashboard/leaderboard/{examId}
**Auth:** `[Authorize]`  
**Query params:** `gradeId`, `classId`, `groupBy` (e.g. `"Class"`)  
**Description:** Student or class leaderboard for a specific exam.

---

### GET /api/dashboard/leaderboard/combined
**Auth:** `[Authorize]`  
**Query params:** All filters  
**Description:** Aggregate leaderboard across multiple exams.

---

### GET /api/dashboard/exam/{examId}/stats
**Auth:** `[Authorize]`  
**Description:** Pass/fail/average statistics for one exam.

---

### GET /api/dashboard/teachers
**Auth:** `[Authorize]`  
**Description:** All teacher accounts with exam counts.

---

### GET /api/dashboard/students
**Auth:** `Teacher, Admin, Board, Superadmin`  
**Description:** All students with quiz scores per exam ID.

**Response 200:** Array of `StudentPerformanceDto`
```json
[{
  "id": 42,
  "name": "Ahmed Hassan",
  "email": "student@example.com",
  "initials": "AH",
  "grade": "Junior",
  "class": "J1",
  "quizScores": { "5": 80.0, "6": 65.0 }
}]
```
