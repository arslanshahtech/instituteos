# Student Import — Feature Guide

**Date:** 29 October 2026  
**Branch:** feat/student-import-preview  
**Status:** Implemented in code; targeted automated tests pass. Staging/database acceptance is still required.

## 1. Feature ka maqsad

Pakistan ke school office ke paas aksar purana student register Excel ya CSV file mein hota hai. Har student ko alag form mein type karna time-consuming hai aur typing mistakes/duplicate profiles ka risk badhata hai. Student Import school operator ko file select karne, columns match karne, rows review karne aur phir confirmation se student profiles create karne deta hai.

## 2. School owner ko faida

- Hundreds of profiles ko manually dobara type karne ka waqt kam hota hai.
- Import se pehle validation warnings aur errors nazar aate hain.
- Likely duplicate students ko skip kiya jata hai, aur per-row outcome report milti hai.
- Urdu names supported hain; system ambiguous dates ko khud se guess nahi karta.
- Existing student records ko update/overwrite nahi kiya jata; yeh initial version new profiles create karta hai.
- Student directory mein `Export CSV` action bhi hai. Yeh current search/status filters ke mutabiq tamam matching student profiles export karta hai (sirf current visible page nahi), UTF-8 BOM ke saath Urdu text preserve karne ki koshish karta hai, aur spreadsheet formula injection ke liye values ko escape karta hai. Export limit 10,000 matching records hai; zaroorat par search/status filter narrow karein.
- Student import mein parent/guardian full name, phone, email aur relationship (father/mother/guardian/other) bhi map kiye ja sakte hain. Same phone/email wale sibling rows preview mein shared-parent warning dikhate hain; import existing guardian ko reuse karke dono students ko link karta hai. Student, guardian aur link ek database transaction mein save hote hain; guardian details conflict hon to row fail hoti hai. Guardian fields optional hain.

**Owner ko kehne ka durust jumla:** “Hum aapke existing Excel/CSV register se basic student profiles import karne mein madad dete hain. Pehle columns map aur rows preview hoti hain, duplicate/error rows highlight hote hain, phir aapki confirmation ke baad valid profiles create hote hain. Import report batati hai kitne create, skip aur fail hue.”

Yeh na kahein ke complete school register, fee ledger, class placements aur family records one-click migrate ho jate hain—woh is version ke scope mein nahi.

## 3. Current scope

Supported file types: **.xlsx** and **.csv**. **.xls** legacy file ko pehle Excel mein **.xlsx** ke taur par Save As karna hoga. Maximum file size 5 MB, maximum 1,000 non-empty student rows per batch aur 50 columns hain.

Mapped fields:

- Full student name (automatically split into first name + remaining name, with a review warning)
- First name, last name, preferred name
- Date of birth (strict YYYY-MM-DD only)
- Gender, student email, student/primary contact phone, status
- Optional parent/guardian full name, phone, email and relationship (`father`, `mother`, `guardian`, `other`)
- Campus selection where the operator's permissions require it

Date format ambiguous ho, email invalid ho, ya required names na hon to row error/warning ke saath preview mein aati hai. System formulas calculate nahi karta. Unknown columns default Skip hain. Urdu text ko parser trim karta hai, transliterate nahi karta.

## 4. Duplicate rules

- Same uploaded file mein repeat row detect hoti hai.
- Existing record se match naam + same DOB par hota hai; agar existing DOB blank ho to naam + phone ko fallback ke taur par use kar sakte hain.
- DOB aur phone dono missing hon to exact-name match conservative duplicate review hai; duplicate ko default se skip karna mumkin hai. Is se legitimate same-name students ka false positive ho sakta hai; office ko identifiers verify karne chahiye.
- Preview ke baad import endpoint validation aur duplicate check dobara run karta hai; sirf pehle preview ko trusted nahi samajhta.

## 5. Data aur security boundaries

- API organization-context, student.create permission aur CSRF protection use karti hai.
- Campus admins ko assigned campus scope ke andar hi import karna hota hai.
- Har row ka result alag hota hai. Guardian details mapped hon to us row ka student, guardian aur unka link ek MongoDB transaction mein create hota hai. Guardian transaction fail ho to student bhi us transaction mein save nahi hota. Poora batch all-or-nothing nahi hai.
- Guardian import same organization ke andar normalized phone ya email se existing guardian ko match/reuse karta hai, aur usi guardian ko multiple sibling students ke saath link karta hai. Phone punctuation aur email letter-case normalize hoti hai. Agar phone/email alag guardian records ko match karein, ya matched contact ke saath name/contact conflict ho, to row fail hoti hai—system guess karke records merge nahi karta.
- Sirf guardian name same ho aur phone/email na ho to automatic deduplication nahi hoti; name akela reliable unique identifier nahi. Aise rows mein parent ka phone/email dena ya manual review karna zaroori hai.
- Batch ke andar rows sequentially process hoti hain, lekin do concurrent import requests mein guardian duplicate race ko abhi database-level unique key se fully prevent nahi kiya gaya. Pilot se pehle staging validation aur single-operator import zaroori hai.
- Yeh importer class/enrollment placement, fee structures/invoices, admission/roll numbers, payments, documents, aur sibling dues import nahi karta.
- Actual school data par import abhi test nahi kiya gaya.

