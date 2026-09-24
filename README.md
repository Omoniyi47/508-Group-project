# Computerized Transcript Digitization & Result Retrieval System

A production-ready MERN application for a university department: digitize paper results, compute
GPA/CGPA and degree classification against configurable institutional grading rules, run a
role-based approval workflow from result entry through transcript release, and generate
professional, printable transcripts (PDF/Excel) — with a full immutable audit trail behind every
sensitive change.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite, Tailwind CSS v4, React Router v7 (library mode), React Hook Form + Zod, Axios, Recharts, Sonner |
| Backend | Node.js + Express 5, Mongoose 9, Zod validation, JWT + bcrypt auth, Winston logging |
| Database | MongoDB (local `mongod` service or Atlas) |
| File processing | PapaParse (CSV), ExcelJS (Excel import/export), Multer (uploads), Puppeteer (PDF export) |
| Testing | Vitest + Supertest + mongodb-memory-server (backend), Vitest + React Testing Library (frontend) |

See the "Interactive API docs" section below for the live Swagger API reference.

## Architecture at a glance

- **`server/`** — Express API. Routes → controllers → Mongoose models, with shared middleware for
  auth (`protect`/`authorize`/`scopeToDepartment`), Zod validation, centralized error handling, and
  request sanitization. A generic CRUD factory (`services/crudFactory.js`) powers the simple
  reference-data modules (Faculty/Department/Session/Semester/Level/Course/GradingRule/User) with
  built-in pagination, search, and dependent-record delete guards; Students/Results/Transcripts have
  bespoke controllers for their workflow logic.
- **`client/`** — Vite SPA. A shared `common/` component library (Button, Input, Select, DataTable,
  Modal, ConfirmDialog, StatusBadge, StatCard, FileDropzone, etc.) backs every page; role-based
  routing (`RoleGuard`) and a role-specific dashboard (`AdminDashboard`, `ResultOfficerDashboard`,
  `HodDashboard`, `TranscriptOfficerDashboard`) per the four roles below.
- **Auth**: short-lived JWT access tokens (`Authorization: Bearer`) + a rotating opaque refresh
  token in an httpOnly cookie. Access tokens are held in memory on the client only (never
  `localStorage`), reducing XSS token-theft exposure.
- **Audit trail**: every sensitive mutation (grade edits, approvals, rejections, merges, exports,
  settings changes, backups) writes an immutable `AuditLog` entry (old value, new value, actor, IP,
  timestamp, reason where applicable) — the model has no update/delete route and a schema-level
  guard rejects any attempt to modify or remove an entry, even from a script.

### Roles & permissions

| Role | Scope | Can do |
|---|---|---|
| **Administrator** | System-wide | Everything: users, academic structure, grading rules, system settings, audit trail, backups |
| **Departmental Result Officer** | Own department | Manual result entry, CSV/Excel upload, edit draft/rejected results, manage own department's students |
| **Head of Department (HOD)** | Own department | Approve/reject submitted results, approve/reject transcript requests, department dashboard |
| **Transcript Officer** | Cross-department | Duplicate-student review queue, transcript request verification, PDF/Excel export |

### Core workflows

- **Result lifecycle**: `draft → submitted → approved | rejected → (back to draft)`. A unique
  `(student, course, session, semester)` index blocks duplicate entries at the database level.
- **Bulk import**: upload → parse (CSV/Excel) → validate every row against the same Zod schema used
  for manual entry → preview (valid/warning/error per row) → explicit **Confirm & Save** commits only
  the valid rows. Nothing is ever saved silently.
- **Duplicate detection**: on student creation, a Levenshtein-distance name-similarity check flags
  likely duplicates into a review queue instead of blocking creation; an admin/Transcript Officer
  resolves each as **merge** (results and transcript requests are reassigned to the kept record, not
  orphaned — a genuine duplicate result for the same course/session/semester is dropped rather than
  double-counted) or **confirm distinct**. The same name-similarity check also guards new *user*
  accounts, requiring explicit confirmation before creating a near-duplicate staff record.
- **Transcript workflow**: `requested → verified → approved | rejected → released`. On approval, the
  computed transcript (per-semester GPA, running CGPA, credits, failed/repeated courses,
  classification) is frozen into a snapshot, so a later result correction can't retroactively alter
  an already-approved/exported transcript.
- **GPA/CGPA engine** (`server/src/services/gpaEngine.js`): pure functions with no DB calls, driven
  entirely by the active `GradingRule` document (grade bands, points, classification bands) — nothing
  is hardcoded, so an institution can redefine its scale without a code change. Unit tested directly.

## Prerequisites

- Node.js ≥ 20
- MongoDB running locally (default `mongodb://127.0.0.1:27017`) or an Atlas connection string
- ~300MB free disk space for Puppeteer's bundled Chromium (used for PDF export)

## Setup

```bash
# 1. Server
cd server
npm install
cp .env.example .env      # then fill in real secrets (see below)
npm run seed               # creates the bootstrap administrator and supplied faculty/department structure
npm run dev                 # http://localhost:5000

# 2. Client (separate terminal)
cd client
npm install
npm run dev                 # http://localhost:5173, proxies /api to the server
```

