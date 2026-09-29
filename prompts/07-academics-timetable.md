# PROMPT 07 — ACADEMICS & TIMETABLE

Execute only academic structure and timetable.

## Entities

- Academic Year
- Term/Semester
- Class
- Section
- Subject
- Enrollment
- Teacher Assignment
- Timetable
- Room where needed

## Implement

- academic year management
- terms
- classes
- sections
- subjects
- teacher assignments
- student enrollment integration
- timetable periods
- room assignment foundation
- timetable creation/editing
- teacher schedules
- student schedules
- class schedules
- clash detection

## Conflict rules

Do not permit double booking when the domain says a teacher, room, or class is already occupied.

Validate conflicts server-side.

## Frontend

- academic years
- terms
- classes
- sections
- subjects
- teacher assignments
- timetable builder
- timetable views

## Do not implement

Attendance, exams, assignments, finance, billing, AI.

## Acceptance criteria

- academic structure works
- enrollments connect correctly
- teacher assignments work
- timetable conflicts are detected
- permissions work
- tests cover conflict cases
