# InstituteOS — Role Permission & Data Scope Matrix

**Status:** Enforced  
**Standard:** OWASP API Security (BOLA / IDOR Prevention)

---

## 1. Role Scopes

| Role | Object Boundary | Restrictions |
| :--- | :--- | :--- |
| **ORGANIZATION_OWNER** | Full Organization & all campuses | Complete access to settings, members, billing, audit. |
| **ORGANIZATION_ADMIN** | Full Organization & assigned campuses | Cannot delete organization or transfer ownership. |
| **CAMPUS_ADMIN** | Assigned Campus Only | Cannot access students or staff from other campuses. |
| **TEACHER** | Assigned Classes & Sections Only | Cannot view finance, fee vouchers, or unassigned class results. |
| **PARENT / GUARDIAN** | Verified Linked Children Only | Cannot access other students' records, attendance, or fees. |
| **STUDENT** | Self Record Only | Read-only access to own timetable, attendance, marks. |

---

## 2. API Authorization Rules

1. **Every Request MUST pass Tenant Context:** `organizationId` from session JWT must match route param `organizationId`.
2. **Parent Requests MUST verify `guardianId` ↔ `studentId` mapping:** No generic student lookup allowed for guardian role.
3. **Teacher Requests MUST verify `teacherId` ↔ `sectionId` mapping:** Marks entry rejected if teacher is not assigned to that section/subject.