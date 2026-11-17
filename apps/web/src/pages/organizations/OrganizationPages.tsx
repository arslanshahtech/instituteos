import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  ChevronDown,
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  Plus,
  Eye,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import { WorkspacePageHeading } from '../../components/ui/WorkspacePrimitives.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { Button } from '../../components/ui/Button.js';
import { Dialog } from '../../components/ui/Dialog.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../../components/ui/States.js';
import {
  acceptOrganizationInvitation,
  archiveOrganization,
  createCampus,
  deleteOrganization,
  getAccessibleOrganizations,
  getCampuses,
  getInvitations,
  getMembers,
  getOrganizationDashboard,
  inviteMember,
  ORGANIZATION_ROLES,
  ORGANIZATION_PERMISSIONS,
  restoreOrganization,
  revokeInvitation,
  updateCampus,
  updateMember,
  updateOrganization,
} from '../../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../../tenancy/tenancy-api.js';
import { AdminDashboardOverview } from './AdminDashboardOverview.js';
import type {
  AccessibleOrganization,
  Campus,
  OrganizationInvitation,
  OrganizationMember,
} from '../../organizations/organizations-api.js';

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The request could not be completed. Try again.';
}

function CampusScopeSelect({
  campuses,
  label,
  selectedCampusIds,
  onChange,
}: {
  campuses: Campus[];
  label: string;
  selectedCampusIds: string[];
  onChange: (campusIds: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const optionsId = useId();
  const selectedCount = selectedCampusIds.length;
  return (
    <div
      className={`campus-scope-dropdown${isOpen ? ' is-open' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}
    >
      <button
        aria-controls={optionsId}
        aria-expanded={isOpen}
        aria-label={label}
        className="campus-scope-trigger"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span>
          {selectedCount === 0
            ? 'Select campuses'
            : `${selectedCount} campus${selectedCount === 1 ? '' : 'es'} selected`}
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </button>
      {isOpen && (
        <div
          aria-label={label}
          className="campus-scope-options"
          id={optionsId}
          role="group"
        >
          {campuses.length ? (
            campuses.map((campus) => (
              <label key={campus.id} className="campus-scope-option">
                <input
                  checked={selectedCampusIds.includes(campus.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selectedCampusIds, campus.id]
                        : selectedCampusIds.filter((id) => id !== campus.id),
                    )
                  }
                  type="checkbox"
                  value={campus.id}
                />
                <span>{campus.name}</span>
              </label>
            ))
          ) : (
            <span className="campus-scope-empty">No campuses available</span>
          )}
        </div>
      )}
    </div>
  );
}

export function MyOrganizationsPage({
  redirectSingle = false,
}: {
  redirectSingle?: boolean;
}) {
  const navigate = useNavigate();
  const organizations = useQuery({
    queryKey: ['accessible-organizations'],
    queryFn: getAccessibleOrganizations,
    retry: false,
  });

  useEffect(() => {
    const records = organizations.data?.organizations ?? [];
    const active = records.filter(
      (organization) => organization.status === 'active',
    );
    const hasArchived = records.some(
      (organization) => organization.status === 'archived',
    );
    if (redirectSingle && active.length === 1 && !hasArchived) {
      navigate('/admin/organizations/' + active[0]!.id, { replace: true });
    }
  }, [navigate, organizations.data, redirectSingle]);

  if (organizations.isPending)
    return <LoadingState message="Loading your organizations…" />;
  if (organizations.isError)
    return (
      <ErrorState
        title="Organizations unavailable"
        description="Your organizations could not be loaded."
        onRetry={() => void organizations.refetch()}
      />
    );

  const accessible = organizations.data.organizations;
  const activeOrganizations = accessible.filter(
    (organization) => organization.status === 'active',
  );
  const archivedOrganizations = accessible.filter(
    (organization) => organization.status === 'archived',
  );
  if (
    redirectSingle &&
    activeOrganizations.length === 1 &&
    archivedOrganizations.length === 0
  )
    return <LoadingState message="Opening your organization…" />;

  return (
    <main className="page-stack organization-admin-page">
      <section className="page-heading organization-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Organizations</h1>
          <p className="page-description">
            Open an organization assigned to your account. Contact your platform
            administrator if you need access.
          </p>
        </div>
      </section>
      {activeOrganizations.length === 0 &&
      archivedOrganizations.length === 0 ? (
        <EmptyState
          title="No organization assigned"
          description="Your account has not been assigned to an organization yet. Contact your InstituteOS platform administrator."
        />
      ) : activeOrganizations.length > 0 ? (
        <section
          aria-label="Active organizations"
          className="accessible-organizations"
        >
          {activeOrganizations.map((organization) => (
            <OrganizationDiscoveryCard
              key={organization.id}
              organization={organization}
            />
          ))}
        </section>
      ) : null}
      {archivedOrganizations.length > 0 && (
        <section
          aria-label="Archived organizations"
          className="archived-organizations"
        >
          <div className="section-heading">
            <div>
              <h2>Archived organizations</h2>
              <p>
                Archived organizations are not active workspaces. Owners can
                restore or permanently delete them.
              </p>
            </div>
          </div>
          {archivedOrganizations.map((organization) => (
            <ArchivedOrganizationCard
              key={organization.id}
              organization={organization}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function ArchivedOrganizationCard({
  organization,
}: {
  organization: AccessibleOrganization;
}) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const restore = useMutation({
    mutationFn: () => restoreOrganization(organization.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['accessible-organizations'],
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteOrganization(organization.id, confirmation),
    onSuccess: async () => {
      setDeleteOpen(false);
      setConfirmation('');
      await queryClient.invalidateQueries({
        queryKey: ['accessible-organizations'],
      });
    },
  });
  return (
    <article className="accessible-organization archived-organization">
      <div>
        <p className="eyebrow">
          Archived organization · {roleLabel(organization.role)}
        </p>
        <h3>{organization.name}</h3>
        <p>Normal organization operations are unavailable while archived.</p>
        {organization.role === 'organization_owner' ? (
          <div className="organization-heading-actions">
            <Button
              disabled={restore.isPending || remove.isPending}
              onClick={() => restore.mutate()}
            >
              {restore.isPending ? 'Restoring…' : 'Restore'}
            </Button>
            <Button
              disabled={restore.isPending || remove.isPending}
              onClick={() => setDeleteOpen(true)}
              variant="danger"
            >
              Delete permanently
            </Button>
          </div>
        ) : (
          <p>Contact an organization owner to restore this workspace.</p>
        )}
        {(restore.isError || remove.isError) && (
          <p className="form-error" role="alert">
            {apiMessage(restore.error ?? remove.error)}
          </p>
        )}
      </div>
      <Dialog
        description={`This permanently removes ${organization.name} and its Phase 05 campuses, memberships, and invitations. User accounts and other organizations are not deleted. This cannot be undone through the current UI.`}
        onOpenChange={(open) => {
          if (!remove.isPending) setDeleteOpen(open);
          if (!open) setConfirmation('');
        }}
        open={deleteOpen}
        title="Delete organization permanently"
      >
        <div className="delete-confirmation">
          <p>
            Type <strong>{organization.name}</strong> exactly to confirm.
          </p>
          <label>
            Organization name
            <input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {remove.isError && (
            <p className="form-error" role="alert">
              {apiMessage(remove.error)}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              disabled={remove.isPending}
              onClick={() => {
                setDeleteOpen(false);
                setConfirmation('');
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={remove.isPending || confirmation !== organization.name}
              onClick={() => remove.mutate()}
              variant="danger"
            >
              {remove.isPending ? 'Deleting…' : 'Delete organization'}
            </Button>
          </div>
        </div>
      </Dialog>
    </article>
  );
}

function OrganizationDiscoveryCard({
  organization,
}: {
  organization: AccessibleOrganization;
}) {
  return (
    <article className="accessible-organization">
      <div>
        <h2>{organization.name}</h2>
        <p>{roleLabel(organization.role)}</p>
      </div>
      <Link
        aria-label={`Open ${organization.name}`}
        className="button button-secondary"
        to={`/admin/organizations/${encodeURIComponent(organization.id)}`}
      >
        Open
      </Link>
    </article>
  );
}

function roleLabel(role: string): string {
  return role.replaceAll('_', ' ');
}

type AdminTab =
  'overview' | 'settings' | 'campuses' | 'members' | 'invitations';

function parseAdminTab(value: string | null): AdminTab {
  return value === 'settings' ||
    value === 'campuses' ||
    value === 'members' ||
    value === 'invitations'
    ? value
    : 'overview';
}

export function OrganizationAdminPage() {
  const { organizationId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>(() =>
    parseAdminTab(searchParams.get('tab')),
  );
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setTab(parseAdminTab(searchParams.get('tab')));
  }, [searchParams]);
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 30_000,
  });

  const dashboard = useQuery({
    queryKey: ['organization-dashboard', organizationId],
    queryFn: () => getOrganizationDashboard(organizationId),
    enabled: Boolean(organizationId && access.data),
    retry: false,
  });
  const campuses = useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('campus.read') &&
      ['campuses', 'members'].includes(tab),
    ),
    retry: false,
  });
  const members = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: () => getMembers(organizationId),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('member.read') &&
      tab === 'members',
    ),
    retry: false,
  });
  const invitations = useQuery({
    queryKey: ['organization-invitations', organizationId],
    queryFn: () => getInvitations(organizationId),
    enabled: Boolean(
      organizationId &&
      access.data?.permissions.includes('member.manage') &&
      tab === 'invitations',
    ),
    retry: false,
  });
  const mutationDone = async (message: string) => {
    setNotice(message);
    await queryClient.invalidateQueries({
      queryKey: ['organization-dashboard', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-header-profile', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-campuses', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-members', organizationId],
    });
    await queryClient.invalidateQueries({
      queryKey: ['organization-invitations', organizationId],
    });
  };
  const canUpdate =
    access.data?.permissions.includes('organization.update') ?? false;
  const canReadCampuses =
    access.data?.permissions.includes('campus.read') ?? false;
  const canCreateCampuses =
    access.data?.permissions.includes('campus.create') ?? false;
  const canUpdateCampuses =
    access.data?.permissions.includes('campus.update') ?? false;
  const canChangeCampusStatus =
    access.data?.permissions.includes('campus.status.update') ?? false;
  const canManageMembers =
    access.data?.permissions.includes('member.manage') ?? false;
  const canReadMembers =
    access.data?.permissions.includes('member.read') ?? false;
  const canInvite = access.data?.permissions.includes('member.invite') ?? false;
  const canAssignOwner = access.data?.role === 'organization_owner';

  useEffect(() => {
    const accessUnavailable =
      access.error instanceof ApiError && access.error.status === 404;
    const dashboardUnavailable =
      dashboard.error instanceof ApiError && dashboard.error.status === 404;
    if (accessUnavailable || dashboardUnavailable)
      navigate('/admin/organizations', { replace: true });
  }, [access.error, dashboard.error, navigate]);

  if (access.isPending)
    return <LoadingState message="Loading organization access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description="You may not have access to this organization."
        onRetry={() => void access.refetch()}
      />
    );

  return (
    <main className="page-stack organization-admin-page">
      <WorkspacePageHeading
        className="organization-heading"
        eyebrow=""
        title={
          tab === 'overview'
            ? 'Institute Overview'
            : tab === 'settings'
              ? 'Organization Profile'
              : tab[0]!.toUpperCase() + tab.slice(1)
        }
        description={
          tab === 'overview'
            ? 'Your organization at a glance.'
            : tab === 'campuses'
              ? 'Create and manage your organization’s campus locations.'
              : tab === 'members'
                ? 'Invite people, assign roles, and manage organization access.'
                : tab === 'invitations'
                  ? 'Review pending invitations and their status.'
                  : 'Manage your organization profile and settings.'
        }
      />
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      {tab === 'overview' && (
        <AdminDashboardOverview
          organizationId={organizationId}
          permissions={access.data.permissions}
        />
      )}
      {tab === 'settings' && (
        <SettingsPanel
          organizationId={organizationId}
          canUpdate={canUpdate}
          canManageLifecycle={canAssignOwner}
          onDone={mutationDone}
        />
      )}
      {tab === 'campuses' && !canReadCampuses && <PermissionDeniedState />}
      {tab === 'campuses' && canReadCampuses && (
        <CampusesPanel
          organizationId={organizationId}
          query={campuses}
          canCreate={canCreateCampuses}
          canUpdate={canUpdateCampuses}
          canChangeStatus={canChangeCampusStatus}
          onDone={mutationDone}
        />
      )}
      {tab === 'members' && !canReadMembers && <PermissionDeniedState />}
      {tab === 'members' && canReadMembers && (
        <MembersPanel
          organizationId={organizationId}
          query={members}
          canManage={canManageMembers}
          canInvite={canInvite}
          canAssignOwner={canAssignOwner}
          campuses={campuses.data?.campuses ?? []}
          onDone={mutationDone}
        />
      )}
      {tab === 'invitations' && !canManageMembers && <PermissionDeniedState />}
      {tab === 'invitations' && canManageMembers && (
        <InvitationsPanel
          organizationId={organizationId}
          query={invitations}
          canInvite={canInvite}
        />
      )}
    </main>
  );
}

function SettingsPanel({
  organizationId,
  canUpdate,
  canManageLifecycle,
  onDone,
}: {
  organizationId: string;
  canUpdate: boolean;
  canManageLifecycle: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoError, setLogoError] = useState('');
  const query = useQuery({
    queryKey: ['organization-profile', organizationId],
    queryFn: () => getOrganizationDashboard(organizationId),
    retry: false,
  });
  useEffect(() => {
    if (query.data) setLogoDataUrl(query.data.organization.logoDataUrl ?? '');
  }, [query.data]);
  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateOrganization>[1]) =>
      updateOrganization(organizationId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['organization-profile', organizationId],
      });
      await onDone('Organization settings saved.');
    },
  });
  const archive = useMutation({
    mutationFn: () => archiveOrganization(organizationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['accessible-organizations'],
      });
      navigate('/admin/organizations', { replace: true });
    },
  });
  if (query.isPending) return <LoadingState message="Loading settings…" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        title="Settings unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  if (!canUpdate) return <PermissionDeniedState />;
  const organization = query.data.organization;
  return (
    <div className="organization-settings-stack">
      <form
        className="organization-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setLogoError('');
          save.mutate({
            name: String(form.get('name')),
            adminName: String(form.get('adminName') || '').trim(),
            shortCode: String(form.get('shortCode') || '')
              .trim()
              .toUpperCase(),
            tagline: String(form.get('tagline') || '').trim(),
            logoDataUrl,
            contactEmail: String(form.get('contactEmail') || ''),
            phone: String(form.get('phone') || ''),
            timezone: String(form.get('timezone') || 'UTC'),
            address: {
              line1: String(form.get('line1') || ''),
              city: String(form.get('city') || ''),
              country: String(form.get('country') || ''),
            },
          });
        }}
      >
        <label>
          Organization name
          <input
            name="name"
            defaultValue={organization.name}
            required
            minLength={2}
            maxLength={160}
          />
        </label>
        <label>
          Organization admin name
          <input
            name="adminName"
            defaultValue={organization.adminName ?? ''}
            placeholder="Person responsible for this institute"
            maxLength={120}
          />
        </label>
        <label>
          Organization short code
          <input
            name="shortCode"
            defaultValue={organization.shortCode ?? ''}
            placeholder="e.g. BFA"
            maxLength={24}
            pattern="[A-Za-z0-9-]+"
            title="Use letters, numbers or hyphens."
          />
        </label>
        <label>
          Tagline
          <input
            name="tagline"
            defaultValue={organization.tagline ?? ''}
            placeholder="A short line about your institution"
            maxLength={180}
          />
        </label>
        <div className="organization-logo-field">
          <span className="organization-logo-label">Organization logo</span>
          <div className="organization-logo-control">
            <div
              className="organization-logo-preview"
              role="img"
              aria-label={
                logoDataUrl
                  ? 'Current organization logo'
                  : 'No organization logo selected'
              }
            >
              {logoDataUrl ? (
                <img src={logoDataUrl} alt="" />
              ) : (
                <GraduationCap size={24} aria-hidden="true" />
              )}
            </div>
            <div className="organization-logo-actions">
              <label className="button button-secondary organization-logo-upload">
                Choose image
                <input
                  aria-label="Upload organization logo"
                  aria-describedby="organization-logo-help"
                  accept="image/png,image/jpeg,image/webp"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (
                      !['image/png', 'image/jpeg', 'image/webp'].includes(
                        file.type,
                      )
                    ) {
                      setLogoError('Choose a PNG, JPG or WebP image.');
                      event.target.value = '';
                      return;
                    }
                    if (file.size > 350 * 1024) {
                      setLogoError('Logo must be 350 KB or smaller.');
                      event.target.value = '';
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string')
                        setLogoDataUrl(reader.result);
                    };
                    reader.onerror = () =>
                      setLogoError(
                        'Could not read this image. Please try another file.',
                      );
                    reader.readAsDataURL(file);
                    event.target.value = '';
                    setLogoError('');
                  }}
                />
              </label>
              <span
                className="organization-logo-help"
                id="organization-logo-help"
              >
                PNG, JPG or WebP (max 350 KB)
              </span>
              {logoDataUrl && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setLogoDataUrl('')}
                >
                  Remove logo
                </Button>
              )}
            </div>
          </div>
          {logoError && (
            <p className="form-error" role="alert">
              {logoError}
            </p>
          )}
        </div>
        <label>
          Contact email
          <input
            name="contactEmail"
            type="email"
            defaultValue={organization.contactEmail ?? ''}
            maxLength={254}
          />
        </label>
        <label>
          Phone
          <input
            name="phone"
            defaultValue={organization.phone ?? ''}
            maxLength={40}
          />
        </label>
        <label>
          Timezone
          <input
            name="timezone"
            defaultValue={organization.timezone ?? 'UTC'}
            maxLength={80}
            required
          />
        </label>
        <label>
          Address
          <input
            name="line1"
            defaultValue={organization.address?.line1 ?? ''}
            maxLength={160}
          />
        </label>
        <label>
          City
          <input
            name="city"
            defaultValue={organization.address?.city ?? ''}
            maxLength={100}
          />
        </label>
        <label>
          Country
          <input
            name="country"
            defaultValue={organization.address?.country ?? ''}
            maxLength={100}
          />
        </label>
        {save.isError && (
          <p role="alert" className="form-error">
            {apiMessage(save.error)}
          </p>
        )}
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>
      {canManageLifecycle && organization.status === 'active' && (
        <section
          className="organization-danger-zone"
          aria-labelledby="danger-zone-title"
        >
          <div>
            <p className="eyebrow">Danger Zone</p>
            <h2 id="danger-zone-title">Archive organization</h2>
            <p>
              Temporarily closes this workspace. Your data stays safe and an
              owner can restore it from My Organizations.
            </p>
          </div>
          {archive.isError && (
            <p className="form-error" role="alert">
              {apiMessage(archive.error)}
            </p>
          )}
          <Button
            className="organization-archive-action"
            disabled={archive.isPending}
            onClick={() => setArchiveOpen(true)}
            variant="danger"
          >
            Archive organization
          </Button>
          <Dialog
            description={`Archiving ${organization.name} makes its normal workspace unavailable. Campuses, memberships, invitations, and audit history will be preserved. An owner can restore it later from My Organizations.`}
            onOpenChange={(open) => {
              if (!archive.isPending) setArchiveOpen(open);
            }}
            open={archiveOpen}
            title="Archive organization?"
          >
            <div className="dialog-actions">
              <Button
                disabled={archive.isPending}
                onClick={() => setArchiveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
                variant="danger"
              >
                {archive.isPending ? 'Archiving…' : 'Archive organization'}
              </Button>
            </div>
          </Dialog>
        </section>
      )}
    </div>
  );
}

function CampusesPanel({
  organizationId,
  query,
  canCreate,
  canUpdate,
  canChangeStatus,
  onDone,
}: {
  organizationId: string;
  query: UseQueryResult<{ campuses: Campus[] }>;
  canCreate: boolean;
  canUpdate: boolean;
  canChangeStatus: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
    }) => createCampus(organizationId, input),
    onSuccess: async () => {
      setName('');
      setCreateOpen(false);
      await onDone('Campus created.');
    },
  });
  const save = useMutation({
    mutationFn: ({
      campus,
      status,
    }: {
      campus: Campus;
      status: Campus['status'];
    }) => updateCampus(organizationId, campus.id, { status }),
    onSuccess: () => onDone('Campus status updated.'),
  });
  const rename = useMutation({
    mutationFn: ({ campus, nextName }: { campus: Campus; nextName: string }) =>
      updateCampus(organizationId, campus.id, { name: nextName }),
    onSuccess: () => onDone('Campus details saved.'),
  });
  const updateContact = useMutation({
    mutationFn: ({
      campus,
      changes,
    }: {
      campus: Campus;
      changes: Partial<Campus>;
    }) => updateCampus(organizationId, campus.id, changes),
    onSuccess: () => onDone('Campus contact details saved.'),
  });
  if (query.isPending) return <LoadingState message="Loading campuses…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Campuses unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  const list = query.data?.campuses ?? [];
  const selectedCampus = list.find((campus) => campus.id === selectedCampusId);
  return (
    <section className="organization-section campus-management">
      <div className="campus-panel-heading">
        {canCreate && (
          <Button
            variant="primary"
            onClick={() => setCreateOpen((open) => !open)}
            type="button"
          >
            <Plus size={16} aria-hidden="true" />
            {createOpen ? 'Cancel' : 'New campus'}
          </Button>
        )}
      </div>
      {createOpen && canCreate && (
        <form
          className="campus-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) {
              const form = new FormData(event.currentTarget);
              create.mutate({
                name: name.trim(),
                phone: String(form.get('phone') || '') || undefined,
                email: String(form.get('email') || '') || undefined,
                address: {
                  line1: String(form.get('line1') || ''),
                  city: String(form.get('city') || ''),
                  country: String(form.get('country') || ''),
                },
              });
            }
          }}
        >
          <div className="campus-form-grid">
            <label htmlFor="campus-name">
              Campus name
              <input
                id="campus-name"
                name="name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={160}
              />
            </label>
            <label>
              Contact email
              <input name="email" type="email" maxLength={254} />
            </label>
            <label>
              Contact phone
              <input name="phone" maxLength={40} />
            </label>
            <label>
              Address
              <input name="line1" maxLength={160} />
            </label>
            <label>
              City
              <input name="city" maxLength={100} />
            </label>
            <label>
              Country
              <input name="country" maxLength={100} />
            </label>
          </div>
          {create.isError && (
            <p className="form-error" role="alert">
              {apiMessage(create.error)}
            </p>
          )}
          <div className="campus-form-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Add campus'}
            </Button>
          </div>
        </form>
      )}
      {!list.length ? (
        <EmptyState
          title="No campuses yet"
          description="Create a campus when your organization needs another location."
        />
      ) : (
        <div className="campus-list" aria-label="Organization campuses">
          {list.map((campus) => {
            const location = [
              campus.address?.line1,
              campus.address?.city,
              campus.address?.country,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <article key={campus.id} className="campus-list-row">
                <span className="campus-list-mark" aria-hidden="true">
                  <GraduationCap size={19} />
                </span>
                <div className="campus-list-main">
                  <div className="campus-list-title">
                    <h3>{campus.name}</h3>
                    <span
                      className={`campus-status-pill ${campus.status === 'active' ? 'is-active' : 'is-inactive'}`}
                    >
                      {campus.status}
                    </span>
                  </div>
                  <p className="campus-list-location">
                    <MapPin size={14} aria-hidden="true" />
                    {location || 'Location not added'}
                  </p>
                  <div className="campus-list-contact">
                    {campus.email && (
                      <span>
                        <Mail size={13} aria-hidden="true" />
                        {campus.email}
                      </span>
                    )}
                    {campus.phone && (
                      <span>
                        <Phone size={13} aria-hidden="true" />
                        {campus.phone}
                      </span>
                    )}
                  </div>
                </div>
                <div className="campus-list-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedCampusId(campus.id)}
                    type="button"
                  >
                    <Eye size={15} aria-hidden="true" />
                    View
                  </Button>
                  {canChangeStatus && (
                    <Button
                      variant="quiet"
                      onClick={() =>
                        save.mutate({
                          campus,
                          status:
                            campus.status === 'active' ? 'inactive' : 'active',
                        })
                      }
                      type="button"
                    >
                      {campus.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {(save.isError || rename.isError || updateContact.isError) && (
        <p role="alert" className="form-error">
          {apiMessage(save.error ?? rename.error ?? updateContact.error)}
        </p>
      )}
      <Dialog
        open={Boolean(selectedCampus)}
        onOpenChange={(open) => {
          if (!open) setSelectedCampusId(null);
        }}
        title={selectedCampus?.name ?? 'Campus details'}
        description="Review campus details and update its name or contact information."
      >
        {selectedCampus && (
          <div className="campus-detail-dialog">
            <div className="campus-detail-summary">
              <span
                className={`campus-status-pill ${selectedCampus.status === 'active' ? 'is-active' : 'is-inactive'}`}
              >
                {selectedCampus.status}
              </span>
              <p>
                <MapPin size={15} aria-hidden="true" />
                {[
                  selectedCampus.address?.line1,
                  selectedCampus.address?.city,
                  selectedCampus.address?.country,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Location not added'}
              </p>
              {selectedCampus.email && (
                <p>
                  <Mail size={15} aria-hidden="true" />
                  {selectedCampus.email}
                </p>
              )}
              {selectedCampus.phone && (
                <p>
                  <Phone size={15} aria-hidden="true" />
                  {selectedCampus.phone}
                </p>
              )}
            </div>
            {canUpdate && (
              <form
                className="campus-edit-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  const nextName = String(form.get('name') || '').trim();
                  const changes = {
                    phone: String(form.get('phone') || '') || undefined,
                    email: String(form.get('email') || '') || undefined,
                    address: {
                      line1: String(form.get('line1') || ''),
                      city: String(form.get('city') || ''),
                      country: String(form.get('country') || ''),
                    },
                  };
                  if (nextName && nextName !== selectedCampus.name)
                    rename.mutate({ campus: selectedCampus, nextName });
                  updateContact.mutate({ campus: selectedCampus, changes });
                }}
              >
                <label>
                  Campus name
                  <input
                    name="name"
                    defaultValue={selectedCampus.name}
                    required
                    minLength={2}
                    maxLength={160}
                  />
                </label>
                <label>
                  Contact email
                  <input
                    name="email"
                    type="email"
                    defaultValue={selectedCampus.email ?? ''}
                    maxLength={254}
                  />
                </label>
                <label>
                  Contact phone
                  <input
                    name="phone"
                    defaultValue={selectedCampus.phone ?? ''}
                    maxLength={40}
                  />
                </label>
                <label>
                  Address
                  <input
                    name="line1"
                    defaultValue={selectedCampus.address?.line1 ?? ''}
                    maxLength={160}
                  />
                </label>
                <label>
                  City
                  <input
                    name="city"
                    defaultValue={selectedCampus.address?.city ?? ''}
                    maxLength={100}
                  />
                </label>
                <label>
                  Country
                  <input
                    name="country"
                    defaultValue={selectedCampus.address?.country ?? ''}
                    maxLength={100}
                  />
                </label>
                {(rename.isError || updateContact.isError) && (
                  <p role="alert" className="form-error">
                    {apiMessage(rename.error ?? updateContact.error)}
                  </p>
                )}
                <div className="campus-form-actions">
                  <Button
                    type="submit"
                    disabled={rename.isPending || updateContact.isPending}
                  >
                    {rename.isPending || updateContact.isPending
                      ? 'Saving…'
                      : 'Save changes'}
                  </Button>
                </div>
              </form>
            )}
            <div className="dialog-actions">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setSelectedCampusId(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function MembersPanel({
  organizationId,
  query,
  canManage,
  canInvite,
  canAssignOwner,
  campuses,
  onDone,
}: {
  organizationId: string;
  query: UseQueryResult<{ members: OrganizationMember[] }>;
  canManage: boolean;
  canInvite: boolean;
  canAssignOwner: boolean;
  campuses: Campus[];
  onDone: (message: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [whatsappShareUrl, setWhatsappShareUrl] = useState('');
  const [inviteDeliveryNotice, setInviteDeliveryNotice] = useState('');
  const [role, setRole] = useState<string>('teacher');
  const [inviteCampusIds, setInviteCampusIds] = useState<string[]>([]);
  const [invitePermissions, setInvitePermissions] = useState<string[]>([
    ...ORGANIZATION_PERMISSIONS,
  ]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        role: string;
        status: OrganizationMember['status'];
        campusIds: string[];
        permissions: string[];
      }
    >
  >({});
  const invite = useMutation({
    mutationFn: () =>
      inviteMember(organizationId, {
        email,
        role,
        campusIds: inviteCampusIds,
        ...(role === 'organization_admin' && canAssignOwner
          ? { permissions: invitePermissions }
          : {}),
      }),
    onMutate: () => {
      setWhatsappShareUrl('');
      setInviteDeliveryNotice('');
    },
    onSuccess: async (result) => {
      setEmail('');
      setInviteCampusIds([]);
      setWhatsappShareUrl(result.whatsappShareUrl ?? '');
      setInviteDeliveryNotice(
        result.emailSent
          ? result.whatsappShareUrl
            ? 'Invitation email sent successfully. You can also share the same secure link through WhatsApp.'
            : 'Invitation email sent successfully.'
          : 'Invitation link created, but the email provider rejected delivery. Share it through WhatsApp, or verify your sending domain to enable email invitations.',
      );
      await onDone(
        result.emailSent
          ? 'Invitation email sent.'
          : 'Invitation created; email delivery needs sender-domain setup.',
      );
    },
  });
  const save = useMutation({
    mutationFn: ({
      id,
      draft,
    }: {
      id: string;
      draft: {
        role: string;
        status: OrganizationMember['status'];
        campusIds: string[];
        permissions: string[];
      };
    }) => {
      const { permissions, ...basicChanges } = draft;
      return updateMember(
        organizationId,
        id,
        draft.role === 'organization_admin'
          ? { ...basicChanges, permissions }
          : basicChanges,
      );
    },
    onSuccess: () => onDone('Member access updated.'),
  });
  if (query.isPending) return <LoadingState message="Loading members…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Members unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  const list = query.data?.members;
  return (
    <section className="organization-section">
      <div className="section-heading">
        <div>
          <h2>Team access</h2>
          <p>Manage current members, roles, and campus access.</p>
        </div>
      </div>
      {canInvite && (
        <form
          className="inline-form member-invite-form"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <div className="member-invite-card-heading">
            <span className="member-invite-icon" aria-hidden="true">
              <UserPlus size={18} />
            </span>
            <div>
              <h3>Invite a team member</h3>
              <p>Send a secure invitation and choose the access they need.</p>
            </div>
          </div>
          <label>
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="name@organization.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <small className="field-hint">
            {role === 'parent_guardian'
              ? 'Use the same email saved in the student’s Family contact record.'
              : role === 'teacher'
                ? 'Use the same email saved in the Staff / Teachers profile.'
                : 'The recipient must sign in with this exact email address to accept the invitation.'}
          </small>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                if (event.target.value === 'organization_admin')
                  setInvitePermissions([...ORGANIZATION_PERMISSIONS]);
              }}
            >
              {ORGANIZATION_ROLES.filter(
                (item) =>
                  canAssignOwner ||
                  (item !== 'organization_owner' &&
                    item !== 'organization_admin'),
              ).map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          {role === 'campus_admin' && (
            <CampusScopeSelect
              campuses={campuses}
              label="Campus scope for invitation"
              onChange={setInviteCampusIds}
              selectedCampusIds={inviteCampusIds}
            />
          )}
          {canAssignOwner && role === 'organization_admin' && (
            <details className="admin-permission-editor">
              <summary>Admin permissions ({invitePermissions.length})</summary>
              <div className="admin-permission-list">
                {ORGANIZATION_PERMISSIONS.map((permission) => (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={invitePermissions.includes(permission)}
                      onChange={(event) =>
                        setInvitePermissions(
                          event.target.checked
                            ? [...invitePermissions, permission]
                            : invitePermissions.filter(
                                (item) => item !== permission,
                              ),
                        )
                      }
                    />
                    {permission}
                  </label>
                ))}
              </div>
            </details>
          )}
          <Button type="submit" disabled={invite.isPending || !email.trim()}>
            <UserPlus size={15} aria-hidden="true" />
            {invite.isPending ? 'Sending invitation…' : 'Send invitation'}
          </Button>
          {inviteDeliveryNotice && (
            <p
              className={
                inviteDeliveryNotice.includes('rejected')
                  ? 'form-error'
                  : 'admin-inline-message'
              }
              role="status"
            >
              {inviteDeliveryNotice}
            </p>
          )}
          {whatsappShareUrl && (
            <Button
              type="button"
              onClick={() =>
                window.open(whatsappShareUrl, '_blank', 'noopener,noreferrer')
              }
            >
              Share invitation via WhatsApp
            </Button>
          )}
        </form>
      )}
      {!list?.length ? (
        <EmptyState
          title="No members found"
          description="Active organization members will appear here."
        />
      ) : (
        <div className="organization-list">
          {list.map((member) => {
            const draft = drafts[member.id] ?? {
              role: member.role,
              status: member.status,
              campusIds: member.campusIds,
              permissions: member.permissions ?? [],
            };
            return (
              <article key={member.id} className="organization-row member-row">
                <div className="member-identity">
                  <strong>
                    {member.user?.displayName ?? 'Unavailable account'}
                  </strong>
                  <span
                    className="member-email"
                    title={member.user?.email ?? 'Account details unavailable'}
                  >
                    {member.user?.email ?? 'Account details unavailable'}
                  </span>
                  <span className="member-tags">
                    <span className="member-tag member-role-tag">
                      {member.role.replaceAll('_', ' ')}
                    </span>
                    <span
                      className={`member-tag ${member.status === 'active' ? 'member-active-tag' : 'member-inactive-tag'}`}
                    >
                      {member.status}
                    </span>
                  </span>
                </div>
                {canManage && member.role !== 'organization_owner' && (
                  <div className="member-controls">
                    <select
                      aria-label={`Role for ${member.user?.email ?? member.id}`}
                      value={draft.role}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: {
                            ...draft,
                            role: event.target.value,
                            permissions:
                              event.target.value === 'organization_admin'
                                ? draft.permissions
                                : [],
                          },
                        })
                      }
                    >
                      {ORGANIZATION_ROLES.filter(
                        (item) =>
                          canAssignOwner ||
                          (item !== 'organization_owner' &&
                            item !== 'organization_admin'),
                      ).map((item) => (
                        <option key={item} value={item}>
                          {item.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`Status for ${member.user?.email ?? member.id}`}
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: {
                            ...draft,
                            status: event.target
                              .value as OrganizationMember['status'],
                          },
                        })
                      }
                    >
                      <option value="active">active</option>
                      <option value="suspended">suspended</option>
                      <option value="revoked">revoked</option>
                    </select>
                    {canAssignOwner && draft.role === 'organization_admin' && (
                      <details className="admin-permission-editor">
                        <summary>
                          Assigned permissions ({draft.permissions.length})
                        </summary>
                        <div className="admin-permission-list">
                          {ORGANIZATION_PERMISSIONS.map((permission) => (
                            <label key={permission}>
                              <input
                                type="checkbox"
                                checked={draft.permissions.includes(permission)}
                                onChange={(event) =>
                                  setDrafts({
                                    ...drafts,
                                    [member.id]: {
                                      ...draft,
                                      permissions: event.target.checked
                                        ? [...draft.permissions, permission]
                                        : draft.permissions.filter(
                                            (item) => item !== permission,
                                          ),
                                    },
                                  })
                                }
                              />
                              {permission}
                            </label>
                          ))}
                        </div>
                      </details>
                    )}
                    <CampusScopeSelect
                      campuses={campuses}
                      label={`Campus scope for ${member.user?.email ?? member.id}`}
                      onChange={(campusIds) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: { ...draft, campusIds },
                        })
                      }
                      selectedCampusIds={draft.campusIds}
                    />
                    <Button
                      variant="primary"
                      onClick={() => save.mutate({ id: member.id, draft })}
                      disabled={save.isPending}
                    >
                      Save access
                    </Button>
                    {member.role !== 'organization_owner' &&
                      member.status !== 'revoked' && (
                        <Button
                          variant="secondary"
                          iconOnly
                          type="button"
                          aria-label={`Remove ${member.user?.displayName ?? member.user?.email ?? 'member'} access`}
                          title="Remove member access"
                          disabled={save.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remove organization access for ${member.user?.displayName ?? member.user?.email ?? 'this member'}?`,
                              )
                            ) {
                              save.mutate({
                                id: member.id,
                                draft: { ...draft, status: 'revoked' },
                              });
                            }
                          }}
                        >
                          <X size={16} aria-hidden="true" />
                        </Button>
                      )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {(invite.isError || save.isError) && (
        <p role="alert" className="form-error">
          {apiMessage(invite.error ?? save.error)}
        </p>
      )}
    </section>
  );
}

