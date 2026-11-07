# Setup and Run Guide

## Prerequisites

| Requirement | Minimum version | How to verify |
|---|---|---|
| .NET SDK | 9.0 | `dotnet --version` |
| Node.js | 18.x | `node --version` |
| npm | 9.x | `npm --version` |
| SQL Server | 2019+ | Accessible on the configured server |
| Git | Any | `git --version` |

---

## Repository Structure

```
Exam-Hub-main/
  client/          ← React frontend
  server/Api/      ← ASP.NET Core backend
  docs/            ← This documentation
  DB_Backups/      ← SQL Server backup files (.bak)
```

---

## Backend Setup

### 1. Configure Database Connection

Edit `server/Api/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "MySqlConnection": "Server=YOUR_SERVER;Database=ElsewedySchoolSysDB;Trusted_Connection=True;Encrypt=False;"
  }
}
```

> **Never commit real credentials to source control.** Use `dotnet user-secrets` for local development:
> ```
> cd server/Api
> dotnet user-secrets init
> dotnet user-secrets set "ConnectionStrings:MySqlConnection" "Server=...;Database=..."
> ```

### 2. Configure JWT

The JWT key is in `appsettings.json` under `"Jwt:Key"`. For production, move this to environment variables.

### 3. Database

The application uses an **existing SQL Server database**. Do NOT run migrations against a production database without approval.

If setting up from scratch using the backup files:
1. Open SQL Server Management Studio
2. Restore `DB_Backups/ElsewedySchoolSysDB_DEV_23-12-2025_.bak` to a local SQL Server instance
3. Update the connection string to point to your local server

### 4. Build and Run the Backend

```powershell
cd "server/Api"
dotnet build
dotnet run
```

The backend starts on:
- **HTTP:** `http://localhost:5051`
- **Swagger UI:** `http://localhost:5051/swagger` (Development environment only)

### 5. Verify Backend is Running

Open `http://localhost:5051/swagger` in a browser. You should see the Swagger API documentation.

---

## Frontend Setup

### 1. Install Dependencies

```powershell
cd client
npm install
```

### 2. Configure API URL

The API base URL is set in `client/.env`:
```
VITE_API_BASE_URL=http://localhost:5051/api
```

This matches the default backend port. No changes needed for local development.

### 3. Run the Frontend Dev Server

```powershell
cd client
npm run dev
```

The frontend starts on:
- **URL:** `http://localhost:5173`

### 4. Build for Production

```powershell
cd client
npm run build
```

Output goes to `client/dist/`. Serve with any static file server or a reverse proxy (nginx, IIS).

---

## Running Both Together

Open two terminals:

**Terminal 1 (Backend):**
```powershell
cd "d:\Cab\Exams Project\Exam-Hub-main\server\Api"
dotnet run
```

**Terminal 2 (Frontend):**
```powershell
cd "d:\Cab\Exams Project\Exam-Hub-main\client"
npm run dev
```

Then open `http://localhost:5173` in your browser.

---

## Local URLs Summary

| Service | URL | Notes |
|---|---|---|
| Frontend (dev) | `http://localhost:5173` | Vite dev server |
| Backend API | `http://localhost:5051/api` | ASP.NET Core |
| Swagger UI | `http://localhost:5051/swagger` | Development only |

---

## First Login

After the application is running, log in with an existing database account.

> The application does not ship with default credentials. Use an account already in the `ElsewedySchoolSysDB` database, or create one via `POST /api/auth/register` using the Swagger UI.

Role-based redirect after login:
- **Student** → `/student`
- **Teacher / Admin** → `/teacher`
- **Board / Superadmin** → `/superadmin`

---

## Common Issues

### Backend won't start — SQL Server connection error
- Verify the server name in `appsettings.json` matches your SQL Server instance
- Confirm SQL Server is running: `Get-Service -Name MSSQL*` (PowerShell)
- Try switching to a connection string with explicit credentials if Windows auth is unavailable

### Frontend shows "Server unreachable"
- Confirm the backend is running on port 5051
- Check that `VITE_API_BASE_URL` in `.env` matches the backend URL
- Check browser console for CORS errors

### Login fails with "Invalid credentials"
- Confirm the account exists in the database
- The password must match what is stored (BCrypt, SHA256, or plaintext for legacy accounts)
- Seeded test accounts (`admin@quiz.local` etc.) may not work — see `AUTHENTICATION_AND_AUTHORIZATION.md` for the BusinessEntity mismatch issue

### Student sees no exams
- Verify the student's `StudentExtension.ClassId` is set in the database
- Confirm exams have a `ClassId` that includes the student's class ID
- Verify the exam `StartDate` has passed and `EndDate` has not

### JWT token expired mid-exam
- The token expires after 8 hours. If a student starts a long exam near expiry, they may be logged out.
- There is no token refresh mechanism. The student would need to log in again.
