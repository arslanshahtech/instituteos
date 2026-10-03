# PROMPT 06 — ADMISSIONS, STUDENTS, GUARDIANS & STAFF

Execute Phase 06 only after Phase 05 has been reviewed and accepted by the human owner and the required checkpoint has been created. If this prerequisite is not satisfied, stop without implementing Phase 06 and report the blocker.

Implement only the people-management domain described in this prompt. Do not begin a later phase.

## Sources of truth and architecture lock

Before changing files, read and reconcile the relevant current sources:

- `AGENTS.md`
- `PROJECT_STATE.md`
- `PROMPT_INDEX.md`
- `PLANS.md`
- `docs/architecture.md`
- `docs/decisions.md`
- this canonical Phase 06 prompt
- the relevant existing API, frontend, data-model, validation, authorization, and test code

The working repository is the source of truth for implementation state. If the sources conflict, stop and explain the inconsistency rather than silently choosing one.

The existing architecture and design system are authoritative:

- Preserve the React frontend → Node.js/Express REST API → modular services → Mongoose → MongoDB architecture and `/api/v1` API prefix.
- Preserve the modular monolith. Do not introduce microservices or redesign module boundaries.
- Preserve the existing frontend architecture, shared layout/components, design tokens, and visual language. Do not replace the design system or rewrite working shared components without an identified root cause.
- Keep business logic in the appropriate module/service rather than adding it to controllers or large global utility files.
- Do not change existing authentication, tenant resolution, authorization, or organization/campus lifecycle behavior to work around a feature.

## Phase 06 scope

Phase 06 remains limited to:

- Admissions
- Students
- Guardians
- Staff and teacher profile foundations
- Enrollment as a separate student-domain concept

Do not implement or pull in academics, timetable, attendance, exams/results, assignments, finance, communication, documents beyond admissions document metadata, SaaS billing, or AI. Those belong to later phases unless an existing canonical Phase 06 requirement explicitly justifies a narrowly scoped dependency. If a necessary dependency appears to exceed Phase 06, document it and stop for owner direction rather than implementing future-phase functionality.

## Admissions workflow

Implement the admissions workflow:

Inquiry
→ Applicant
→ Application
→ Documents
→ Review
→ Admission
→ Student creation
→ Enrollment

Admissions must support:

- inquiry
- application
- application status
- admissions document metadata
- approval and rejection

Preserve the distinction between an applicant/application and an enrolled student. Define and validate allowed workflow transitions; do not permit invalid or unauthorized transitions. Approval must support creating a student and the corresponding enrollment without weakening tenant or authorization boundaries.

## Students

Implement:

- student profile
- student status
- contact information
- guardian relationships
- emergency information as appropriate
- academic-history foundation only; do not implement the Academics phase
- student search, filtering, and pagination

Student identity/profile and enrollment are separate domain concepts. A student can have multiple enrollments over time. Do not model enrollment as an inseparable set of fields on the student profile.

## Guardians

Implement:

- guardian profile
- student-guardian relationships
- support for one guardian related to multiple children
- communication preferences

Ensure relationship changes are authorized, validated, and scoped to the same tenant. Do not infer or grant account access or permissions merely from a guardian relationship.

## Staff and teachers

Implement:

- staff profile
- department association
- qualification information
- staff status
- teacher-specific profile foundation

Do not implement later academic or timetable functionality as part of the teacher profile foundation.

## Frontend

Implement the relevant user-facing screens within the existing frontend architecture:

- admissions dashboard
- inquiries
- applications
- student list
- student detail
- guardian detail
- staff list
- teacher profile

Include loading, empty, error, permission-denied, and success feedback states where applicable. Use human-readable information in labels and navigation; do not expose technical IDs or implementation identifiers as visible UI labels unless genuinely required. Routes and internal identifiers may remain unchanged.

### Responsive UI is first-class

Design each frontend feature intentionally for mobile; do not merely compress the desktop layout. Use the existing responsive system and a small number of coherent breakpoints rather than many one-off breakpoint hacks.

Consider these viewport widths during responsive implementation and verification:

360, 375, 390, 400, 480, 600, 768, 1024, 1280, and 1440 pixels.

Check relevant screens and states for:

- no horizontal overflow or clipped content
- readable typography and clear information hierarchy
- usable controls, adequate spacing, and touch-friendly actions
- appropriate stacking and responsive use of available width by cards and forms
- data tables or dense lists remaining usable at narrow widths
- dialogs fitting within the viewport and remaining operable

Preserve the existing desktop composition and visual language while making the mobile layout intentional and usable.