function InvitationsPanel({
  organizationId,
  query,
  canInvite,
}: {
  organizationId: string;
  query: UseQueryResult<{ invitations: OrganizationInvitation[] }>;
  canInvite: boolean;
}) {
  const navigate = useNavigate();
  const revoke = useMutation({
    mutationFn: (email: string) => revokeInvitation(organizationId, email),
    onSuccess: () => void query.refetch(),
  });
  if (query.isPending) return <LoadingState message="Loading invitations…" />;
  if (query.isError)
    return (
      <ErrorState
        title="Invitations unavailable"
        onRetry={() => void query.refetch()}
      />
    );
  const list = query.data?.invitations;
  return (
    <section className="organization-section invitation-management">
      <h2>Pending invitations</h2>
      {revoke.isError && (
        <p className="admin-inline-message" role="alert">
          {apiMessage(revoke.error)}
        </p>
      )}
      {canInvite && (
        <div className="invitation-empty-action invitation-empty-action--centered">
          <p className="muted-copy">
            Invite a colleague and set their role and campus access from
            Members.
          </p>
          <Button
            onClick={() =>
              navigate(
                `/admin/organizations/${encodeURIComponent(organizationId)}?tab=members`,
              )
            }
            type="button"
          >
            <UserPlus size={15} aria-hidden="true" />
            Invite member
          </Button>
        </div>
      )}
      {!list?.length ? (
        <EmptyState title="No pending invitations" />
      ) : (
        <div className="organization-list">
          {list.map((item) => (
            <article className="organization-row" key={item.id}>
              <div>
                <strong>{item.email}</strong>
                <span>
                  {item.role.replaceAll('_', ' ')} · expires{' '}
                  {new Date(item.expiresAt).toLocaleDateString()}
                </span>
              </div>
              {canInvite && (
                <Button
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(item.email)}
                  type="button"
                  variant="secondary"
                >
                  Cancel invitation
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function AcceptOrganizationInvitationPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [error, setError] = useState('');
  const [emailMismatch, setEmailMismatch] = useState(false);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);
  const started = useRef(false);
  const token = useMemo(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '',
    [],
  );
  const accept = useMutation({
    mutationFn: acceptOrganizationInvitation,
    onSuccess: () => {
      setStatus('done');
      window.history.replaceState(null, '', window.location.pathname);
      navigate('/dashboard', { replace: true });
    },
    onError: (reason) => {
      setStatus('error');
      setEmailMismatch(
        reason instanceof ApiError &&
          reason.code === 'INVITATION_EMAIL_MISMATCH',
      );
      setError(apiMessage(reason));
    },
  });
  useEffect(() => {
    if (started.current || auth.status === 'loading') return;
    if (!token) {
      started.current = true;
      setStatus('error');
      setError('This invitation link is invalid or expired.');
      return;
    }
    if (auth.status === 'anonymous') {
      started.current = true;
      const invitationPath =
        window.location.pathname +
        window.location.search +
        window.location.hash;
      navigate('/login', {
        replace: true,
        state: { from: invitationPath },
      });
      return;
    }
    if (auth.status === 'error') {
      started.current = true;
      setSessionCheckFailed(true);
      setStatus('error');
      setError(
        'We could not verify your sign-in session. Check your connection and try again.',
      );
      return;
    }
    started.current = true;
    accept.mutate(token);
  }, [token, auth.status, auth.retryBootstrap, navigate, accept]);
  if (status === 'pending')
    return <LoadingState message="Accepting your organization invitation…" />;
  if (status === 'error')
    return (
      <main className="page-stack">
        <ErrorState
          title="Invitation unavailable"
          description={error}
          onRetry={
            sessionCheckFailed
              ? () => {
                  started.current = false;
                  setStatus('pending');
                  setSessionCheckFailed(false);
                  setError('');
                  void auth.retryBootstrap();
                }
              : undefined
          }
        />
        {emailMismatch && (
          <Button
            type="button"
            onClick={() => {
              const invitationPath =
                window.location.pathname +
                window.location.search +
                window.location.hash;
              void auth
                .logout()
                .then(() =>
                  navigate('/login', {
                    replace: true,
                    state: { from: invitationPath },
                  }),
                )
                .catch((reason: unknown) => setError(apiMessage(reason)));
            }}
          >
            Sign out and use the invited email
          </Button>
        )}
      </main>
    );
  return <LoadingState message="Opening your organization…" />;
}
