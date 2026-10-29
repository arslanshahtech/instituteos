# InstituteOS Deployment Runbook

This runbook is for the current monorepo layout. It is not evidence that a production deployment has already been created.

## Recommended first deployment topology

- **Frontend:** Vercel static SPA, built from the repository root.
- **API:** Render Node.js web service, built from the repository root.
- **Database:** MongoDB Atlas replica-set cluster.
- **Domains:** use two HTTPS subdomains of the same domain you own, such as `app.example.pk` and `api.example.pk`. Replace the examples with your actual domain.

### Why same-parent subdomains matter

The browser API client uses credentialed requests and a readable CSRF cookie, while the session cookie is HttpOnly and uses `SameSite=Strict`. Separate unrelated provider domains (for example, a default `.vercel.app` frontend and `.onrender.com` API) can break cookie/CSRF behavior. Use a shared owned parent domain for the frontend and API, configure `AUTH_CSRF_COOKIE_DOMAIN` for that parent domain, and explicitly test sign-in and a CSRF-protected mutation in a real browser. Do not set the cookie domain to a public suffix or a domain you do not control.

## 1. Prepare MongoDB Atlas first

1. Create a production project/cluster that supports replica-set transactions. Finance receipts/payments and several organization/attendance workflows use MongoDB transactions; a standalone local MongoDB instance is not a valid production substitute for those paths.
2. Create a dedicated database user with only the permissions the application needs. Use a strong generated password and store the URI only in the API service's secret environment configuration.
3. Restrict Atlas network access to the API host's known outbound IP range or an approved private networking option. Do not use `0.0.0.0/0` as an unreviewed shortcut.
4. Enable an appropriate automated backup policy for the chosen cluster tier. Confirm the plan's retention/restore capabilities and run an actual restore into a separate test cluster before importing real school records.
5. Use a production database name different from development and staging. Verify required unique indexes and run a transaction smoke test in staging.

