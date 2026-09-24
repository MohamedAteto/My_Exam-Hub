---
kind: external_dependency
name: 'Database: SQL Server (ElsewedySchoolSysDB_DEV)'
slug: sql-server
category: external_dependency
category_hints:
    - vendor_identity
scope:
    - '**'
---

The persistence layer targets SQL Server via `Microsoft.EntityFrameworkCore.SqlServer`. The default connection string points to server `Dbserver`, database `ElsewedySchoolSysDB_DEV`, user `dev`. Migrations live under `server/Api/Migrations/` and are managed through EF Core Tools.