### Required `.env` values (`server/.env`)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Long random strings — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | Frontend origin, for CORS (`http://localhost:5173` in dev) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Bootstrap administrator, created by `npm run seed`. This is the **only** account seeded from config — every other user (including additional admins) is created afterward through the Users screen by someone holding these credentials, so treat this password like a production secret |

See `server/.env.example` for the complete list (rate limiting, logging, token lifetimes).

## Vercel frontend and Render backend

Configure the Vercel project with Root Directory `client`, Build Command
`npm run build`, and Output Directory `dist`. Data requests, uploads, and downloads
use the Render `API_BASE_URL` in `client/src/api/axiosClient.js`.
Login, session refresh, and logout use `/api` on the frontend's own origin so
session recovery does not depend on third-party cookies. The configuration in
`client/vercel.json` forwards `/api/*` to
`https://five08-group-project.onrender.com/api/*` before falling back to
`index.html` for React routes such as `/login`. Update that destination if the
backend hostname changes. `VITE_API_PROXY_TARGET` only configures local development;
it does not forward requests in the deployed site.

In the Render service's environment settings, set:

```dotenv
NODE_ENV=production
CLIENT_URL=https://508-group-project.vercel.app
```

`CLIENT_URL` is the frontend origin, without a trailing slash or `/login` path.
Keep `MONGO_URI` as the MongoDB connection string. Supply all the other required
server environment variables on Render as well. Editing a local `.env` does not
update the hosted service. Redeploy Render after changing its settings and deploy
the updated client files to Vercel.

