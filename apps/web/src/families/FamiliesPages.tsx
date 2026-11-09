import { useEffect, useMemo, useState } from 'react';
import './families.css';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Eye,
  Pencil,
  Trash2,
  UsersRound,
  GraduationCap,
  UserRound,
  FileText,
  Download,
  Search,
  Plus,
  X,
} from 'lucide-react';
import { ApiError } from '../api/client.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { Pagination } from '../components/ui/Pagination.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import { getFamilyContact, listFamilyContacts } from './family-contacts-api.js';
import {
  createFamily,
  deleteFamily,
  getFamily,
  listFamilies,
  updateFamily,
} from './families-api.js';
import type { FamilyListItem } from './families-api.js';

const PAGE_SIZE = 10;
const base = (organizationId: string) =>
  `/admin/organizations/${encodeURIComponent(organizationId)}`;
function message(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'The request could not be completed. Try again.';
}

export function FamiliesListPage() {
  const { organizationId = '' } = useParams();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [guardianChoices, setFamilyContactChoices] = useState<string[]>([]);
  const [guardianToAdd, setFamilyContactToAdd] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [familyName, setFamilyName] = useState('');
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const canRead = Boolean(
    access.data?.permissions.includes('student.read') &&
    access.data.permissions.includes('guardian.read'),
  );
  const canCreate = Boolean(
    access.data?.permissions.includes('student.update') &&
    access.data.permissions.includes('guardian.update'),
  );
  const families = useQuery({
    queryKey: ['families', organizationId, search, page],
    queryFn: () =>
      listFamilies(organizationId, { search, page, pageSize: PAGE_SIZE }),
    enabled: canRead,
  });
  const guardians = useQuery({
    queryKey: ['family-contacts', organizationId, 'family-choice'],
    queryFn: () =>
      listFamilyContacts(organizationId, {
        search: '',
        page: 1,
        pageSize: 100,
      }),
    enabled: createOpen && canCreate,
  });
  const guardianDetails = useQueries({
    queries: guardianChoices.map((id) => ({
      queryKey: ['family-contact-detail', organizationId, id],
      queryFn: () => getFamilyContact(organizationId, id),
      enabled: createOpen,
    })),
  });
  const linkedStudents = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    guardianDetails.forEach((query) =>
      (query.data?.students ?? []).forEach((relation) =>
        map.set(relation.student.id, {
          id: relation.student.id,
          name: relation.student.firstName + ' ' + relation.student.lastName,
        }),
      ),
    );
    return [...map.values()];
  }, [guardianDetails]);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const createMutation = useMutation({
    mutationFn: () =>
      createFamily(organizationId, {
        guardianIds: guardianChoices,
        studentIds: selectedStudents,
        name: familyName.trim() || undefined,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: ['families', organizationId],
      });
      setCreateOpen(false);
      setFamilyContactChoices([]);
      setSelectedStudents([]);
      setFamilyName('');
      showToast(`Family ${result.family.familyNumber} created successfully.`);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (familyId: string) => deleteFamily(organizationId, familyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['families', organizationId],
      });
      if (page > 1 && families.data?.items.length === 1)
        setPage((current) => Math.max(1, current - 1));
      showToast(
        'Family removed. Student, parent and invoice records were preserved.',
      );
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    const ids = linkedStudents.map((item) => item.id);
    setSelectedStudents((current) =>
      current.join('|') === ids.join('|') ? current : ids,
    );
  }, [linkedStudents]);

  const addFamilyContact = () => {
    if (guardianToAdd && !guardianChoices.includes(guardianToAdd))
      setFamilyContactChoices((items) => [...items, guardianToAdd]);
    setFamilyContactToAdd('');
  };
  const exportCsv = () => {
    const rows = families.data?.items ?? [];
    const quote = (value: unknown) =>
      '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = [
      [
        'Family number',
        'Family name',
        'Students',
        'Parents',
        'Invoices',
        'Status',
      ],
      ...rows.map((item) => [
        item.familyNumber,
        item.name,
        item.studentCount,
        item.parentCount,
        item.invoiceCount,
        item.status,
      ]),
    ]
      .map((row) => row.map(quote).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'instituteos-families.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (access.isPending)
    return <LoadingState message="Checking family access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description={message(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;

  return (
    <main className="page-stack student-management-page reference-live-module families-page">
      <header className="families-heading">
        <div>
          <span className="families-eyebrow">PEOPLE MANAGEMENT</span>
          <h1>Families</h1>
          <p>
            Households grouped by family number. Link existing parents and their
            students into one family.
          </p>
        </div>
        {canCreate && (
          <button
            className="button button-primary"
            type="button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} /> Create family
          </button>
        )}
      </header>
      <section className="families-stats">
        <article>
          <span>FAMILIES</span>
          <strong>{families.data?.total ?? '—'}</strong>
          <small>Family groups in this school</small>
          <UsersRound />
        </article>
        <article>
          <span>STUDENTS</span>
          <strong>
            {families.data?.items.reduce(
              (sum, item) => sum + item.studentCount,
              0,
            ) ?? '—'}
          </strong>
          <small>Students on this page</small>
          <GraduationCap />
        </article>
        <article>
          <span>PARENTS</span>
          <strong>
            {families.data?.items.reduce(
              (sum, item) => sum + item.parentCount,
              0,
            ) ?? '—'}
          </strong>
          <small>Parent links on this page</small>
          <UserRound />
        </article>
      </section>
      <section className="families-list-panel panel">
        <div className="families-toolbar">
          <label className="families-search">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by family number or family name…"
              aria-label="Search families"
            />
            <Search size={16} aria-hidden="true" />
          </label>
          <div>
            <button
              className="button button-secondary"
              type="button"
              onClick={exportCsv}
              disabled={!families.data?.items.length}
            >
              <Download size={14} /> CSV
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => window.print()}
            >
              <FileText size={14} /> PDF / Print
            </button>
          </div>
        </div>
        <div className="families-table-wrap">
          <table className="families-table">
            <thead>
              <tr>
                <th>FAMILY</th>
                <th>STUDENTS</th>
                <th>PARENTS</th>
                <th>INVOICES</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {families.isPending ? (
                <tr>
                  <td colSpan={6}>
                    <LoadingState message="Loading families…" />
                  </td>
                </tr>
              ) : families.isError ? (
                <tr>
                  <td colSpan={6}>
                    <ErrorState
                      title="Families unavailable"
                      description={message(families.error)}
                      onRetry={() => void families.refetch()}
                    />
                  </td>
                </tr>
              ) : families.data.items.length ? (
                families.data.items.map((family) => (
                  <tr key={family.id}>
                    <td>
                      <strong>{family.familyNumber}</strong>
                      <small>{family.name || 'No label'}</small>
                    </td>
                    <td>{family.studentCount}</td>
                    <td>{family.parentCount}</td>
                    <td>{family.invoiceCount}</td>
                    <td>
                      <span className="families-status">● Active</span>
                    </td>
                    <td>
                      <div className="families-actions">
                        <Link
                          aria-label={`View ${family.familyNumber}`}
                          title="View family"
                          to={
                            base(organizationId) +
                            '/families/' +
                            encodeURIComponent(family.id)
                          }
                        >
                          <Eye size={16} />
                        </Link>
                        {canCreate && (
                          <button
                            type="button"
                            title="Edit family"
                            aria-label={`Edit ${family.familyNumber}`}
                            onClick={() =>
                              window.dispatchEvent(
                                new CustomEvent('instituteos-edit-family', {
                                  detail: family,
                                }),
                              )
                            }
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {canCreate && (
                          <button
                            className="is-danger"
                            type="button"
                            title="Remove family"
                            aria-label={`Remove ${family.familyNumber}`}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove ${family.familyNumber}? Students, parents and invoices will be kept; only the family grouping will be removed.`,
                                )
                              )
                                deleteMutation.mutate(family.id);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={
                        search
                          ? 'No families match this search'
                          : 'No families yet'
                      }
                      description={
                        search
                          ? 'Try another family number, label or name.'
                          : 'Create a family from an existing family contact and their linked students.'
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {families.data && (
          <Pagination
            currentPage={families.data.page}
            onPageChange={setPage}
            pageSize={families.data.pageSize}
            totalItems={families.data.total}
          />
        )}
      </section>
      {createOpen && (
        <div
          className="families-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCreateOpen(false);
          }}
        >
          <section
            className="families-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="family-create-title"
          >
            <header>
              <div>
                <h2 id="family-create-title">Create family</h2>
                <p>
                  Choose an existing family contact. Their linked students will
                  be available to include.
                </p>
              </div>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setCreateOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>
            <label>
              Family contact
              <select
                value={guardianToAdd}
                onChange={(event) => setFamilyContactToAdd(event.target.value)}
              >
                <option value="">Select existing family contact</option>
                {(guardians.data?.items ?? [])
                  .filter((item) => !guardianChoices.includes(item.id))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.firstName} {item.lastName} ·{' '}
                      {item.phone || 'No phone'}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button button-secondary"
              type="button"
              onClick={addFamilyContact}
              disabled={!guardianToAdd}
            >
              Add family contact
            </button>
            {guardianChoices.length > 0 && (
              <div className="families-selected-parents">
                {guardianChoices.map((id) => {
                  const item = guardians.data?.items.find(
                    (guardian) => guardian.id === id,
                  );
                  return (
                    <span key={id}>
                      {item ? item.firstName + ' ' + item.lastName : 'Loading…'}
                      <button
                        type="button"
                        aria-label="Remove family contact"
                        onClick={() =>
                          setFamilyContactChoices((items) =>
                            items.filter((value) => value !== id),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <label>
              Family label (optional)
              <input
                value={familyName}
                onChange={(event) => setFamilyName(event.target.value)}
                placeholder="e.g. Satti Family"
              />
            </label>
            <div className="families-student-choices">
              <strong>Students linked to selected family contacts</strong>
              {guardianDetails.some((query) => query.isPending) ? (
                <LoadingState message="Loading linked students…" />
              ) : linkedStudents.length ? (
                linkedStudents.map((student) => (
                  <label key={student.id}>
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={(event) =>
                        setSelectedStudents((items) =>
                          event.target.checked
                            ? [...items, student.id]
                            : items.filter((id) => id !== student.id),
                        )
                      }
                    />
                    {student.name}
                  </label>
                ))
              ) : (
                <p className="page-description">
                  Select a family contact with linked students to continue.
                </p>
              )}
            </div>
            {createMutation.isError && (
              <p role="alert">{message(createMutation.error)}</p>
            )}
            <footer>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={
                  createMutation.isPending ||
                  !guardianChoices.length ||
                  !selectedStudents.length
                }
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? 'Creating…' : 'Create family'}
              </button>
            </footer>
          </section>
        </div>
      )}
      <FamilyEditListener organizationId={organizationId} />
    </main>
  );
}

function FamilyEditListener({ organizationId }: { organizationId: string }) {
  const [family, setFamily] = useState<FamilyListItem | null>(null);
  const [familyNumber, setFamilyNumber] = useState('');
  const [name, setName] = useState('');
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      updateFamily(organizationId, family!.id, { familyNumber, name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['families', organizationId],
      });
      setFamily(null);
      showToast('Family details updated.');
    },
  });
  useEffect(() => {
    const handler = (event: Event) => {
      const selected = (event as CustomEvent<FamilyListItem>).detail;
      setFamily(selected);
      setFamilyNumber(selected.familyNumber);
      setName(selected.name);
    };
    window.addEventListener('instituteos-edit-family', handler);
    return () => window.removeEventListener('instituteos-edit-family', handler);
  }, []);
  if (!family) return null;
  return (
    <div
      className="families-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setFamily(null);
      }}
    >
      <section
        className="families-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-edit-title"
      >
        <header>
          <div>
            <h2 id="family-edit-title">Edit family</h2>
            <p>
              Renaming updates the family number shared by its members.
              Historical invoices keep their student links.
            </p>
          </div>
          <button
            type="button"
            className="button button-ghost"
            onClick={() => setFamily(null)}
          >
            <X size={18} />
          </button>
        </header>
        <label>
          Family number
          <input
            value={familyNumber}
            onChange={(event) => setFamilyNumber(event.target.value)}
            required
            maxLength={24}
          />
          <small>
            Letters, digits, hyphens, underscores or spaces. Must be unique
            within this school.
          </small>
        </label>
        <label>
          Label (optional)
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. The Khan Family"
          />
        </label>
        {mutation.isError && <p role="alert">{message(mutation.error)}</p>}
        <footer>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setFamily(null)}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={mutation.isPending || !familyNumber.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function FamilyDetailPage() {
  const { organizationId = '', familyId = '' } = useParams();
  const navigate = useNavigate();
  const access = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
  const canRead = Boolean(
    access.data?.permissions.includes('student.read') &&
    access.data.permissions.includes('guardian.read'),
  );
  const family = useQuery({
    queryKey: ['family', organizationId, familyId],
    queryFn: () => getFamily(organizationId, familyId),
    enabled: canRead,
  });
  if (access.isPending || (canRead && family.isPending))
    return <LoadingState message="Loading family…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description={message(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;
  if (family.isError)
    return (
      <ErrorState
        title="Family unavailable"
        description={message(family.error)}
        onRetry={() => void family.refetch()}
      />
    );
  const record = family.data!;
  return (
    <main className="page-stack student-management-page reference-live-module families-page">
      <div className="families-detail-heading">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => navigate(base(organizationId) + '/families')}
        >
          ← Back
        </button>
        <div>
          <span className="families-number">{record.family.familyNumber}</span>
          <h1>Family</h1>
          {record.family.name && <p>{record.family.name}</p>}
        </div>
      </div>
      <section className="families-stats">
        <article>
          <span>STUDENTS</span>
          <strong>{record.students.length}</strong>
          <small>Enrolled in this family</small>
          <GraduationCap />
        </article>
        <article>
          <span>PARENTS</span>
          <strong>{record.parents.length}</strong>
          <small>Accounts linked</small>
          <UserRound />
        </article>
        <article>
          <span>INVOICES</span>
          <strong>{record.family.invoiceCount}</strong>
          <small>Invoices linked to family students</small>
          <FileText />
        </article>
      </section>
      <section className="families-detail-panel panel">
        <h2>Students ({record.students.length})</h2>
        <div className="families-table-wrap">
          <table className="families-table">
            <thead>
              <tr>
                <th>STUDENT</th>
                <th>REG NO</th>
                <th>CLASS</th>
                <th>SECTION</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {record.students.map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                  </td>
                  <td>{student.registrationNumber || '—'}</td>
                  <td>{student.className}</td>
                  <td>{student.sectionName}</td>
                  <td>
                    <Link
                      to={
                        base(organizationId) +
                        '/students/' +
                        encodeURIComponent(student.id)
                      }
                      title="View student"
                      aria-label={`View ${student.name}`}
                    >
                      <Eye size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="families-detail-panel panel">
        <h2>Parents ({record.parents.length})</h2>
        <div className="families-table-wrap">
          <table className="families-table">
            <thead>
              <tr>
                <th>PARENT</th>
                <th>ROLE</th>
                <th>PHONE</th>
                <th>EMAIL</th>
                <th>CNIC</th>
              </tr>
            </thead>
            <tbody>
              {record.parents.map((parent) => (
                <tr key={parent.id}>
                  <td>
                    <strong>{parent.name}</strong>
                  </td>
                  <td>{parent.relationship}</td>
                  <td>{parent.phone || '—'}</td>
                  <td>{parent.email || '—'}</td>
                  <td>{parent.cnic || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
