import { useEffect, useMemo, useState } from 'react';
import { Archive, BookOpen, ChevronRight, Plus, Search, Users, X } from 'lucide-react';
import type { AcademicClass, AcademicSection, AcademicYear, AcademicCampus, AcademicSubject, TeacherAssignment } from './academics-api.js';

interface Props {
  classes: AcademicClass[];
  sections: AcademicSection[];
  years: AcademicYear[];
  campuses: AcademicCampus[];
  subjects: AcademicSubject[];
  assignments: TeacherAssignment[];
  teachers: Array<{ id: string; firstName: string; lastName: string }>;
  onCreate: (resource: 'classes' | 'sections') => void;
  onCreateSubject: () => void;
  onEdit: (resource: 'classes' | 'sections', record: AcademicClass | AcademicSection) => void;
  onDelete: (resource: 'classes' | 'sections', id: string, title: string) => void;
  onOpenEnrollment: (sectionId?: string, classId?: string, view?: 'students' | 'teacher') => void;
  onOpenCampusSetup: () => void;
}

export function ClassesSectionsReferenceView({
  classes, sections, years, campuses, subjects, assignments, teachers,
  onCreate, onCreateSubject, onEdit, onDelete, onOpenEnrollment, onOpenCampusSetup,
}: Props) {
  const [campusFilter, setCampusFilter] = useState('all');
  const [yearId, setYearId] = useState(years.find((year) => year.status === 'active')?.id ?? years[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'sections' | 'teachers'>('sections');
  useEffect(() => {
    if (!yearId && years.length) setYearId(years.find((year) => year.status === 'active')?.id ?? years[0]!.id);
  }, [yearId, years]);

  const campusNames = useMemo(() => new Map(campuses.map((campus) => [campus.id, campus.name])), [campuses]);
  const filteredClasses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return classes.filter((item) => {
      const matchesCampus = campusFilter === 'all' || item.campusId === campusFilter;
      const matchesSearch = !term || `${item.name} ${item.code} ${campusNames.get(item.campusId) ?? ''}`.toLocaleLowerCase().includes(term);
      return matchesCampus && matchesSearch;
    });
  }, [classes, campusFilter, campusNames, search]);
  const selectedClass = classes.find((item) => item.id === selectedId) ?? null;
  const selectedSections = selectedClass ? sections.filter((item) => item.classId === selectedClass.id) : [];
  const selectedAssignments = selectedClass ? assignments.filter((item) => item.classId === selectedClass.id && (!yearId || item.academicYearId === yearId)) : [];

  return (
    <main className="page-stack classes-reference-page">
      <header className="cr-header">
        <div>
          <div className="cr-kicker-row">
            <span className="cr-module-pill">Module</span>
            <span className="cr-muted">InstituteOS · Academic workspace</span>
          </div>
          <h1>Classes &amp; Sections</h1>
          <p>Manage classes, sections, student rosters and teacher assignments in one place.</p>
        </div>
        <div className="cr-header-actions">
          <label className="cr-session-control">
            <span>Session</span>
            <select aria-label="Academic session" value={yearId} onChange={(event) => setYearId(event.target.value)}>
              {years.length === 0 && <option value="">No sessions</option>}
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.status === 'active' ? ' • Current' : ''}</option>)}
            </select>
          </label>
          <button className="cr-primary-button" type="button" onClick={() => campuses.length ? onCreate('classes') : onOpenCampusSetup()}><Plus size={16} /> Create Class</button>
        </div>
      </header>

      {campuses.length === 0 && (
        <section className="cr-campus-setup-alert" role="status">
          <div><strong>Campus setup is needed before creating a class</strong><p>Campus aapke institute ki branch/location hoti hai. Pehle campus banayein, phir class us campus ke saath assign karein.</p></div>
          <button className="cr-primary-button" type="button" onClick={onOpenCampusSetup}>Create Campus</button>
        </section>
      )}

      <section className="cr-stat-grid" aria-label="Academic summary">
        <article className="cr-stat-card"><span className="cr-stat-icon"><BookOpen size={17} /></span><p>Total Classes</p><strong>{classes.length}</strong><small>Across this organization</small></article>
        <article className="cr-stat-card"><span className="cr-stat-icon"><Users size={17} /></span><p>Total Sections</p><strong>{sections.length}</strong><small>Across {classes.length} classes</small></article>
        <article className="cr-stat-card"><span className="cr-stat-icon"><Users size={17} /></span><p>Campuses</p><strong>{campuses.length}</strong><small>Locations available to classes</small></article>
        <article className="cr-stat-card"><span className="cr-stat-icon"><BookOpen size={17} /></span><p>Academic Sessions</p><strong>{years.length}</strong><small>{years.some((year) => year.status === 'active') ? 'An active session is configured' : 'Set up an active session'}</small></article>
      </section>

      <section className="cr-workspace">
        <div className="cr-list-column">
          <div className="cr-toolbar">
            <div className="cr-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search classes, sections, code..." aria-label="Search classes" /></div>
            <select className="cr-filter-select" value={campusFilter} onChange={(event) => setCampusFilter(event.target.value)} aria-label="Filter by campus">
              <option value="all">All Campuses</option>
              {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
            </select>
          </div>

          <div className="cr-section-title"><div><span className="cr-eyebrow">ACADEMIC STRUCTURE</span><h2>Classes</h2></div><span className="cr-count">{filteredClasses.length} total</span></div>

          {filteredClasses.length ? (
            <div className="cr-class-grid">
              {filteredClasses.map((item) => {
                const itemSections = sections.filter((section) => section.classId === item.id);
                const active = item.id === selectedId;
                return (
                  <button className={`cr-class-card${active ? ' is-selected' : ''}`} key={item.id} type="button" onClick={() => { setSelectedId(item.id); setDrawerTab('sections'); }}>
                    <div className="cr-class-card-top"><span className="cr-class-avatar">{item.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="cr-card-code">{item.code}</span></div>
                    <h3>{item.name}</h3>
                    <p className="cr-card-campus">{campusNames.get(item.campusId) ?? 'Campus not available'}</p>
                    <div className="cr-card-footer"><span><Users size={14} /> {itemSections.length} sections</span><ChevronRight size={16} /></div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="cr-empty-state"><span className="cr-empty-icon"><BookOpen size={22} /></span><h3>No classes found</h3><p>{search || campusFilter !== 'all' ? 'Try changing your search or academy filter.' : 'Create the first class for this organization.'}</p>{!search && campusFilter === 'all' && <button className="cr-primary-button" type="button" onClick={() => campuses.length ? onCreate('classes') : onOpenCampusSetup()}><Plus size={16} /> Create Class</button>}</div>
          )}
        </div>

        <aside className="cr-detail-column">
          {selectedClass ? (
            <>
              <div className="cr-detail-header">
                <div className="cr-detail-title"><span className="cr-class-avatar cr-detail-avatar">{selectedClass.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><h2>{selectedClass.name}</h2><p>{selectedClass.code} · {campusNames.get(selectedClass.campusId) ?? 'Campus'}</p></div></div>
                <button className="cr-icon-button" type="button" aria-label="Close class details" onClick={() => setSelectedId(null)}><X size={16} /></button>
              </div>
              <div className="cr-detail-tabs" role="tablist" aria-label="Class details">
                <button type="button" role="tab" aria-selected={drawerTab === 'sections'} className={drawerTab === 'sections' ? 'active' : ''} onClick={() => setDrawerTab('sections')}>Sections ({selectedSections.length})</button>
                <button type="button" role="tab" aria-selected={drawerTab === 'teachers'} className={drawerTab === 'teachers' ? 'active' : ''} onClick={() => setDrawerTab('teachers')}>Teachers &amp; Subjects ({selectedAssignments.length})</button>
              </div>
              {drawerTab === 'sections' ? (
                <div className="cr-detail-body">
                  <div className="cr-detail-section-heading"><div><h3>Class Sections</h3><p>Sections configured for this class.</p></div><button className="cr-small-dark-button" type="button" onClick={() => onCreate('sections')}><Plus size={14} /> Add Section</button></div>
                  {selectedSections.length ? <div className="cr-section-list">{selectedSections.map((section) => <article className="cr-section-row" key={section.id}><span className="cr-section-letter">{section.name.slice(0, 1).toUpperCase()}</span><div className="cr-section-row-copy"><strong>{section.name}</strong><small>{section.capacity ? `Capacity ${section.capacity}` : 'Capacity not set'}</small></div><button className="cr-text-button" type="button" onClick={() => onEdit('sections', section)}>Edit</button><button className="cr-text-button danger" type="button" onClick={() => onDelete('sections', section.id, section.name)}>Delete</button></article>)}</div> : <div className="cr-empty-inline"><p>No sections created for this class yet.</p><button className="cr-text-button" type="button" onClick={() => onCreate('sections')}>Add the first section</button></div>}
                  <div className="cr-detail-actions"><button className="cr-secondary-button" type="button" onClick={() => onOpenEnrollment(selectedSections[0]?.id, selectedClass.id, 'students')}><Users size={15} /> View Students</button><button className="cr-primary-button" type="button" onClick={() => onOpenEnrollment(selectedSections[0]?.id, selectedClass.id, 'students')}><Plus size={15} /> Add Students</button><button className="cr-secondary-button" type="button" onClick={() => selectedSections.length ? onOpenEnrollment(selectedSections[0]?.id, selectedClass.id, 'teacher') : onCreate('sections')}><BookOpen size={15} /> Assign Teacher</button><button className="cr-secondary-button" type="button" onClick={() => onEdit('classes', selectedClass)}>Edit Class</button><button className="cr-danger-button" type="button" onClick={() => onDelete('classes', selectedClass.id, selectedClass.name)}><Archive size={15} /> Delete Class</button></div>
                </div>
              ) : (
                <div className="cr-detail-body">
                  <div className="cr-detail-section-heading"><div><h3>Subjects &amp; Teachers</h3><p>Add subjects, then assign a teacher for each section and academic year.</p></div><button className="cr-small-dark-button" type="button" onClick={onCreateSubject}><Plus size={14} /> Add Subject</button></div>
                  {selectedAssignments.length ? <div className="cr-section-list">{selectedAssignments.map((assignment) => { const subject = subjects.find((item) => item.id === assignment.subjectId); return <article className="cr-section-row" key={assignment.id}><span className="cr-section-letter"><BookOpen size={15} /></span><div className="cr-section-row-copy"><strong>{subject?.name ?? 'Subject'}</strong><small>{teachers.find((item) => item.id === assignment.teacherStaffId)?.firstName ?? 'Teacher'} {teachers.find((item) => item.id === assignment.teacherStaffId)?.lastName ?? ''} · {subject?.code ?? 'No subject code'} · {sections.find((item) => item.id === assignment.sectionId)?.name ?? 'Section'} · {years.find((item) => item.id === assignment.academicYearId)?.name ?? 'Academic year'}</small></div></article>; })}</div> : <div className="cr-empty-inline"><p>No teacher assignments for this class yet.</p><span>Add a subject first, then open Assign Teacher to choose the subject, section, year and teacher.</span><button className="cr-text-button" type="button" onClick={() => onOpenEnrollment(selectedSections[0]?.id, selectedClass.id, 'teacher')}>Open teacher assignment</button></div>}
                </div>
              )}
            </>
          ) : (
            <div className="cr-detail-placeholder"><span className="cr-empty-icon"><BookOpen size={22} /></span><h3>Select a class</h3><p>Choose a class to view its sections, manage details, and review teacher assignments.</p></div>
          )}
        </aside>
      </section>

      <footer className="cr-footer"><span>InstituteOS · Classes &amp; Sections</span><span><span className="cr-live-dot" /> Live organization data</span></footer>
    </main>
  );
}
