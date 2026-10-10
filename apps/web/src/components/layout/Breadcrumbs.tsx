import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { getAccessibleOrganizations } from '../../organizations/organizations-api.js';
import type { RoleLayoutConfig } from '../../layouts/layoutTypes.js';

const segmentLabels: Record<string, string> = {
  foundations: 'UI foundations',
  organizations: 'Organizations',
  context: 'Access context',
};

function breadcrumbLabel(
  segment: string,
  previousSegment: string | undefined,
  organizationId: string | undefined,
  organizationName: string,
): string {
  if (segment === organizationId) return organizationName;
  if (/^[\da-f]{24}$/i.test(segment)) {
    if (previousSegment === 'students') return 'Student details';
    if (previousSegment === 'guardians') return 'Guardian details';
    return 'Record details';
  }
  return segmentLabels[segment] ?? segment;
}

export function Breadcrumbs({ role }: { role: RoleLayoutConfig }) {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean).slice(1);
  const organizationId =
    segments[0] === 'organizations' &&
    segments[1] &&
    /^[\da-f]{24}$/i.test(segments[1])
      ? segments[1]
      : undefined;
  const organizations = useQuery({
    queryKey: ['accessible-organizations'],
    queryFn: getAccessibleOrganizations,
    enabled: Boolean(organizationId),
    retry: false,
  });
  const organizationName =
    organizations.data?.organizations.find(
      (organization) => organization.id === organizationId,
    )?.name ?? 'Organization';
  const crumbs = [
    { label: role.workspaceTitle, to: `/${role.key}` },
    ...segments.map((segment, index) => ({
      label: breadcrumbLabel(
        segment,
        segments[index - 1],
        organizationId,
        organizationName,
      ),
      to: `/${role.key}/${segments.slice(0, index + 1).join('/')}`,
    })),
  ];
  if (segments.length === 0) crumbs[0].label = 'Overview';

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={crumb.to}>
            {index === crumbs.length - 1 ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link to={crumb.to}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
      <div className="mobile-workspace-identity" aria-label="Current workspace">
        <span>{role.workspaceTitle}</span>
        <strong>
          {organizationId
            ? organizationName
            : (crumbs.at(-1)?.label ?? role.workspaceTitle)}
        </strong>
      </div>
    </nav>
  );
}
