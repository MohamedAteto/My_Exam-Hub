---
kind: build_system
name: 'Build System: Vite + .NET SDK Monorepo with No CI/Containerization'
category: build_system
scope:
    - '**'
source_files:
    - client/package.json
    - client/vite.config.js
    - client/.env.development
    - client/.env.production
    - server/QuizesApi.sln
    - server/Api/QuizesApi.csproj
    - server/DataCheck/DataCheck.csproj
    - README.md
---

## What system/approach is used

This repository is a monorepo pairing a React/Vite frontend (`client/`) with an ASP.NET Core 9 Web API backend (`server/Api/`). There is no shared build orchestrator at the repository root — each side builds independently using its native toolchain:
- **Frontend**: Vite (v7) via `npm run build` / `npm run dev`, configured in `client/vite.config.js`. The client is a private npm package (`"private": true`) with version `0.0.0`.
- **Backend**: .NET SDK targeting `net9.0`, built via `dotnet restore` and `dotnet run` (per README), organized under a single Visual Studio solution `server/QuizesApi.sln` that references `Api/QuizesApi.csproj`. A small helper console project `server/DataCheck/DataCheck.csproj` references the API project to reuse its models.

There are **no** Dockerfiles, docker-compose files, Makefiles, shell build scripts, GitHub Actions/GitLab CI pipelines, or NuGet/NPM publish workflows checked into the repo. The only artifact hint is a top-level `Exams publish.rar` archive, suggesting manual publishing outside of source control.

## Key files and packages

- `client/package.json` — defines the Vite build/dev/lint/preview scripts and all runtime/dev dependencies (React 19, axios, recharts, framer-motion, eslint, vite).
- `client/vite.config.js` — sets the dev server port to `5177` with `strictPort: true`; uses the `@vitejs/plugin-react` plugin.
- `client/.env.development` and `client/.env.production` — environment-specific configuration consumed by Vite.
- `server/QuizesApi.sln` — Visual Studio solution declaring Debug/Release configurations for `Any CPU`.
- `server/Api/QuizesApi.csproj` — SDK-style `.csproj` targeting `net9.0` with `<Nullable>enable</Nullable>` and `<ImplicitUsings>enable</ImplicitUsings>`; declares EF Core, JWT Bearer auth, AutoMapper, Swagger/Swashbuckle, ClosedXML, BCrypt, etc.
- `server/DataCheck/DataCheck.csproj` — separate executable project referencing the API project to share models.
- `README.md` — documents the two-step local setup (`cd server/api && dotnet restore && dotnet run`, then `cd client && npm install && npm run dev`).

## Architecture and conventions

- **Dual-toolchain monorepo**: Each subproject owns its own manifest and build pipeline. There is no cross-project script that builds both sides together; developers must run the two stacks separately.
- **.NET project layout**: Controllers, DTOs, Models, Repositories (interfaces + implementations), Migrations, and `appsettings.*.json` live directly under `server/Api/`. EF migrations are stored as C# classes under `server/Api/Migrations/` and applied through EF tools rather than a custom migration runner.
- **Vite dev server convention**: The dev server is pinned to port `5177` (not Vite's default 5173) and refuses to start if the port is already taken (`strictPort: true`). Environment variables are split across `.env.development` and `.env.production`.
- **Solution structure**: The `.sln` only contains the API project; the DataCheck utility is not included in the solution file but still compiles as a standalone executable.

## Conventions and constraints

- **No automated CI/CD**: No workflow files exist under `.github/` or any other CI directory. Build, test, and publish steps are not defined in source control.
- **No containerization**: No `Dockerfile` or `docker-compose.yml` is present; deployment appears to be done by manually packaging artifacts (e.g., the `Exams publish.rar` archive at the repo root).
- **Local development is manual**: Per `README.md`, developers must run `dotnet restore` + `dotnet run` for the server and `npm install` + `npm run dev` for the client in separate terminal sessions.
- **Environment separation**: The client distinguishes environments via Vite's `.env.development` and `.env.production` files; the server uses `appsettings.Development.json` and `appsettings.Production.json`.
- **.NET nullable reference types**: Enabled globally via `<Nullable>enable</Nullable>` in both `.csproj` files, enforcing nullability checks at compile time.
- **Dependency management**: Frontend uses npm lockfile (`package-lock.json`); backend uses PackageReference versions pinned inside the `.csproj` (no `packages.config` or central `Directory.Packages.props`).