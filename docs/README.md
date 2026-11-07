# Exam-Hub Documentation

Welcome to the Exam-Hub project documentation. This folder contains comprehensive documentation covering every aspect of the system, from architecture to user workflows.

## Documentation Index

| File | Contents |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Purpose, objectives, technology stack, user roles |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, data flow, dependency injection |
| [BACKEND_DOCUMENTATION.md](BACKEND_DOCUMENTATION.md) | Controllers, services, repositories, DTOs, helpers |
| [FRONTEND_DOCUMENTATION.md](FRONTEND_DOCUMENTATION.md) | Pages, components, routing, state management |
| [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md) | Tables, columns, relationships, EF Core mappings |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | All 30 API endpoints with request/response details |
| [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) | JWT, roles, ownership checks, security model |
| [FEATURES_DOCUMENTATION.md](FEATURES_DOCUMENTATION.md) | Features grouped by user role |
| [USER_GUIDE.md](USER_GUIDE.md) | Step-by-step guides for each role |
| [SETUP_AND_RUN.md](SETUP_AND_RUN.md) | Prerequisites, configuration, startup instructions |
| [DEVELOPMENT_HISTORY.md](DEVELOPMENT_HISTORY.md) | Detailed history of all five development phases |
| [KNOWN_ISSUES_AND_LIMITATIONS.md](KNOWN_ISSUES_AND_LIMITATIONS.md) | Known bugs, limitations, and deferred items |

## Quick Start

```
# Backend
cd server/Api
dotnet run

# Frontend (separate terminal)
cd client
npm install
npm run dev
```

- Backend URL: `http://localhost:5051`
- Frontend URL: `http://localhost:5173`
- API Base: `http://localhost:5051/api`
- Swagger UI: `http://localhost:5051/swagger`

## Project Status

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Security & Authorization | ✅ Complete |
| Phase 2 | Correct Answer Protection | ✅ Complete |
| Phase 3 | Student Exam UI | ✅ Complete |
| Phase 4 | Backend Refactoring | ✅ Complete |
| Phase 5 | Performance Optimization | ✅ Complete |

## Technology Stack

- **Frontend:** React 19 + Vite 7 + React Router 7
- **Backend:** ASP.NET Core .NET 9
- **Database:** SQL Server (ElsewedySchoolSysDB)
- **Authentication:** JWT Bearer tokens
- **ORM:** Entity Framework Core 9
