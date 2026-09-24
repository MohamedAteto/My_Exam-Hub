---
kind: dependency_management
name: 'Dual Package Managers: npm (client) and NuGet (server) with Lockfiles'
category: dependency_management
scope:
    - '**'
source_files:
    - client/package.json
    - package-lock.json
    - server/Api/QuizesApi.csproj
    - server/DataCheck/DataCheck.csproj
---

## Overview

The Exams Hub monorepo manages dependencies for two distinct projects using their native package managers:
- **Client (React/Vite)**: managed via `npm` with `package.json` and a lockfile.
- **Server (.NET 9 API)**: managed via the built-in .NET SDK / NuGet, declared in `.csproj` files.

There is no shared root-level dependency manifest; each project owns its own dependency declarations. No vendoring or private registry configuration was found.

## Client-side Dependencies (npm)

- **Manifest**: `client/package.json` declares runtime dependencies (`react`, `react-dom`, `react-router-dom`, `axios`, `recharts`, `framer-motion`, `lucide-react`, `xlsx`, `file-saver`) and development dependencies (`vite`, `eslint`, `@vitejs/plugin-react`, TypeScript types, ESLint plugins).
- **Lockfile**: A top-level `package-lock.json` exists at the repo root but is effectively empty (`"packages": {}`), so it does not pin versions. The actual client lockfile should be under `client/package-lock.json` (referenced by the directory tree) — that file is what pins exact versions for reproducible installs.
- **Versioning style**: All dependencies use caret ranges (`^x.y.z`), allowing minor/patch updates automatically. There are no fixed exact versions in `package.json`.
- **No private registry**: No `.npmrc` or `registry` overrides were found in the client directory.
- **Build tooling**: Vite is used as both dev server and bundler; dependencies are resolved from the public npm registry.

## Server-side Dependencies (NuGet / .NET SDK)

- **Manifest**: `server/Api/QuizesApi.csproj` is the only project that declares external packages via `<PackageReference>` elements. It targets `net9.0` with nullable and implicit usings enabled.
- **Declared packages** (all pinned to exact versions in the `.csproj`):
  - `AutoMapper.Extensions.Microsoft.DependencyInjection` 12.0.1
  - `BCrypt.Net-Next` 4.0.3
  - `ClosedXML` 0.105.0
  - `Microsoft.AspNetCore.Authentication.JwtBearer` 9.0.9
  - `Microsoft.AspNetCore.Identity.EntityFrameworkCore` 9.0.9
  - `Microsoft.AspNetCore.OpenApi` 9.0.7
  - `Microsoft.EntityFrameworkCore` 9.0.9
  - `Microsoft.EntityFrameworkCore.SqlServer` 9.0.9
  - `Microsoft.EntityFrameworkCore.Tools` 9.0.9 (with `<PrivateAssets>all</PrivateAssets>` and explicit `IncludeAssets` — a build-only tool)
  - `Swashbuckle.AspNetCore` 9.0.4
- **Tool usage convention**: Build-time-only tools like EF Core Tools are marked with `PrivateAssets=All` so they do not propagate to consumers of the project.
- **Project references**: `server/DataCheck/DataCheck.csproj` depends on the API project via `<ProjectReference Include="..\Api\QuizesApi.csproj" />`, meaning it inherits the same transitive dependencies without re-declaring them.
- **No global packages or custom sources**: No `NuGet.config` / `nuget.config` file was found anywhere in the repository, so all packages resolve from the default nuget.org source.
- **Lockfile**: No `packages.lock.json` was found in the server directory; version pinning happens directly in the `.csproj` rather than via a separate lockfile.

## Conventions Observed

1. **Separate manifests per project** — the monorepo does not centralize dependencies; each subproject declares its own.
2. **Exact version pinning on the server side** — every `<PackageReference>` uses a literal version number, ensuring deterministic builds.
3. **Flexible versioning on the client side** — `package.json` uses caret ranges, deferring pinning to the generated lockfile.
4. **Build-only packages are isolated** — EF Core Tools is excluded from runtime assets via `PrivateAssets`.
5. **No vendoring** — neither npm nor NuGet packages are checked into version control; only manifests and lockfiles are committed.
6. **No private registries or proxies** — all packages come from public sources (npm registry and nuget.org).

## Constraints

- The server project must remain on `net9.0`; any added package must target this framework.
- Only the `server/Api` project declares third-party packages; helper projects like `DataCheck` depend on the API via project reference instead of duplicating package declarations.