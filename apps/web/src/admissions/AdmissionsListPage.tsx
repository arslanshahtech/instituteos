import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { DataTable } from '../components/ui/DataTable.js';
import { Pagination } from '../components/ui/Pagination.js';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../components/ui/States.js';
import { useToast } from '../components/ui/ToastProvider.js';
import { getCampuses } from '../organizations/organizations-api.js';
import type { Campus } from '../organizations/organizations-api.js';
import { getOrganizationAccessContext } from '../tenancy/tenancy-api.js';
import type { OrganizationAccessContext } from '../tenancy/tenancy-api.js';
import {
  useApplications,
  useCreateApplication,
  useCreateInquiry,
  useInquiries,
  useUpdateInquiryStatus,
} from './admissions-queries.js';
import type { ApplicationStatus, InquiryStatus } from './admissions-api.js';
import type { ApplicationRecord, InquiryRecord } from './admissions-api.js';
import { ApplicationForm, InquiryForm } from './AdmissionsForms.js';

const PAGE_SIZE = 20;
type AdmissionsTab = 'inquiries' | 'applications';

const inquiryStatuses: { value: InquiryStatus | ''; label: string }[] = [
  { value: '', label: 'All inquiry statuses' },
  { value: 'new', label: 'Open' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const applicationStatuses: { value: ApplicationStatus | ''; label: string }[] =
  [
    { value: '', label: 'All application statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Pending' },
    { value: 'in_review', label: 'Under review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'admitted', label: 'Admitted' },
  ];

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.requestId
      ? `${error.message} (Reference: ${error.requestId})`
      : error.message;
  }
  return 'The request could not be completed. Try again.';
}

function useOrganizationAccess(organizationId: string) {
  return useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId),
    enabled: Boolean(organizationId),
    retry: false,
  });
}

function useCampusChoices(
  organizationId: string,
  access?: OrganizationAccessContext,
) {
  return useQuery({
    queryKey: ['organization-campuses', organizationId],
    queryFn: () => getCampuses(organizationId),
    enabled: Boolean(access?.permissions.includes('campus.read')),
    retry: false,
  });
}

