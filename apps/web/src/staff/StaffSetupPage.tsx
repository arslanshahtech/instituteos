import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Plus, Pencil, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button.js';
import { LoadingState, ErrorState, PermissionDeniedState } from '../components/ui/States.js';
import { WorkspacePageHeading } from '../components/ui/WorkspacePrimitives.js';
import { useOrganizationAccess, apiMessage } from './StaffPageShared.js';
import { useOrganizationSettings, useUpdateOrganizationSettings } from '../settings/settings-api.js';
import type { StaffSetup, StaffSetupItem } from '../settings/settings-api.js';
import './staff-setup.css';

type SetupKey = keyof StaffSetup;
type SetupGroup = { key: SetupKey; title: string; help: string; example: string; placeholder: string; suggestions: string[] };
type SetupStep = { title: string; subtitle: string; purpose: string; groups: SetupGroup[] };
const steps: SetupStep[] = [
  { title: 'Organization structure', subtitle: 'Set up how your staff is organized.', purpose: 'These options appear when you add or edit a staff member. They help the school keep staff records organized.', groups: [
    { key: 'departments', title: 'Departments', help: 'A department tells you which part of the school a person works in.', example: 'Example: A Maths teacher belongs to Academics.', placeholder: 'e.g. Academics', suggestions: ['Academics', 'Administration', 'Finance', 'IT', 'Operations'] },
    { key: 'designations', title: 'Designations', help: 'A designation is the person’s job title, not their permission level.', example: 'Example: Mathematics Teacher, Principal, Accountant.', placeholder: 'e.g. Mathematics Teacher', suggestions: ['Principal', 'Vice Principal', 'Subject Teacher', 'Coordinator', 'Accountant', 'Librarian'] },
  ] },
  { title: 'Employment & work', subtitle: 'Define how and when staff work.', purpose: 'These details help the school understand each appointment and the working schedule. They do not create login permissions or calculate payroll.', groups: [
    { key: 'employmentTypes', title: 'Employment types', help: 'Describe the nature of a staff member’s appointment.', example: 'Example: Full-time for a regular teacher; Contract for a fixed-term hire.', placeholder: 'e.g. Full-time', suggestions: ['Full-time', 'Part-time', 'Contract', 'Visiting', 'Temporary'] },
    { key: 'workShifts', title: 'Work shifts', help: 'Name the time slot or shift a staff member is assigned to.', example: 'Example: Morning shift or Afternoon shift.', placeholder: 'e.g. Morning', suggestions: ['Morning', 'Afternoon', 'Evening'] },
  ] },
  { title: 'Qualifications & documents', subtitle: 'Standardize education and staff documents.', purpose: 'These lists make staff profiles consistent. They define document categories only; files are uploaded separately in the staff member’s profile.', groups: [
    { key: 'qualifications', title: 'Qualifications', help: 'Common education or professional qualifications.', example: 'Example: B.Ed, M.Ed, Bachelor or Master.', placeholder: 'e.g. B.Ed', suggestions: ['Matric', 'Intermediate', 'Bachelor', 'Master', 'MPhil', 'PhD', 'B.Ed', 'M.Ed'] },
    { key: 'documentTypes', title: 'Document types', help: 'Choose which document categories your school collects.', example: 'Example: CNIC, CV, degree certificate or experience letter.', placeholder: 'e.g. CNIC', suggestions: ['CNIC', 'Resume / CV', 'Educational Certificate', 'Experience Letter', 'Employment Contract', 'Photograph'] },
  ] },
];
const emptySetup: StaffSetup = { departments: [], designations: [], employmentTypes: [], workShifts: [], qualifications: [], documentTypes: [] };

