import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Megaphone, MessageSquare, Pin, Plus, Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { listAcademicCampuses } from '../academics/academics-api.js';
import { useAuth } from '../auth/AuthProvider.js';
import { Button } from '../components/ui/Button.js';
import { Dialog } from '../components/ui/Dialog.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import {
  apiMessage,
  useOrganizationAccess,
} from '../staff/StaffPageShared.js';
import { getMembers } from '../organizations/organizations-api.js';
import type { OrganizationMember } from '../organizations/organizations-api.js';
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementInput,
  AnnouncementStatus,
} from './communications-api.js';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from './communications-api.js';
import { ParentTeacherInbox } from './ParentTeacherInbox.js';

const managerRoles = [
  'organization_owner',
  'organization_admin',
  'campus_admin',
  'principal_director',
  'academic_coordinator',
];

const messagingRoles = [
  'organization_owner',
  'organization_admin',
  'principal_director',
  'teacher',
  'parent_guardian',
];

const audienceLabels: Record<AnnouncementAudience, string> = {
  all: 'Everyone',
  staff: 'Staff',
  students: 'Students',
  guardians: 'Guardians',
};

const statusLabels: Record<AnnouncementStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
};

interface AnnouncementDraft {
  title: string;
  content: string;
  targetAudience: AnnouncementAudience;
  campusId: string;
  status: 'draft' | 'published';
  isPinned: boolean;
}

