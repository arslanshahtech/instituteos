import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../components/ui/ToastProvider.js';
import './attendance-settings.css';

type AttendanceSettings = {
  organizationId: string;
  timezone: string;
  schoolStartTime: string;
  gracePeriodMinutes: number;
  markingCutoffTime: string;
  autoMarkUnmarkedAbsent: boolean;
  allowAdminOverride: boolean;
  workingDays: string[];
};

const defaults: AttendanceSettings = {
  organizationId: '',
  timezone: 'Asia/Karachi',
  schoolStartTime: '08:00',
  gracePeriodMinutes: 15,
  markingCutoffTime: '09:00',
  autoMarkUnmarkedAbsent: false,
  allowAdminOverride: true,
  workingDays: [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ],
};

const dayOptions = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
] as const;

export function AttendanceSettingsPanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState<AttendanceSettings>(defaults);
  const queryKey = ['attendance', organizationId, 'settings'] as const;
  const settings = useQuery({
    queryKey,
    queryFn: () =>
      apiRequest<{ settings: AttendanceSettings }>(
        '/organizations/' +
          encodeURIComponent(organizationId) +
          '/attendance/settings',
      ),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const save = useMutation({
    mutationFn: (input: Omit<AttendanceSettings, 'organizationId'>) =>
      apiRequest<{ settings: AttendanceSettings }>(
        '/organizations/' +
          encodeURIComponent(organizationId) +
          '/attendance/settings',
        { method: 'PATCH', body: JSON.stringify(input) },
      ),
    onSuccess: async (result) => {
      setForm(result.settings);
      await queryClient.invalidateQueries({ queryKey });
      showToast('Attendance settings saved.');
    },
  });

  useEffect(() => {
    if (settings.data?.settings) setForm(settings.data.settings);
  }, [settings.data?.settings]);

  const savedSettings = settings.data?.settings;
  const hasUnsavedChanges =
    Boolean(savedSettings) &&
    JSON.stringify(form) !== JSON.stringify(savedSettings);

  if (settings.isPending)
    return (
      <div className="attendance-settings-state">
        Loading attendance settings...
      </div>
    );
  if (settings.isError)
    return (
      <div
        className="attendance-settings-state attendance-settings-error"
        role="alert"
      >
        Attendance settings could not be loaded:{' '}
        {settings.error instanceof Error
          ? settings.error.message
          : 'Unknown API error'}
        . Refresh the page after checking your organization access.
      </div>
    );

  const update = <K extends keyof AttendanceSettings>(
    key: K,
    value: AttendanceSettings[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="attendance-settings-page">
      <header className="attendance-settings-heading">
        <div>
          <span className="attendance-settings-eyebrow">
            Attendance configuration
          </span>
          <h2>Attendance Settings</h2>
          <p>
            Set the school day, teacher marking deadline, and automatic absence
            rules for this organization.
          </p>
        </div>
        <span className="attendance-settings-scope">Organization-wide</span>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate({
            timezone: form.timezone,
            schoolStartTime: form.schoolStartTime,
            gracePeriodMinutes: form.gracePeriodMinutes,
            markingCutoffTime: form.markingCutoffTime,
            autoMarkUnmarkedAbsent: form.autoMarkUnmarkedAbsent,
            allowAdminOverride: form.allowAdminOverride,
            workingDays: form.workingDays,
          });
        }}
      >
        <section className="attendance-settings-card">
          <div className="attendance-settings-card-title">
            <div>
              <h3>Attendance schedule</h3>
              <p>
                Set the school start, late-arrival grace period, and final
                attendance cutoff. All times use the institute timezone.
              </p>
            </div>
          </div>
          <div className="attendance-settings-grid">
            <label className="attendance-settings-field">
              <span>Institute timezone</span>
              <select
                value={form.timezone}
                onChange={(event) => update('timezone', event.target.value)}
              >
                <option value="Asia/Karachi">Pakistan — Asia/Karachi</option>
                <option value="UTC">UTC</option>
                <option value="Asia/Dubai">UAE — Asia/Dubai</option>
                <option value="Europe/London">UK — Europe/London</option>
              </select>
              <small>
                Used to calculate the attendance cutoff in local school time.
              </small>
            </label>
            <label className="attendance-settings-field">
              <span>School start time</span>
              <input
                type="time"
                required
                value={form.schoolStartTime}
                onChange={(event) =>
                  update('schoolStartTime', event.target.value)
                }
              />
              <small>
                Used as the reference time when staff review late arrivals.
              </small>
            </label>
            <label className="attendance-settings-field">
              <span>Grace period (minutes)</span>
              <input
                type="number"
                min={0}
                max={120}
                step={1}
                required
                value={form.gracePeriodMinutes}
                onChange={(event) =>
                  update('gracePeriodMinutes', Number(event.target.value))
                }
              />
              <small>
                Helps staff decide when to manually mark a student Late. The
                system does not automatically change attendance to Late.
              </small>
            </label>
            <label className="attendance-settings-field">
              <span>Attendance marking cutoff</span>
              <input
                type="time"
                required
                value={form.markingCutoffTime}
                onChange={(event) =>
                  update('markingCutoffTime', event.target.value)
                }
              />
              <small>
                At this time, any students still unmarked are automatically
                saved as Absent when automatic absence is enabled. Teachers
                cannot submit normal roll-call changes after the cutoff.
              </small>
            </label>
          </div>
        </section>

        <section className="attendance-settings-card">
          <div className="attendance-settings-card-title">
            <div>
              <h3>Automatic student absence</h3>
              <p>
                Unmarked active students are saved as Absent after the cutoff.
              </p>
            </div>
          </div>
          <label className="attendance-settings-toggle">
            <span>
              <strong>Automatically mark unmarked students Absent</strong>
              <small>
                The system checks the active academic year and class placements.
                Existing Present, Late, Leave, or manually entered Absent
                records are preserved.
              </small>
            </span>
            <input
              type="checkbox"
              checked={form.autoMarkUnmarkedAbsent}
              onChange={(event) =>
                update('autoMarkUnmarkedAbsent', event.target.checked)
              }
            />
          </label>
          <label className="attendance-settings-toggle">
            <span>
              <strong>Allow administrator override after cutoff</strong>
              <small>
                Organization Owner and Admin can correct attendance after the
                deadline. All changes remain subject to attendance.write
                permission.
              </small>
            </span>
            <input
              type="checkbox"
              checked={form.allowAdminOverride}
              onChange={(event) =>
                update('allowAdminOverride', event.target.checked)
              }
            />
          </label>
          <div className="attendance-settings-days">
            <strong>Working days</strong>
            <p>
              Automatic absence is skipped on non-working days and institute
              holidays with “No classes” enabled.
            </p>
            <div className="attendance-settings-day-options">
              {dayOptions.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    checked={form.workingDays.includes(value)}
                    onChange={(event) =>
                      update(
                        'workingDays',
                        event.target.checked
                          ? [...form.workingDays, value]
                          : form.workingDays.filter((day) => day !== value),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>

        {save.isError && (
          <p className="attendance-settings-error" role="alert">
            Settings could not be saved:{' '}
            {save.error instanceof Error
              ? save.error.message
              : 'Unknown API error'}
            . Please check your access and try again.
          </p>
        )}
        <div className="attendance-settings-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={!hasUnsavedChanges || save.isPending}
            onClick={() => savedSettings && setForm(savedSettings)}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={
              save.isPending ||
              !hasUnsavedChanges ||
              form.workingDays.length === 0
            }
          >
            {save.isPending ? 'Saving settings...' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </section>
  );
}
