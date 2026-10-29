# InstituteOS product contract

## Product

InstituteOS is a multi-tenant education management and operations SaaS for schools, school groups, colleges, academies, coaching institutes, and multi-campus education organizations.

## Product boundaries

- Start with a modular monolith and clear feature ownership.
- Expose REST APIs under `/api/v1`.
- Scope organization-owned data to its tenant and enforce access on the server.
- Treat SaaS subscription billing and institute fee collection as separate capabilities.
- Keep AI interactions inside explicit, authorized application capabilities; never grant an LLM unrestricted data access.
- Keep secrets in environment configuration and out of source control and logs.

## Planned capabilities

Authentication and identity; organizations, campuses, memberships, roles, and permissions; admissions; students and guardians; staff; academics; timetable; attendance; exams and assignments; finance; communication; documents; reports; SaaS billing; audit logs; and an AI assistant.

This list describes the intended product scope, not a blanket statement that every feature is complete. The current repository also contains implemented modules for identity/authentication, organizations/campuses and membership permissions, admissions, students/guardians/staff, academics, attendance, examinations/homework, finance/fee operations/concessions, communications, reporting, settings and student pickup workflows. Individual workflows still require production-like end-to-end validation before being offered to a school. Treat AI assistance, SaaS subscription billing, official automated messaging/payment integrations and any missing document-management workflow as planned/unverified until they have implementation and acceptance evidence. The production readiness gates are tracked in docs/PRODUCTION_READINESS_PLAN.md.

## Initial role set

Platform Super Admin; Organization Owner; Organization Admin; Campus Admin; Principal/Director; Academic Coordinator; Teacher; Accountant/Finance Officer; Admissions/Reception; Student; Parent/Guardian. New roles should be introduced only when a later product phase requires them.
