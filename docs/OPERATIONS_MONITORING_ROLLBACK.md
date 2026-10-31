# InstituteOS — Monitoring, Alerts and Rollback (Phase 1 Operations)

Status: Phase 1 deliverable, 31 October 2026. This note covers the local/dev
and pilot deployment. It does not replace `DEPLOYMENT_RUNBOOK.md`; read both
before the Sunday college pilot.

## 1. Health checks

Run these before any pilot session and after every deploy or rollback:

- Web: `GET http://<host>:5173/` (dev) or the hosted URL must return 200.
- API health: `GET /api/v1/health` must return ok.
- API readiness: `GET /api/v1/ready` must report the database connected.
- If any check fails, do not start the pilot session. Fix or roll back first
  (see section 4), then re-run all three checks.

## 2. What to monitor during the pilot

Check at the start of the day and after any incident:

- API process is running and responding (health + ready above).
- Database connection is stable; a single dropped connection that recovers
  on its own is noted, a repeated drop stops the session.
- Error rate in API logs: repeated 5xx responses, repeated 404s on
  tenant-scoped routes, and repeated failed logins are investigated, not
  ignored.
- Disk and memory on the host: a full disk stops database writes first,
  so check free space before the session.
- Fee totals: at day end, collected + outstanding must equal invoiced
  for the checked students. Any mismatch is a stop-and-investigate event,
  not a rounding note.

## 3. Alerts (pilot stage: manual + log-based)

Automated alerting (email/SMS/push) is not yet built. Until it is, the
pilot owner owns these manual alerts:

- API down or database disconnected: tell the pilot owner immediately,
  pause new admissions and payments, keep the last known-good state.
- Repeated failed logins or CSRF rejections from one source: treat as a
  possible attack, keep the account lockout/rate-limit behaviour, and do
  not disable security controls to "make it work".
- Any fee total mismatch: stop payment entry, preserve invoices and
  receipts, and reconcile before continuing.

When automated alerting is added, it must cover at minimum: API down,
database disconnected, 5xx spike, and backup failure. Alert delivery
must not depend on the same server that is down.

## 4. Rollback procedure

Rollback returns the running code to the last verified state. It never
deletes data.

1. Stop new writes: pause admissions, payments and imports. Tell users
   the system is in read-only/maintenance mode.
2. Note the current state: branch, commit, deployment target, and the
   time of the last good health check.
3. Restore code: check out the last verified branch/commit on the
   deployment target and restart the API and web processes.
4. Do NOT run destructive migrations. If a migration already ran, stop
   and escalate instead of improvising a reverse migration.
5. Database: if data was corrupted, restore from the latest Atlas
   backup to a separate target first, verify counts and fee totals,
   then switch over. Never restore over the only copy without a
   verified backup.
6. Verify: health + ready checks pass, login works, one student record,
   one invoice and one attendance record read correctly.
7. Record the incident: what changed, when it broke, what was rolled
   back, and what check will prevent a repeat.

## 5. Backup rule (until the restore drill passes)

Backups are unproven until a restore drill has actually succeeded
(Phase 1 open item, needs Atlas access). Until then:

- No real college data import beyond the minimum approved pilot data.
- Export the pilot data (students, invoices, receipts) at day end and
  keep the export off the same machine.
- The Sunday pilot is a controlled, guided pilot, not an unsupervised
  production launch.

## 6. Pilot-day checklist

- [ ] Health + ready checks pass.
- [ ] Last verified commit/branch noted.
- [ ] Day-end export location confirmed.
- [ ] Rollback decision maker named (who may call "stop and roll back").
- [ ] Known gaps list printed/shared: no family payment split, no
      thermal receipt, no daily cashier reconciliation, no defaulter
      ageing, no document upload, backup restore unproven, no payment
      gateway, no automated SMS/WhatsApp, no mobile app.
