# Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────┐
│              Browser / Client                │
│  React SPA  (Vite dev server :5173)          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Pages   │  │Components│  │  Routing  │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│        │ axios (Bearer JWT)                  │
└────────┼────────────────────────────────────┘
         │  HTTP REST  (port 5051)
┌────────▼────────────────────────────────────┐
│        ASP.NET Core Web API (.NET 9)         │
│  ┌──────────────────────────────────────┐   │
│  │  Controllers (thin HTTP layer)       │   │
│  │  AuthController                      │   │
│  │  ExamDetailController                │   │
│  │  QuestionBankController              │   │
│  │  StudentExamAnswerController         │   │
│  │  DashboardController                 │   │
│  └────────────┬─────────────────────────┘   │
│               │                              │
│  ┌────────────▼─────────────────────────┐   │
│  │  Services (business logic)           │   │
│  │  AuthService                         │   │
│  │  StudentExamService                  │   │
│  └────────────┬─────────────────────────┘   │
│               │                              │
│  ┌────────────▼─────────────────────────┐   │
│  │  Repositories (data access)          │   │
│  │  ExamRepo  ·  QuestionBankRepo       │   │
│  │  DashboardRepo                       │   │
│  └────────────┬─────────────────────────┘   │
│               │  EF Core 9                   │
└───────────────┼─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│          SQL Server                          │
│       ElsewedySchoolSysDB                    │
└─────────────────────────────────────────────┘
```

## Frontend Architecture

### Entry Point
- **`client/src/main.jsx`** — application entry point. Creates a `BrowserRouter` with `createBrowserRouter` and wraps the app in `StrictMode`.

### Routing
All routes are defined in `main.jsx`:

| Path | Component | Protection |
|---|---|---|
| `/` | `LoginPage` | Public |
| `/greeting` | `GreetingPage` | Public (splash screen) |
| `/student` | `StudentPage` | `ProtectedRoute` (Student only) |
| `/teacher` | `TeacherPage` | `ProtectedRoute` (Teacher, Admin) |
| `/superadmin` | `SuperAdminPage` | `ProtectedRoute` (Admin, Superadmin, Board) |
| `/student-details` | `StudentDetailsPage` | `ProtectedRoute` (Admin, Superadmin, Board) |
| `*` | Redirect → `/` | — |

> **Note:** `App.jsx` is an empty shell component (`return null`). All meaningful layout and routing is handled by `main.jsx` and the individual page components.

### Authentication on the Frontend
- After login, the JWT token is stored in `localStorage` or `sessionStorage` via `client/src/utils/storage.js`.
- `ProtectedRoute` (`client/src/components/ProtectedRoute.jsx`) parses the JWT payload to extract roles and gates access.
- `client/src/api/axios.js` attaches the `Authorization: Bearer <token>` header to every request via an Axios request interceptor.
- On 401 response, the interceptor removes the stored token and redirects to `/login`.

### State Management
- **No global state library.** Each page component manages its own state with React `useState` and `useEffect`.
- Exam session data (answers, review marks, current question index) is persisted to `sessionStorage` with keys namespaced by `userId` and `examId`.
- User identity (`token`, `userRole`, `userName`) is stored in `localStorage` or `sessionStorage` depending on the "Remember Me" selection.

### API Communication
- All API calls go through the singleton `api` instance in `client/src/api/axios.js`.
- Base URL: `http://localhost:5051/api` (development), configurable via `VITE_API_BASE_URL` environment variable.
- Timeout: 15 seconds per request.

## Backend Architecture

### Layer Responsibilities

#### Controllers (`server/Api/Controllers/`)
Thin HTTP layer only. Responsible for:
- Receiving and validating HTTP requests
- Extracting identity from JWT claims via `ClaimsHelper`
- Applying `[Authorize]` and role restrictions
- Calling the appropriate Service or Repository
- Translating service results/exceptions into HTTP status codes

Controllers do **not** contain business logic, database queries, or password handling.

#### Services (`server/Api/Services/`)
Business logic layer. Responsible for:
- Business rules and workflows
- Data orchestration across repositories
- Grading logic and answer validation
- JWT token generation and password verification
- Returning typed result objects (not HTTP-specific types)

