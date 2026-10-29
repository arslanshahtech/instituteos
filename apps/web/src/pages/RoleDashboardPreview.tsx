import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  BookOpenText,
  CalendarCheck,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MessageCircle,
  ReceiptText,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  WorkspaceMetricCard,
  WorkspacePageHeading,
  WorkspaceQuickAction,
} from '../components/ui/WorkspacePrimitives.js';
import type { RoleLayoutConfig } from '../layouts/layoutTypes.js';

type PreviewMetric = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
};

type PreviewActivity = {
  title: string;
  description: string;
  status: string;
  tone: 'pending' | 'approved' | 'enrolled' | 'paid' | 'info';
};

type PreviewConfig = {
  title: string;
  description: string;
  metrics: PreviewMetric[];
  actions: Array<{ label: string; to: string; icon: LucideIcon }>;
  activityTitle: string;
  activity: PreviewActivity[];
  chartTitle: string;
  chartLabel: string;
  chartValues: number[];
};

function previewConfig(
  role: Exclude<RoleLayoutConfig['key'], 'platform'>,
): PreviewConfig {
  const base = `/${role}/organizations/preview`;
  const adminBase = `/admin/organizations/preview`;
  const admin = role === 'admin';
  const accountant = role === 'accountant';
  const parent = role === 'parent';
  const teacher = role === 'teacher';

  if (admin) {
    return {
      title: 'Institute Overview',
      description: 'Monitor growth, collections and operations at a glance.',
      metrics: [
        {
          label: 'Total students',
          value: '342',
          detail: '+12 this month',
          icon: Users,
        },
        {
          label: 'Teachers',
          value: '18',
          detail: '3 on leave',
          icon: GraduationCap,
        },
        { label: 'Guardians', value: '298', detail: '5 new', icon: Users },
        {
          label: 'Monthly collection',
          value: 'Rs 12.4L',
          detail: '82% of target',
          icon: ReceiptText,
        },
        {
          label: 'Pending dues',
          value: 'Rs 1.8L',
          detail: '46 students',
          icon: WalletCards,
        },
        {
          label: "Today's attendance",
          value: '94%',
          detail: '312 / 332 present',
          icon: CalendarCheck,
        },
      ],
      actions: [
        { label: 'Add Student', to: adminBase + '/students', icon: Users },
        { label: 'Collect Fee', to: adminBase + '/finance', icon: WalletCards },
        {
          label: 'Mark Attendance',
          to: adminBase + '/attendance',
          icon: CalendarCheck,
        },
        {
          label: 'Generate Report',
          to: adminBase + '/reports',
          icon: ChartNoAxesColumnIncreasing,
        },
      ],
      activityTitle: 'Recent Admissions',
      activity: [
        {
          title: 'Reyansh Patel',
          description: '8-A Applied · Today',
          status: 'Pending',
          tone: 'pending',
        },
        {
          title: 'Saanvi Mehta',
          description: '9-A Applied · Yesterday',
          status: 'Approved',
          tone: 'approved',
        },
        {
          title: 'Kabir Khan',
          description: '8-A Enrolled · 2d ago',
          status: 'Enrolled',
          tone: 'enrolled',
        },
      ],
      chartTitle: 'Attendance · This Week',
      chartLabel: '94% average · Best on Saturday',
      chartValues: [72, 78, 87, 81, 91, 96, 94],
    };
  }

  if (teacher) {
    return {
      title: 'My Classes',
      description: 'Monitor classes, attendance and academic tasks.',
      metrics: [
        {
          label: 'My classes',
          value: '4',
          detail: '8-A, 9-B, 10-A…',
          icon: BookOpenText,
        },
        {
          label: 'My students',
          value: '86',
          detail: 'Across 4 sections',
          icon: Users,
        },
        {
          label: 'Attendance today',
          value: '96%',
          detail: '83 / 86 present',
          icon: CalendarCheck,
        },
        {
          label: 'Homework pending',
          value: '12',
          detail: 'To be checked',
          icon: ClipboardCheck,
        },
        {
          label: 'Tests this week',
          value: '5',
          detail: 'Math, Science',
          icon: ReceiptText,
        },
        {
          label: 'Messages',
          value: '8',
          detail: 'Parent queries',
          icon: MessageCircle,
        },
      ],
      actions: [
        {
          label: 'Mark Attendance',
          to: base + '/attendance',
          icon: CalendarCheck,
        },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        {
          label: 'Messages',
          to: base + '/communications',
          icon: MessageCircle,
        },
        {
          label: 'Generate Report',
          to: base + '/reports',
          icon: ChartNoAxesColumnIncreasing,
        },
      ],
      activityTitle: 'Recent Activity',
      activity: [
        {
          title: 'Class 8-A attendance',
          description: 'Today · Mathematics',
          status: 'Saved',
          tone: 'approved',
        },
        {
          title: 'Algebra Assignment · Ch 3',
          description: '8-A · Due 10 Oct',
          status: 'Pending',
          tone: 'pending',
        },
        {
          title: 'Science Lab Report',
          description: '9-B · Submitted today',
          status: 'Checked',
          tone: 'enrolled',
        },
      ],
      chartTitle: 'Attendance · This Week',
      chartLabel: 'Consistent performance · Target 85%',
      chartValues: [76, 86, 92, 88, 91, 90, 96],
    };
  }

  if (parent) {
    return {
      title: 'My Child Overview',
      description:
        'Track your child’s attendance, homework and fee in one place.',
      metrics: [
        {
          label: 'Attendance',
          value: '92%',
          detail: 'Zoya · 8-A',
          icon: CalendarCheck,
        },
        {
          label: 'Fee due',
          value: 'Rs 20K',
          detail: 'Due 10 Oct',
          icon: WalletCards,
        },
        {
          label: 'Homework',
          value: '3 pending',
          detail: 'Math, English',
          icon: BookOpenText,
        },
        {
          label: 'Performance',
          value: '90%',
          detail: 'Avg last term',
          icon: ChartNoAxesColumnIncreasing,
        },
        {
          label: 'Teachers',
          value: '6',
          detail: 'Linked',
          icon: GraduationCap,
        },
        {
          label: 'Messages',
          value: '2 unread',
          detail: 'From class teacher',
          icon: MessageCircle,
        },
      ],
      actions: [
        { label: 'Attendance', to: base + '/attendance', icon: CalendarCheck },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
        { label: 'Messages', to: base + '/messages', icon: MessageCircle },
      ],
      activityTitle: 'Recent Activity',
      activity: [
        {
          title: 'Attendance updated',
          description: 'Zoya · Today',
          status: 'Present',
          tone: 'approved',
        },
        {
          title: 'English homework',
          description: 'Due tomorrow',
          status: 'Pending',
          tone: 'pending',
        },
        {
          title: 'Mid-term result published',
          description: 'Mathematics · 90%',
          status: 'View result',
          tone: 'info',
        },
      ],
      chartTitle: 'Attendance · This Week',
      chartLabel: 'Consistent performance · Target 95%',
      chartValues: [78, 89, 95, 92, 90, 96, 94],
    };
  }

  if (accountant) {
    return {
      title: 'Finance Overview',
      description: 'Monitor collections, dues and college fee operations.',
      metrics: [
        {
          label: 'Collected',
          value: 'Rs 12.4L',
          detail: 'This month',
          icon: WalletCards,
        },
        {
          label: 'Pending',
          value: 'Rs 1.8L',
          detail: '46 students',
          icon: ReceiptText,
        },
        {
          label: 'Concessions',
          value: 'Rs 45K',
          detail: '12 cases',
          icon: CheckCircle2,
        },
        {
          label: 'Today',
          value: 'Rs 84K',
          detail: 'Cash + online',
          icon: WalletCards,
        },
        {
          label: 'Defaulters',
          value: '18',
          detail: 'Over 30 days',
          icon: ClipboardCheck,
        },
        {
          label: 'Receipts',
          value: '342',
          detail: 'Generated',
          icon: ReceiptText,
        },
      ],
      actions: [
        { label: 'Collect Fee', to: base + '/finance', icon: WalletCards },
        { label: 'Concessions', to: base + '/concessions', icon: ReceiptText },
        { label: 'View Receipts', to: base + '/finance', icon: ClipboardCheck },
        {
          label: 'Generate Report',
          to: base + '/reports',
          icon: ChartNoAxesColumnIncreasing,
        },
      ],
      activityTitle: 'Recent Activity',
      activity: [
        {
          title: 'Monthly fee · Areeba Khan',
          description: 'Receipt issued · Today',
          status: 'Paid',
          tone: 'paid',
        },
        {
          title: 'Lab fee · Hassan Ali',
          description: 'Payment received · Yesterday',
          status: 'Paid',
          tone: 'paid',
        },
        {
          title: 'Fee reminder · Class 8-A',
          description: 'Reminder queued',
          status: 'Pending',
          tone: 'pending',
        },
      ],
      chartTitle: 'Daily Collection',
      chartLabel: 'Collection progress · Target 95%',
      chartValues: [55, 72, 84, 78, 89, 93, 86],
    };
  }

  return {
    title: 'My Learning Overview',
    description:
      'Your attendance, homework and published results in one place.',
    metrics: [
      {
        label: 'Attendance',
        value: '92%',
        detail: 'This month',
        icon: CalendarCheck,
      },
      {
        label: 'Homework',
        value: '3 pending',
        detail: 'Next due tomorrow',
        icon: BookOpenText,
      },
      {
        label: 'Performance',
        value: '90%',
        detail: 'Average last term',
        icon: ChartNoAxesColumnIncreasing,
      },
      {
        label: 'Tests',
        value: '2 upcoming',
        detail: 'This week',
        icon: ClipboardCheck,
      },
      {
        label: 'Results',
        value: '4 published',
        detail: 'Latest term',
        icon: GraduationCap,
      },
      {
        label: 'Messages',
        value: '2 unread',
        detail: 'Class updates',
        icon: MessageCircle,
      },
    ],
    actions: [
      { label: 'Attendance', to: base + '/attendance', icon: CalendarCheck },
      { label: 'Homework & Tests', to: base + '/homework', icon: BookOpenText },
      {
        label: 'Published Results',
        to: base + '/results',
        icon: GraduationCap,
      },
      { label: 'Messages', to: base + '/messages', icon: MessageCircle },
    ],
    activityTitle: 'Recent Activity',
    activity: [
      {
        title: 'Attendance updated',
        description: 'Today',
        status: 'Present',
        tone: 'approved',
      },
      {
        title: 'Science homework',
        description: 'Due tomorrow',
        status: 'Pending',
        tone: 'pending',
      },
      {
        title: 'Mathematics result',
        description: 'Published this week',
        status: 'View result',
        tone: 'info',
      },
    ],
    chartTitle: 'Attendance · This Week',
    chartLabel: 'Weekly attendance summary · Preview',
    chartValues: [77, 88, 91, 84, 93, 90, 92],
  };
}

