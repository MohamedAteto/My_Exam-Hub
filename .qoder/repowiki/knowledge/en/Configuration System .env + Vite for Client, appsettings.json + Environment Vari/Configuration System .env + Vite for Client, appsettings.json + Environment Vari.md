---
kind: configuration_system
name: 'Configuration System: .env + Vite for Client, appsettings.json + Environment Variables for ASP.NET Core'
category: configuration_system
scope:
    - '**'
source_files:
    - server/Api/appsettings.json
    - server/Api/appsettings.Development.json
    - server/Api/appsettings.Production.json
    - server/Api/Program.cs
    - client/.env.development
    - client/.env.production
    - client/src/api/axios.js
    - client/src/utils/token.js
---

# Configuration System

## Approach
The monorepo uses two independent configuration subsystems — one per runtime:

- **React/Vite client**: environment variables via Vite's `import.meta.env`, sourced from `.env.development` and `.env.production`.
- **ASP.NET Core API**: the standard `IConfiguration` pipeline reading layered `appsettings*.json` files plus environment-variable overrides (e.g. `ConnectionStrings__DefaultConnection`).

There is no shared configuration file, no YAML/TOML/feature-flag system, and no secret manager integration beyond what each side provides.

## Key Files

### Server (ASP.NET Core)
- `server/Api/appsettings.json` — base config: `ConnectionStrings.DefaultConnection`, `Jwt.Key`/`Issuer`/`Audience`, `Logging.LogLevel`, `AllowedHosts`.
- `server/Api/appsettings.Development.json` — dev-only overrides (adds a `DefaultConnection_Remote` connection string).
- `server/Api/appsettings.Production.json` — production overrides (connection string only).
- `server/Api/Program.cs` — wires `IConfiguration` into DI: reads `DefaultConnection` for EF Core (`UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))`) and reads `Jwt:Key` / `Jwt:Issuer` / `Jwt:Audience` for JWT validation.
- `server/Api/Models/EmailSetting.cs` — POCO for email settings; currently a database-backed model rather than an `IConfiguration`-bound section.

### Client (Vite/React)
- `client/.env.development` — defines `VITE_API_BASE_URL=http://localhost:5051/api`.
- `client/.env.production` — defines `VITE_API_BASE_URL`, `VITE_APP_URL`, `VITE_CAS_URL`, `VITE_CAS_API_URL` pointing at the production CAS and API endpoints.
- `client/vite.config.js` — minimal Vite config (dev server port 5177); does not define additional env handling.
- `client/src/api/axios.js` — consumes `import.meta.env.VITE_API_BASE_URL` as the axios `baseURL` (fallback `https://exam.sewedy.com.eg/api`), and `import.meta.env.VITE_CAS_URL` on 401 to redirect to the CAS login.
- `client/src/utils/token.js` — decodes JWT payloads locally to extract user identity claims.

## Architecture & Conventions

1. **Layered JSON config on the server.** The default values live in `appsettings.json`; environment-specific values override them via `appsettings.{Environment}.json`. This follows the built-in ASP.NET Core configuration loading order.
2. **Secrets are embedded in `appsettings.json`.** The SQL connection string, JWT signing key, issuer, and audience are committed directly in the repository (see `server/Api/appsettings.json`). No `.gitignore` exclusion or external secret store is used.
3. **Environment-driven behavior on the server.** `Program.cs` branches on `app.Environment.IsDevelopment()` to enable Swagger UI. Other sections of code read configuration via `builder.Configuration["Jwt:..."]` with C# null-coalescing fallbacks (e.g. `?? "CAS.Api"`, `?? "tbV/kbyLRqqoDCKJVwksaKqE07GNPkOcFTX7LN96nkY="`).
4. **Vite env vars prefixed with `VITE_` are exposed to the browser bundle.** `axios.js` reads `VITE_API_BASE_URL` and `VITE_CAS_URL` at build time via `import.meta.env.*`. These are the only client-side configuration points consumed by application code.
5. **No typed configuration objects on the server.** Values are accessed through string-keyed indexer (`builder.Configuration["Jwt:Key"]`) and `GetConnectionString`, not via strongly-typed options classes bound with `Configure<T>`.
6. **CORS and auth policies are hard-coded in `Program.cs`.** CORS policy `AllowFrontend` allows any origin/header/method; role-based authorization policies (`StudentOnly`, `TeacherOnly`, `SuperadminOnly`, `TeacherOrAdmin`) are registered inline.
7. **Client-side token handling is self-contained.** `token.js` parses JWT payloads locally to derive user IDs, checking multiple claim name variants (`AccountId`, `accountId`, `sub`, `id`, `nameid`, `userId`).

## Conventions & Constraints

- **Server configuration keys are flat strings under `Jwt:` and `ConnectionStrings:`.** All JWT-related settings live under the `Jwt` section; all DB connections under `ConnectionStrings`.
- **Fallback defaults are baked into `Program.cs` using `??` operators.** If a config key is missing, the code supplies a hardcoded default (issuer `"CAS.Api"`, audience `"CAS.Clients"`, signing key `"tbV/kbyLRqqoDCKJVwksaKqE07GNPkOcFTX7LN96nkY="`). This means the service can start even without those keys present, but will operate with insecure defaults.
- **Client env var names must be prefixed with `VITE_`** because Vite only exposes `VITE_*` variables to the browser bundle via `import.meta.env`.
- **Production vs development separation is file-based**, not feature-flag based. There is no runtime toggle between environments other than `IsDevelopment()` in `Program.cs`.
- **No centralized secrets management.** Connection strings and JWT keys are stored in plain text inside the repo's `appsettings.json` files.
- **Email settings are modeled as a database entity (`EmailSetting`)** rather than being loaded from configuration, so SMTP credentials are expected to be persisted in the database instead of injected via `IConfiguration`.