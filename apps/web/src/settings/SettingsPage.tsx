import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/ui/States.js';
import { apiMessage, useOrganizationAccess } from '../staff/StaffPageShared.js';
import { apiRequest } from '../api/client.js';
import {
  useOrganizationSettings,
  useUpdateOrganizationSettings,
  type OrganizationSettings,
} from './settings-api.js';
import { ProfileSettingsPage } from './ProfileSettingsPage.js';
import './settings.css';

const managerRoles = ['organization_owner', 'organization_admin'];
type SettingsTab = 'my-profile' | 'notifications' | 'roles-permissions';
type Permission = string;
type RolePolicyData = {
  policies: Record<string, Permission[]>;
  defaults: Record<string, Permission[]>;
  roles: string[];
  permissions: Permission[];
};

const roleLabels: Record<string, string> = {
  organization_admin: 'Admin',
  campus_admin: 'Campus Admin',
  principal_director: 'Principal / Director',
  academic_coordinator: 'Coordinator',
  teacher: 'Teacher',
  accountant_finance_officer: 'Accountant',
  admissions_reception: 'Admissions',
  student: 'Student',
  parent_guardian: 'Parent / Guardian',
};

const permissionGroups: Array<{
  title: string;
  items: Array<{ key: string; label: string }>;
}> = [
  {
    title: 'Organization',
    items: [
      { key: 'organization.read', label: 'View organization' },
      { key: 'organization.update', label: 'Update organization' },
    ],
  },
  {
    title: 'Campuses & Members',
    items: [
      { key: 'campus.read', label: 'View campuses' },
      { key: 'campus.create', label: 'Create campuses' },
      { key: 'campus.update', label: 'Edit campuses' },
      { key: 'campus.status.update', label: 'Change campus status' },
      { key: 'member.read', label: 'View members' },
      { key: 'member.invite', label: 'Invite members' },
      { key: 'member.manage', label: 'Manage members' },
    ],
  },
  {
    title: 'Students & Staff',
    items: [
      { key: 'student.read', label: 'View students' },
      { key: 'student.create', label: 'Add students' },
      { key: 'student.update', label: 'Edit students' },
      { key: 'guardian.read', label: 'View guardians' },
      { key: 'guardian.create', label: 'Add guardians' },
      { key: 'guardian.update', label: 'Edit guardians' },
      { key: 'staff.read', label: 'View staff' },
      { key: 'staff.create', label: 'Add staff' },
      { key: 'staff.update', label: 'Edit staff' },
    ],
  },
  {
    title: 'Admissions & Academics',
    items: [
      { key: 'admission.read', label: 'View admissions' },
      { key: 'admission.create', label: 'Create admissions' },
      { key: 'admission.review', label: 'Review applications' },
      { key: 'academics.read', label: 'View academics' },
      { key: 'academics.write', label: 'Manage academics' },
    ],
  },
  {
    title: 'Attendance & Examinations',
    items: [
      { key: 'attendance.read', label: 'View attendance' },
      { key: 'attendance.write', label: 'Manage attendance' },
      { key: 'examination.read', label: 'View examinations' },
      { key: 'examination.write', label: 'Manage examinations' },
    ],
  },
  {
    title: 'Finance & Communication',
    items: [
      { key: 'finance.read', label: 'View finance' },
      { key: 'finance.write', label: 'Manage finance' },
      { key: 'communication.read', label: 'View communication' },
      { key: 'communication.write', label: 'Send messages / announcements' },
    ],
  },
  {
    title: 'Reports & Audit',
    items: [
      { key: 'reporting.read', label: 'View reports' },
      { key: 'audit.read', label: 'View audit history' },
    ],
  },
];

const settingsTabs: Array<{
  id: SettingsTab;
  title: string;
  icon: typeof Bell;
}> = [
  {
    id: 'my-profile',
    title: 'My Profile',
    icon: UserRound,
  },
  {
    id: 'notifications',
    title: 'Notifications',
    icon: Bell,
  },
];

function parseSettingsTab(value: string | null): SettingsTab {
  const allowed: SettingsTab[] = [
    'my-profile',
    'notifications',
    'roles-permissions',
  ];
  return allowed.includes(value as SettingsTab)
    ? (value as SettingsTab)
    : 'my-profile';
}

