import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface WorkspaceMetric {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  className?: string;
}

export function WorkspacePageHeading({
  eyebrow,
  title,
  description,
  aside,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`page-heading reference-dashboard-heading ${className}`.trim()}
    >
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
        {children}
      </div>
      {aside}
    </section>
  );
}

export function WorkspaceMetricCard({ metric }: { metric: WorkspaceMetric }) {
  const Icon = metric.icon;
  return (
    <article
      className={`reference-metric-card ${metric.className ?? ''}`.trim()}
    >
      <div className="reference-metric-icon">
        <Icon size={15} aria-hidden="true" />
      </div>
      <span className="reference-metric-label">{metric.label}</span>
      <strong>{metric.value}</strong>
      <small>{metric.detail}</small>
    </article>
  );
}

export function WorkspaceQuickAction({
  label,
  to,
  icon: Icon,
}: {
  label: string;
  to: string;
  icon: LucideIcon;
}) {
  return (
    <Link className="reference-quick-action" to={to}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </Link>
  );
}