References: [Atlas security setup](https://www.mongodb.com/docs/atlas/setup-cluster-security/), [Atlas backup and restore](https://www.mongodb.com/docs/atlas/backup-restore-cluster/).

## 2. Deploy the API on Render

Create a Node.js web service connected to the Git repository, using the repository root as the service root directory.

| Setting           | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Build command     | `npm ci && npm run build --workspace @instituteos/api`             |
| Start command     | `npm run start --workspace @instituteos/api`                       |
| Health check path | `/api/v1/ready`                                                    |
| Runtime           | Node.js 22 or newer compatible with the root `engines` requirement |

Set runtime environment variables in the Render dashboard; never upload the local `.env` file.

| Variable                                   | Value / rule                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                                   |
| `MONGODB_URI`                              | Atlas SRV URI; secret                                                                          |
| `API_HOST`                                 | Leave unset so production defaults to `0.0.0.0`, or explicitly set `0.0.0.0`                   |
| `PORT`                                     | Let Render provide it; the server now prefers `PORT` over `API_PORT`                           |
| `AUTH_COOKIE_SECURE`                       | `true`                                                                                         |
| `AUTH_REQUIRE_EMAIL_VERIFICATION`          | `true`                                                                                         |
| `AUTH_WEB_APP_URL`                         | Public HTTPS frontend URL                                                                      |
| `CORS_ORIGINS`                             | Exact frontend origin only, e.g. `https://app.example.pk`                                      |
| `AUTH_CSRF_COOKIE_DOMAIN`                  | Shared parent domain only, e.g. `.example.pk`; omit until your actual owned domain is selected |
| `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` | Approved SMTP provider values; password is secret                                              |
| `PLATFORM_ADMIN_EMAIL`                     | One exact allowlisted platform-admin email                                                     |
| `API_TRUST_PROXY_HOPS`                     | Set to the actual documented trusted proxy-hop count; do not guess                             |

Do not set `API_HOST=127.0.0.1` in the hosted service. A hosted web process must bind to `0.0.0.0` and its assigned `PORT`. Source: [Render web-service port binding](https://render.com/docs/web-services).

After the first healthy deploy, register the custom API domain (e.g. `api.example.pk`) and verify its HTTPS certificate before pointing the frontend at it.

## 3. Deploy the frontend on Vercel

Create a Vercel project using the repository root, not `apps/web`, so npm workspaces can use the root lockfile.

- Install command: `npm ci`
- Build command: `npm run build --workspace @instituteos/web`
- Output directory: `apps/web/dist`
- Set `VITE_API_BASE_URL=https://api.example.pk/api/v1` to the actual custom API URL **before the build**. Vite environment values are bundled into the frontend at build time; redeploy after changing them.
- Add the custom frontend domain (e.g. `app.example.pk`).

The root `vercel.json` provides SPA rewrites so browser refresh/deep links resolve to `index.html`. Source: [Vercel Vite SPA deployment](https://vercel.com/docs/frameworks/frontend/vite).

Then set `AUTH_WEB_APP_URL`, `CORS_ORIGINS` and `AUTH_CSRF_COOKIE_DOMAIN` on the API service to match the actual live domains. Redeploy both services after all domains and environment variables are final.

## 4. Email and administrator bootstrap

1. Configure a real approved SMTP sender/domain. Test registration verification and password-reset delivery to at least two test mailboxes. Verify the links open the deployed frontend, not localhost.
2. Register the allowlisted platform-admin email through the normal production registration flow and complete email verification.
3. Run the documented bootstrap command once, from the API workspace, for that exact allowlisted email: `npm run bootstrap:platform-admin -- --email <same-email> --confirm-bootstrap`.
4. Verify a second ordinary account cannot acquire platform-admin access. Never put a bootstrap password or real email credentials in source control.

## 5. Staging verification

After both services have HTTPS custom domains and Atlas staging is connected, run:

```powershell
$env:API_ORIGIN = 'https://api-staging.example.pk'
$env:WEB_ORIGIN = 'https://app-staging.example.pk'
npm run smoke:staging
```

This read-only script checks API liveness, database readiness, credentialed CORS for the configured frontend origin, and the frontend HTML response. It does not create/edit data and does not replace the manual checklist below.

### Manual authenticated smoke checks

Use a test organization and synthetic records only.

- [ ] Register a test account; verify email; sign in; hard refresh; session remains valid.
- [ ] Browser devtools shows the session cookie is Secure, HttpOnly and SameSite=Strict; it is not readable by JavaScript.
- [ ] The CSRF cookie is Secure and SameSite=Strict, readable by the frontend on the configured parent domain, and absent from untrusted unrelated domains.
- [ ] Save one harmless organization setting; missing/wrong CSRF header is rejected; correct request succeeds.
- [ ] Sign out; the old session can no longer access a protected endpoint.
- [ ] Password reset mail points to staging frontend and a single-use reset invalidates earlier sessions.
- [ ] Create a synthetic student, mark attendance, generate an invoice, record a partial then remaining payment, and confirm receipt/ledger totals reconcile.
- [ ] Confirm a second organization cannot read or change the first organization's records.
- [ ] Confirm `/api/v1/health` is HTTP 200 and `/api/v1/ready` reports ready only when the database/index initialization is healthy.
- [ ] Print/download one fee receipt and test the application on a low-cost Android phone and a weak-but-usable mobile data connection.
- [ ] Take a backup and prove restoration into an isolated test cluster.

## 6. Release, rollback and monitoring

- Require GitHub Actions CI to pass for the release commit. The CI workflow runs lint, typecheck, tests, and build; it is not a production backup or security check.
- Configure alerts for API downtime, readiness failures, repeated database disconnects and failed deploys. Logs must not contain passwords, cookies, tokens, OTPs or school/student data.
- Before a schema/index migration or new release, confirm a recent successful backup and know the rollback steps. If a migration is not backward compatible, use an explicit planned maintenance window.
- Keep staging and production credentials/databases separate; never copy a real school's student data into preview deployments.
- Document the person responsible for urgent incidents, response windows, maintenance notices, customer data export and offboarding.

## 7. Current boundary

Actual hosting account creation, DNS changes, Atlas cluster selection, backups, SMTP approval and a live deployment require the project owner's accounts and explicit configuration. Until the smoke script and manual checklist pass against a real staging deployment, mark this step **not verified**.
