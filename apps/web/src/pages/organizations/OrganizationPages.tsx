import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { Button } from '../../components/ui/Button.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../../components/ui/States.js';
import {
  acceptOrganizationInvitation,
  createCampus,
  createOrganization,
  getCampuses,
  getInvitations,
  getMembers,
  getOrganizationDashboard,
  inviteMember,
  ORGANIZATION_ROLES,
  updateCampus,
  updateMember,
  updateOrganization,
} from '../../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../../tenancy/tenancy-api.js';
import type {
  Campus,
  OrganizationDashboard,
  OrganizationInvitation,
  OrganizationMember,
} from '../../organizations/organizations-api.js';

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'The request could not be completed. Try again.';
}

export function OrganizationOnboardingPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: createOrganization,
    onSuccess: ({ organization }) =>
      navigate(`/admin/organizations/${organization.id}`),
    onError: (reason) => setError(apiMessage(reason)),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const campusName = String(form.get('campusName') ?? '').trim();
    if (name.length < 2)
      return setError('Organization name must be at least 2 characters.');
    if (campusName && campusName.length < 2)
      return setError('Campus name must be at least 2 characters.');
    setError('');
    create.mutate({
      name,
      contactEmail: String(form.get('contactEmail') ?? '').trim() || undefined,
      phone: String(form.get('phone') ?? '').trim() || undefined,
      timezone: String(form.get('timezone') ?? '').trim() || undefined,
      ...(campusName ? { initialCampus: { name: campusName } } : {}),
    });
  }
  return (
    <main className="page-stack organization-admin-page">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Organization setup</p>
          <h1>Create your organization</h1>
          <p className="page-description">
            You will become its first organization owner.
          </p>
        </div>
      </section>
      <form className="organization-form" onSubmit={submit}>
        <label>
          Organization name
          <input name="name" required minLength={2} maxLength={160} />
        </label>
        <label>
          Contact email
          <input name="contactEmail" type="email" maxLength={254} />
        </label>
        <label>
          Phone
          <input name="phone" maxLength={40} />
        </label>
        <label>
          Timezone
          <input name="timezone" placeholder="UTC" maxLength={80} />
        </label>
        <label>
          Initial campus name <span className="field-hint">Optional</span>
          <input name="campusName" maxLength={160} />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create organization'}
        </Button>
      </form>
    </main>
  );
}

type AdminTab =
  'overview' | 'settings' | 'campuses' | 'members' | 'invitations';

export function OrganizationAdminPage() {
  const { organizationId = '' } = useParams();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [notice, setNotice] = useState('');
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
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
      <section className="page-heading organization-heading">
        <div>
          <p className="eyebrow">
            Organization workspace · {access.data.role.replaceAll('_', ' ')}
          </p>
          <h1>{dashboard.data?.organization.name ?? 'Organization'}</h1>
          <p className="page-description">
            Signed in as {auth.user?.displayName ?? 'current user'}.
          </p>
        </div>
        <Link
          className="button button-secondary"
          to="/admin/organizations/onboarding"
        >
          Add organization
        </Link>
      </section>
      <nav
        className="organization-tabs"
        aria-label="Organization administration"
      >
        {(
          [
            'overview',
            'settings',
            'campuses',
            'members',
            'invitations',
          ] as const
        ).map((item) => (
          <button
            key={item}
            type="button"
            aria-current={tab === item ? 'page' : undefined}
            onClick={() => {
              setTab(item);
              setNotice('');
            }}
          >
            {item}
          </button>
        ))}
      </nav>
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      {tab === 'overview' && (
        <OverviewPanel organizationId={organizationId} dashboard={dashboard} />
      )}
      {tab === 'settings' && (
        <SettingsPanel
          organizationId={organizationId}
          canUpdate={canUpdate}
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
        <InvitationsPanel query={invitations} canInvite={canInvite} />
      )}
    </main>
  );
}