function SetupList({ group, items, onChange }: { group: SetupGroup; items: StaffSetupItem[]; onChange: (items: StaffSetupItem[]) => void }) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const add = () => {
    const clean = value.trim();
    if (!clean || items.some((item) => item.name.toLowerCase() === clean.toLowerCase() && item.id !== editing)) return;
    onChange(editing ? items.map((item) => item.id === editing ? { ...item, name: clean } : item) : [...items, { id: crypto.randomUUID(), name: clean, isActive: true }]);
    setValue(''); setEditing(null);
  };
  const suggestions = group.suggestions.filter((suggestion) => !items.some((item) => item.name.toLowerCase() === suggestion.toLowerCase()));
  return <section className="setup-list-card">
    <div className="setup-list-title"><div><h3>{group.title}</h3><span>{items.filter((item) => item.isActive).length} active</span></div></div>
    <p className="setup-list-help">{group.help}</p>
    <p className="setup-list-example">{group.example}</p>
    <div className="setup-add-control"><input aria-label={`Add ${group.title}`} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} placeholder={group.placeholder} maxLength={120} /><button type="button" onClick={add} disabled={!value.trim()} aria-label={editing ? 'Update option' : `Add to ${group.title}`}>{editing ? <Check size={16} /> : <Plus size={16} />}</button>{editing && <button type="button" className="setup-cancel-edit" onClick={() => { setEditing(null); setValue(''); }} aria-label="Cancel edit"><X size={15} /></button>}</div>
    {suggestions.length > 0 && <div className="setup-suggestions"><span>Common options</span><div>{suggestions.slice(0, 6).map((suggestion) => <button type="button" key={suggestion} onClick={() => onChange([...items, { id: crypto.randomUUID(), name: suggestion, isActive: true }])}>+ {suggestion}</button>)}</div></div>}
    <div className="setup-items-list">{items.length ? items.map((item) => <div className={`setup-item ${item.isActive ? '' : 'is-inactive'}`} key={item.id}><span>{item.name}</span>{!item.isActive && <small>Inactive</small>}<button type="button" onClick={() => { setEditing(item.id); setValue(item.name); }} aria-label={`Edit ${item.name}`}><Pencil size={14} /></button><button type="button" onClick={() => onChange(items.map((entry) => entry.id === item.id ? { ...entry, isActive: !entry.isActive } : entry))} aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.name}`}><CheckCircle2 size={15} /></button></div>) : <p className="setup-empty-hint">No options added yet. Add your own or choose a common option above.</p>}</div>
  </section>;
}

export function StaffSetupPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const settings = useOrganizationSettings(organizationId, Boolean(access.data?.permissions.includes('organization.read')));
  const update = useUpdateOrganizationSettings(organizationId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<StaffSetup | null>(null);
  const source = draft ?? settings.data?.settings.staffSetup ?? emptySetup;
  const current = steps[step];
  const change = (key: SetupKey, items: StaffSetupItem[]) => setDraft({ ...source, [key]: items });
  const save = () => update.mutate({ staffSetup: source }, { onSuccess: () => setDraft(null) });
  const total = (Object.values(source) as StaffSetupItem[][]).reduce((sum, items) => sum + items.filter((item: StaffSetupItem) => item.isActive).length, 0);

  if (access.isLoading) return <LoadingState message="Checking staff setup access..." />;
  if (access.error || !access.data) return <ErrorState title="Organization unavailable" description={access.error ? apiMessage(access.error) : 'Staff setup could not be loaded.'} onRetry={() => void access.refetch()} />;
  if (!access.data.permissions.includes('organization.update')) return <PermissionDeniedState />;
  if (settings.isLoading) return <LoadingState message="Loading staff setup..." />;
  if (settings.error) return <ErrorState title="Staff setup unavailable" description={apiMessage(settings.error)} onRetry={() => void settings.refetch()} />;

  return <div className="staff-setup-page">
    <WorkspacePageHeading eyebrow="STAFF MANAGEMENT" title="Staff Setup" description="A few simple lists to keep every staff profile consistent." aside={<div className="setup-heading-meta"><span>{total} active options</span><span className={draft ? 'setup-unsaved' : 'setup-saved'}>{draft ? 'Unsaved changes' : 'All changes saved'}</span></div>} />
    <div className="setup-fixed-types"><div><strong>Staff types</strong><p>InstituteOS uses these two fixed staff classifications.</p></div><span>Teacher</span><span>Other Staff</span><small>Not permission roles</small></div>
    <div className="setup-stepper" aria-label="Setup progress">{steps.map((item, index) => <button type="button" key={item.title} className={index === step ? 'current' : index < step ? 'completed' : ''} onClick={() => setStep(index)}><span className="setup-step-number">{index < step ? <Check size={14} /> : index + 1}</span><span><strong>{item.title}</strong><small>Step {index + 1} of 3</small></span></button>)}</div>
    <section className="setup-step-content"><div className="setup-step-intro"><div><span className="setup-step-kicker">STEP {step + 1} OF 3</span><h2>{current.title}</h2><p>{current.subtitle}</p></div><div className="setup-step-purpose"><strong>Why is this needed?</strong><p>{current.purpose}</p></div></div>
      <div className="setup-groups-grid">{current.groups.map((group) => <SetupList key={group.key} group={group} items={source[group.key]} onChange={(items) => change(group.key, items)} />)}</div>
      <div className="setup-step-footer"><Button onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}><ArrowLeft size={15} /> Back</Button><div><Button variant="primary" onClick={save} disabled={!draft || update.isPending}><Check size={15} /> {update.isPending ? 'Saving...' : 'Save changes'}</Button>{step < 2 ? <Button variant="primary" onClick={() => setStep((value) => Math.min(2, value + 1))}>Next step <ArrowRight size={15} /></Button> : <span className="setup-finish-note">You’re at the final step.</span>}</div></div>
    </section>
    {update.error && <p className="staff-setup-error" role="alert">{apiMessage(update.error)}</p>}
  </div>;
}
