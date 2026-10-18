import type { ReactNode } from 'react';
import { Search, type LucideIcon } from 'lucide-react';
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

export function WorkspaceSearchField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="reference-search-input">
      <Search size={14} aria-hidden="true" />
      <input
        aria-label={label}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
    </label>
  );
}

export function WorkspaceFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Shared layout primitives keep Demo and live modules visually aligned. */
export function WorkspaceModuleSection({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`reference-module-section ${className}`.trim()}>
      {children}
    </section>
  );
}

export function WorkspaceModuleToolbar({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`reference-module-toolbar ${className}`.trim()}>
      {children}
    </div>
  );
}

/** Shared visual card used by both sample previews and live organization records. */
export function WorkspaceStudentCard({
  initials,
  name,
  subtitle,
  status,
  statusClassName,
  footer,
  to,
  onClick,
  ariaLabel,
  className = '',
}: {
  initials: string;
  name: string;
  subtitle: ReactNode;
  status: string;
  statusClassName: string;
  footer: ReactNode;
  to?: string;
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const content = (
    <>
      <span className="reference-student-card-top">
        <span className="reference-student-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className={`reference-status ${statusClassName}`}>{status}</span>
      </span>
      <strong>{name}</strong>
      <small>{subtitle}</small>
      <span className="reference-student-card-bottom">{footer}</span>
    </>
  );

  if (to) {
    return (
      <Link
        aria-label={ariaLabel}
        className={`reference-student-card ${className}`.trim()}
        to={to}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={`reference-student-card ${className}`.trim()}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  );
}

export function WorkspaceGuardianCard({
  initials,
  name,
  phone,
  relationship,
  childrenNames,
  childCount,
  childrenLoading = false,
  childrenUnavailable = false,
  to,
}: {
  initials: string;
  name: string;
  phone?: string;
  relationship?: string;
  childrenNames: string[];
  childCount: number;
  childrenLoading?: boolean;
  childrenUnavailable?: boolean;
  to: string;
}) {
  return (
    <Link aria-label={name} className="reference-guardian-card" to={to}>
      <span className="reference-guardian-card-top">
        <span className="reference-staff-avatar" aria-hidden="true">{initials}</span>
        <span className="reference-guardian-count">
          {childCount} {childCount === 1 ? 'child' : 'children'}
        </span>
      </span>
      <strong>{name}</strong>
      <span className="reference-guardian-phone">{phone || 'Phone not provided'}</span>
      <span className="reference-guardian-relation">{relationship || 'Relationship not set'}</span>
      <span className="reference-guardian-children">
        <small>Linked children</small>
        {childrenNames.length > 0
          ? childrenNames.join(', ')
          : childrenUnavailable
            ? 'Children list unavailable'
            : childrenLoading
              ? 'Loading linked children…'
              : childCount > 0
                ? 'Linked child names unavailable'
                : 'No linked children'}
      </span>
    </Link>
  );
}

export function WorkspaceStaffCard({
  initials,
  name,
  subtitle,
  details,
  status,
  action,
}: {
  initials: string;
  name: ReactNode;
  subtitle: ReactNode;
  details: ReactNode[];
  status?: ReactNode;
  action: ReactNode;
}) {
  return (
    <article className="reference-staff-card">
      <span className="reference-staff-avatar" aria-hidden="true">
        {initials}
      </span>
      <div className="reference-staff-copy">
        <strong>{name}</strong>
        <small>{subtitle}</small>
        {details.map((detail, index) => (
          <span key={index}>{detail}</span>
        ))}
        {status}
      </div>
      {action}
    </article>
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