function OverviewPanel({
  organizationId,
  dashboard,
}: {
  organizationId: string;
  dashboard: UseQueryResult<OrganizationDashboard>;
}) {
  const data = dashboard.data;
  if (dashboard.isPending)
    return <LoadingState message="Loading organization data…" />;
  if (dashboard.isError || !data)
    return (
      <ErrorState
        title="Dashboard unavailable"
        description="Organization information could not be loaded."
        onRetry={() => void dashboard.refetch()}
      />
    );
  return (
    <section
      className="organization-overview"
      aria-label="Organization overview"
    >
      <div className="organization-facts">
        <article>
          <span>Active campuses</span>
          <strong>{data.counts.campuses}</strong>
        </article>
        <article>
          <span>Active members</span>
          <strong>{data.counts.members}</strong>
        </article>
        <article>
          <span>Setup</span>
          <strong>{data.setupComplete ? 'Ready' : 'Add a campus'}</strong>
        </article>
      </div>
      {!data.setupComplete && (
        <p className="setup-note">
          Organization setup is ready. Add an initial campus to complete the
          basics.
        </p>
      )}
      <p className="muted-copy">Organization ID: {organizationId}</p>
    </section>
  );
}

function SettingsPanel({
  organizationId,
  canUpdate,
  onDone,
}: {
  organizationId: string;
  canUpdate: boolean;
  onDone: (message: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['organization-profile', organizationId],
    queryFn: () => getOrganizationDashboard(organizationId),
    retry: false,
  });
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
    <form
      className="organization-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        save.mutate({
          name: String(form.get('name')),
          contactEmail: String(form.get('contactEmail')) || undefined,
          phone: String(form.get('phone')) || undefined,
          timezone: String(form.get('timezone')) || undefined,
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
  const [edits, setEdits] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: (input: {
      name: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
    }) => createCampus(organizationId, input),
    onSuccess: async () => {
      setName('');
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
  const list = query.data?.campuses;
  return (
    <section className="organization-section">
      <div className="section-heading">
        <div>
          <h2>Campuses</h2>
          <p>Manage the locations attached to this organization.</p>
        </div>
      </div>
      {canCreate && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length >= 2) {
              const form = new FormData(event.currentTarget);
              create.mutate({
                name,
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
          <label htmlFor="campus-name">
            New campus
            <input
              id="campus-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={160}
            />
          </label>
          <label>
            Contact phone
            <input name="phone" maxLength={40} />
          </label>
          <label>
            Contact email
            <input name="email" type="email" maxLength={254} />
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
          <Button type="submit" disabled={create.isPending}>
            Add campus
          </Button>
        </form>
      )}
      {!list?.length ? (
        <EmptyState
          title="No campuses yet"
          description="Add a campus when you are ready to organize locations."
        />
      ) : (
        <div className="organization-list">
          {list.map((campus) => (
            <article key={campus.id} className="organization-row">
              <div>
                <strong>{campus.name}</strong>
                <span>{campus.status}</span>
              </div>
              <div className="member-controls">
                {canUpdate && (
                  <>
                    <input
                      aria-label={`Name for ${campus.name}`}
                      value={edits[campus.id] ?? campus.name}
                      onChange={(event) =>
                        setEdits({ ...edits, [campus.id]: event.target.value })
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={() =>
                        rename.mutate({
                          campus,
                          nextName: edits[campus.id] ?? campus.name,
                        })
                      }
                    >
                      Save
                    </Button>
                    <details>
                      <summary>Contact details</summary>
                      <form
                        className="organization-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const form = new FormData(event.currentTarget);
                          updateContact.mutate({
                            campus,
                            changes: {
                              phone:
                                String(form.get('phone') || '') || undefined,
                              email:
                                String(form.get('email') || '') || undefined,
                              address: {
                                line1: String(form.get('line1') || ''),
                                city: String(form.get('city') || ''),
                                country: String(form.get('country') || ''),
                              },
                            },
                          });
                        }}
                      >
                        <label>
                          Phone
                          <input
                            name="phone"
                            defaultValue={campus.phone ?? ''}
                            maxLength={40}
                          />
                        </label>
                        <label>
                          Email
                          <input
                            name="email"
                            type="email"
                            defaultValue={campus.email ?? ''}
                            maxLength={254}
                          />
                        </label>
                        <label>
                          Address
                          <input
                            name="line1"
                            defaultValue={campus.address?.line1 ?? ''}
                            maxLength={160}
                          />
                        </label>
                        <label>
                          City
                          <input
                            name="city"
                            defaultValue={campus.address?.city ?? ''}
                            maxLength={100}
                          />
                        </label>
                        <label>
                          Country
                          <input
                            name="country"
                            defaultValue={campus.address?.country ?? ''}
                            maxLength={100}
                          />
                        </label>
                        <Button type="submit">Save contact details</Button>
                      </form>
                    </details>
                  </>
                )}
                {canChangeStatus && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      save.mutate({
                        campus,
                        status:
                          campus.status === 'active' ? 'inactive' : 'active',
                      })
                    }
                  >
                    {campus.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {(create.isError ||
        save.isError ||
        rename.isError ||
        updateContact.isError) && (
        <p role="alert" className="form-error">
          {apiMessage(
            create.error ?? save.error ?? rename.error ?? updateContact.error,
          )}
        </p>
      )}
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
  const [role, setRole] = useState<string>('teacher');
  const [inviteCampusIds, setInviteCampusIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        role: string;
        status: OrganizationMember['status'];
        campusIds: string[];
      }
    >
  >({});
  const invite = useMutation({
    mutationFn: () =>
      inviteMember(organizationId, { email, role, campusIds: inviteCampusIds }),
    onSuccess: async () => {
      setEmail('');
      await onDone('Invitation sent when delivery is available.');
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
      };
    }) => updateMember(organizationId, id, draft),
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
          <h2>Members</h2>
          <p>
            Membership roles and campus assignments are enforced by the API.
          </p>
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
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              {ORGANIZATION_ROLES.filter(
                (item) => canAssignOwner || item !== 'organization_owner',
              ).map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          {role === 'campus_admin' && (
            <label>
              Campus scope
              <select
                multiple
                value={inviteCampusIds}
                onChange={(event) =>
                  setInviteCampusIds(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
              >
                {campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" disabled={invite.isPending}>
            Invite member
          </Button>
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
            };
            return (
              <article key={member.id} className="organization-row member-row">
                <div>
                  <strong>
                    {member.user?.displayName ?? 'Unavailable account'}
                  </strong>
                  <span>
                    {member.user?.email ?? 'Account details unavailable'} ·{' '}
                    {member.status}
                  </span>
                </div>
                {canManage && (
                  <div className="member-controls">
                    <select
                      aria-label={`Role for ${member.user?.email ?? member.id}`}
                      value={draft.role}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: { ...draft, role: event.target.value },
                        })
                      }
                    >
                      {ORGANIZATION_ROLES.filter(
                        (item) =>
                          canAssignOwner || item !== 'organization_owner',
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
                    <select
                      aria-label={`Campus scope for ${member.user?.email ?? member.id}`}
                      multiple
                      value={draft.campusIds}
                      onChange={(event) =>
                        setDrafts({
                          ...drafts,
                          [member.id]: {
                            ...draft,
                            campusIds: Array.from(
                              event.target.selectedOptions,
                              (option) => option.value,
                            ),
                          },
                        })
                      }
                    >
                      {campuses.map((campus) => (
                        <option key={campus.id} value={campus.id}>
                          {campus.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      onClick={() => save.mutate({ id: member.id, draft })}
                    >
                      Save access
                    </Button>
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
  query,
  canInvite,
}: {
  query: UseQueryResult<{ invitations: OrganizationInvitation[] }>;
  canInvite: boolean;
}) {
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
    <section className="organization-section">
      <h2>Pending invitations</h2>
      {canInvite && (
        <p className="muted-copy">Send invitations from the Members section.</p>
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function AcceptOrganizationInvitationPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [error, setError] = useState('');
  const started = useRef(false);
  const token = useMemo(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '',
    [],
  );
  const accept = useMutation({
    mutationFn: acceptOrganizationInvitation,
    onSuccess: (result) => {
      setStatus('done');
      window.history.replaceState(null, '', window.location.pathname);
      navigate(`/admin/organizations/${result.membership.organizationId}`, {
        replace: true,
      });
    },
    onError: (reason) => {
      setStatus('error');
      setError(apiMessage(reason));
    },
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (token) accept.mutate(token);
    else {
      setStatus('error');
      setError('This invitation link is invalid or expired.');
    }
  }, [token]);
  if (status === 'pending')
    return <LoadingState message="Accepting your organization invitation…" />;
  if (status === 'error')
    return (
      <main className="page-stack">
        <ErrorState title="Invitation unavailable" description={error} />
      </main>
    );
  return <LoadingState message="Opening your organization…" />;
}