After deployment, open `https://five08-group-project.onrender.com/api/health`.
It should return JSON containing `API is healthy`. Render must allow the exact
frontend origin through `CLIENT_URL`. For local frontend testing against Render,
the backend's CORS configuration must also permit the local frontend origin.
Auth requests go through the Vercel rewrite (or Vite's development proxy), which
forwards them to the same Render backend and returns its HttpOnly refresh cookie
on the frontend domain. On reload, the app waits for one shared refresh request
before rendering protected pages. Access tokens stay in memory; the old local
storage session cache is removed. After deploying this auth routing change, sign
in once to establish the cookie on the Vercel domain. Subsequent reloads restore
the session until the refresh cookie expires or you sign out.

If login returns `Invalid email or password`, check that the account exists in
the database used by Render. For a new database, run `npm run seed` from `server`
with that database's environment configured to create the bootstrap administrator.
Changing `ADMIN_PASSWORD` in the environment does not reset an existing account;
the seed script skips administrators that already exist.

## First administrator account

`npm run seed` creates the administrator defined by `ADMIN_NAME`, `ADMIN_EMAIL`, and
`ADMIN_PASSWORD` in `server/.env`. Sign in with those values, then create Result Officers, HODs,
Transcript Officers, and any additional administrators from the Users screen. Credentials are never
stored in source code.

The supplied institution structure (14 faculties and their departments) is seeded without creating
any user accounts beyond the bootstrap administrator. The seed also creates missing session labels
from 1962/1963 through 2026/2027, levels 100–600, and environment-configured system settings.
No courses, students, results, staff users, or grading rules are seeded. The administrator assigns users to the
appropriate faculty and department through the secured application, then result officers digitize
the department's real historical records.

For an existing database with empty student dropdowns, run `npm run seed:student-references`
from `server/`. This only inserts missing sessions and levels, preserving existing IDs, dates,
and current-session selections. Refresh the Students page afterward.

The session range starts with OAU's [1962/1963 first session](https://fss.oauife.edu.ng/about-the-department/)
and ends with its [announced 2026/2027 admission session](https://oauife.edu.ng/oau-2026-post-utme-screening-exercise-new-date-announced/)
(sources checked September 24, 2026). Intermediate year labels are generated continuously;
this is not an independently verified calendar of every historical session. Seeded start/end
dates are January 1 of the first year and December 31 of the second year, marked
`datesAreEstimated: true`. They support ordering, not claims about teaching dates.
Administrators can replace them under Sessions and clear the placeholder checkbox after
checking official calendars. No session is automatically marked current.

## Scripts

| | Server (`server/`) | Client (`client/`) |
|---|---|---|
| Dev server | `npm run dev` | `npm run dev` |
| Production build/start | `npm start` | `npm run build` / `npm run preview` |
| Tests | `npm test` | `npm test` |
| Seed administrator | `npm run seed` | — |
| Lint | — | `npm run lint` |

## Testing

- **Backend** (`server/npm test`): Vitest + Supertest against a real Express app instance, with
  `mongodb-memory-server` providing an isolated in-memory MongoDB per run — no shared state with your
  dev database. Covers auth (login/refresh/RBAC), every academic CRUD module, student
  duplicate-detection and the verification-queue merge cascade, the full result lifecycle and CSV
  upload wizard, the GPA/CGPA engine (pure unit tests), the transcript request workflow and
  PDF/Excel export, audit log immutability and filtering, system settings, and backups.
- **Frontend** (`client/npm test`): Vitest + React Testing Library — login form validation and
  submission, role-based route guarding, and the search-input debounce hook.

## Interactive API docs

A live Swagger UI is mounted at `http://localhost:5000/api/docs` when the server is running,
covering the core Auth/Students/Results/Transcripts flows with "try it out" support (paste an
access token via the Authorize button). It is the complete, always-accurate
reference for every endpoint — it's generated directly from the route/controller/validator source,
not written by hand, so it can't drift from the real behavior.

## Security notes

- Passwords hashed with bcrypt (cost 12); JWT access tokens are short-lived (15 min default) and
  held in memory only on the client; refresh tokens are opaque (not JWTs), stored server-side as a
  SHA-256 hash, rotated on every use, and revoked on reuse-after-rotation (replay detection).
- Role + department scoping is enforced server-side on every request (not just hidden in the UI).
- Request bodies/params/query are recursively stripped of `$`-prefixed and `__proto__`/`constructor`
  keys (a small custom middleware, not the `express-mongo-sanitize` package — that package tries to
  reassign `req.query`, which is a getter-only property under Express 5 and throws).
- Rate limiting on `/api/auth/login`; Helmet security headers; CORS locked to `CLIENT_URL`.
- **Known, accepted transitive vulnerabilities**: `exceljs`'s bundled zip dependencies
  (`archiver`/`glob`/`minimatch`/`brace-expansion`) have open advisories; the vulnerable code paths
  (glob-pattern matching) are never reached with user-controlled input in this app's usage, and the
  only upstream fix is a downgrade to an old `exceljs` major. Similarly, `react-router` has an open
  advisory specific to RSC/framework mode with server actions — this app uses React Router in plain
  client-side library mode with no server actions, so that code path is unreachable here.

## Known limitations

- **OCR requires institution-owned provider credentials.** The result upload screen supports scanned
  PDF/image OCR through Amazon Textract when the backend AWS environment variables below are
  configured. OCR produces a review-only draft: staff must correct any doubtful matric number or score
  and explicitly save it; the normal HOD approval still applies. Scans are uploaded temporarily to
  a private S3 bucket and deletion is attempted after processing, including failed requests.
  With `OCR_PROVIDER=none` (the default), manual entry and CSV/Excel
  upload continue to work but scan processing is disabled.
- **Deployment**: this README intentionally does not include a platform-specific deployment guide
  (Render/Railway/Docker/etc.) — that was scoped out in favor of a correct, well-tested local dev
  setup. The app has no deployment-specific code paths to work around (env-var driven config
  throughout), so standard Node + MongoDB hosting instructions for any platform apply.

### Amazon Textract OCR configuration

Set these values in `server/.env` and in the Render backend's environment settings:

```dotenv
OCR_PROVIDER=amazon_textract
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
AWS_TEXTRACT_S3_BUCKET=
OCR_TEXTRACT_TIMEOUT_MS=180000
```

Fill in the access key and secret key for an IAM identity with Textract/S3 access.
`AWS_SESSION_TOKEN` is only needed for temporary AWS credentials. Use a private
S3 bucket in the same region as `AWS_REGION`; enter its bucket name, not an S3 URL.
Keep these credentials on the backend, never in a `VITE_*` variable or frontend file.
The local credential fields are intentionally empty until real AWS values are supplied.
Restart/redeploy the backend after changing its environment.

Required permissions are `textract:StartDocumentAnalysis` and
`textract:GetDocumentAnalysis`, plus `s3:PutObject`, `s3:GetObject`, and
`s3:DeleteObject` for `arn:aws:s3:::YOUR_BUCKET/ocr-input/*`. If bucket versioning is
enabled, also allow `s3:GetObjectVersion` and `s3:DeleteObjectVersion`. Objects use
SSE-S3 encryption (`AES256`). Configure a lifecycle rule for `ocr-input/` to expire
current/noncurrent objects as a fallback if the server stops or deletion fails.

The backend uses [Textract's asynchronous table analysis](https://docs.aws.amazon.com/textract/latest/APIReference/API_StartDocumentAnalysis.html)
for multipage PDF/TIFF support and retrieves every result page before returning the
existing preview response. The existing 15MB upload limit and review/correct/confirm
flow are unchanged. WebP files and JPEG/PNG files over Textract's 10MB image limit
are converted to lossless TIFF in memory, preserving scan resolution. Other
[Textract document limits](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html)
still apply, including unencrypted PDFs and image dimensions up to 10,000 pixels.
Incomplete provider results are rejected instead of silently importing some pages.
The request waits up to `OCR_TEXTRACT_TIMEOUT_MS` (default three minutes, maximum
ten minutes); use smaller scans if the hosting request timeout is shorter.
Textract's analysis results remain retrievable from AWS for seven days, independently
of deletion of the temporary S3 input. See [GetDocumentAnalysis](https://docs.aws.amazon.com/textract/latest/APIReference/API_GetDocumentAnalysis.html).
