import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiMessage } from '../staff/StaffPageShared.js';
import {
  ArrowLeft,
  Coffee,
  Copy,
  Download,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  addBulkBreak,
  deleteSectionTimetable,
  listAcademicSubjects,
  listSectionTimetables,
  saveSectionTimetable,
} from './academics-api.js';
import type {
  AcademicClass,
  AcademicSection,
  AcademicSubject,
  AcademicYear,
  AcademicWeekDay,
  SectionTimetable,
  SectionTimetableEntry,
  TimetableEntryType,
} from './academics-api.js';
import './academic-timetable.css';

interface TeacherChoice {
  id: string;
  firstName: string;
  lastName: string;
}
interface Props {
  organizationId: string;
  teachers: TeacherChoice[];
  classes: AcademicClass[];
  sections: AcademicSection[];
  subjects: AcademicSubject[];
  years: AcademicYear[];
  canWrite?: boolean;
}
const days: { value: AcademicWeekDay; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];
const defaultDays: AcademicWeekDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
const nameOf = (teacher?: TeacherChoice) =>
  teacher ? (teacher.firstName + ' ' + teacher.lastName).trim() : '';
const newEntry = (day: AcademicWeekDay): SectionTimetableEntry => ({
  type: 'class',
  dayOfWeek: day,
  startTime: '08:00',
  endTime: '08:40',
});