function InquiryStatusCell({
  inquiry,
  canReview,
  organizationId,
}: {
  inquiry: InquiryRecord;
  canReview: boolean;
  organizationId: string;
}) {
  const update = useUpdateInquiryStatus(organizationId);
  return canReview ? (
    <label className="admission-status-control">
      <span className="visually-hidden">
        Status for {inquiry.firstName} {inquiry.lastName}
      </span>
      <select
        aria-label={`Status for ${inquiry.firstName} ${inquiry.lastName}`}
        disabled={update.isPending}
        value={inquiry.status}
        onChange={(event) =>
          update.mutate({
            inquiryId: inquiry.id,
            status: event.target.value as InquiryStatus,
          })
        }
      >
        {inquiryStatuses
          .filter((status) => status.value)
          .map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
      </select>
      {update.isError && (
        <span className="field-error" role="alert">
          {apiMessage(update.error)}
        </span>
      )}
    </label>
  ) : (
    <span className="status-badge">{statusLabel(inquiry.status)}</span>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    new: 'Open',
    contacted: 'Contacted',
    qualified: 'Qualified',
    converted: 'Converted',
    closed: 'Closed',
    draft: 'Draft',
    submitted: 'Pending',
    in_review: 'Under review',
    approved: 'Approved',
    rejected: 'Rejected',
    admitted: 'Admitted',
  };
  return labels[status] ?? status;
}

function campusName(campusId: string | undefined, campuses: Campus[]) {
  if (!campusId) return '—';
  return (
    campuses.find((campus) => campus.id === campusId)?.name ?? 'Assigned campus'
  );
}

function InquiryTable({
  rows,
  canReview,
  organizationId,
  campuses,
}: {
  rows: InquiryRecord[];
  canReview: boolean;
  organizationId: string;
  campuses: Campus[];
}) {
  return (
    <div className="admissions-inquiry-table">
      <DataTable
        caption="Admission inquiries"
        columns={[
          {
            header: 'Applicant',
            render: (row) => (
              <div className="inquiry-cell-content">
                <span className="inquiry-mobile-label">Applicant</span>
                <span className="admissions-applicant-name">
                  {row.firstName} {row.lastName}
                </span>
              </div>
            ),
          },
          {
            header: 'Contact',
            render: (row) => (
              <div className="inquiry-cell-content">
                <span className="inquiry-mobile-label">Contact</span>
                <span className="inquiry-contact-value">
                  {row.email ?? row.phone ?? '—'}
                </span>
              </div>
            ),
          },
          {
            header: 'Grade interest',
            render: (row) => (
              <div className="inquiry-cell-content">
                <span className="inquiry-mobile-label">Grade interest</span>
                <span>{row.gradeLevelInterest ?? '—'}</span>
              </div>
            ),
          },
          {
            header: 'Campus of interest',
            render: (row) => (
              <div className="inquiry-cell-content">
                <span className="inquiry-mobile-label">Campus</span>
                <span className="admissions-campus-tag">
                  {campusName(row.campusId, campuses)}
                </span>
              </div>
            ),
          },
          {
            header: 'Status',
            render: (row) => (
              <div className="inquiry-cell-content">
                <span className="inquiry-mobile-label">Status</span>
                <InquiryStatusCell
                  canReview={canReview}
                  inquiry={row}
                  organizationId={organizationId}
                />
              </div>
            ),
          },
          {
            header: 'Received',
            render: (row) => (
              <div className="inquiry-cell-content">
                <span className="inquiry-mobile-label">Received</span>
                <span>{new Date(row.createdAt).toLocaleDateString()}</span>
              </div>
            ),
          },
        ]}
        emptyTitle="No admission inquiries"
        emptyDescription="New inquiries will appear here."
        rowKey={(row) => row.id}
        rows={rows}
      />
    </div>
  );
}

function ApplicationTable({
  rows,
  organizationId,
  campuses,
}: {
  rows: ApplicationRecord[];
  organizationId: string;
  campuses: Campus[];
}) {
  return (
    <DataTable
      caption="Admission applications"
      columns={[
        {
          header: 'Applicant',
          render: (row) => (
            <Link
              className="student-name-link"
              to={`/admin/organizations/${encodeURIComponent(organizationId)}/admissions/applications/${encodeURIComponent(row.id)}`}
            >
              {row.firstName} {row.lastName}
            </Link>
          ),
        },
        { header: 'Program / grade', render: (row) => row.program ?? '—' },
        {
          header: 'Campus',
          render: (row) => (
            <span className="admissions-campus-tag">
              {campusName(row.campusId, campuses)}
            </span>
          ),
        },
        {
          header: 'Status',
          render: (row) => (
            <span className="status-badge">{statusLabel(row.status)}</span>
          ),
        },
        {
          header: 'Received',
          render: (row) => new Date(row.createdAt).toLocaleDateString(),
        },
      ]}
      emptyTitle="No admission applications"
      emptyDescription="Submitted applications will appear here."
      rowKey={(row) => row.id}
      rows={rows}
    />
  );
}

export function AdmissionsListPage() {
  const { organizationId = '' } = useParams();
  const access = useOrganizationAccess(organizationId);
  const campusQuery = useCampusChoices(organizationId, access.data);
  const { showToast } = useToast();
  const [tab, setTab] = useState<AdmissionsTab>('inquiries');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const canRead = access.data?.permissions.includes('admission.read') ?? false;
  const canCreate =
    access.data?.permissions.includes('admission.create') ?? false;
  const canReview =
    access.data?.permissions.includes('admission.review') ?? false;
  const query = {
    search,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const inquiries = useInquiries(
    organizationId,
    query as typeof query & { status?: InquiryStatus },
    Boolean(canRead && tab === 'inquiries'),
  );
  const applications = useApplications(
    organizationId,
    query as typeof query & { status?: ApplicationStatus },
    Boolean(canRead && tab === 'applications'),
  );
  const inquiryChoices = useInquiries(
    organizationId,
    { search, page: 1, pageSize: 100 },
    Boolean(canRead && tab === 'applications' && formOpen),
  );
  const createInquiry = useCreateInquiry(organizationId);
  const createApplication = useCreateApplication(organizationId);

  if (access.isPending)
    return <LoadingState message="Checking admissions access…" />;
  if (access.isError || !access.data)
    return (
      <ErrorState
        title="Organization unavailable"
        description={apiMessage(access.error)}
        onRetry={() => void access.refetch()}
      />
    );
  if (!canRead) return <PermissionDeniedState />;

  const campuses: Campus[] =
    campusQuery.data?.campuses ??
    (access.data.role === 'campus_admin'
      ? access.data.campusIds.map((id, index) => ({
          id,
          organizationId,
          name: `Assigned campus ${index + 1}`,
          status: 'active',
        }))
      : []);
  const campusRequired = access.data.role === 'campus_admin';
  const campusError =
    campusQuery.isError && access.data.permissions.includes('campus.read')
      ? apiMessage(campusQuery.error)
      : undefined;

  return (
    <main className="page-stack student-management-page">
      <section className="page-heading student-page-heading">
        <div>
          <p className="eyebrow">Organization workspace</p>
          <h1>Admissions</h1>
          <p className="page-description">
            Track prospective students from first inquiry through application
            review.
          </p>
        </div>
        <div className="student-page-actions">
          {canCreate && (
            <Button
              onClick={() => setFormOpen((open) => !open)}
              variant="primary"
            >
              {formOpen
                ? 'Close form'
                : tab === 'inquiries'
                  ? 'Add inquiry'
                  : 'New application'}
            </Button>
          )}
        </div>
      </section>

      <section
        aria-label="Admissions records"
        className="student-list-panel panel"
      >
        <div className="admissions-tabs" aria-label="Admissions record type">
          <button
            aria-pressed={tab === 'inquiries'}
            className="admissions-tab"
            onClick={() => {
              setTab('inquiries');
              setStatus('');
              setPage(1);
              setFormOpen(false);
            }}
            type="button"
          >
            Inquiries
          </button>
          <button
            aria-pressed={tab === 'applications'}
            className="admissions-tab"
            onClick={() => {
              setTab('applications');
              setStatus('');
              setPage(1);
              setFormOpen(false);
            }}
            type="button"
          >
            Applications
          </button>
        </div>

        {formOpen && canCreate && (
          <section
            className="student-form-panel panel"
            aria-label={
              tab === 'inquiries' ? 'Create inquiry' : 'Submit application'
            }
          >
            <div className="student-detail-heading">
              <h2>
                {tab === 'inquiries'
                  ? 'Create an inquiry'
                  : 'Submit an application'}
              </h2>
            </div>
            {campusError && (
              <ErrorState
                title="Campus choices unavailable"
                description={campusError}
              />
            )}
            {campusRequired &&
              !campusQuery.isPending &&
              campuses.length === 0 && (
                <p className="form-error" role="alert">
                  No assigned campus is available. Contact your organization
                  administrator.
                </p>
              )}
            {tab === 'inquiries' ? (
              <InquiryForm
                campuses={campuses}
                campusRequired={campusRequired}
                isSaving={createInquiry.isPending}
                saveError={
                  createInquiry.isError
                    ? apiMessage(createInquiry.error)
                    : undefined
                }
                onSubmit={(input) =>
                  createInquiry.mutate(input, {
                    onSuccess: () => {
                      showToast('Inquiry created.');
                      setFormOpen(false);
                    },
                  })
                }
              />
            ) : (
              <ApplicationForm
                inquiries={inquiryChoices.data?.items ?? []}
                campuses={campuses}
                campusRequired={campusRequired}
                isSaving={createApplication.isPending}
                saveError={
                  createApplication.isError
                    ? apiMessage(createApplication.error)
                    : undefined
                }
                onSubmit={(input) =>
                  createApplication.mutate(input, {
                    onSuccess: () => {
                      showToast('Application submitted.');
                      setFormOpen(false);
                      setTab('applications');
                    },
                  })
                }
              />
            )}
            {tab === 'applications' && inquiryChoices.isPending && (
              <LoadingState message="Loading inquiry choices…" />
            )}
            {tab === 'applications' && inquiryChoices.isError && (
              <ErrorState
                title="Inquiry choices unavailable"
                description={apiMessage(inquiryChoices.error)}
                onRetry={() => void inquiryChoices.refetch()}
              />
            )}
          </section>
        )}

        <div className="student-filters">
          <label className="student-search-field">
            <span>
              {tab === 'applications' && formOpen
                ? 'Search applications or linked inquiries'
                : `Search ${tab}`}
            </span>
            <input
              aria-label={`Search ${tab}`}
              autoComplete="off"
              onChange={(event) => {
                setSearchInput(event.target.value);
                setPage(1);
              }}
              placeholder="Search by applicant name or contact"
              type="search"
              value={searchInput}
            />
          </label>
          <label className="student-status-filter">
            <span>Status</span>
            <select
              aria-label="Filter by status"
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              value={status}
            >
              {(tab === 'inquiries'
                ? inquiryStatuses
                : applicationStatuses
              ).map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tab === 'inquiries' ? (
          inquiries.isPending ? (
            <LoadingState message="Loading inquiries…" />
          ) : inquiries.isError ? (
            <ErrorState
              title="Could not load inquiries"
              description={apiMessage(inquiries.error)}
              onRetry={() => void inquiries.refetch()}
            />
          ) : (
            <>
              {inquiries.data.items.length === 0 && (search || status) ? (
                <EmptyState title="No inquiries match these filters" />
              ) : (
                <InquiryTable
                  canReview={canReview}
                  campuses={campuses}
                  organizationId={organizationId}
                  rows={inquiries.data.items}
                />
              )}
              <Pagination
                currentPage={inquiries.data.page}
                pageSize={inquiries.data.pageSize}
                totalItems={inquiries.data.total}
                onPageChange={setPage}
              />
            </>
          )
        ) : applications.isPending ? (
          <LoadingState message="Loading applications…" />
        ) : applications.isError ? (
          <ErrorState
            title="Could not load applications"
            description={apiMessage(applications.error)}
            onRetry={() => void applications.refetch()}
          />
        ) : (
          <>
            {applications.data.items.length === 0 && (search || status) ? (
              <EmptyState title="No applications match these filters" />
            ) : (
              <ApplicationTable
                campuses={campuses}
                organizationId={organizationId}
                rows={applications.data.items}
              />
            )}
            <Pagination
              currentPage={applications.data.page}
              pageSize={applications.data.pageSize}
              totalItems={applications.data.total}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </main>
  );
}
