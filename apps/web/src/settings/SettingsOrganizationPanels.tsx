import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button.js';
import type {
  OrganizationSettings,
  OrganizationSettingsInput,
  StaffSetup,
  StaffSetupItem,
} from './settings-api.js';

type SaveSettings = (input: OrganizationSettingsInput) => void;

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-card" aria-labelledby="settings-panel-title">
      <header className="settings-card-heading">
        <div>
          <h2 id="settings-panel-title">{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function SaveRow({ disabled, saving }: { disabled: boolean; saving: boolean }) {
  return (
    <div className="settings-save-row">
      <Button type="submit" variant="primary" disabled={disabled}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

function formText(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? '').trim();
}

export function InstituteInfoSettings({
  settings,
  canUpdate,
  saving,
  onSave,
}: {
  settings: OrganizationSettings;
  canUpdate: boolean;
  saving: boolean;
  onSave: SaveSettings;
}) {
  const [primaryColor, setPrimaryColor] = useState(
    settings.branding.primaryColor,
  );
  useEffect(
    () => setPrimaryColor(settings.branding.primaryColor),
    [settings.branding.primaryColor],
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    onSave({
      branding: {
        logoUrl: formText(form, 'logoUrl'),
        primaryColor: primaryColor || '#0f766e',
        tagLine: formText(form, 'tagLine'),
      },
      contact: {
        email: formText(form, 'email'),
        phone: formText(form, 'phone'),
        address: formText(form, 'address'),
        website: formText(form, 'website'),
      },
    });
  }

  return (
    <SettingsCard
      title="Institute information"
      description="Manage your institute identity and the contact details shown across your organization."
    >
      {!canUpdate && (
        <p className="settings-readonly-note">
          You have read-only access to organization settings.
        </p>
      )}
      <form className="settings-fields" onSubmit={submit}>
        <label className="settings-field">
          <span>Logo URL</span>
          <input
            name="logoUrl"
            type="url"
            maxLength={500}
            defaultValue={settings.branding.logoUrl ?? ''}
            disabled={!canUpdate}
            placeholder="https://example.com/logo.png"
          />
          <small>Use a publicly accessible HTTPS image URL.</small>
        </label>
        <label className="settings-field">
          <span>Primary brand color</span>
          <div className="settings-color-control">
            <input
              className="settings-color-picker"
              name="primaryColor"
              type="color"
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              disabled={!canUpdate}
            />
            <span className="settings-color-value">{primaryColor}</span>
          </div>
        </label>
        <label className="settings-field settings-field-wide">
          <span>Tagline</span>
          <input
            name="tagLine"
            maxLength={160}
            defaultValue={settings.branding.tagLine ?? ''}
            disabled={!canUpdate}
            placeholder="A short line about your institute"
          />
        </label>
        <label className="settings-field">
          <span>Contact email</span>
          <input
            name="email"
            type="email"
            maxLength={254}
            defaultValue={settings.contact.email ?? ''}
            disabled={!canUpdate}
          />
        </label>
        <label className="settings-field">
          <span>Contact phone</span>
          <input
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={settings.contact.phone ?? ''}
            disabled={!canUpdate}
          />
        </label>
        <label className="settings-field settings-field-wide">
          <span>Website</span>
          <input
            name="website"
            type="url"
            maxLength={300}
            defaultValue={settings.contact.website ?? ''}
            disabled={!canUpdate}
            placeholder="https://example.com"
          />
        </label>
        <label className="settings-field settings-field-wide">
          <span>Address</span>
          <textarea
            name="address"
            maxLength={300}
            rows={3}
            defaultValue={settings.contact.address ?? ''}
            disabled={!canUpdate}
          />
        </label>
        {canUpdate && <SaveRow disabled={saving} saving={saving} />}
      </form>
    </SettingsCard>
  );
}

export function LocalizationSettings({
  settings,
  canUpdate,
  saving,
  onSave,
}: {
  settings: OrganizationSettings;
  canUpdate: boolean;
  saving: boolean;
  onSave: SaveSettings;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    onSave({
      localization: {
        timezone: formText(form, 'timezone'),
        currency: formText(form, 'currency').toUpperCase(),
        dateFormat: formText(form, 'dateFormat'),
      },
    });
  }

  return (
    <SettingsCard
      title="Localization"
      description="Set the time zone, currency and date format used for organization records and reports."
    >
      <form className="settings-fields" onSubmit={submit}>
        <label className="settings-field settings-field-wide">
          <span>Time zone</span>
          <input
            name="timezone"
            required
            maxLength={80}
            defaultValue={settings.localization.timezone}
            disabled={!canUpdate}
            placeholder="Asia/Karachi"
          />
          <small>
            Use an IANA time-zone name, for example Asia/Karachi or
            Europe/London.
          </small>
        </label>
        <label className="settings-field">
          <span>Currency</span>
          <select
            name="currency"
            defaultValue={settings.localization.currency}
            disabled={!canUpdate}
          >
            {['PKR', 'USD', 'GBP', 'EUR', 'AED', 'SAR', 'INR', 'BDT'].map(
              (currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ),
            )}
          </select>
        </label>
        <label className="settings-field">
          <span>Date format</span>
          <select
            name="dateFormat"
            defaultValue={settings.localization.dateFormat}
            disabled={!canUpdate}
          >
            <option value="YYYY-MM-DD">YYYY-MM-DD (2026-11-14)</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY (14-11-2026)</option>
            <option value="MM-DD-YYYY">MM-DD-YYYY (11-14-2026)</option>
            <option value="DD MMM YYYY">DD MMM YYYY (14 Nov 2026)</option>
          </select>
        </label>
        {canUpdate && <SaveRow disabled={saving} saving={saving} />}
      </form>
    </SettingsCard>
  );
}

const staffLists: Array<{ key: keyof StaffSetup; title: string }> = [
  { key: 'departments', title: 'Departments' },
  { key: 'designations', title: 'Designations' },
  { key: 'employmentTypes', title: 'Employment types' },
  { key: 'workShifts', title: 'Work shifts' },
  { key: 'qualifications', title: 'Qualifications' },
  { key: 'documentTypes', title: 'Document types' },
];

export function StaffSetupSettings({
  settings,
  canUpdate,
  saving,
  onSave,
}: {
  settings: OrganizationSettings;
  canUpdate: boolean;
  saving: boolean;
  onSave: SaveSettings;
}) {
  const [staffSetup, setStaffSetup] = useState<StaffSetup>(settings.staffSetup);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    setStaffSetup(settings.staffSetup);
  }, [settings.staffSetup]);

  function addItem(key: keyof StaffSetup) {
    const name = (drafts[key] ?? '').trim();
    if (!name) {
      setError('Enter a name before adding an item.');
      return;
    }
    if (staffSetup[key].length >= 100) {
      setError('Each staff list can contain up to 100 items.');
      return;
    }
    if (
      staffSetup[key].some(
        (item) => item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError('This item already exists in the list.');
      return;
    }
    const item: StaffSetupItem = {
      id: crypto.randomUUID(),
      name,
      isActive: true,
    };
    setStaffSetup((current) => ({
      ...current,
      [key]: [...current[key], item],
    }));
    setDrafts((current) => ({ ...current, [key]: '' }));
    setError('');
  }

  function updateItem(
    key: keyof StaffSetup,
    id: string,
    changes: Partial<StaffSetupItem>,
  ) {
    setStaffSetup((current) => ({
      ...current,
      [key]: current[key].map((item) =>
        item.id === id ? { ...item, ...changes } : item,
      ),
    }));
  }

  return (
    <SettingsCard
      title="Staff setup"
      description="Maintain reusable organization-specific lists for staff profiles and staff records."
    >
      {!canUpdate && (
        <p className="settings-readonly-note">
          You have read-only access to staff setup options.
        </p>
      )}
      <div className="staff-setup-groups">
        {staffLists.map(({ key, title }) => (
          <section className="staff-setup-group" key={key} aria-label={title}>
            <div className="staff-setup-heading">
              <h3>{title}</h3>
              <span>{staffSetup[key].length} / 100</span>
            </div>
            <div className="staff-setup-add">
              <input
                aria-label={'New ' + title.toLowerCase()}
                value={drafts[key] ?? ''}
                maxLength={120}
                disabled={!canUpdate || staffSetup[key].length >= 100}
                onChange={(event) =>
                  setDrafts((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addItem(key);
                  }
                }}
                placeholder={'Add ' + title.toLowerCase()}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={!canUpdate || staffSetup[key].length >= 100}
                onClick={() => addItem(key)}
              >
                <Plus size={15} /> Add
              </Button>
            </div>
            {staffSetup[key].length ? (
              <ul className="staff-setup-list">
                {staffSetup[key].map((item) => (
                  <li key={item.id}>
                    <span className="staff-setup-item-name">{item.name}</span>
                    <label className="staff-setup-active">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        disabled={!canUpdate}
                        onChange={(event) =>
                          updateItem(key, item.id, {
                            isActive: event.target.checked,
                          })
                        }
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="settings-icon-button"
                      aria-label={'Remove ' + item.name}
                      disabled={!canUpdate}
                      onClick={() =>
                        setStaffSetup((current) => ({
                          ...current,
                          [key]: current[key].filter(
                            (entry) => entry.id !== item.id,
                          ),
                        }))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="staff-setup-empty">No items added yet.</p>
            )}
          </section>
        ))}
      </div>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {canUpdate && (
        <div className="settings-save-row">
          <Button
            type="button"
            variant="primary"
            disabled={saving}
            onClick={() => onSave({ staffSetup })}
          >
            {saving ? 'Saving…' : 'Save staff setup'}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}

const attendanceStatuses: Array<{
  value: 'present' | 'absent' | 'half-day' | 'on-leave';
  label: string;
}> = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half-day', label: 'Half day' },
  { value: 'on-leave', label: 'On leave' },
];

export function AttendancePolicySettings({
  settings,
  canUpdate,
  saving,
  onSave,
}: {
  settings: OrganizationSettings;
  canUpdate: boolean;
  saving: boolean;
  onSave: SaveSettings;
}) {
  const [policy, setPolicy] = useState(settings.teacherSelfAttendance);
  useEffect(
    () => setPolicy(settings.teacherSelfAttendance),
    [settings.teacherSelfAttendance],
  );

  function toggleStatus(
    status: (typeof attendanceStatuses)[number]['value'],
    checked: boolean,
  ) {
    setPolicy((current) => ({
      ...current,
      allowedStatuses: checked
        ? [...current.allowedStatuses, status]
        : current.allowedStatuses.filter((item) => item !== status),
    }));
  }

  return (
    <SettingsCard
      title="Teacher attendance policy"
      description="Control what teachers can view and which attendance statuses they may submit for themselves."
    >
      <div className="settings-toggles">
        <label className="settings-toggle">
          <span>
            <strong>View own attendance</strong>
            <small>
              Allow teachers to review their personal attendance history.
            </small>
          </span>
          <input
            type="checkbox"
            checked={policy.viewOwnAttendance}
            disabled={!canUpdate}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                viewOwnAttendance: event.target.checked,
              }))
            }
          />
        </label>
        <label className="settings-toggle">
          <span>
            <strong>Self-mark attendance</strong>
            <small>
              Allow teachers to submit their own attendance when the workflow
              supports it.
            </small>
          </span>
          <input
            type="checkbox"
            checked={policy.selfMarkingEnabled}
            disabled={!canUpdate}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                selfMarkingEnabled: event.target.checked,
              }))
            }
          />
        </label>
      </div>
      <fieldset className="settings-status-fieldset" disabled={!canUpdate}>
        <legend>Statuses teachers may select</legend>
        <div className="settings-status-options">
          {attendanceStatuses.map(({ value, label }) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={policy.allowedStatuses.includes(value)}
                onChange={(event) => toggleStatus(value, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {policy.allowedStatuses.length === 0 && (
        <p className="settings-error" role="alert">
          Select at least one attendance status.
        </p>
      )}
      {!canUpdate && (
        <p className="settings-readonly-note">
          You have read-only access to attendance policy settings.
        </p>
      )}
      {canUpdate && (
        <div className="settings-save-row">
          <Button
            type="button"
            variant="primary"
            disabled={saving || policy.allowedStatuses.length === 0}
            onClick={() => onSave({ teacherSelfAttendance: policy })}
          >
            {saving ? 'Saving…' : 'Save attendance policy'}
          </Button>
        </div>
      )}
    </SettingsCard>
  );
}
