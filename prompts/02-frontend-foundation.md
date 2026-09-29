# PROMPT 02 — FRONTEND FOUNDATION

Execute only the frontend foundation phase.

Read `AGENTS.md`.

## Objective

Create the professional React application shell and reusable UI foundation for InstituteOS.

## Technology

Prefer:
- React
- Vite
- TypeScript
- React Router
- TanStack Query
- React Hook Form
- Zod
- Tailwind CSS
- shadcn/ui or equivalent accessible components

Preserve an existing working stack if changing it would create unnecessary migration risk.

## Implement

- router
- providers
- query client
- API client foundation
- global styles/design tokens
- responsive application shell
- sidebar/navigation
- top bar
- breadcrumbs
- toast system
- modal/dialog foundation
- form foundation
- table foundation
- pagination foundation
- loading states
- empty states
- error states
- permission-denied state
- error boundary
- role-based layout foundation

Create:

- PlatformLayout
- AdminLayout
- TeacherLayout
- StudentLayout
- ParentLayout

## Design direction

Premium B2B SaaS.

Avoid:
- excessive gradients
- excessive glassmorphism
- giant rounded cards
- unnecessary animation
- fake metrics

## Do not implement business modules yet.

Acceptance criteria:

- application starts
- routing works
- desktop/tablet/mobile shell works
- shared components are reusable
- API client is centralized
- query system works
- error/loading/empty patterns exist
- lint/typecheck/build pass