## Security and data integrity

- All tenant-owned records must be scoped server-side to the authorized organization and, where applicable, campus.
- Never trust a client-supplied organization or campus identifier without verifying the authenticated user's membership, permission, and applicable campus scope.
- Prevent IDOR and cross-tenant access on reads, searches, relationship operations, and mutations.
- Enforce authorization on the server. Hiding a control in the frontend is not a security boundary.
- Preserve existing authentication, session, CSRF, RBAC, and tenant-resolution protections.
- Validate inputs and domain state transitions at the appropriate API/service boundaries.
- Handle errors consistently and return user-readable feedback without exposing secrets, sensitive personal data, or internal implementation details.
- Audit important mutations using existing project conventions where applicable; do not create an unrelated general-purpose audit framework.
- Protect sensitive personal information and admissions document metadata according to existing security and data-handling conventions. Do not introduce unrestricted file storage or unrelated document-management functionality.

## Implementation discipline

For each feature, follow:

Inspect
→ understand existing behavior and dependencies
→ identify the root cause and affected surfaces
→ implement the smallest coherent change
→ verify
→ report

Before implementation:

1. Inspect only the relevant code, tests, and documentation.
2. Identify the existing module and shared patterns to reuse.
3. Trace the full affected request and UI flows, including authorization and tenant/campus scope.
4. Form a concise implementation sequence and identify risks.

Avoid broad speculative refactors, duplicate components, arbitrary CSS patches, and unrelated changes. When diagnosing a UI issue, determine whether its cause is DOM structure, container sizing, flex/grid behavior, width constraints, overflow, conditional rendering, breakpoint behavior, shared-component behavior, or information hierarchy; fix the root cause where practical.

Consider consistency across relevant desktop, tablet, and mobile layouts and loading, empty, error, denied, and success states before declaring a feature complete.

Meaningful mutations must have validation, server-side authorization, consistent error handling, user-readable feedback, and relevant tests.

## Testing and verification

Add or update focused tests for behavior changes, especially workflow transitions, tenant/campus isolation, authorization, guardian relationships, student search, staff records, and enrollment separation.

Use focused tests and verification during implementation, then run the broader checks required by the repository's phase gate. Do not repeatedly run expensive full-repository checks after every small change.

Run the applicable repository commands for:

- tests
- typecheck
- lint
- build
- formatting
- `git diff --check`

Do not claim a check passed unless it was run and its result inspected. Report failures and distinguish existing warnings or environment limitations from regressions.

### Browser and automation discipline

Use browser automation or layout inspection when useful for frontend acceptance. If a screenshot or browser action fails:

1. Determine whether the application itself is failing.
2. Use DOM or layout inspection when possible.
3. Retry only when there is a reasonable technical cause.
4. Otherwise, record manual verification as pending.

Do not repeatedly retry the same failing browser or screenshot operation.

## Out of scope

Do not implement:

- academics or timetable
- attendance
- exams or results
- assignments
- finance or fee collection
- SaaS billing
- communication
- general document management
- AI

Admissions document metadata remains in scope; a general document system does not.

## Acceptance criteria

- The admissions workflow works from inquiry through admission, student creation, and enrollment.
- An approved applicant can create a student and a distinct enrollment.
- Student and enrollment remain separate concepts, and a student can have multiple enrollments over time.
- Guardian profiles and relationships work, including multiple children per guardian.
- Student search, filtering, and pagination work.
- Staff records and the teacher-specific profile foundation work.
- All tenant-owned records remain organization-scoped and campus-scoped where applicable.
- Server-side authorization, RBAC, and existing tenant protections remain correct.
- Validation, error handling, and relevant user feedback are in place for meaningful mutations.
- Relevant automated tests and required repository verification pass.
- Relevant frontend screens are responsive and include applicable loading, empty, error, permission-denied, and success states.
- Documentation and `PROJECT_STATE.md` reflect the actual implementation after completion.

## Stop condition

Once the Phase 06 acceptance criteria are satisfied and required verification has passed, stop. Do not continue speculative exploration, implement later-phase functionality, or make unrelated improvements. Report the result and wait for human review.

## Final report

Every Phase 06 implementation report must include:

- what was implemented
- exact files changed
- architecture impact
- security impact
- tests
- typecheck
- lint
- build
- formatting
- diff check
- browser/manual checks
- known limitations
- remaining issues, if any

If there are no remaining issues, state clearly:

**PHASE 06 = READY FOR HUMAN ACCEPTANCE**

Then stop.

## Git

Never commit automatically. The human owner reviews the diff and decides whether and when to commit.
