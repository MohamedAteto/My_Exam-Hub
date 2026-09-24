---
kind: logging_system
name: Logging System — Mixed ILogger and Console.WriteLine in ASP.NET Core API; no client-side logging
category: logging_system
scope:
    - '**'
source_files:
    - server/Api/Program.cs
    - server/Api/appsettings.json
    - server/Api/Controllers/AuthController.cs
    - server/Api/Controllers/DashboardController.cs
    - server/Api/Controllers/ExamDetailController.cs
    - server/Api/Controllers/StudentExamAnswerController.cs
---

## What system/approach is used

The server (ASP.NET Core) uses the built-in `Microsoft.Extensions.Logging` abstraction via constructor-injected `ILogger<T>` together with the default console sink provided by the framework. The client (React/Vite) does not use any logging library — there are no `console.log`, logger, or logging imports found under `client/src/`. All runtime output on the client side is therefore absent from the codebase.

## Key files and packages

- `server/Api/Program.cs` — registers the web host, controllers, authentication, CORS, and dependency injection. It also demonstrates structured logging via `ILogger<Program>` when catching exceptions during database seeding (`logger.LogWarning("DB seeding skipped: {Message}", ex.Message)`).
- `server/Api/appsettings.json` — defines the global logging configuration through the standard `Logging.LogLevel` section: default level `Information`, Microsoft.AspNetCore logs at `Warning`.
- `server/Api/Controllers/AuthController.cs` — declares a private `_logger` field of type `ILogger<AuthController>` injected via constructor, showing the DI-based pattern for controller-level logging.
- `server/Api/Controllers/DashboardController.cs`, `ExamDetailController.cs`, `StudentExamAnswerController.cs` — contain ad-hoc diagnostic output using `Console.WriteLine` with custom tags like `[DIAG]`, `[FILTER]`, `[ERROR]`, and `[Inner]`.
- `server/DataCheck/Program.cs`, `server/check_data.cs` — utility scripts that emit `Console.WriteLine` output for data inspection.

## Architecture and conventions

- **Server-side logging** follows two parallel patterns:
  1. **Structured logging via `ILogger<T>`**: Used in `Program.cs` and declared in `AuthController.cs`. Messages are written with message templates and named parameters (e.g. `{Message}`), which is the idiomatic way to produce structured fields in `Microsoft.Extensions.Logging`.
  2. **Ad-hoc console diagnostics**: Controllers frequently fall back to `Console.WriteLine` with human-readable tags (`[DIAG]`, `[FILTER]`, `[ERROR]`) to print request context, query results, and exception details (including `ex.StackTrace`). These are clearly temporary debugging aids rather than production log entries.
- **Log levels** are centrally configured in `appsettings.json` under `Logging.LogLevel.Default = Information` and `Microsoft.AspNetCore = Warning`. No per-namespace overrides are present beyond the framework namespace.
- **Sinks**: Only the default console sink is configured. There is no Serilog, NLog, Seq, Application Insights, or file sink setup anywhere in the project.
- **Client-side logging**: None detected. The React application contains no logging initialization, no `console.log` statements, and no third-party logging libraries in `package.json`.

## Conventions and constraints

- Controller classes should accept `ILogger<T>` via constructor injection (observed in `AuthController.cs`) rather than instantiating loggers directly.
- Structured messages should use template placeholders (e.g. `{Message}`) so that `Microsoft.Extensions.Logging` can capture them as typed fields — this is the only structured logging style observed in the repo.
- Global minimum log levels are controlled exclusively through `appsettings.json`'s `Logging.LogLevel` section; no programmatic filtering is applied in `Program.cs`.
- Diagnostic `Console.WriteLine` calls use informal tag prefixes (`[DIAG]`, `[FILTER]`, `[ERROR]`, `[Inner]`) to distinguish development-time traces from normal output — these are not part of the structured logging pipeline and are likely intended to be removed before production deployment.
- There is no centralized logging middleware, exception handler, or global error filter that would normalize error output across all controllers.