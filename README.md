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
`npm run build`, and Output Directory `dist`. The configuration in
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

After deployment, open `https://508-group-project.vercel.app/api/health`.
It should return JSON containing `API is healthy`. HTML or a 404 indicates that
API forwarding is missing; a gateway error means the backend must be checked.
The browser uses `/api` on the frontend domain for both login and refresh cookies.

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
any user accounts beyond the bootstrap administrator. No sessions, courses, students, results,
staff users, grading rules, or system settings are seeded. The administrator assigns users to the
appropriate faculty and department through the secured application, then result officers digitize
the department's real historical records.

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
  PDF/image OCR through Google Document AI when the optional `OCR_*` environment variables are
  configured. OCR produces a review-only draft: staff must correct any doubtful matric number or score
  and explicitly save it; the normal HOD approval still applies. The original scan is not retained by
  the API after this review session. With `OCR_PROVIDER=none` (the default), manual entry and CSV/Excel
  upload continue to work but scan processing is disabled.
- **Deployment**: this README intentionally does not include a platform-specific deployment guide
  (Render/Railway/Docker/etc.) — that was scoped out in favor of a correct, well-tested local dev
  setup. The app has no deployment-specific code paths to work around (env-var driven config
  throughout), so standard Node + MongoDB hosting instructions for any platform apply.
