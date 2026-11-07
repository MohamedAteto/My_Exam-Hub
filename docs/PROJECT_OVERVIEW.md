# Project Overview

## Purpose

Exam-Hub (internally `QuizesApi` / `quiz-system`) is a school examination management platform built for Elsewedy Technical Academy. It enables teachers to create and manage exams, students to take exams digitally, and administrators to monitor performance across the school.

## Main Objectives

1. Provide a secure, role-based examination platform.
2. Allow teachers to build question banks and compose exams from them.
3. Deliver a structured, one-question-at-a-time exam-taking experience for students.
4. Protect correct answers from students before and during exams.
5. Give administrators and teachers analytics dashboards and leaderboards.
6. Maintain all student exam records and scores in a central SQL Server database.

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React | 19.1.1 |
| Frontend bundler | Vite | 7.1.2 |
| Frontend routing | React Router DOM | 7.8.0 |
| Frontend HTTP client | Axios | 1.12.2 |
| Frontend charts | Recharts | 3.6.0 |
| Frontend animations | Framer Motion | 12.38.0 |
| Frontend icons | Lucide React | 0.562.0 |
| Frontend spreadsheet | XLSX + ClosedXML | 0.18.5 |
| Backend framework | ASP.NET Core | .NET 9 |
| Backend ORM | Entity Framework Core | 9.0.9 |
| Backend auth | JWT Bearer | 9.0.9 |
| Backend password | BCrypt.Net-Next | 4.0.3 |
| Backend Excel | ClosedXML | 0.105.0 |
| Backend API docs | Swashbuckle (Swagger) | 9.0.4 |
| Database | SQL Server | (existing production DB) |
| Database name | ElsewedySchoolSysDB | — |

## User Roles

The system has five roles, all registered under `BusinessEntity = "Exams"`:

| Role | Frontend Route | Description |
|---|---|---|
| `Student` | `/student` | Takes exams, views results and scores |
| `Teacher` | `/teacher` | Creates exams and question banks, views analytics |
| `Admin` | `/teacher` (same UI) | Administrative teacher-level access |
| `Board` | `/superadmin` | Full administrative dashboard |
| `Superadmin` | `/superadmin` | Full administrative dashboard |

> **Note on naming:** The registration endpoint maps `"Admin"` and `"Superadmin"` to the `"Board"` role in the `Exams` BusinessEntity. The frontend routes `Admin` users to `/teacher` and `Board`/`Superadmin` to `/superadmin`.

## Main System Capabilities

### Students
- Login and view available exams assigned to their class
- Take exams with one-question-at-a-time navigation
- Mark questions for review and track progress
- Submit exams; view scores and correct-answer review after submission
- sessionStorage-based answer persistence across page refreshes

### Teachers
- Create, edit, and delete exams linked to specific grades and classes
- Build and manage question banks (manual creation or Excel upload)
- View unified dashboard with exam analytics, pass/fail rates, and score distributions
- View student performance grids filtered by grade, class, subject, and date range
- Access leaderboards and per-exam statistics

### Administrators / Board / Superadmin
- Full view of all exams, all students, all teachers
- System-wide analytics dashboard
- Filter and search all students by performance
- View teacher accounts and their exam counts

## Overall System Architecture

```
Browser (React SPA)
    │
    │  HTTP/JSON over REST
    ▼
ASP.NET Core Web API (.NET 9)  ←── JWT authentication
    │
    ├── Controllers (HTTP concerns only)
    ├── Services (business logic)
    ├── Repositories (data access)
    │
    ▼
SQL Server Database (ElsewedySchoolSysDB)
```

The frontend is a React Single Page Application that communicates with the backend exclusively via REST API calls using Axios. All authentication is token-based (JWT). No server-side rendering occurs.
