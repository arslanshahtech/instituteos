import { Link, useLocation } from 'react-router-dom';
import type { RoleLayoutConfig } from '../../layouts/layoutTypes.js';

const segmentLabels: Record<string, string> = {
  foundations: 'UI foundations',
};

export function Breadcrumbs({ role }: { role: RoleLayoutConfig }) {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean).slice(1);
  const crumbs = [
    { label: role.workspaceTitle, to: `/${role.key}` },
    ...segments.map((segment, index) => ({
      label: segmentLabels[segment] ?? segment,
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
    </nav>
  );
}
