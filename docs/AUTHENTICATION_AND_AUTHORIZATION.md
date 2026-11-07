# Authentication and Authorization

## Overview

Exam-Hub uses **JWT Bearer token authentication** with **role-based authorization**. Roles are tied to a specific `BusinessEntity` (`"Exams"`), allowing the same database to serve multiple applications.

---

## Registration

**Endpoint:** `POST /api/auth/register`  
**File:** `server/Api/Services/AuthService.cs` → `RegisterAsync()`

1. Password strength is validated (minimum 8 characters, uppercase, lowercase, digit).
2. Role is resolved. `"Admin"` and `"Superadmin"` are mapped to `"Board"` in the `"Exams"` entity.
3. A role record is looked up in `Roles WHERE BusinessEntity = 'Exams'`.
4. The account is created with the password hashed using **BCrypt**.
5. An `AccountRole` entry is created linking the account to the role with `BusinessEntityName = 'Exams'`.
6. A `Login` table entry is created (primary authentication table).

---

## Login

**Endpoint:** `POST /api/auth/login`  
**File:** `server/Api/Services/AuthService.cs` → `LoginAsync()`

### Account lookup
1. First checks the `Login` table by email.
2. If not found or inactive, falls back to the `Account` table.

### Password verification (three-layer fallback)
```
1. BCrypt.Verify(inputPassword, storedHash)     ← primary (new accounts)
2. SHA256(inputPassword) == storedHash           ← legacy hash format
3. inputPassword.Trim() == storedHash.Trim()     ← plaintext fallback (legacy data)
```

> **Security note:** The plaintext fallback is a known limitation inherited from legacy data. It is logged as a warning when triggered. Removing it requires a database-side password migration.

### JWT generation
After password verification:
1. Roles are loaded from `AccountRoles WHERE BusinessEntityName = 'Exams'`.
2. A JWT is generated with:
   - `sub` = `account.Id.ToString()`
   - `email` = `account.Email`
   - One `ClaimTypes.Role` claim per role
   - Expiry: **8 hours**
   - Signed with HMAC-SHA256

---

## JWT Claims Structure

```
{
  "sub": "42",                          ← AccountId (as string)
  "email": "student@example.com",
  "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": "Student",
  "exp": 1762000000                      ← 8-hour expiry
}
```

The ASP.NET Core JWT middleware automatically maps the `sub` claim to `ClaimTypes.NameIdentifier` (the long URI form). This is how `ClaimsHelper.GetRequesterInfo()` reads the `AccountId`.

---

## Token Storage (Frontend)

After login, the token is stored via `client/src/utils/storage.js`:
- **"Remember Me" checked:** stored in `localStorage` (survives browser close)
- **"Remember Me" unchecked:** stored in `sessionStorage` (cleared on tab close)

The Axios interceptor in `client/src/api/axios.js` attaches `Authorization: Bearer <token>` to every request.

On 401 response, the interceptor removes the token and redirects to `/`.

---

## Role Definitions

| Role | BusinessEntity | Access level |
|---|---|---|
| `Student` | Exams | Exam taking, own results only |
| `Teacher` | Exams | Exam management, question banks, analytics |
| `Board` | Exams | Full administrative access (mapped from Admin/Superadmin on register) |
| `Admin` | Quizes System | Legacy seed role (does not appear in JWT for production accounts) |
| `Superadmin` | Quizes System | Legacy seed role |

> **Important:** Production accounts created via `POST /api/auth/register` use `BusinessEntityName = 'Exams'`. Seeded test accounts use `BusinessEntityName = 'Quizes System'`. The login query filters by `'Exams'`, so seeded test accounts will receive **empty role lists** in their JWT and will fail role-based authorization checks.

---

## Authorization Attributes

### Controller-level
```csharp
[Authorize]                                           // any authenticated user
[Authorize(Roles = "Teacher,Admin,Board,Superadmin")] // staff only
[Authorize(Roles = "Admin,Board,Superadmin")]         // admin only
[Authorize(Roles = "Student")]                         // students only
```

### Policy-based (defined in Program.cs, available but not heavily used)
```csharp
"StudentOnly"     → RequireRole("Student")
"TeacherOnly"     → RequireRole("Teacher")
"SuperadminOnly"  → RequireRole("Superadmin", "Admin", "Board")
"TeacherOrAdmin"  → RequireRole("Teacher", "Superadmin", "Admin", "Board")
```

---

## Ownership Validation

**File:** `server/Api/Helpers/ClaimsHelper.cs`

All student-specific endpoints validate that the authenticated user is accessing their own data:

```csharp
var (requesterId, roles) = ClaimsHelper.GetRequesterInfo(User);

if (!ClaimsHelper.IsStaff(roles) && requesterId != accountId)
    return StatusCode(403, ...);
```

- **Staff roles** (Teacher, Admin, Board, Superadmin) bypass ownership checks.
- **Students** can only access their own `accountId`.
- The `AccountId` in the request body is **never** used for authorization — only the JWT claim.

---

## Student Access Rules

A student may:
- Read their own profile (`GET /api/auth/profile/{id}` — own `id` only)
- List exams assigned to their class (`GET /api/examdetail`)
- Start an exam in their class that they haven't submitted yet
- View their own completed exam answers
- Submit their own exam answers

A student may NOT:
- Read another student's results or answers (403)
- Submit answers with a different student's `accountId` in the JWT
- Access correct answers before submission
- Access Teacher or Admin endpoints (403)
- Re-access the exam start endpoint after submission (403)

---

## Staff Access Rules

**Teachers** may:
- Access all exams (not filtered by class)
- Manage question banks
- View student dashboards and answers for any student
- Create and edit exams (not delete — that requires Admin)

**Admin / Board / Superadmin** may:
- All teacher permissions
- Delete exams
- Delete questions
- Access system-wide analytics
- View and manage teacher accounts

---

## Protected Route (Frontend)

**File:** `client/src/components/ProtectedRoute.jsx`

The frontend `ProtectedRoute` component:
1. Checks for a stored token.
2. Parses the JWT payload (base64 decode, no signature verification).
3. Extracts roles from the payload.
4. Compares against `allowedRoles` prop.
5. Redirects to the appropriate page if unauthorized.

> **Note:** Frontend route guards are convenience only. All security is enforced server-side via `[Authorize]` attributes and ownership checks.

---

## Known Security Limitations

1. **Plaintext password fallback:** Legacy accounts with plaintext stored passwords can authenticate. Should be removed after migration.

2. **JWT key in appsettings.json:** The signing key is stored in source-controlled configuration. Should be moved to environment variables or a secrets manager before production deployment.

3. **Broad CORS policy:** `AllowAnyOrigin()` is configured. Acceptable for internal school use but should be restricted for public deployments.

4. **Token expiry is 8 hours with no refresh:** There is no token refresh mechanism. A student mid-exam when their token expires would be logged out. The `timeRemaining` timer in the frontend is based on exam `EndDate`, not token expiry.

5. **`BusinessEntity` mismatch for seeded accounts:** The database seed script uses `"Quizes System"` while the application uses `"Exams"`. Seeded test accounts receive empty roles and cannot pass role-based authorization.