export function RoleDashboardPreview({
  role,
  userName,
}: {
  role: Exclude<RoleLayoutConfig['key'], 'platform'>;
  userName?: string;
}) {
  const config = previewConfig(role);
  const base =
    role === 'admin'
      ? '/admin/organizations/preview'
      : `/${role}/organizations/preview`;

  return (
    <main className="page-stack role-dashboard reference-dashboard-preview">
      <WorkspacePageHeading
        eyebrow={
          role === 'admin'
            ? 'Admin view'
            : role === 'accountant'
              ? 'Finance view'
              : role === 'parent'
                ? 'Parent view'
                : role === 'teacher'
                  ? 'Teacher view'
                  : 'Student view'
        }
        title={config.title}
        description={config.description}
        aside={
          <span className="reference-preview-note">
            LAYOUT PREVIEW · SAMPLE DATA
          </span>
        }
      />
      {userName && (
        <p className="reference-dashboard-greeting">
          Previewing for {userName}
        </p>
      )}

      <nav
        aria-label="Dashboard quick actions"
        className="reference-quick-actions"
      >
        {config.actions.map((action) => (
          <WorkspaceQuickAction key={action.label} {...action} />
        ))}
      </nav>

      <section
        aria-label="Sample dashboard metrics"
        className="reference-metrics-grid"
      >
        {config.metrics.map((metric) => (
          <WorkspaceMetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div className="reference-dashboard-bottom">
        <section className="reference-dashboard-panel">
          <div className="reference-panel-heading">
            <h2>{config.activityTitle}</h2>
            <Link
              to={
                base +
                (role === 'admin'
                  ? '/admissions'
                  : role === 'accountant'
                    ? '/finance'
                    : role === 'parent'
                      ? '/messages'
                      : role === 'student'
                        ? '/results'
                        : '/homework')
              }
              className="reference-view-all"
            >
              View all <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div className="reference-activity-list">
            {config.activity.map((activity) => (
              <article className="reference-activity-row" key={activity.title}>
                <span className="reference-activity-dot" aria-hidden="true" />
                <span className="reference-activity-copy">
                  <strong>{activity.title}</strong>
                  <small>{activity.description}</small>
                </span>
                <span
                  className={`reference-status reference-status-${activity.tone}`}
                >
                  {activity.status}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="reference-dashboard-panel reference-attendance-panel">
          <div className="reference-panel-heading">
            <h2>{config.chartTitle}</h2>
          </div>
          <div
            className="reference-chart-bars"
            role="img"
            aria-label={config.chartTitle + ', sample data'}
          >
            {config.chartValues.map((value, index) => (
              <div className="reference-chart-day" key={index}>
                <div className="reference-chart-track">
                  <span
                    className="reference-chart-fill"
                    style={{ height: value + '%' }}
                  />
                </div>
                <small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small>
              </div>
            ))}
          </div>
          <div className="reference-chart-summary">
            <span className="reference-chart-status-dot" aria-hidden="true" />
            {config.chartLabel}
          </div>
        </section>
      </div>
    </main>
  );
}
