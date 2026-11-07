# Known Issues and Limitations

## Security Limitations

### S-1 — Plaintext Password Fallback (Medium)
**Location:** `server/Api/Services/AuthService.cs` → `LoginAsync()`

The login service has a three-layer password verification chain. The third layer compares the submitted password directly to the stored hash string (plaintext comparison). This allows legacy accounts with plaintext stored passwords to log in.

**Impact:** Accounts with plaintext passwords are vulnerable if the database is compromised.  
**Fix required:** Database-level password migration to BCrypt. Cannot be done without modifying database records.  
**Status:** Deferred — requires explicit approval.

---

### S-2 — JWT Key in appsettings.json (Low-Medium)
**Location:** `server/Api/appsettings.json`

The JWT signing key is stored in a source-controlled configuration file.

**Impact:** If the repository is public or the file is leaked, JWT tokens can be forged.  
**Fix:** Move the key to environment variables or a secrets manager.  
**Status:** Infrastructure concern, out of scope for current phases.

---

### S-3 — Broad CORS Policy (Low)
**Location:** `server/Api/Program.cs`

`AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()` is configured.

**Impact:** Any website can make API calls to the backend.  
**Fix:** Restrict to known frontend origins for production.  
**Status:** Acceptable for internal school deployment; should be addressed for public deployment.

---

### S-4 — BusinessEntity Mismatch for Seeded Test Accounts (Low)
**Location:** `server/Api/Models/ElsewedySchoolContextSeed.cs`

The seed script creates accounts with `BusinessEntityName = "Quizes System"`, but the login query filters by `BusinessEntityName = "Exams"`. Seeded test accounts receive empty role lists and fail all role-based authorization.

**Impact:** Test accounts (`admin@quiz.local`, `teacher@quiz.local`, `student@quiz.local`) cannot be used for integration testing.  
**Fix:** Update seed to use `"Exams"`, or create new accounts via the register endpoint.  
**Status:** Known. Not blocking for production accounts.

---

## Architecture Limitations

### A-1 — ClassId Stored as Comma-Delimited String (Low)
**Location:** `server/Api/Models/ExamDetail.cs` (column `Class_ID`)

The `ExamDetail.ClassId` column stores multiple class IDs as a comma-delimited string (e.g. `",5,8,12,"`). This violates database normalization and makes SQL-side filtering unreliable.

**Impact:** Class filtering requires string parsing in C# or complex LIKE queries.  
**Fix:** Requires a database schema change (junction table). Out of scope.  
**Status:** Accepted limitation.

---

### A-2 — DashboardRepo Contains Mixed Responsibilities (Low)
**Location:** `server/Api/Repositories/Implementation/DashboardRepo.cs`

The `DashboardRepo` contains analytics calculations, caching logic, and DTO construction — responsibilities that belong in a service layer.

**Impact:** Makes the class harder to unit test and maintain.  
**Status:** Intentionally deferred in Phase 4 to preserve caching correctness. Candidates for future refactoring.

---

### A-3 — No Token Refresh Mechanism (Low-Medium)
**Location:** Frontend authentication flow

JWT tokens expire after 8 hours. There is no refresh token or silent re-authentication mechanism.

**Impact:** A student whose session expires mid-exam will be logged out, losing their in-progress state (though sessionStorage persists answers).  
**Status:** Not implemented. Low priority for internal use.

---

### A-4 — App.jsx is Empty (Informational)
**Location:** `client/src/App.jsx`

The `App` component returns `null`. All routing and application logic is in `main.jsx`.

**Impact:** None functional, but confusing for new developers.  
**Status:** Cosmetic. Could be cleaned up or documented inline.

---

## Performance Limitations

### P-1 — ExamRepo.GetAllAsync Loads All Exam Records (Low)
**Location:** `server/Api/Repositories/Implementation/ExamRepo.cs` → `GetAllAsync()`

All exams are loaded with `Include(e => e.Subject)` without any pagination or filtering at the database level.

**Impact:** As the exam count grows, this call will slow down. Mitigated in Phase 5 for link/question loading; exam list itself is not paginated.  
**Status:** Acceptable for current scale. Pagination can be added when needed.

---

### P-2 — No Pagination on Any Endpoint (Low)
**Impact:** All list endpoints (`/api/examdetail`, `/api/questionbank`, `/api/dashboard/students`) return all records.  
**Status:** Not a problem at current scale. Future improvement.

---

## Frontend Limitations

### F-1 — Forgot Password Link Has No Action
**Location:** `client/src/pages/LoginPage.jsx`

The "Forgot password?" link is an `<a href="#">` with no handler.

**Impact:** Users cannot reset their passwords from the UI.  
**Status:** Feature not implemented.

---

### F-2 — Profile Background Color Debugging Artifact
**Location:** `client/src/pages/StudentPage.jsx`

```jsx
background: currentSection === 'profile' ? 'yellow' : 'var(--bg-surface)'
```

The yellow background on the profile section is a development debugging artifact.

**Impact:** Cosmetic — yellow background appears when navigating to the Profile section.  
**Status:** Not fixed per Phase 3 instructions ("excluded — unrelated to Phase 3"). Should be fixed in a future cleanup pass.

---

### F-3 — Register Account Only via API
**Impact:** New accounts can only be created by directly calling `POST /api/auth/register` (e.g. via Swagger). There is no UI registration form.  
**Status:** By design for the current school context.

---

### F-4 — Question Shuffle: Correct-Answer Index in Review
**Location:** `client/src/pages/StudentPage.jsx` → `startExam()`, `reviewExam()`

Questions are shuffled when an exam starts. The backend stores the text value of the correct answer. The frontend maps letter answers (A/B/C/D) to option indices for display. After shuffling, this mapping can become misaligned if the review endpoint returns questions in a different order than the shuffled order.

**Impact:** In review mode, the highlighted "Correct Answer" option may occasionally be incorrect in the UI display. The grading itself (done server-side) is always correct.  
**Status:** Phase 3 noted. The shuffled order is restored from sessionStorage; if the session is cleared, the review uses the unsorted server order.

---

## Unimplemented Features

| Feature | Notes |
|---|---|
| Password reset | No email service, no reset endpoint |
| User registration UI | API-only |
| Email notifications | Not implemented |
| Token refresh | 8-hour hard expiry |
| Pagination | All lists return all records |
| Audit trail | No action history logging |
| Multi-language UI | Arabic names stored but UI is English-only |