const emptyDraft: AnnouncementDraft = {
  title: '',
  content: '',
  targetAudience: 'all',
  campusId: '',
  status: 'draft',
  isPinned: false,
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function announcementDraft(item: Announcement): AnnouncementDraft {
  return {
    title: item.title,
    content: item.content,
    targetAudience: item.targetAudience,
    campusId: item.campusId ?? '',
    status: item.status === 'published' ? 'published' : 'draft',
    isPinned: item.isPinned,
  };
}

export function CommunicationsDashboard() {
  const { organizationId = '' } = useParams();
  const { user } = useAuth();
  const access = useOrganizationAccess(organizationId);

  const currentRole = access.data?.role ?? '';
  const currentUserId = user?.id ?? '';

  const canManageAnnouncements = managerRoles.includes(currentRole);
  const canAccessMessaging = messagingRoles.includes(currentRole);

  const [activeTab, setActiveTab] = useState<'announcements' | 'messaging'>(
    canManageAnnouncements ? 'announcements' : 'messaging',
  );

  const [audienceFilter, setAudienceFilter] = useState<AnnouncementAudience | ''>('');
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | ''>('');
  const [campusFilter, setCampusFilter] = useState('');

  const filters = useMemo(
    () => ({
      ...(audienceFilter ? { targetAudience: audienceFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(campusFilter ? { campusId: campusFilter } : {}),
    }),
    [audienceFilter, statusFilter, campusFilter],
  );

  const announcements = useAnnouncements(
    organizationId,
    Boolean(access.data && canManageAnnouncements),
    filters,
  );
  const campuses = useQuery({
    queryKey: ['academics', organizationId, 'campuses'],
    queryFn: () => listAcademicCampuses(organizationId),
    enabled: Boolean(access.data && canManageAnnouncements),
    retry: false,
  });
  const members = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: () => getMembers(organizationId),
    enabled: Boolean(access.data && canManageAnnouncements),
    retry: false,
  });

  const create = useCreateAnnouncement(organizationId);
  const update = useUpdateAnnouncement(organizationId);
  const remove = useDeleteAnnouncement(organizationId);
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [draft, setDraft] = useState<AnnouncementDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deletePending, setDeletePending] = useState(false);

  const campusList = campuses.data?.campuses ?? [];
  const campusRestricted =
    access.data?.role === 'campus_admin' ||
    Boolean(access.data?.campusIds.length);
  const availableCampuses = campusRestricted
    ? campusList.filter((campus) =>
        access.data?.campusIds.includes(campus.id),
      )
    : campusList;
  const memberList = members.data?.members ?? [];
  const memberByUserId = new Map(
    memberList
      .filter((member: OrganizationMember) => member.user)
      .map((member: OrganizationMember) => [
        member.user!.id,
        member.user!.displayName,
      ]),
  );

  function openCreate() {
    setEditing(null);
    setDraft({
      ...emptyDraft,
      ...(campusRestricted ? { campusId: availableCampuses[0]?.id ?? '' } : {}),
    });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(item: Announcement) {
    setEditing(item);
    setDraft(announcementDraft(item));
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const input: AnnouncementInput = {
      title: draft.title.trim(),
      content: draft.content.trim(),
      targetAudience: draft.targetAudience,
      ...(draft.campusId ? { campusId: draft.campusId } : {}),
      status: draft.status,
      isPinned: draft.isPinned,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: input });
        toast.showToast(
          input.status === 'published'
            ? 'Announcement updated and published.'
            : 'Announcement updated.',
        );
      } else {
        await create.mutateAsync(input);
        toast.showToast(
          input.status === 'published'
            ? 'Announcement published.'
            : 'Draft announcement saved.',
        );
      }
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(apiMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError('');
    setDeletePending(true);
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.showToast('Announcement deleted.');
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(apiMessage(error));
    } finally {
      setDeletePending(false);
    }
  }

  if (access.isPending) {
    return <LoadingState message="Checking communications access..." />;
  }
  if (access.error || !access.data) {
    return (
      <ErrorState
        title="Organization unavailable"
        description={
          access.error
            ? apiMessage(access.error)
            : 'Communications access could not be verified.'
        }
        onRetry={() => void access.refetch()}
      />
    );
  }

  if (!canManageAnnouncements && !canAccessMessaging) {
    return <PermissionDeniedState />;
  }

  const queryError =
    announcements.error ?? campuses.error ?? members.error ?? null;

  const items = announcements.data?.items ?? [];
  const saving = create.isPending || update.isPending;

  return (
    <main className="communications-page">
      <header className="page-heading communications-heading">
        <div className="communications-heading-text">
          <p className="eyebrow">
            <Megaphone size={15} aria-hidden="true" />
            Organization workspace
          </p>
          <h1>Communications</h1>
          <p className="page-description">
            School-wide announcements and scoped, private parent-teacher messaging.
          </p>
        </div>

        {activeTab === 'announcements' && canManageAnnouncements && (
          <Button onClick={openCreate} type="button" variant="primary">
            <Plus size={17} aria-hidden="true" />
            Create announcement
          </Button>
        )}
      </header>

      {/* Workspace Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: '1.5rem',
        }}
      >
        {canManageAnnouncements && (
          <button
            type="button"
            onClick={() => setActiveTab('announcements')}
            style={{
              padding: '0.75rem 0.25rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'announcements' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'announcements' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Megaphone size={16} />
            Announcements
          </button>
        )}

        {canAccessMessaging && (
          <button
            type="button"
            onClick={() => setActiveTab('messaging')}
            style={{
              padding: '0.75rem 0.25rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'messaging' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'messaging' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <MessageSquare size={16} />
            Parent-Teacher Messages
          </button>
        )}
      </div>

      {activeTab === 'messaging' ? (
        <ParentTeacherInbox
          organizationId={organizationId}
          currentUserId={currentUserId}
          userRole={currentRole}
        />
      ) : (
        <>
          {queryError ? (
            <ErrorState
              title="Communications could not be loaded"
              description={apiMessage(queryError)}
              onRetry={() => {
                void announcements.refetch();
                void campuses.refetch();
                void members.refetch();
              }}
            />
          ) : announcements.isPending || campuses.isPending || members.isPending ? (
            <LoadingState message="Loading announcements..." />
          ) : (
            <section
              className="communications-section"
              aria-label="Announcements"
            >
              <div className="communications-section-heading">
                <div>
                  <h2>Announcement feed</h2>
                  <p>Published notices, drafts, and archived announcements.</p>
                </div>
                <span className="communications-count">
                  {items.length} {items.length === 1 ? 'announcement' : 'announcements'}
                </span>
              </div>

              <div className="communications-filters">
                <label className="communications-field">
                  <span>Target audience</span>
                  <select
                    value={audienceFilter}
                    onChange={(event) =>
                      setAudienceFilter(
                        event.target.value as AnnouncementAudience | '',
                      )
                    }
                  >
                    <option value="">All audiences</option>
                    {(Object.keys(audienceLabels) as AnnouncementAudience[]).map(
                      (audience) => (
                        <option key={audience} value={audience}>
                          {audienceLabels[audience]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="communications-field">
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as AnnouncementStatus | '',
                      )
                    }
                  >
                    <option value="">All statuses</option>
                    {(Object.keys(statusLabels) as AnnouncementStatus[]).map(
                      (status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="communications-field">
                  <span>Campus</span>
                  <select
                    value={campusFilter}
                    onChange={(event) => setCampusFilter(event.target.value)}
                  >
                    <option value="">All campuses</option>
                    {availableCampuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {announcements.isFetching && (
                <p className="communications-refresh" role="status">
                  Updating announcements…
                </p>
              )}

              {items.length === 0 ? (
                <EmptyState
                  title="No announcements found"
                  description="Create an announcement or adjust the selected filters."
                  action={
                    <Button onClick={openCreate} type="button" variant="secondary">
                      <Plus size={16} aria-hidden="true" />
                      Create announcement
                    </Button>
                  }
                />
              ) : (
                <div className="communications-grid">
                  {items.map((item) => (
                    <article className="announcement-card" key={item.id}>
                      <div className="announcement-card-heading">
                        <div className="announcement-badges">
                          {item.isPinned && (
                            <span className="announcement-badge announcement-pin">
                              <Pin size={13} aria-hidden="true" />
                              Pinned
                            </span>
                          )}
                          <span className="announcement-badge announcement-audience">
                            {audienceLabels[item.targetAudience]}
                          </span>
                          <span
                            className={`announcement-badge announcement-status announcement-status-${item.status}`}
                          >
                            {statusLabels[item.status]}
                          </span>
                        </div>
                        <h3>{item.title}</h3>
                      </div>
                      <p className="announcement-content">{item.content}</p>
                      <dl className="announcement-meta">
                        <div>
                          <dt>Publish date</dt>
                          <dd>{formatDate(item.publishDate)}</dd>
                        </div>
                        <div>
                          <dt>Author</dt>
                          <dd>
                            {memberByUserId.get(item.authorId) ??
                              `Member ${shortId(item.authorId)}`}
                          </dd>
                        </div>
                        <div>
                          <dt>Campus</dt>
                          <dd>
                            {item.campusId
                              ? campusList.find(
                                  (campus) => campus.id === item.campusId,
                                )?.name ?? 'Assigned campus'
                              : 'Organization-wide'}
                          </dd>
                        </div>
                      </dl>
                      <div className="announcement-actions">
                        <Button
                          onClick={() => openEdit(item)}
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        <Button
                          aria-label={`Delete ${item.title}`}
                          onClick={() => {
                            setDeleteTarget(item);
                            setDeleteError('');
                          }}
                          type="button"
                          variant="danger"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Create / Edit Announcement Modal */}
      <Dialog
        open={formOpen}
        title={editing ? 'Edit announcement' : 'Create announcement'}
        description="Share a message with your organization or a selected campus."
        onOpenChange={(open) => {
          if (!open) {
            setFormOpen(false);
            setEditing(null);
            setFormError('');
          }
        }}
      >
        <form className="communications-form" onSubmit={submit}>
          <label className="communications-field">
            <span>Title</span>
            <input
              autoFocus
              maxLength={160}
              onChange={(event) => {
                const val = event.target.value;
                setDraft((current) => ({
                  ...current,
                  title: val,
                }));
              }}
              required
              value={draft.title}
            />
          </label>
          <label className="communications-field">
            <span>Content</span>
            <textarea
              maxLength={5000}
              onChange={(event) => {
                const val = event.target.value;
                setDraft((current) => ({
                  ...current,
                  content: val,
                }));
              }}
              required
              rows={6}
              value={draft.content}
            />
          </label>
          <div className="communications-form-grid">
            <label className="communications-field">
              <span>Target audience</span>
              <select
                onChange={(event) => {
                  const val = event.target.value as AnnouncementAudience;
                  setDraft((current) => ({
                    ...current,
                    targetAudience: val,
                  }));
                }}
                value={draft.targetAudience}
              >
                {(Object.keys(audienceLabels) as AnnouncementAudience[]).map(
                  (audience) => (
                    <option key={audience} value={audience}>
                      {audienceLabels[audience]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="communications-field">
              <span>Campus (optional)</span>
              <select
                onChange={(event) => {
                  const val = event.target.value;
                  setDraft((current) => ({
                    ...current,
                    campusId: val,
                  }));
                }}
                value={draft.campusId}
              >
                {!campusRestricted && (
                  <option value="">Organization-wide</option>
                )}
                {availableCampuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="communications-field">
              <span>Status</span>
              <select
                onChange={(event) => {
                  const val = event.target.value as 'draft' | 'published';
                  setDraft((current) => ({
                    ...current,
                    status: val,
                  }));
                }}
                value={draft.status}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>
          <label className="communications-checkbox">
            <input
              checked={draft.isPinned}
              onChange={(event) => {
                const checked = event.target.checked;
                setDraft((current) => ({
                  ...current,
                  isPinned: checked,
                }));
              }}
              type="checkbox"
            />
            <span>Pin this announcement</span>
          </label>
          {formError && (
            <p className="communications-form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
                setFormError('');
              }}
              type="button"
              variant="quiet"
            >
              Cancel
            </Button>
            <Button disabled={saving} type="submit" variant="primary">
              {saving
                ? 'Saving…'
                : draft.status === 'published'
                  ? 'Publish announcement'
                  : 'Save draft'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deleteTarget)}
        title="Delete announcement?"
        description={
          deleteTarget
            ? `“${deleteTarget.title}” will be permanently deleted.`
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError('');
          }
        }}
      >
        {deleteError && (
          <p className="communications-form-error" role="alert">
            {deleteError}
          </p>
        )}
        <div className="dialog-actions">
          <Button
            disabled={deletePending}
            onClick={() => setDeleteTarget(null)}
            type="button"
            variant="quiet"
          >
            Cancel
          </Button>
          <Button
            disabled={deletePending}
            onClick={() => void confirmDelete()}
            type="button"
            variant="danger"
          >
            {deletePending ? 'Deleting…' : 'Delete announcement'}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}