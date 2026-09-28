# Exams Hub

Exams Hub is a web application for creating, organizing, delivering, and reporting on academic examinations. It supports teachers, students, and administrative users through a React frontend and a .NET Web API backend.

## Architecture

- `client/` — React application built with Vite.
- `server/Api/` — ASP.NET Core Web API targeting .NET 9.
- SQL Server — application data, question banks, exams, accounts, classes, and results.

## Technology Stack

### Frontend

- React
- Vite
- JavaScript and CSS
- Axios
- ExcelJS and FileSaver for report exports
- DOMPurify for safe rich-text rendering

### Backend

- ASP.NET Core .NET 9
- Entity Framework Core
- SQL Server
- JWT authentication and CAS SSO integration
- ClosedXML for Excel question templates and imports

## Prerequisites

- .NET 9 SDK
- Node.js and npm
- SQL Server access to the configured database
- IIS with the ASP.NET Core Hosting Bundle when using a framework-dependent deployment

## Local Development

### Backend

```powershell
cd server/Api
dotnet restore
dotnet run
```

The API normally runs on the URL configured in `server/Api/Properties/launchSettings.json`.

### Frontend

```powershell
cd client
npm install
npm run dev
```

The Vite development server normally runs at `http://localhost:5173`.

### Tests

Run frontend tests:

```powershell
cd client
npm run test:run
```

Run backend tests:

```powershell
dotnet test server/QuizesApi.Tests/QuizesApi.Tests.csproj
```

## Configuration

The API requires a database connection string and JWT settings at startup. Configure them through environment variables or deployment configuration:

```text
ConnectionStrings__DefaultConnection=<SQL Server connection string>
JWT_KEY=<JWT signing key>
JWT_ISSUER=CAS.Api
JWT_AUDIENCE=CAS.Clients
```

For local development, configuration can also be placed in `server/Api/appsettings.Development.json`. Production deployments should use IIS/server environment variables or a protected configuration store rather than committing secrets to source control.

## Excel Question Upload

Teachers can upload questions from the Question Bank editor or Quiz editor using an `.xlsx` file. The template is available through the **Download Template** button.

The template contains only the question table:

| Column | Header | Required |
|---|---|---|
| A | Question Type | Yes |
| B | Question Text * | Yes |
| C | Correct Answer * | Yes |
| D | Marks | No; defaults to 1 |
| E | Option A | No |
| F | Option B | No |
| G | Option C | No |
| H | Option D | No |

The importer locates the header row by its column names, so title or instruction rows are not imported as questions. Empty rows are ignored, and up to 1,000 questions can be uploaded per file.

### Supported question types

- **MCQ** — provide the correct answer and options A–D.
- **True/False** — use `True` or `False` as the correct answer.
- **Fill Blank** — leave the options empty and provide the expected answer.

### Math and rich text in Excel

Uploaded question text, options, and answers use the same rich-text renderer as questions created in the editor. Common notation is supported:

- `x^2` renders as x².
- `(a+b)^2` renders with the expression as a superscript.
- `H_2O` renders as H₂O.
- `^text^` and `~text~` support the editor's superscript and subscript notation.
- Line breaks are preserved.

Unicode symbols such as `²`, `³`, `√`, `π`, `≤`, and `≥` can also be entered directly in Excel.

For detailed upload examples, see [client/FILE_UPLOAD_GUIDE.md](client/FILE_UPLOAD_GUIDE.md).

## Production Deployment to IIS

From the repository root, create the repeatable self-contained deployment package with:

```powershell
dotnet publish .\server\Api\QuizesApi.csproj `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -o .\deployment\ExamHubApi
```

The package is created at:

```text
deployment/ExamHubApi/
```

Deploy the complete contents of this folder to the IIS API directory, including `QuizesApi.exe`, `web.config`, `appsettings.json`, and `appsettings.Production.json`. Then recycle the IIS application pool.

The self-contained package does not require the .NET runtime to be installed on the server, but IIS must have the `AspNetCoreModuleV2` IIS module installed.

If IIS returns `HTTP 500.30`, the API process failed to start. Check the Windows Event Viewer and IIS logs, and verify the deployed configuration and application-pool permissions.

## Project Structure

```text
Exam-Hub/
├── client/                 # React/Vite frontend
│   ├── src/                # Pages, components, utilities, and tests
│   └── package.json
├── server/
│   ├── Api/                # ASP.NET Core API
│   └── QuizesApi.Tests/    # Backend tests
├── deployment/             # Generated deployment output (local only)
└── README.md
```

## Security Notes

- Never share SSO callback URLs or JWT tokens in screenshots, logs, issues, or chat.
- Rotate any token or signing key that has been exposed.
- Keep production database credentials and JWT keys outside source control.
- Use HTTPS for all production traffic.

## License

See the repository license file for licensing details.
