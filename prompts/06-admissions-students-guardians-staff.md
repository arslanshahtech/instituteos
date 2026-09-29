# PROMPT 06 — ADMISSIONS, STUDENTS, GUARDIANS & STAFF

Execute only the people-management domain.

Read `AGENTS.md`.

## Admissions workflow

Inquiry
→ Applicant
→ Application
→ Documents
→ Review
→ Admission
→ Student creation
→ Enrollment

## Implement

Admissions:
- inquiry
- application
- application status
- document metadata
- approval/rejection

Students:
- profile
- status
- contact
- guardians
- emergency information as appropriate
- academic-history foundation
- search/filter/pagination

Guardians:
- profile
- relationships
- multiple children per guardian
- communication preferences

Staff/Teachers:
- profile
- department
- qualification
- status
- teacher-specific profile foundation

Enrollment:
Treat Student and Enrollment as separate domain concepts.

A student can have multiple enrollments over time.

## Frontend

- admissions dashboard
- inquiries
- applications
- student list
- student detail
- guardian detail
- staff list
- teacher profile

Include loading/empty/error/permission-denied states.

## Security

All tenant-owned records must be scoped to organization and, where applicable, campus.

## Do not implement

Academics/timetable, attendance, exams, assignments, finance, billing, AI.

## Acceptance criteria

- admission workflow works
- approved applicant can create a student
- guardian relationships work
- student search works
- staff records work
- enrollment model is separated
- authorization and tenant isolation remain correct
- tests pass
