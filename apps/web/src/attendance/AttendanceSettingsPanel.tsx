import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { useToast } from '../components/ui/ToastProvider.js';
import {
  useOrganizationSettings,
  useUpdateOrganizationSettings,
} from '../settings/settings-api.js';
import type { OrganizationSettings } from '../settings/settings-api.js';
import './attendance-settings.css';

type AttendanceSettings = {
  organizationId: string;
  timezone: string;
  schoolStartTime: string;
  gracePeriodMinutes: number;
  markingCutoffTime: string;
  teacherMarkingCutoffEnabled: boolean;
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
  teacherMarkingCutoffEnabled: false,
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
  const organizationPolicy = useOrganizationSettings(organizationId);
  const updateOrganizationPolicy =
    useUpdateOrganizationSettings(organizationId);
  const [teacherPolicy, setTeacherPolicy] = useState<
    OrganizationSettings['teacherSelfAttendance']
  >({
    viewOwnAttendance: true,
    selfMarkingEnabled: false,
    allowedStatuses: ['present'],
  });
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

  useEffect(() => {
    if (organizationPolicy.data?.settings.teacherSelfAttendance) {
      setTeacherPolicy(organizationPolicy.data.settings.teacherSelfAttendance);
    }
  }, [organizationPolicy.data?.settings.teacherSelfAttendance]);

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

  const updateTeacherPolicy = (
    next: OrganizationSettings['teacherSelfAttendance'],
  ) => {
    setTeacherPolicy(next);
    updateOrganizationPolicy.mutate(
      { teacherSelfAttendance: next },
      {
        onError: () =>
          setTeacherPolicy(
            organizationPolicy.data?.settings.teacherSelfAttendance ?? {
              viewOwnAttendance: true,
              selfMarkingEnabled: false,
              allowedStatuses: ['present'],
            },
          ),
      },
    );
  };

  return (
    <section className="attendance-settings-page">
      <header className="attendance-settings-heading">
        <div>
          <span className="attendance-settings-eyebrow">
            Attendance configuration
          </span>
          <h2>Attendance Settings</h2>
          <p>Configure attendance timings, rules and teacher access.</p>
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
            teacherMarkingCutoffEnabled: form.teacherMarkingCutoffEnabled,
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
              <p>Set the start time, late grace period and daily cutoff.</p>
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
              <small>Used for attendance dates and cutoff times.</small>
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
              <small>Reference time for late arrivals.</small>
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
                Guides manual Late marking; status is not changed automatically.
              </small>
            </label>
            <label className="attendance-settings-field">
              <span>Daily attendance cutoff time</span>
              <input
                type="time"
                disabled={
                  !form.teacherMarkingCutoffEnabled &&
                  !form.autoMarkUnmarkedAbsent
                }
                required={
                  form.teacherMarkingCutoffEnabled ||
                  form.autoMarkUnmarkedAbsent
                }
                value={form.markingCutoffTime}
                onChange={(event) =>
                  update('markingCutoffTime', event.target.value)
                }
              />
              <small>
                Applies to teacher lock time and, separately, the automatic
                absence schedule when that option is enabled.
              </small>
            </label>
          </div>
        </section>

        <section className="attendance-settings-card">
          <div className="attendance-settings-card-title">
            <div>
              <h3>Teacher attendance marking</h3>
              <p>Set a cutoff for teacher-submitted student attendance.</p>
            </div>
          </div>
          <label className="attendance-settings-toggle">
            <span>
              <strong>Restrict teachers after a daily cutoff</strong>
              <small>
                Off means teachers can record today's class attendance at any
                time. Past dates remain restricted.
              </small>
            </span>
            <input
              type="checkbox"
              checked={form.teacherMarkingCutoffEnabled}
              onChange={(event) =>
                update('teacherMarkingCutoffEnabled', event.target.checked)
              }
            />
          </label>
        </section>

        <section className="attendance-settings-card">
          <div className="attendance-settings-card-title">
            <div>
              <h3>Teacher self-attendance</h3>
              <p>
                Choose whether teachers can view or submit their own attendance.
              </p>
            </div>
          </div>
          {organizationPolicy.isPending ? (
            <p>Loading teacher attendance policy...</p>
          ) : organizationPolicy.isError ? (
            <p className="attendance-settings-error" role="alert">
              Teacher attendance policy could not be loaded.
            </p>
          ) : (
            <>
              <label className="attendance-settings-toggle">
                <span>
                  <strong>Allow teachers to view attendance history</strong>
                  <small>
                    Teachers can view only their own attendance records.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={teacherPolicy.viewOwnAttendance}
                  disabled={updateOrganizationPolicy.isPending}
                  onChange={(event) => {
                    const next = {
                      ...teacherPolicy,
                      viewOwnAttendance: event.target.checked,
                    };
                    updateTeacherPolicy(next);
                  }}
                />
              </label>
              <label className="attendance-settings-toggle">
                <span>
                  <strong>Allow teachers to mark their own attendance</strong>
                  <small>
                    Teachers can mark today only; existing records stay
                    unchanged.
                  </small>
                </span>
                <input
                  type="checkbox"
                  checked={teacherPolicy.selfMarkingEnabled}
                  disabled={updateOrganizationPolicy.isPending}
                  onChange={(event) => {
                    const next = {
                      ...teacherPolicy,
                      selfMarkingEnabled: event.target.checked,
                    };
                    updateTeacherPolicy(next);
                  }}
                />
              </label>
              <div className="attendance-settings-days">
                <strong>Allowed self-attendance statuses</strong>
                <div className="attendance-settings-day-options">
                  {(['present', 'absent', 'half-day', 'on-leave'] as const).map(
                    (status) => (
                      <label key={status}>
                        <input
                          type="checkbox"
                          checked={teacherPolicy.allowedStatuses.includes(
                            status,
                          )}
                          disabled={
                            !teacherPolicy.selfMarkingEnabled ||
                            updateOrganizationPolicy.isPending ||
                            (teacherPolicy.allowedStatuses.length === 1 &&
                              teacherPolicy.allowedStatuses.includes(status))
                          }
                          onChange={(event) => {
                            const next = {
                              ...teacherPolicy,
                              allowedStatuses: event.target.checked
                                ? [...teacherPolicy.allowedStatuses, status]
                                : teacherPolicy.allowedStatuses.filter(
                                    (item) => item !== status,
                                  ),
                            };
                            updateTeacherPolicy(next);
                          }}
                        />
                        {status
                          .replace('-', ' ')
                          .replace(/^\w/, (letter) => letter.toUpperCase())}
                      </label>
                    ),
                  )}
                </div>
              </div>
              {updateOrganizationPolicy.isError && (
                <p className="attendance-settings-error" role="alert">
                  Teacher attendance policy could not be saved. Please try
                  again.
                </p>
              )}
            </>
          )}
        </section>

        <section className="attendance-settings-card">
          <div className="attendance-settings-card-title">
            <div>
              <h3>Automatic student absence</h3>
              <p>Automatically mark unrecorded students absent.</p>
            </div>
          </div>
          <label className="attendance-settings-toggle">
            <span>
              <strong>Automatically mark unmarked students Absent</strong>
              <small>
                Applies to active class placements. Existing attendance marks
                are preserved.
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
                Owners and Admins can correct records after the cutoff.
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
              Automatic absence skips non-working days and “No classes”
              holidays.
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
