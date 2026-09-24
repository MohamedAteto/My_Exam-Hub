Single .NET 9 Web project (`server/Api/QuizesApi.csproj`) organized in a classic layered layout:
- `Program.cs` bootstraps the app: registers controllers with camelCase JSON, Swagger (dev only), EF `ElsewedySchoolSysDbDevContext` against a SQL Server connection string, JWT Bearer auth with role policies (`StudentOnly`, `TeacherOnly`, `SuperadminOnly`, `TeacherOrAdmin`), CORS (`AllowFrontend`), and DI for three repository pairs.
- `Api/Controllers/` — thin API surface (`AuthController`, `DashboardController`, `ExamDetailController`, `QuestionBankController`, `StudentExamAnswerController`) using `[ApiController]` + `[Route("api/[controller]")]`.
- `Api/DTOs/` — request/response contracts separated from domain models.
- `Api/Repositories/{Interfaces,Implementation}/` — interface-first data layer (`IExamRepo`/`ExamRepo`, `IQuestionBankRepo`/`QuestionBankRepo`, `IDashboardRepo`/`DashboardRepo`) that wraps EF queries; controllers depend on interfaces via DI.
- `Api/Models/` — EF entity classes plus `ElsewedySchoolSysDbDevContext` and `ElsewedySchoolContextSeed` used at startup to seed roles/accounts.
- `Api/Migrations/` — EF migrations tracking schema evolution (e.g. `FixConstraints_Final`, `AddExamClassJunction`, `ModifyStudentExamAnswer`).
- `DataCheck/` — separate small console project for ad-hoc DB checks.
- Auth is custom (not ASP.NET Identity): `AuthController` handles register/login/SSO, stores BCrypt hashes, falls back to SHA256/plaintext for legacy data, and issues HS256 JWTs signed with `Jwt:Key` from config.