function RolePermissionsPanel({ organizationId }: { organizationId: string }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState('organization_admin');
  const [selected, setSelected] = useState<Permission[]>([]);
  const [dirty, setDirty] = useState(false);
  const query = useQuery({
    queryKey: ['organization-role-policies', organizationId],
    queryFn: () =>
      apiRequest<RolePolicyData>(
        '/organizations/' +
          encodeURIComponent(organizationId) +
          '/role-permissions',
      ),
    retry: false,
  });
  const policy = query.data?.policies[role] ?? query.data?.defaults[role] ?? [];
  useEffect(() => {
    setSelected([...policy]);
    setDirty(false);
  }, [role, query.data]);
  const save = useMutation({
    mutationFn: () =>
      apiRequest(
        '/organizations/' +
          encodeURIComponent(organizationId) +
          '/role-permissions/' +
          role,
        { method: 'PUT', body: JSON.stringify({ permissions: selected }) },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['organization-role-policies', organizationId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['organization-context', organizationId],
      });
      setDirty(false);
    },
  });
  const activeCount = useMemo(() => selected.length, [selected]);
  if (query.isPending)
    return <LoadingState message="Loading role permissions…" />;
  if (query.error || !query.data) {
    return (
      <ErrorState
        title="Role permissions unavailable"
        description={
          query.error
            ? apiMessage(query.error)
            : 'Could not load role permissions.'
        }
        onRetry={() => void query.refetch()}
      />
    );
  }
  const toggle = (permission: string, checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...current, permission]
        : current.filter((item) => item !== permission),
    );
    setDirty(true);
  };
  return (
    <section
      className="settings-card role-policy-card"
      aria-labelledby="role-policy-title"
    >
      <header className="settings-card-heading role-policy-heading">
        <div>
          <span className="settings-kicker">ACCESS CONTROL</span>
          <h2 id="role-policy-title">Roles &amp; Permissions</h2>
          <p>
            Choose what each role can view and manage across this organization.
          </p>
        </div>
        <span className="role-policy-count">
          {activeCount} permissions enabled
        </span>
      </header>
      <div className="role-policy-toolbar">
        <label className="role-select-label" htmlFor="settings-role-select">
          Configure role
          <select
            id="settings-role-select"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {query.data.roles.map((item) => (
              <option key={item} value={item}>
                {roleLabels[item] ?? item}
              </option>
            ))}
          </select>
        </label>
        <div className="role-policy-actions">
          <button
            type="button"
            className="settings-quiet-button"
            onClick={() => {
              setSelected([...(query.data.defaults[role] ?? [])]);
              setDirty(true);
            }}
          >
            Reset defaults
          </button>
          <button
            type="button"
            className="settings-primary-button"
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'Saving…' : 'Save permissions'}
          </button>
        </div>
      </div>
      {role === 'organization_admin' && (
        <p className="role-policy-note">
          <LockKeyhole size={15} /> The Organization Owner always retains full
          access. Admin permissions can be limited here.
        </p>
      )}
      <div className="permission-groups">
        {permissionGroups.map((group) => (
          <section className="permission-group" key={group.title}>
            <div className="permission-group-heading">
              <h3>{group.title}</h3>
              <span>
                {
                  group.items.filter(
                    (item) =>
                      query.data!.permissions.includes(item.key) &&
                      selected.includes(item.key),
                  ).length
                }
                {' / '}
                {
                  group.items.filter((item) =>
                    query.data!.permissions.includes(item.key),
                  ).length
                }
              </span>
            </div>
            <div className="permission-grid">
              {group.items
                .filter((item) => query.data!.permissions.includes(item.key))
                .map((item) => (
                  <label className="permission-option" key={item.key}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.key)}
                      onChange={(event) =>
                        toggle(item.key, event.target.checked)
                      }
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
            </div>
          </section>
        ))}
      </div>
      {save.isError && (
        <p className="settings-error" role="alert">
          {apiMessage(save.error)}
        </p>
      )}
      {save.isSuccess && !dirty && (
        <p className="role-policy-success">
          <Check size={15} /> Permissions saved and applied to this role.
        </p>
      )}
    </section>
  );
}