export function AcademicTimetable({
  organizationId,
  teachers,
  classes,
  sections,
  subjects,
  years,
  canWrite = true,
}: Props) {
  const client = useQueryClient();
  const active = years.find((year) => year.status === 'active') ?? years[0];
  const [yearId, setYearId] = useState(active?.id ?? '');
  const selectedYear = years.some((year) => year.id === yearId)
    ? yearId
    : (active?.id ?? '');
  const query = useQuery({
    queryKey: ['academics', organizationId, 'section-timetables', selectedYear],
    queryFn: () => listSectionTimetables(organizationId, selectedYear),
    enabled: Boolean(selectedYear),
    retry: false,
  });
  const subjectsQuery = useQuery({
    queryKey: ['academics', organizationId, 'subjects'],
    queryFn: () => listAcademicSubjects(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [editing, setEditing] = useState<SectionTimetable | null>(null);
  const [viewingOnly, setViewingOnly] = useState(false);
  const [sectionId, setSectionId] = useState('');
  const [workingDays, setWorkingDays] =
    useState<AcademicWeekDay[]>(defaultDays);
  const [entries, setEntries] = useState<SectionTimetableEntry[]>([]);
  const [draft, setDraft] = useState<SectionTimetableEntry | null>(null);
  const [copiedEntry, setCopiedEntry] = useState<SectionTimetableEntry | null>(
    null,
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkName, setBulkName] = useState('Break');
  const [bulkStart, setBulkStart] = useState('10:40');
  const [bulkEnd, setBulkEnd] = useState('11:00');
  const [bulkSectionIds, setBulkSectionIds] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2000);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  const items = query.data?.items ?? [];
  const classMap = useMemo(
    () => new Map(classes.map((item) => [item.id, item])),
    [classes],
  );
  const availableSubjects = subjectsQuery.data?.items ?? subjects;
  const subjectMap = useMemo(
    () => new Map(availableSubjects.map((item) => [item.id, item])),
    [availableSubjects],
  );
  const teacherMap = useMemo(
    () => new Map(teachers.map((item) => [item.id, item])),
    [teachers],
  );
  const sectionMap = useMemo(
    () => new Map(sections.map((item) => [item.id, item])),
    [sections],
  );
  const selectedClassId = sectionMap.get(sectionId)?.classId ?? '';
  const classSubjects = availableSubjects.filter(
    (subject) =>
      !subject.classIds?.length || subject.classIds.includes(selectedClassId),
  );
  const selectableSubjects = classSubjects.length
    ? classSubjects
    : availableSubjects;
  const filtered = items.filter((item) => {
    const section = sectionMap.get(item.sectionId);
    const classId = section?.classId ?? '';
    const term = search.trim().toLowerCase();
    const match =
      !term ||
      (
        (section?.name ?? '') +
        ' ' +
        (classMap.get(classId)?.name ?? '') +
        ' ' +
        (classMap.get(classId)?.code ?? '')
      )
        .toLowerCase()
        .includes(term);
    return (
      match &&
      (classFilter === 'all' || classId === classFilter) &&
      (sectionFilter === 'all' || item.sectionId === sectionFilter)
    );
  });
  const entryCount = items.reduce((sum, item) => sum + item.entries.length, 0);
  const downloadCsv = () => {
    const rows = [
      ['Section', 'Class', 'Entries'],
      ...filtered.map((item) => {
        const section = sectionMap.get(item.sectionId);
        return [
          section?.name ?? 'Section',
          classMap.get(section?.classId ?? '')?.name ?? 'Class',
          String(item.entries.length),
        ];
      }),
    ];
    const csv =
      '\uFEFF' +
      rows
        .map((row) =>
          row
            .map((value) => '"' + String(value).replace(/"/g, '""') + '"')
            .join(','),
        )
        .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'instituteos-timetables.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const covered = items.filter((item) => item.entries.length > 0).length;
  const refresh = async () => {
    await client.invalidateQueries({
      queryKey: [
        'academics',
        organizationId,
        'section-timetables',
        selectedYear,
      ],
    });
    await client.invalidateQueries({ queryKey: ['teacher-timetable'] });
  };
  const save = useMutation({
    mutationFn: () =>
      saveSectionTimetable(organizationId, {
        academicYearId: selectedYear,
        sectionId,
        workingDays,
        entries: entries.map(
          (entry) =>
            Object.fromEntries(
              Object.entries(entry).filter(([key]) => key !== 'id'),
            ) as Omit<typeof entry, 'id'>,
        ),
      }),
    onSuccess: async () => {
      setEditing(null);
      setSectionId('');
      setDraft(null);
      setError('');
      setNotice('Timetable saved successfully.');
      await refresh();
    },
    onError: (reason) => setError(apiMessage(reason)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteSectionTimetable(organizationId, id),
    onSuccess: refresh,
    onError: (reason) => setError(apiMessage(reason)),
  });
  const bulk = useMutation({
    mutationFn: () =>
      addBulkBreak(organizationId, {
        academicYearId: selectedYear,
        name: bulkName,
        startTime: bulkStart,
        endTime: bulkEnd,
        days: defaultDays,
        ...(bulkSectionIds.length ? { sectionIds: bulkSectionIds } : {}),
      }),
    onSuccess: async (result) => {
      setBulkOpen(false);
      setNotice(
        result.added +
          ' break entries added. ' +
          result.skipped.length +
          ' occupied slots skipped.',
      );
      await refresh();
    },
    onError: (reason) => setError(apiMessage(reason)),
  });
  const startNew = () => {
    setViewingOnly(false);
    setEditing(null);
    setSectionId('__new__');
    setWorkingDays(defaultDays);
    setEntries([]);
    setDraft(null);
    setError('');
    setNotice('');
  };
  const startEdit = (item: SectionTimetable) => {
    setViewingOnly(false);
    setEditing(item);
    setSectionId(item.sectionId);
    setWorkingDays(item.workingDays.length ? item.workingDays : defaultDays);
    setEntries(item.entries.map((entry) => ({ ...entry })));
    setDraft(null);
    setError('');
    setNotice('');
  };
  const startView = (item: SectionTimetable) => {
    setViewingOnly(true);
    setEditing(item);
    setSectionId(item.sectionId);
    setWorkingDays(item.workingDays.length ? item.workingDays : defaultDays);
    setEntries(item.entries.map((entry) => ({ ...entry })));
    setDraft(null);
    setError('');
    setNotice('');
  };
  const editorDays = days.filter((day) =>
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(
      day.value,
    ),
  );
  const entriesByDay = editorDays.map((day) =>
    entries
      .filter((entry) => entry.dayOfWeek === day.value)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  );
  const pendingDayIndex =
    draft && !draft.id
      ? editorDays.findIndex((day) => day.value === draft.dayOfWeek)
      : -1;
  const pendingRowCount =
    pendingDayIndex >= 0 ? (entriesByDay[pendingDayIndex]?.length ?? 0) + 1 : 0;
  const scheduleRowCount = Math.max(
    1,
    pendingRowCount,
    ...entriesByDay.map((dayEntries) => dayEntries.length),
  );
  const pasteEntry = (day: AcademicWeekDay) => {
    if (!copiedEntry) return;
    setEntries((current) => [
      ...current,
      { ...copiedEntry, id: crypto.randomUUID(), dayOfWeek: day },
    ]);
    setNotice(
      'Period copied to ' +
        editorDays.find((item) => item.value === day)?.label +
        '.',
    );
  };
  const nextEntryForDay = (day: AcademicWeekDay) => {
    const dayEntries = entries
      .filter((entry) => entry.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const startTime = dayEntries.at(-1)?.endTime ?? '08:00';
    const [hours, minutes] = startTime.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + 40;
    const endTime =
      endMinutes < 24 * 60
        ? String(Math.floor(endMinutes / 60)).padStart(2, '0') +
          ':' +
          String(endMinutes % 60).padStart(2, '0')
        : '08:40';
    return { ...newEntry(day), startTime, endTime };
  };
  const finishDraft = () => {
    if (!draft) return;
    if (
      !draft.startTime ||
      !draft.endTime ||
      draft.startTime >= draft.endTime
    ) {
      setError('End time must be later than start time.');
      return;
    }
    if (draft.type === 'class' && !draft.subjectId) {
      setError('Please select a subject.');
      return;
    }
    if (draft.type !== 'class' && !draft.name?.trim()) {
      setError('Please enter a name.');
      return;
    }
    const prepared = { ...draft, id: draft.id ?? crypto.randomUUID() };
    setEntries((current) =>
      draft.id
        ? current.map((entry) => (entry.id === draft.id ? prepared : entry))
        : [...current, prepared],
    );
    setDraft(null);
    setError('');
  };

  if (sectionId)
    return (
      <section className="academic-section-timetable page-stack">
        <header className="academic-timetable-heading academic-timetable-editor-heading">
          <div className="academic-timetable-editor-title">
            <button
              type="button"
              className="academic-editor-back"
              onClick={() => {
                setViewingOnly(false);
                setEditing(null);
                setSectionId('');
                setDraft(null);
                setError('');
              }}
              aria-label="Back to timetable overview"
              title="Back to overview"
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <h2>
                {viewingOnly
                  ? 'View Timetable'
                  : editing
                    ? 'Edit Timetable'
                    : 'Add Timetable'}
              </h2>
              <p>Set up the weekly class schedule for this section.</p>
            </div>
          </div>
          <label className="academic-timetable-year">
            <span>Session</span>
            <select
              value={selectedYear}
              onChange={(event) => setYearId(event.target.value)}
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="academic-timetable-editor-card">
          <section className="academic-editor-section-select">
            <label className="academic-timetable-field">
              Section
              <select
                value={sectionId === '__new__' ? '' : sectionId}
                disabled={Boolean(editing)}
                onChange={(event) => setSectionId(event.target.value)}
              >
                <option value="">Select section</option>
                {sections
                  .filter(
                    (section) =>
                      Boolean(editing) ||
                      !items.some((item) => item.sectionId === section.id),
                  )
                  .map((section) => (
                    <option key={section.id} value={section.id}>
                      {classMap.get(section.classId)?.name ?? 'Class'} ·{' '}
                      {section.name}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              Select the class section whose weekly schedule you want to
              configure.
            </p>
          </section>
          <section className="academic-editor-weekly">
            <div className="academic-weekly-schedule-heading">
              <div>
                <h3>Weekly Schedule</h3>
                <p>
                  Click an empty slot to add a class, break, or activity. Each
                  day can have its own timings.
                </p>
              </div>
              <span>{entries.length} entries</span>
            </div>
            <div className="academic-week-grid-wrap">
              <div className="academic-week-grid academic-week-grid-reference">
                <div className="academic-week-grid-head academic-period-label">
                  PERIOD
                </div>
                {editorDays.map((day) => (
                  <div className="academic-week-grid-head" key={day.value}>
                    {day.label.slice(0, 3)} <span aria-hidden="true">⌄</span>
                  </div>
                ))}
                {Array.from({ length: scheduleRowCount }, (_, rowIndex) => (
                  <>
                    <div
                      className="academic-period-index"
                      key={'period-' + rowIndex}
                    >
                      <small>PERIOD</small>
                      <strong>{rowIndex + 1}</strong>
                    </div>
                    {editorDays.map((day, dayIndex) => {
                      const entry = entriesByDay[dayIndex]?.[rowIndex];
                      const isPendingDraft = Boolean(
                        draft &&
                        !draft.id &&
                        draft.dayOfWeek === day.value &&
                        pendingDayIndex === dayIndex &&
                        rowIndex === (entriesByDay[dayIndex]?.length ?? 0),
                      );
                      return (
                        <div
                          className="academic-week-cell"
                          key={day.value + '-' + rowIndex}
                        >
                          {isPendingDraft ? (
                            <article className="academic-period-card academic-period-pending">
                              <strong>Period {rowIndex + 1}</strong>
                              <span>New period ? Add details</span>
                              <time>
                                {draft?.startTime} ? {draft?.endTime}
                              </time>
                            </article>
                          ) : entry ? (
                            <article
                              className={
                                'academic-period-card is-' + entry.type
                              }
                            >
                              <button
                                type="button"
                                className="academic-period-edit"
                                onClick={() => {
                                  if (!viewingOnly) setDraft({ ...entry });
                                }}
                                disabled={viewingOnly}
                              >
                                <strong>
                                  {entry.type === 'class'
                                    ? (subjectMap.get(entry.subjectId ?? '')
                                        ?.name ?? 'Subject')
                                    : entry.name}
                                </strong>
                                {entry.type === 'class' && (
                                  <span>
                                    {nameOf(
                                      teacherMap.get(
                                        entry.teacherStaffId ?? '',
                                      ),
                                    ) || 'No teacher assigned'}
                                  </span>
                                )}
                                <time>
                                  {entry.startTime} – {entry.endTime}
                                </time>
                                {entry.room && <span>{entry.room}</span>}
                              </button>
                              {!viewingOnly && (
                                <div className="academic-period-card-tools">
                                  <button
                                    type="button"
                                    aria-label="Copy period"
                                    title="Copy period"
                                    onClick={() => {
                                      setCopiedEntry({ ...entry });
                                      setNotice(
                                        'Period copied. Choose a + slot to paste it.',
                                      );
                                    }}
                                  >
                                    <Copy size={14} />
                                  </button>
                                </div>
                              )}
                            </article>
                          ) : (
                            <button
                              type="button"
                              className="academic-add-period academic-add-period-cell"
                              disabled={viewingOnly}
                              onClick={() => {
                                if (copiedEntry) pasteEntry(day.value);
                                else {
                                  setError('');
                                  setDraft(nextEntryForDay(day.value));
                                }
                              }}
                            >
                              {copiedEntry ? (
                                <>
                                  <Plus size={14} /> Paste
                                </>
                              ) : (
                                <Plus size={15} />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </>
                ))}
                <div className="academic-period-footer-label">
                  Add to a day →
                </div>
                {editorDays.map((day) => (
                  <button
                    type="button"
                    className="academic-add-day"
                    key={'add-' + day.value}
                    disabled={viewingOnly}
                    onClick={() => {
                      setError('');
                      setDraft(nextEntryForDay(day.value));
                    }}
                  >
                    <Plus size={13} /> {day.label.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            {copiedEntry && !viewingOnly && (
              <p className="academic-copy-hint">
                A period is copied. Select any + slot to paste a duplicate.
              </p>
            )}
          </section>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="academic-timetable-form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setViewingOnly(false);
                setEditing(null);
                setSectionId('');
                setDraft(null);
              }}
            >
              {viewingOnly ? 'Back to Timetables' : 'Cancel'}
            </button>
            {!viewingOnly && (
              <button
                type="button"
                className="button button-primary"
                disabled={
                  !canWrite ||
                  sectionId === '__new__' ||
                  !workingDays.length ||
                  save.isPending
                }
                onClick={() => save.mutate()}
              >
                {save.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
        {draft && (
          <div
            className="academic-timetable-overlay"
            onClick={() => setDraft(null)}
          >
            <section
              className="academic-period-dialog"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="academic-entry-title"
            >
              <header>
                <div>
                  <small>
                    {days.find((day) => day.value === draft.dayOfWeek)?.label}
                  </small>
                  <h3 id="academic-entry-title">
                    {draft.id ? 'Edit period' : 'Add period'}
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setDraft(null)}
                >
                  ×
                </button>
              </header>
              <div className="academic-entry-type-tabs">
                {(['class', 'break', 'activity'] as TimetableEntryType[]).map(
                  (type) => (
                    <button
                      type="button"
                      className={draft.type === type ? 'is-active' : ''}
                      key={type}
                      onClick={() =>
                        setDraft({ ...newEntry(draft.dayOfWeek), type })
                      }
                    >
                      {type[0]!.toUpperCase() + type.slice(1)}
                    </button>
                  ),
                )}
              </div>
              <div className="academic-period-time-fields">
                <label className="academic-timetable-field">
                  Start time
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(event) =>
                      setDraft({ ...draft, startTime: event.target.value })
                    }
                  />
                </label>
                <label className="academic-timetable-field">
                  End time
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(event) =>
                      setDraft({ ...draft, endTime: event.target.value })
                    }
                  />
                </label>
              </div>
              {draft.type === 'class' ? (
                <>
                  <label className="academic-timetable-field">
                    Subject
                    <select
                      value={draft.subjectId ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, subjectId: event.target.value })
                      }
                    >
                      <option value="">Choose subject</option>
                      {selectableSubjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="academic-timetable-field">
                    Teacher
                    <select
                      value={draft.teacherStaffId ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          teacherStaffId: event.target.value || undefined,
                        })
                      }
                    >
                      <option value="">No teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {nameOf(teacher)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="academic-timetable-field">
                    Room
                    <input
                      maxLength={80}
                      value={draft.room ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, room: event.target.value })
                      }
                      placeholder="e.g. Room 101"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="academic-timetable-field">
                    Name
                    <input
                      maxLength={100}
                      value={draft.name ?? ''}
                      onChange={(event) =>
                        setDraft({ ...draft, name: event.target.value })
                      }
                      placeholder={
                        draft.type === 'break'
                          ? 'e.g. Lunch Break'
                          : 'e.g. Morning Assembly'
                      }
                    />
                  </label>
                  {draft.type === 'activity' && (
                    <label className="academic-timetable-field">
                      Description
                      <textarea
                        maxLength={500}
                        rows={3}
                        value={draft.description ?? ''}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            description: event.target.value,
                          })
                        }
                        placeholder="Add activity details"
                      />
                    </label>
                  )}
                </>
              )}
              {error && <p className="form-error">{error}</p>}
              <footer>
                {draft.id ? (
                  <button
                    type="button"
                    className="academic-period-delete"
                    aria-label="Delete period"
                    title="Delete period"
                    onClick={() => {
                      setEntries((current) =>
                        current.filter((entry) => entry.id !== draft.id),
                      );
                      setDraft(null);
                      setError('');
                    }}
                  >
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setDraft(null)}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className="button button-primary"
                  onClick={finishDraft}
                >
                  Done
                </button>
              </footer>
            </section>
          </div>
        )}
      </section>
    );

  return (
    <section className="academic-section-timetable page-stack">
      <header className="academic-timetable-heading">
        <div>
          <h2>Timetables</h2>
          <p>Manage timetables for all sections</p>
        </div>
        <div className="academic-timetable-header-actions">
          {canWrite && (
            <>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setBulkOpen(true);
                  setError('');
                }}
              >
                <Coffee size={15} aria-hidden="true" /> Add break
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={startNew}
              >
                <Plus size={16} aria-hidden="true" /> Create Timetable
              </button>
            </>
          )}
        </div>
      </header>
      {!selectedYear ? (
        <p className="muted-copy">
          Create an academic year before setting up timetables.
        </p>
      ) : (
        <>
          <div className="academic-timetable-stats">
            <article>
              <span>Timetables</span>
              <strong>{items.length}</strong>
              <small>in selected academic year</small>
            </article>
            <article>
              <span>Sections</span>
              <strong>{sections.length}</strong>
              <small>in this organization</small>
            </article>
            <article>
              <span>Coverage</span>
              <strong>
                {sections.length
                  ? Math.round((covered / sections.length) * 100)
                  : 0}
                %
              </strong>
              <small>sections with scheduled entries</small>
            </article>
            <article>
              <span>Entries</span>
              <strong>{entryCount}</strong>
              <small>scheduled slots</small>
            </article>
          </div>
          <div className="academic-timetable-filters">
            <div className="academic-timetable-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search by section or class"
                placeholder="Search by section, class name or code..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                >
                  ×
                </button>
              )}
            </div>
            <div className="academic-timetable-filter-control">
              <select
                aria-label="Filter by class"
                value={classFilter}
                onChange={(event) => {
                  setClassFilter(event.target.value);
                  setSectionFilter('all');
                }}
              >
                <option value="all">All Classes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {classFilter !== 'all' && (
                <button
                  type="button"
                  aria-label="Clear class filter"
                  onClick={() => {
                    setClassFilter('all');
                    setSectionFilter('all');
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="academic-timetable-filter-control">
              <select
                aria-label="Filter by section"
                value={sectionFilter}
                onChange={(event) => setSectionFilter(event.target.value)}
              >
                <option value="all">All Sections</option>
                {sections
                  .filter(
                    (section) =>
                      classFilter === 'all' || section.classId === classFilter,
                  )
                  .map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
              </select>
              {sectionFilter !== 'all' && (
                <button
                  type="button"
                  aria-label="Clear section filter"
                  onClick={() => setSectionFilter('all')}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          {notice && (
            <p className="academic-timetable-notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {query.isPending ? (
            <p>Loading timetables…</p>
          ) : query.isError ? (
            <p className="form-error">{apiMessage(query.error)}</p>
          ) : (
            <div className="academic-timetable-table-wrap">
              <div className="academic-timetable-table-title">
                <h3>All Timetables ({filtered.length})</h3>
                <button
                  type="button"
                  className="academic-timetable-download"
                  onClick={downloadCsv}
                >
                  <Download size={15} aria-hidden="true" /> Download CSV
                </button>
              </div>
              <table className="academic-timetable-table">
                <colgroup>
                  <col className="timetable-col-section" />
                  <col className="timetable-col-class" />
                  <col className="timetable-col-entries" />
                  <col className="timetable-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Class</th>
                    <th>
                      <span className="academic-timetable-entries-heading">
                        <ListChecks size={14} aria-hidden="true" /> Entries
                      </span>
                    </th>
                    <th className="academic-timetable-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const section = sectionMap.get(item.sectionId);
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{section?.name ?? 'Section'}</strong>
                        </td>
                        <td>
                          {classMap.get(section?.classId ?? '')?.name ??
                            'Class'}
                        </td>
                        <td>
                          <span className="academic-timetable-entry-count">
                            {item.entries.length}
                          </span>
                        </td>
                        <td>
                          <div className="academic-timetable-row-actions">
                            <button
                              type="button"
                              aria-label={
                                'View ' +
                                (section?.name ?? 'section') +
                                ' timetable'
                              }
                              title="View"
                              onClick={() => startView(item)}
                            >
                              <Eye size={16} aria-hidden="true" />
                            </button>
                            {canWrite && (
                              <>
                                <button
                                  type="button"
                                  aria-label={
                                    'Edit ' +
                                    (section?.name ?? 'section') +
                                    ' timetable'
                                  }
                                  title="Edit"
                                  onClick={() => startEdit(item)}
                                >
                                  <Pencil size={16} aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="is-danger"
                                  aria-label={
                                    'Delete ' +
                                    (section?.name ?? 'section') +
                                    ' timetable'
                                  }
                                  title="Delete"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        'Delete this section timetable?',
                                      )
                                    )
                                      remove.mutate(item.id);
                                  }}
                                >
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={4} className="academic-timetable-empty">
                        No timetables found. Create the first section timetable
                        to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {bulkOpen && (
        <div className="academic-timetable-overlay">
          <section
            className="academic-period-dialog academic-bulk-break-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="academic-bulk-break-title"
          >
            <header>
              <div>
                <h3 id="academic-bulk-break-title">
                  Add break to many sections
                </h3>
                <p>
                  Existing lessons are never moved. Sections already teaching at
                  this time are skipped.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setBulkOpen(false)}
              >
                ×
              </button>
            </header>
            <label className="academic-timetable-field">
              Name
              <input
                value={bulkName}
                onChange={(event) => setBulkName(event.target.value)}
                maxLength={100}
              />
            </label>
            <div className="academic-period-time-fields">
              <label className="academic-timetable-field">
                Start Time
                <input
                  type="time"
                  value={bulkStart}
                  onChange={(event) => setBulkStart(event.target.value)}
                />
              </label>
              <label className="academic-timetable-field">
                End Time
                <input
                  type="time"
                  value={bulkEnd}
                  onChange={(event) => setBulkEnd(event.target.value)}
                />
              </label>
            </div>
            <label className="academic-timetable-field">
              Apply to
              <select
                value={bulkSectionIds.length ? 'selected' : 'all'}
                onChange={(event) =>
                  setBulkSectionIds(
                    event.target.value === 'all'
                      ? []
                      : sections.map((section) => section.id),
                  )
                }
              >
                <option value="all">Every section in the school</option>
                <option value="selected">Selected sections</option>
              </select>
            </label>
            {bulkSectionIds.length > 0 && (
              <div className="academic-bulk-section-list">
                {sections.map((section) => (
                  <label key={section.id}>
                    <input
                      type="checkbox"
                      checked={bulkSectionIds.includes(section.id)}
                      onChange={() =>
                        setBulkSectionIds((current) =>
                          current.includes(section.id)
                            ? current.filter((id) => id !== section.id)
                            : [...current, section.id],
                        )
                      }
                    />
                    {classMap.get(section.classId)?.name} · {section.name}
                  </label>
                ))}
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setBulkOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={
                  !bulkName.trim() || bulkStart >= bulkEnd || bulk.isPending
                }
                onClick={() => bulk.mutate()}
              >
                {bulk.isPending ? 'Adding…' : 'Add break'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
