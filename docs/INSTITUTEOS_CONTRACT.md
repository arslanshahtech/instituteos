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

This list describes product scope, not implemented features. Phases 00 and 01 implement only the application and operational API foundations; none of these business capabilities are implemented yet.

## Initial role set

Platform Super Admin; Organization Owner; Organization Admin; Campus Admin; Principal/Director; Academic Coordinator; Teacher; Accountant/Finance Officer; Admissions/Reception; Student; Parent/Guardian. New roles should be introduced only when a later product phase requires them.
