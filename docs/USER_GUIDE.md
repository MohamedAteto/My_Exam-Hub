# User Guide

## Logging In

1. Open the application in your browser (`http://localhost:5173` in development)
2. Enter your email address and password
3. Optionally check "Keep me signed in" to persist your session across browser closes
4. Click "Sign In"
5. You will see a brief welcome screen with your name, then be redirected to your dashboard

---

## Student Guide

### Viewing Available Exams

After login you land on the Student Dashboard. Use the sidebar to navigate to **"Available Exams"**.

Each exam card shows:
- Exam title and ID
- Subject
- Number of questions
- Time remaining until the deadline

Exams that have already expired or that you have completed will not appear here.

---

### Taking an Exam

1. Click **"Start"** on an exam card
2. The exam loads — questions are displayed **one at a time**
3. The timer in the header shows time remaining until the exam deadline

**Answering questions:**
- For multiple choice: click one of the lettered options
- For True/False: click True or False
- For fill-in-the-blank: type your answer

**Navigating between questions:**
- Click **"Next →"** to move to the next question
- Click **"← Previous"** to go back
- Your answers are saved automatically as you navigate — you will not lose them

**Question Grid:**
- Click **"⊞ Questions"** to open a grid of all questions
- Dots are colour-coded:
  - 🟢 Green = answered
  - 🟡 Amber = marked for review
  - ⬜ Grey = unanswered
  - 🔴 Red = current question
- Click any dot to jump directly to that question

**Mark for Review:**
- Click **"🔖 Mark for Review"** on any question to flag it for later
- The button turns amber when marked
- Your review marks are saved automatically
- Use the question grid to spot and revisit marked questions

**Progress bar:**
- Shows "Question N of M | ✓ X Answered · Y Unanswered · 🔖 Z Review"
- Updates immediately as you answer

---

### Submitting Your Exam

1. When you are ready, click **"Finish Exam"** (in the navigation row)
2. A summary dialog appears showing:
   - Total questions
   - How many you answered
   - How many are unanswered
   - How many are marked for review
3. If you have unanswered questions, you will see a warning and can click **"→ Go to first unanswered"** to review them
4. Click **"Submit Exam"** to finalise your submission
5. Click **"Continue Exam"** to go back and keep working

After submission, your score is displayed (earned marks / total marks and percentage). Click OK to return to the completed exams list.

> **Note:** The exam timer runs based on the exam's end date. If time expires before you submit, the exam is submitted automatically with whatever answers you have entered.

---

### Viewing Your Results

Navigate to **"Completed Exams"** in the sidebar.

Each completed exam shows your score. Click **"Review"** to see:
- All questions with your submitted answer
- The correct answer highlighted in green
- Your incorrect answers highlighted in red
- Your score per question

---

### Your Dashboard

The **Dashboard** section shows:
- Exams taken and pass rate
- Score distribution chart
- Recent exam performance
- Leaderboard for your latest exam

---

## Teacher Guide

### Dashboard

After login you land on the Teacher Dashboard, showing:
- Exams you created
- Student participation and pass rates
- Score distributions

---

### Managing Exams

Navigate to **"My Quizzes"** in the sidebar.

**Create a new exam:**
1. Click **"Create New Exam"**
2. Fill in: Title, Subject, Grade, Classes (you can select multiple classes), Start Date, End Date, Description
3. Click **"Add Questions from Bank"** to open the question bank selector
4. Browse your question banks and check the questions you want to include
5. Click **"Add Selected"** to add them to the exam
6. Click **"Save Exam"**

**Edit an existing exam:**
1. Click the edit button on any exam card
2. Modify the fields and question list
3. Save

**Delete an exam:**
Only Admin and above can delete exams.

---

### Managing Question Banks

Navigate to **"Question Banks"** in the sidebar.

**Create a question bank:**
1. Click **"Create New Bank"**
2. Give it a title and description
3. Add questions individually using the question form
4. Each question has: question text (supports bold, italic, images), up to 8 options, correct answer, and marks

**Upload questions in bulk:**
1. Click **"Upload Excel"**
2. Download the template first (`GET /api/questionbank/template`)
3. Fill in: Question Type, Question Text, Correct Answer, Marks, Options A–D
4. Upload the filled .xlsx file

---

### Viewing Student Performance

Navigate to **"Students"** in the sidebar to see:
- All students' scores per exam
- Filter by grade, class, exam, date range
- Click any student to see their individual performance

---

## Admin / Superadmin / Board Guide

### Dashboard

The system-wide dashboard shows:
- Total exams, students, and teachers
- Overall pass rate
- Top performing students
- Recent activity

---

### All Exams

Navigate to **"All Exams"** to view every exam in the system. Use the filters to find exams by grade, class, subject, or date range.

---

### Teachers

Navigate to **"Teachers"** to see all teacher accounts:
- Name, email, active/inactive status
- Number of exams created
- Search by name or email

---

### Students

Navigate to **"Students"** to see all student performance data. Click any student row to view their detailed profile with scores across all exams.

---

## Logging Out

Click **"Logout"** in the sidebar.

- If you are mid-exam, you will be asked to complete the exam first
- Confirm logout → token is cleared → redirected to login page