## 6. Files aur unka role

| File                                                | Role                                                                                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| apps/web/src/students/student-import-parser.ts      | .xlsx/CSV read, size/row/column limits, headers aur data rows normalize, common headings suggest.          |
| apps/web/src/students/StudentImportPage.tsx         | File selection, campus, column mapping, preview, confirm, import report aur UI errors.                     |
| apps/web/src/students/StudentPages.tsx              | Students directory mein consistent Import / Export / Add actions aur student records.                       |
| apps/web/src/styles/modules/students.css            | Directory action layout, styled file picker, responsive panels aur mobile row-card preview tables.           |
| apps/web/src/students/students-api.ts               | Preview aur confirm-import HTTP calls + TypeScript response types.                                         |
| apps/web/src/students/student-queries.ts            | Existing student list/create/update query handling; import ke baad student list cache invalidate hota hai. |
| apps/web/src/app/router.tsx                         | Admin student import page ka lazy route.                                                                   |
| apps/api/src/modules/people/people.routes.ts        | Protected preview/commit endpoints, payload allow-list aur campus ID validation.                           |
| apps/api/src/modules/people/people.service.ts       | Row validation, name splitting, strict dates, duplicate review aur row-by-row import result.               |
| apps/api/src/modules/people/people.repository.ts    | Student/guardian transaction, guardian contact matching/reuse aur campus ownership check.                  |
| apps/api/src/modules/people/people.types.ts         | Preview/import request aur response contracts.                                                             |
| apps/api/src/modules/people/people.test.ts          | Validation, duplicate rules, repeat import aur campus-scope service tests.                                 |
| apps/api/src/modules/people/people.routes.test.ts   | CSRF, preview route, commit route aur unsupported fields ke HTTP tests.                                    |
| apps/web/src/students/student-import-parser.test.ts | Urdu, CSV quoting, headers, limits, malformed input aur legacy-format test cases.                          |
| apps/web/src/students/StudentImportPage.test.tsx    | Permission denial aur preview → confirm → report user flow test.                                           |
| apps/web/src/students/students-api.test.ts          | Frontend API path/payload contract tests.                                                                  |
| apps/web/package.json and package-lock.json         | Spreadsheet reader dependency (read-excel-file).                                                           |
| docs/features/student-import-sibling-test.csv       | Synthetic test data: two siblings share one guardian, one student has no guardian, one duplicate row.      |

## 7. API endpoints

- POST /api/v1/organizations/:organizationId/students/import/preview
- POST /api/v1/organizations/:organizationId/students/import

Dono ko authenticated session, student.create permission aur valid CSRF token chahiye. Request mein rows (source row number + explicitly mapped fields) aur optional campusId aata hai. Preview sirf review karta hai; second endpoint create operation shuru karta hai.

## 8. Tests aur release status

Last verification: **30 October 2026**.

- API People service + routes: **29 tests passed** (shared-parent preview, sibling guardian reuse, duplicate students, permissions, CSRF aur unsupported fields).
- Frontend Students list + importer parser + API + import page: **20 tests passed** (including guardian-column mapping, preview → confirm → report, responsive action controls ki presence, parser limits aur CSV cases).
- Typecheck: API aur web dono workspaces mein passed.
- Production build: API aur web dono workspaces mein successful. Vite ne third-party Zod package ke Rollup comment annotations par warnings di, lekin build complete hua.
- Targeted ESLint, Prettier check aur `git diff --check`: passed.
- Local running web app: HTTP 200. Local API health: HTTP 200. API readiness: database connected.
- Read-only MongoDB transaction check: passed; configured database student/guardian transaction capability support karta hai.
- Live database mein dummy students import nahi kiye gaye, taake school ke existing records mein test data na likha jaye. Browser screenshot/manual authenticated import bhi is run mein perform nahi hua. Actual import, forced rollback aur mobile visual acceptance ko staging test ke taur par abhi complete karna hai.
- Automated service tests MemoryPeopleRepository use karte hain; real MongoDB transaction capability ka read-only check alag se kiya gaya. Live-school release se pehle staging acceptance zaroori hai.

## 9. Acceptance checklist before school pilot

- [ ] Desktop aur 360px mobile viewport par directory actions, file picker, mapping, preview row cards aur import report visually check hon.
- [ ] An anonymised register with Urdu names, blank DOB, invalid DOB, duplicate candidates and unknown headings is imported in staging.
- [ ] Preview totals and every row outcome are manually checked before confirmation.
- [ ] A repeated import does not create duplicate students in ordinary sequential use.
- [ ] Two sibling rows with the same verified parent phone/email create one guardian and two student links; preview warns that the guardian is shared.
- [ ] Conflicting guardian identifiers fail safely without merging unrelated records.
- [ ] MongoDB deployment supports transactions and a forced transaction failure leaves no half-created student/guardian pair.
- [ ] Wrong-campus and no-permission requests are denied.
- [ ] A failed row report does not expose database internals or private errors.
- [ ] Student list can find imported records; exported CSV opens in Excel with Urdu values intact and formula-like cells treated as text.
- [ ] Export respects the current search/status filter and includes all matching pages, up to the 10,000-record limit.
- [ ] Backup/restore and a manual rollback plan are ready.
- [ ] School owner is told exactly which related records are not included.