function NotificationsSettings({
  settings,
  canUpdate,
  saving,
  onToggle,
}: {
  settings: OrganizationSettings;
  canUpdate: boolean;
  saving: boolean;
  onToggle: (
    key: keyof OrganizationSettings['notifications'],
    value: boolean,
  ) => void;
}) {
  const toggles: Array<{
    key: keyof OrganizationSettings['notifications'];
    label: string;
  }> = [
    {
      key: 'emailAlerts',
      label: 'Email alerts',
    },
    {
      key: 'smsAlerts',
      label: 'SMS alerts',
    },
    {
      key: 'autoAttendanceAlerts',
      label: 'Attendance alerts',
    },
  ];
  return (
    <section
      className="settings-card"
      aria-labelledby="settings-notifications-title"
    >
      <header className="settings-card-heading">
        <h2 id="settings-notifications-title">Notifications</h2>
      </header>
      {!canUpdate && (
        <p className="settings-readonly-note" role="status">
          You have read-only access. Ask the Organization Owner to grant
          organization update permission.
        </p>
      )}
      <div className="settings-toggles">
        {toggles.map(({ key, label }) => (
          <label className="settings-toggle" key={key}>
            <span>
              <strong>{label}</strong>
            </span>
            <input
              type="checkbox"
              disabled={!canUpdate || saving}
              checked={settings.notifications[key]}
              onChange={(event) => onToggle(key, event.target.checked)}
            />
          </label>
        ))}
      </div>
      {saving && (
        <p className="settings-saving-note" role="status">
          Saving notification preferences…
        </p>
      )}
    </section>
  );
}

export function SettingsPage() {
  const { organizationId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = parseSettingsTab(searchParams.get('tab'));
  const access = useOrganizationAccess(organizationId);
  const canReadSettings =
    access.data !== undefined &&
    managerRoles.includes(access.data.role) &&
    access.data.permissions.includes('organization.read');
  const canUpdateSettings =
    canReadSettings &&
    access.data?.permissions.includes('organization.update') === true;
  const isOwner = access.data?.role === 'organization_owner';
  const activeTab =
    (requestedTab === 'notifications' && !canReadSettings) ||
    (requestedTab === 'roles-permissions' && !isOwner)
      ? 'my-profile'
      : requestedTab;
  const settings = useOrganizationSettings(organizationId, canReadSettings);
  const updateSettings = useUpdateOrganizationSettings(organizationId);

  useEffect(() => {
    if (access.isPending || !access.data) return;
    if (searchParams.get('tab') !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [access.data, access.isPending, activeTab, searchParams, setSearchParams]);

  if (access.isPending)
    return <LoadingState message="Checking organization access…" />;
  if (access.error || !access.data) {
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Settings access could not be verified for this organization.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }
  const tabs = [
    ...(canReadSettings ? settingsTabs : [settingsTabs[0]]),
    ...(isOwner
      ? [
          {
            id: 'roles-permissions' as const,
            title: 'Roles & Permissions',
            icon: ShieldCheck,
          },
        ]
      : []),
  ];

  return (
    <div className="settings-page reference-live-module">
      <header className="settings-heading">
        <h1>Settings</h1>
      </header>
      <nav
        className={
          'settings-tabs settings-category-grid' +
          (tabs.length === 1 ? ' settings-tabs-single' : '')
        }
        aria-label="Settings sections"
      >
        {tabs.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            aria-current={activeTab === id ? 'page' : undefined}
            className={
              'settings-tab settings-category-card' +
              (activeTab === id ? ' is-active' : '')
            }
            onClick={() => setSearchParams({ tab: id })}
            type="button"
          >
            <span className="settings-category-icon">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="settings-category-copy">
              <strong>{title}</strong>
            </span>
          </button>
        ))}
      </nav>
      <div className="settings-content">
        {activeTab === 'my-profile' ? (
          <ProfileSettingsPage />
        ) : activeTab === 'roles-permissions' ? (
          isOwner ? (
            <RolePermissionsPanel organizationId={organizationId} />
          ) : (
            <ErrorState
              title="Owner access required"
              description="Only the Organization Owner can change role permission policies."
            />
          )
        ) : settings.isPending ? (
          <LoadingState message="Loading organization settings…" />
        ) : settings.error || !settings.data ? (
          <ErrorState
            title="Organization settings unavailable"
            description={
              settings.error
                ? apiMessage(settings.error)
                : 'Could not load organization settings.'
            }
            onRetry={() => void settings.refetch()}
          />
        ) : (
          <>
            {activeTab === 'notifications' && (
              <NotificationsSettings
                settings={settings.data.settings}
                canUpdate={canUpdateSettings}
                saving={updateSettings.isPending}
                onToggle={(key, value) =>
                  updateSettings.mutate({
                    notifications: {
                      ...settings.data!.settings.notifications,
                      [key]: value,
                    },
                  })
                }
              />
            )}
            {updateSettings.isError && (
              <p className="settings-error" role="alert">
                {apiMessage(updateSettings.error)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