#### Repositories (`server/Api/Repositories/`)
Data access layer only. Responsible for:
- EF Core queries
- Data retrieval and persistence
- Entity population (loading navigation properties)

Repositories do **not** contain HTTP-specific code or business rules.

#### Helpers (`server/Api/Helpers/`)
Shared utility code:
- `ClaimsHelper` — reads `AccountId` and `Roles` from JWT claims; defines staff role list

### Controller → Service → Repository Flow

```
HTTP Request
    │
    ▼
Controller
 ├── ClaimsHelper.GetRequesterInfo(User)      ← identity from JWT
 ├── Ownership / role check                   ← security gate
 ├── service.MethodAsync(...)                 ← delegate to service
 └── return Ok(result) / NotFound() / 403
         │
         ▼
Service
 ├── Business rule validation
 ├── _context.DbSet queries (direct EF Core)  ← for complex operations
 ├── _repo.MethodAsync(...)                   ← for standard CRUD
 └── return typed result / throw exception
         │
         ▼
Repository
 ├── EF Core queries (tracked)
 ├── Navigation property population
 └── SaveChangesAsync()
         │
         ▼
SQL Server
```

### Dependency Injection (Program.cs)

```csharp
// Repositories
builder.Services.AddScoped<IExamRepo, ExamRepo>();
builder.Services.AddScoped<IQuestionBankRepo, QuestionBankRepo>();
builder.Services.AddScoped<IDashboardRepo, DashboardRepo>();

// Services
builder.Services.AddScoped<IStudentExamService, StudentExamService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Infrastructure
builder.Services.AddDbContext<ElsewedySchoolSysDbDevContext>(...);
builder.Services.AddMemoryCache();
```

All registrations use `Scoped` lifetime, meaning one instance per HTTP request.

## Authentication Flow

```
Client                          Server
  │                               │
  │  POST /api/auth/login         │
  │  { email, password }          │
  ├──────────────────────────────►│
  │                               │ 1. Look up account in Login table
  │                               │ 2. Verify BCrypt / SHA256 / plaintext
  │                               │ 3. Load roles from AccountRoles
  │                               │    WHERE BusinessEntityName = 'Exams'
  │                               │ 4. Generate JWT (sub=accountId, roles)
  │                               │    Expires: 8 hours
  │◄──────────────────────────────┤
  │  200 { token, roles, ... }    │
  │                               │
  │  GET /api/examdetail          │
  │  Authorization: Bearer <jwt>  │
  ├──────────────────────────────►│
  │                               │ 5. JWT middleware validates signature
  │                               │    Maps 'sub' → ClaimTypes.NameIdentifier
  │                               │    Maps role claims → ClaimTypes.Role
  │                               │ 6. [Authorize] passes
  │                               │ 7. ClaimsHelper.GetRequesterInfo(User)
  │                               │    reads AccountId and Roles from claims
  │◄──────────────────────────────┤
  │  200 { exams: [...] }         │
```

## CORS Configuration

The backend allows all origins, headers, and methods (policy `"AllowFrontend"`):
```csharp
policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
```

This is appropriate for a development/internal school environment.

## Important Architectural Decisions

1. **No service layer for DashboardRepo:** The `DashboardRepo` contains complex analytics logic and caching, intentionally not extracted to a service layer to avoid breaking the caching pattern.

2. **`ExamQuestionBanks` nav property populated manually:** EF Core lazy loading is not enabled. The `PopulateExamQuestionsAsync` method loads links and questions in batched queries and assembles them in memory.

3. **JWT identity always from token:** The `AccountId` field in request bodies is accepted for API compatibility but is never trusted for authorization. Identity always comes from `ClaimTypes.NameIdentifier` in the JWT.

4. **No database migrations in source:** Migrations exist in `server/Api/Migrations/` but are not run automatically. The existing production database is used directly.

5. **React SPA with no server-side rendering:** The frontend is a pure client-side application. All route protection is enforced both on the client (via `ProtectedRoute`) and on the server (via `[Authorize]` attributes).
