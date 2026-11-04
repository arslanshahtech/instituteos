# Local email testing

InstituteOS can test account verification and organization invitations without a purchased domain or deployment.

## Start

1. Install Mailpit once on Windows:

   `winget install --id axllent.mailpit -e`

2. From the repository root, run:

   `npm run dev:local-email`

3. Open:
   - Web app: http://127.0.0.1:5173
   - Mailpit inbox: http://127.0.0.1:8025
   - API readiness: http://127.0.0.1:4000/api/v1/ready

The helper binds Mailpit to loopback only. SMTP is available at `127.0.0.1:1025`. It captures outgoing mail and never forwards it to real recipients. The helper overrides SMTP, email-verification, and development rate-limit settings only in the launched process. It does not edit `.env`; it uses the existing Atlas cluster credentials but explicitly selects the separate `instituteos_dev` database.

## Safe development test accounts

From the repository root, run:

```powershell
npm run seed:local
```

The helper derives a connection string locally from the existing `.env` Atlas URI but changes the database path to exactly `instituteos_dev`. The current `.env` database (which may be `test`) is never seeded. The helper refuses any target database other than `instituteos_dev`, performs idempotent upserts only, and never drops collections or deletes existing records. It does not print or modify the Atlas credentials and does not edit `.env`.

It creates and verifies these development accounts and their organization data:

- Admin: `admin@instituteos.test`
- Teacher: `teacher@instituteos.test`
- Parent: `parent@instituteos.test`
- One linked student for the Parent account
- One active class/section/subject assignment for the Teacher account

A random local-only password is stored outside the repository in a hidden file. Open it locally when you need to sign in:

```powershell
notepad "$env:LOCALAPPDATA\InstituteOS-Local-QA\password.txt"
```

Use that same password for the three accounts. The file is not committed to Git. Do not copy the password or Atlas URI into chat.

Then start the app:

```powershell
npm run dev:local-email
```

The local helper automatically targets the same `instituteos_dev` database, starts Mailpit, uses local SMTP, enables email verification, and raises the API's global request limit to 600 **only for this development process**. Production rate limits and production email credentials are unchanged. If you have a separate development URI, set `DEV_SEED_MONGODB_URI` in that PowerShell window; it must point to a database named exactly `instituteos_dev`.

## Role login URLs

- Organization Admin: http://127.0.0.1:5173/admin/login
- Teacher: http://127.0.0.1:5173/teacher/login
- Parent: http://127.0.0.1:5173/parent/login

Each role login checks the account's server-returned active organization membership before routing to that workspace. The invitation email alone does not create an InstituteOS password/account. A first-time invitee must register using the exact invited email, verify it when required, then return to the original invitation URL. An existing account with an unknown password must use Forgot password rather than registering a duplicate account.

## Teacher invitation test

1. Sign in with the existing Organization Admin account.
2. In Staff / Teachers, create one active teacher profile. Save the intended test email on that profile.
3. In Members, invite the exact same email with role `teacher`.
4. Open Mailpit and inspect the invitation. Open its localhost link.
5. Register or sign in using that exact email. If registration asks for email verification, open the verification email in Mailpit and use its link.
6. Continue to the invitation link. After acceptance, the account should open Teacher Workspace.
7. Assign the teacher to a class/section to test assigned teaching data.

The API requires exactly one active teaching staff profile matching the invitation email. The profile must be recognizable as a teaching profile (teacher/lecturer/professor/instructor/tutor/faculty designation or assigned subjects).

## Parent invitation test

1. Create one Guardian record with the test parent's email.
2. Link that Guardian to the relevant student(s).
3. In Members, invite the exact same email with role `parent_guardian`.
4. Open the invitation in Mailpit, then register/sign in with that email.
5. If prompted, verify the account using the verification email captured in Mailpit.
6. Continue to the invitation link. After acceptance, the account should open Parent Workspace and see only linked children.

The parent portal requires a verified account and exactly one Guardian record with the same email in the organization. Guardian-to-student links must already exist before testing.

For safe dummy recipients, use addresses such as `teacher.test@example.com` and `parent.test@example.com`. Mailpit captures the messages locally; no real inbox receives them.

## Stop

Stop the API/web processes with Ctrl+C in the terminal running the helper. Mailpit runs separately; close `mailpit.exe` from Task Manager or stop it from PowerShell when finished:

`Get-Process mailpit -ErrorAction SilentlyContinue | Stop-Process`
