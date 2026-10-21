import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/ui/Button.js';
import { apiMessage } from '../staff/StaffPageShared.js';
import {
  bulkPlaceStudents,
  getEligibleStudents,
  getStudentRoster,
  placeStudent,
  removeStudentFromSection,
} from '../attendance/attendance-api.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicSubject,
  AcademicYear,
} from './academics-api.js';
import { saveAcademicsResource } from './academics-api.js';
import { createStudent } from '../students/students-api.js';

interface Props {
  organizationId: string;
  classes: AcademicClass[];
  sections: AcademicSection[];
  years: AcademicYear[];
  subjects: AcademicSubject[];
  teachers: Array<{ id: string; firstName: string; lastName: string }>;
  teachersLoading?: boolean;
  teachersError?: string;
  initialSectionId?: string;
  initialClassId?: string;
  initialView?: 'students' | 'teacher';
  onViewChange?: (view: 'students' | 'teacher') => void;
  onCreateSection?: (classId: string) => void;
}

export function ClassEnrollmentPanel({
  organizationId,
  classes,
  sections,
  years,
  subjects,
  teachers,
  teachersLoading = false,
  teachersError,
  initialSectionId,
  initialClassId,
  initialView = 'students',
  onViewChange,
  onCreateSection,
}: Props) {
  const [activeView, setActiveView] = useState<'students' | 'teacher'>(initialView);
  // Keep the rendered tab synchronized when the parent opens this panel in a different view.
  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);
  const [rosterSelectionMode, setRosterSelectionMode] = useState(false);
  const teacherViewRef = useRef<HTMLElement | null>(null);
  const studentsViewRef = useRef<HTMLDivElement | null>(null);
  const [rosterSearch, setRosterSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState(
    initialClassId ?? sections.find((item) => item.id === initialSectionId)?.classId ?? classes[0]?.id ?? '',
  );
  const [sectionId, setSectionId] = useState(
    initialSectionId ?? sections.find((item) => item.classId === (initialClassId ?? classes[0]?.id))?.id ?? '',
  );
  const [academicYearId, setAcademicYearId] = useState(
    years.find((year) => year.status === 'active')?.id ?? '',
  );
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedRosterIds, setSelectedRosterIds] = useState<string[]>([]);
  const [teacherStaffId, setTeacherStaffId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [showNewStudent, setShowNewStudent] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const queryClient = useQueryClient();
  const scrollToView = (view: 'students' | 'teacher') => {
    const target = view === 'teacher' ? teacherViewRef.current : studentsViewRef.current;
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  useEffect(() => {
    // Wait until React commits the selected panel so the scroll target exists.
    const frame = window.requestAnimationFrame(() => scrollToView(activeView));
    return () => window.cancelAnimationFrame(frame);
  }, [activeView]);
  const navigateToView = (view: 'students' | 'teacher') => {
    setActiveView(view);
    onViewChange?.(view);
    // The target is conditional; wait for React to commit the selected panel.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollToView(view)));
  };
  const section = sections.find((item) => item.id === sectionId && item.classId === selectedClassId);
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const classSections = sections.filter((item) => item.classId === selectedClassId);
  useEffect(() => {
    if (!sections.some((item) => item.id === sectionId && item.classId === selectedClassId)) {
      setSectionId(sections.find((item) => item.classId === selectedClassId)?.id ?? '');
    }
  }, [sections, selectedClassId, sectionId]);
  useEffect(() => {
    if (!academicYearId) {
      const activeYear = years.find((year) => year.status === 'active');
      if (activeYear) setAcademicYearId(activeYear.id);
    }
  }, [academicYearId, years]);
  const studentsQuery = useQuery({
    queryKey: [
      'academics',
      organizationId,
      'eligible-students',
      selectedClass?.campusId,
      academicYearId,
    ],
    queryFn: () =>
      getEligibleStudents(
        organizationId,
        selectedClass!.campusId,
        academicYearId,
      ),
    enabled: Boolean(selectedClass?.campusId && academicYearId),
    retry: false,
  });
  const rosterQuery = useQuery({
    queryKey: ['academics', organizationId, 'class-roster', selectedClass?.id, sectionId, academicYearId],
    queryFn: () => getStudentRoster(organizationId, {
      classId: selectedClass!.id,
      sectionId,
      academicYearId,
      campusId: selectedClass!.campusId,
      date: new Date().toISOString().slice(0, 10),
    }),
    enabled: Boolean(selectedClass?.id && section && academicYearId),
    retry: false,
  });
  const students = studentsQuery.data?.items ?? [];
  const rosterStudents = rosterQuery.data?.items ?? [];
  const filteredRosterStudents = useMemo(() => {
    const term = rosterSearch.trim().toLocaleLowerCase();
    return term ? rosterStudents.filter((student) => `${student.firstName} ${student.lastName} ${student.preferredName ?? ''}`.toLocaleLowerCase().includes(term)) : rosterStudents;
  }, [rosterStudents, rosterSearch]);
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term
      ? students.filter((student) =>
          `${student.firstName} ${student.lastName} ${student.preferredName ?? ''}`
            .toLocaleLowerCase()
            .includes(term),
        )
      : students;
  }, [students, search]);
  const allShownSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) => selectedIds.includes(student.id));
  const bulk = useMutation({
    mutationFn: () =>
      bulkPlaceStudents(organizationId, {
        studentIds: selectedIds,
        classId: section!.classId,
        sectionId,
        academicYearId,
        campusId: selectedClass!.campusId,
      }),
    onSuccess: async () => {
      setSelectedIds([]);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['academics', organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['attendance', organizationId],
        }),
      ]);
      await Promise.all([studentsQuery.refetch(), rosterQuery.refetch()]);
    },
  });
  const removeRosterStudent = useMutation({
    mutationFn: async (studentIds: string[]) => {
      if (!selectedClass || !section) throw new Error('Choose a class section first.');
      for (const studentId of studentIds) {
        await removeStudentFromSection(organizationId, studentId, {
          classId: selectedClass.id,
          sectionId,
          academicYearId,
          campusId: selectedClass.campusId,
        });
      }
      return { removed: studentIds.length };
    },
    onSuccess: async () => {
      setSelectedRosterIds([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academics', organizationId] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', organizationId] }),
      ]);
      await Promise.all([rosterQuery.refetch(), studentsQuery.refetch()]);
    },
  });
  const addNewStudent = useMutation({
    mutationFn: async () => {
      if (!section || !selectedClass) throw new Error('Choose a class section first.');
      const created = await createStudent(organizationId, {
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
        ...(newEmail.trim() ? { contactEmail: newEmail.trim() } : {}),
        campusId: selectedClass.campusId,
        status: 'active',
      });
      await placeStudent(organizationId, {
        studentId: created.student.id,
        classId: section.classId,
        sectionId,
        academicYearId,
        campusId: selectedClass.campusId,
      });
      return created.student;
    },
    onSuccess: async () => {
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      setShowNewStudent(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['academics', organizationId] }),
        queryClient.invalidateQueries({ queryKey: ['attendance', organizationId] }),
        queryClient.invalidateQueries({ queryKey: ['students', organizationId] }),
      ]);
      await Promise.all([studentsQuery.refetch(), rosterQuery.refetch()]);
    },
  });
  const assignTeacher = useMutation({
    mutationFn: (input: {
      teacherStaffId: string;
      subjectId: string;
      classId: string;
      sectionId: string;
      academicYearId: string;
    }) =>
      saveAcademicsResource(
        organizationId,
        'teacher-assignments',
        undefined,
        input,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['academics', organizationId],
      });
    },
  });
  const toggleStudent = (id: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );
  };
  const toggleAllShown = () => {
    setSelectedIds((current) =>
      allShownSelected
        ? current.filter(
            (id) => !filteredStudents.some((student) => student.id === id),
          )
        : [
            ...new Set([
              ...current,
              ...filteredStudents.map((student) => student.id),
            ]),
          ],
    );
  };

  return (
    <section className="panel academics-panel class-enrollment-panel">
      <div className="academics-panel-heading">
        <div>
          <h2>Class enrollment</h2>
          <p>
            Choose a class, session and section. Existing students at that campus can be added together.
          </p>
        </div>
      </div>
      <div className="class-enrollment-view-tabs" role="tablist" aria-label="Class management view">
        <button type="button" role="tab" aria-selected={activeView === 'students'} className={activeView === 'students' ? 'active' : ''} onClick={() => navigateToView('students')}>View Students</button>
        <button type="button" role="tab" aria-selected={activeView === 'teacher'} className={activeView === 'teacher' ? 'active' : ''} onClick={() => navigateToView('teacher')}>Assign Teacher</button>
      </div>
      <div className="form-grid">
        <label>
          Class
          <select
            value={selectedClassId}
            onChange={(event) => {
              const nextClassId = event.target.value;
              setSelectedClassId(nextClassId);
              setSectionId(sections.find((item) => item.classId === nextClassId)?.id ?? '');
              setSelectedIds([]);
              setSelectedRosterIds([]);
              setRosterSelectionMode(false);
              setRosterSearch('');
            }}
          >
            <option value="">Choose class</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.code}</option>
            ))}
          </select>
        </label>
        <label>
          Academic year
          <select
            value={academicYearId}
            onChange={(event) => {
              setAcademicYearId(event.target.value);
              setSelectedIds([]);
              setSelectedRosterIds([]);
              setRosterSelectionMode(false);
              setRosterSearch('');
            }}
          >
            <option value="">Choose academic year</option>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select
            value={sectionId}
            onChange={(event) => {
              setSectionId(event.target.value);
              setSelectedIds([]);
              setSelectedRosterIds([]);
              setRosterSelectionMode(false);
              setRosterSearch('');
            }}
            disabled={!selectedClassId || classSections.length === 0}
          >
            <option value="">Choose section</option>
            {classSections.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>
      {selectedClass && academicYearId && classSections.length > 0 && section ? (
        <>
          {activeView === 'teacher' && (
          <section
            ref={teacherViewRef}
            className="class-teacher-assignment class-enrollment-anchor"
            aria-label="Assign class teacher"
          >
            <h3>Assign teacher</h3>
            <div className="form-grid">
              <label>
                Subject teacher
                <select
                  value={teacherStaffId}
                  onChange={(event) => setTeacherStaffId(event.target.value)}
                >
                  <option value="">Choose teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
                {teachersLoading && <small>Loading active teachers...</small>}
                {!teachersLoading && !teachersError && teachers.length === 0 && (
                  <small>No active staff found. Add/activate a teacher in Teachers &amp; Staff first.</small>
                )}
              </label>
              <label>
                Subject
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                >
                  <option value="">Choose subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
                {subjects.length === 0 && <small>Add a subject from the class details panel before assigning a subject teacher.</small>}
              </label>
              <div className="class-enrollment-actions">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    !teacherStaffId || !subjectId || !sectionId || !academicYearId || teachersLoading || Boolean(teachersError) || assignTeacher.isPending
                  }
                  onClick={() =>
                    assignTeacher.mutate({
                      teacherStaffId,
                      subjectId,
                      classId: section.classId,
                      sectionId,
                      academicYearId,
                    })
                  }
                >
                  {assignTeacher.isPending ? 'Assigning…' : 'Assign teacher'}
                </Button>
              </div>
            </div>
            {teachersError && (
              <p className="form-error" role="alert">Teacher list could not be loaded: {teachersError}</p>
            )}
            {assignTeacher.isError && (
              <p className="form-error" role="alert">
                {apiMessage(assignTeacher.error)}
              </p>
            )}
            {assignTeacher.isSuccess && (
              <p className="success-note" role="status">
                Teacher assigned to this class section and subject.
              </p>
            )}
          </section>
          )}
          {activeView === 'students' && (
          <>
          <div ref={studentsViewRef} className="class-enrollment-students-view class-enrollment-anchor">
          <section className="class-roster-section" aria-label="Currently enrolled students">
            <div className="academics-panel-heading">
              <div>
                <h3>Currently enrolled students</h3>
                <p>Students already assigned to {selectedClass.name} · {section.name}.</p>
              </div>
              <div className="class-roster-heading-actions">
                <span className="class-roster-count">{rosterQuery.data?.items.length ?? 0} students</span>
                {rosterStudents.length > 0 && <Button type="button" variant="secondary" onClick={() => { setRosterSelectionMode((current) => !current); setSelectedRosterIds([]); }} aria-expanded={rosterSelectionMode}>{rosterSelectionMode ? 'Cancel selection' : '... Select students'}</Button>}
              </div>
            </div>
            {rosterQuery.isSuccess && rosterStudents.length > 0 && <label className="form-field">Search enrolled students<input aria-label="Search enrolled students" value={rosterSearch} onChange={(event) => setRosterSearch(event.target.value)} placeholder="Search this class roster by name" /></label>}
            {rosterQuery.isPending ? <p>Loading class roster…</p> : rosterQuery.isError ? <p className="form-error" role="alert">{apiMessage(rosterQuery.error)}</p> : rosterStudents.length ? (
              <>
                {rosterSelectionMode && <div className="class-roster-select-toolbar">
                  <label><input type="checkbox" checked={filteredRosterStudents.length > 0 && filteredRosterStudents.every((student) => selectedRosterIds.includes(student.id))} onChange={(event) => setSelectedRosterIds(event.target.checked ? [...new Set([...selectedRosterIds, ...filteredRosterStudents.map((student) => student.id)])] : selectedRosterIds.filter((id) => !filteredRosterStudents.some((student) => student.id === id)))} /> Select all shown</label>
                  <span>{selectedRosterIds.length} selected</span>
                  <Button type="button" variant="secondary" disabled={!selectedRosterIds.length || removeRosterStudent.isPending} onClick={() => removeRosterStudent.mutate(selectedRosterIds)}>Remove selected</Button>
                </div>}
                <div className="class-enrollment-list">
                  {filteredRosterStudents.map((student) => (
                    <div className="class-enrollment-student" key={student.id}>
                      {rosterSelectionMode && <input aria-label={`Select ${student.firstName} ${student.lastName}`} type="checkbox" checked={selectedRosterIds.includes(student.id)} onChange={(event) => setSelectedRosterIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} />}
                      <span className="class-roster-student-name"><strong>{student.preferredName || `${student.firstName} ${student.lastName}`}</strong><small>{student.firstName} {student.lastName}</small></span>
                      <span className="class-roster-status">Enrolled</span>
                      <button className="class-roster-remove-button" type="button" disabled={removeRosterStudent.isPending} onClick={() => removeRosterStudent.mutate([student.id])}>Remove</button>
                    </div>
                  ))}
                </div>
                {rosterSearch.trim() && filteredRosterStudents.length === 0 && <p className="class-roster-empty" role="status">No enrolled students match "{rosterSearch.trim()}". Try another name or clear the search.</p>}
                {removeRosterStudent.isError && <p className="form-error" role="alert">{apiMessage(removeRosterStudent.error)}</p>}
              </>
            ) : <p className="class-roster-empty">No students assigned yet. Select existing students below to add them in bulk.</p>}
          </section>
          <div className="academics-panel-heading class-enrollment-actions">
            <div>
              <h3>Add students</h3>
              <p>Select one or many existing students, or register a new student directly into this section.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setShowNewStudent((value) => !value)}>
              {showNewStudent ? 'Cancel new student' : 'Add new student'}
            </Button>
          </div>
          {showNewStudent && (
            <form className="student-form" onSubmit={(event) => { event.preventDefault(); addNewStudent.mutate(); }}>
              <div className="student-form-grid">
                <label className="form-field">First name<input required maxLength={80} value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} /></label>
                <label className="form-field">Last name<input required maxLength={80} value={newLastName} onChange={(event) => setNewLastName(event.target.value)} /></label>
                <label className="form-field">Phone (optional)<input maxLength={40} value={newPhone} onChange={(event) => setNewPhone(event.target.value)} /></label>
                <label className="form-field">Email (optional)<input type="email" maxLength={254} value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
              </div>
              {addNewStudent.isError && <p className="form-error" role="alert">{apiMessage(addNewStudent.error)}. If the student was created but enrollment failed, add that student from the existing-student list.</p>}
              <div className="class-enrollment-actions"><Button type="submit" variant="primary" disabled={!newFirstName.trim() || !newLastName.trim() || addNewStudent.isPending}>{addNewStudent.isPending ? 'Creating and adding…' : 'Create student and add to section'}</Button></div>
            </form>
          )}
          <label className="form-field">
            Search eligible students to add
            <input
              aria-label="Search eligible students to add"
              autoComplete="off"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type a student name"
            />
          </label>
          <div className="academics-panel-heading">
            <p>
              {selectedIds.length} selected · {filteredStudents.length}{' '}
              available students
            </p>
            <Button type="button" variant="quiet" onClick={toggleAllShown}>
              {allShownSelected ? 'Deselect all shown' : 'Select all shown'}
            </Button>
          </div>
          {studentsQuery.isPending ? (
            <p>Loading available students…</p>
          ) : studentsQuery.isError ? (
            <p className="form-error" role="alert">
              {apiMessage(studentsQuery.error)}
            </p>
          ) : filteredStudents.length ? (
            <div className="class-enrollment-list">
              {filteredStudents.map((student) => (
                <label className="class-enrollment-student" key={student.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(student.id)}
                    onChange={(event) =>
                      toggleStudent(student.id, event.target.checked)
                    }
                  />
                  <span>
                    <strong>
                      {student.preferredName ||
                        `${student.firstName} ${student.lastName}`}
                    </strong>
                    <small>
                      {student.firstName} {student.lastName}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          ) : search.trim() ? (
            <div className="class-roster-empty" role="status">
              <p>No students match “{search.trim()}”.</p>
              <Button type="button" variant="quiet" onClick={() => setSearch('')}>
                Clear search
              </Button>
            </div>
          ) : (
            <p className="class-roster-empty" role="status">
              No unassigned students are available for this campus and academic session. If the student is already in this section, find them in the enrolled-students list above.
            </p>
          )}
          {(bulk.isError || bulk.isSuccess) && (
            <div
              className={
                bulk.isError || bulk.data.failed.length
                  ? 'enrollment-result enrollment-result-error'
                  : 'enrollment-result enrollment-result-success'
              }
              role={bulk.isError ? 'alert' : 'status'}
            >
              {bulk.isError ? (
                apiMessage(bulk.error)
              ) : (
                <>
                  <strong>Enrollment result</strong>
                  <p>
                    {bulk.data.added.length} added · {bulk.data.skipped.length}{' '}
                    already enrolled · {bulk.data.failed.length} failed
                  </p>
                  {bulk.data.failed.length > 0 && (
                    <ul>
                      {bulk.data.failed.map((item) => (
                        <li key={item.studentId}>{item.message}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
          <div className="academics-panel-heading class-enrollment-actions">
            <span />
            <Button
              type="button"
              variant="primary"
              disabled={
                !selectedIds.length ||
                bulk.isPending ||
                !section ||
                !selectedClass
              }
              onClick={() => bulk.mutate()}
            >
              {bulk.isPending
                ? 'Adding students…'
                : `Add ${selectedIds.length} students to section`}
            </Button>
          </div>
          </div>
          </>
          )}
        </>
      ) : selectedClass && academicYearId && classSections.length === 0 ? (
        <div className="class-enrollment-setup-hint">
          <h3>This class needs a section first</h3>
          <p>Students are added to a section inside the class. Create a section (for example, A) and then return here to add students.</p>
          <Button type="button" variant="primary" onClick={() => selectedClass && onCreateSection?.(selectedClass.id)}>Create section</Button>
        </div>
      ) : (
        <p>Select a class and academic year to manage its students.</p>
      )}
    </section>
  );
}
