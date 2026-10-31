# College Academics Configuration and Compatibility

## Target tenancy model

InstituteOS is a multi-organization product. Each organization is one institution and has exactly one institution type: `school` or `college`. A School organization does not contain a College, and a College organization does not contain a School. Existing organizationId scoping remains the tenant boundary.

## College academic hierarchy

- Organization: e.g. Abdullah College
- Academic Year: e.g. 2026-2027 (dates are organization-specific; no fixed April/March assumption)
- Terms / semesters: non-overlapping periods inside that academic year
- Class / study level: First Year, Second Year, or Other
- Program / group: FSc Pre-Medical, FSc Pre-Engineering, ICS, FA, FA IT, I.Com, or an administrator-defined value
- Sections: A, B, etc. belong to one class/program record
- Subjects: new subjects must map to one or more class/program records
- Teacher assignments and exam schedules must use a subject mapped to the selected class/program

A class record represents a study level + program combination. For example, First Year / FSc Pre-Medical and Second Year / FSc Pre-Medical are separate class records, each with their own sections. This preserves the existing classId and sectionId references used by students, attendance, exams and finance.

## Eight implementation and verification steps

1. **Organization type** — platform organization creation requires School or College; existing organizations without a type are shown as Type not set until explicitly migrated.
2. **College study levels and groups** — class records now accept studyLevel and programName; values remain flexible rather than hardcoded to a fixed list.
3. **Sections** — existing sections remain attached to classId, which now identifies the level/program combination. Class cards and selectors show the program metadata.
4. **Subject-to-class mapping** — subjects store classIds. New subjects must select at least one class/program. Existing legacy subjects with no mapping remain organization-wide for backward compatibility.
5. **Teacher assignment validation** — assignment service rejects a subject when it is mapped to different classes. The Class Detail teacher picker filters the subject list to applicable subjects.
6. **Student enrollment integration** — existing enrollment uses classId + sectionId + academicYearId. Those identifiers and validation remain unchanged, so new college groups can use the same flow.
7. **Attendance, exams and fees impact** — attendance and placements continue using classId/sectionId; fee structures remain class-specific; exam schedules now validate that the selected subject is available for the selected class. No new foreign-key migration is required for these modules.
8. **Testable migration and final checks** — additive fields preserve old records. The institution-type migration script is read-only by default and only updates one explicitly named organization when passed --apply. Run automated tests/build, then test a staging organization end-to-end before using live college records.

## Safe migration commands

Read-only audit of existing organizations missing a type:

```powershell
npm run migrate:institution-types --workspace @instituteos/api
```

Dry run for one organization:

```powershell
npm run migrate:institution-types --workspace @instituteos/api -- --organization-id <ORG_ID> --type college
```

Apply only after confirming the organization's real type:

```powershell
npm run migrate:institution-types --workspace @instituteos/api -- --organization-id <ORG_ID> --type college --apply
```

The migration never guesses the institution type and never changes student, fee, attendance, exam, class, or enrollment records.

## Manual acceptance checklist

- Create one test College organization and one test School organization; verify the platform list shows their types.
- Sign into each test organization and confirm the other organization's students, staff, classes, fees and reports are not accessible.
- In the College, create one academic year with the actual college dates and at least two non-overlapping terms.
- Create First Year / FSc Pre-Medical and First Year / ICS; create A/B sections under the relevant class.
- Create Biology mapped to FSc Pre-Medical only and Computer Science mapped to ICS only.
- Attempt to assign Biology to ICS and schedule Biology in an ICS exam; both must be rejected.
- Enroll a test student in First Year / FSc Pre-Medical / Section A; confirm the same class and section appear in attendance, fee structure and exam roster workflows.
- Refresh each page and verify the records persist.
- Verify a legacy subject with no classIds can still be read and existing assignments are not silently rewritten.

## Known verification boundary

Automated API tests and the frontend production build do not prove a live MongoDB migration, real user permissions, or browser-based end-to-end behavior. Those still require staging/manual verification with dummy data.
