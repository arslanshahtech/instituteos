# InstituteOS — Prompt Index

Execute these prompts ONE AT A TIME.

| ID  | Phase              | Goal                                          | Status                                                                       |
| --- | ------------------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| 00  | Foundation         | Repository foundation + project constitution  | Superseded by Phase 01; no separate checkpoint recorded                      |
| 01  | Backend            | Express/API/database engineering foundation   | Complete                                                                     |
| 02  | Frontend           | React app shell + design system               | Complete                                                                     |
| 03  | Auth               | Authentication + identity                     | Complete                                                                     |
| 04  | Multi-tenancy/RBAC | Tenant isolation + permissions                | Complete                                                                     |
| 05  | Organizations      | Organizations, campuses, members, onboarding  | Implementation complete — final lifecycle closeout awaiting human acceptance |
| 06  | People             | Admissions, students, guardians, staff        | ☐                                                                            |
| 07  | Academics          | Academic structure + timetable                | ☐                                                                            |
| 08  | Learning           | Attendance + exams + assignments              | ☐                                                                            |
| 09  | Finance            | Student/institute fees and payments           | ☐                                                                            |
| 10  | Operations         | Communication, documents, reports, audit      | ☐                                                                            |
| 11  | SaaS Billing       | InstituteOS subscription billing              | ☐                                                                            |
| 12  | AI                 | Permission-aware AI assistant                 | ☐                                                                            |
| 13  | Hardening          | Security, testing, production readiness       | ☐                                                                            |
| 14  | Final QA           | End-to-end verification + portfolio packaging | ☐                                                                            |

## Execution rule

For each phase:

1. Open the correct prompt file.
2. Copy only the prompt body.
3. Paste it into the active coding-agent chat.
4. Let the agent inspect the workspace.
5. Review file changes.
6. Run/inspect tests and builds.
7. Fix issues.
8. Update `PROJECT_STATE.md`.
9. Commit a checkpoint if desired.
10. Move to the next phase only after acceptance.

## Prompt file naming

- `00-foundation.md`
- `01-backend-foundation.md`
- `02-frontend-foundation.md`
- `03-authentication.md`
- `04-multitenancy-rbac.md`
- `05-organizations-campuses-users.md`
- `06-admissions-students-guardians-staff.md`
- `07-academics-timetable.md`
- `08-attendance-exams-assignments.md`
- `09-finance.md`
- `10-communication-documents-reports-audit.md`
- `11-saas-billing.md`
- `12-ai-assistant.md`
- `13-hardening-security-testing-deployment.md`
- `14-final-qa-portfolio.md`
