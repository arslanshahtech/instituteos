import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  BookOpenText,
  ClipboardCheck,
  ClipboardList,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  Megaphone,
  MessageSquare,
  Bell,
  Building2,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  Users,
  UserCheck,
  UserPlus,
  WalletCards,
  X,
  CircleUserRound,
} from 'lucide-react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';

import type { RoleLayoutConfig } from '../../layouts/layoutTypes.js';
import { useAuth } from '../../auth/AuthProvider.js';
import { ApiError } from '../../api/client.js';
import { getOrganizationAccessContext } from '../../tenancy/tenancy-api.js';
import { getOrganizationProfile } from '../../organizations/organizations-api.js';
import { getTeacherProfile } from '../../attendance/attendance-api.js';
import { getPortalMe } from '../../pages/portal-api.js';
import { getRoleLayout } from '../../layouts/layoutTypes.js';
import {
  ErrorState,
  LoadingState,
  PermissionDeniedState,
} from '../ui/States.js';

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  queryTab?: string;
  children?: NavigationItem[];
}

const ADMIN_NAVIGATION_PERMISSIONS: Record<string, readonly string[]> = {
  Admission: ['admission.read', 'admission.create'],
  'Enroll Student': ['admission.create'],
  'Promote Students': ['student.update'],
  Students: ['student.read'],
  Families: ['guardian.read'],
  Curriculum: ['academics.read'],
  Sessions: ['academics.read'],
  Sections: ['academics.read'],
  Subjects: ['academics.read'],
  Timetable: ['academics.read'],
  Staff: ['staff.read', 'staff.create', 'staff.update'],
  'Add Staff': ['staff.create'],
  'All Staff': ['staff.read'],
  'Staff Setup': ['staff.read'],
  Attendance: ['attendance.read'],
  Classes: ['attendance.read', 'academics.read'],
  'Attendance Settings': ['attendance.read'],
  Tests: ['examination.read'],
  Exam: ['examination.read'],
  Overview: ['examination.read'],
  Exams: ['examination.read'],
  Schedule: ['examination.read'],
  Marks: ['examination.read'],
  Results: ['examination.read'],
  'Events & Holidays': ['examination.read'],
  Finance: ['finance.read'],
  'Financial Overview': ['finance.read'],
  'Fee Operations': ['finance.read'],
  'Payments & Receipts': ['finance.read'],
  'Expense Management': ['finance.read'],
  'Payroll & Salaries': ['finance.read'],
  'Accounts & Ledger': ['finance.read'],
  Messages: ['communication.read'],
  Announcements: ['communication.read'],
  'Import & Export': ['reporting.read'],
  Organization: [
    'organization.read',
    'campus.read',
    'member.read',
    'member.manage',
    'member.invite',
  ],
  'Organization Profile': ['organization.read'],
  Campuses: ['campus.read'],
  Members: ['member.read'],
  Invitations: ['member.manage'],
};

function filterAdminNavigationItems(
  items: NavigationItem[],
  permissions: readonly string[],
): NavigationItem[] {
  const granted = new Set(permissions);
  const canSee = (label: string, parentLabel?: string) => {
    if (parentLabel === 'Attendance' && label === 'Staff')
      return granted.has('staff.read') && granted.has('attendance.read');
    const required =
      parentLabel === 'Attendance' && label === 'Students'
        ? ['attendance.read']
        : parentLabel === 'Curriculum' && label === 'Classes'
          ? ['academics.read']
          : ADMIN_NAVIGATION_PERMISSIONS[label];
    return !required || required.some((permission) => granted.has(permission));
  };

  return items.flatMap((item) => {
    if (!item.children) return canSee(item.label) ? [item] : [];
    const children = item.children.filter((child) =>
      canSee(child.label, item.label),
    );
    return children.length ? [{ ...item, children }] : [];
  });
}

const previewRoleOptions = [
  { key: 'admin', label: 'Admin' },
  { key: 'teacher', label: 'Teacher' },
  { key: 'parent', label: 'Parent' },
  { key: 'accountant', label: 'Accountant' },
] as const;

function workspaceBasePath(role: RoleLayoutConfig, organizationId?: string) {
  if (!organizationId) return `/${role.key}`;
  return role.key === 'admin'
    ? `/admin/organizations/${encodeURIComponent(organizationId)}`
    : `/${role.key}/organizations/${encodeURIComponent(organizationId)}`;
}

function workspaceKeyForMembershipRole(
  membershipRole: string,
): RoleLayoutConfig['key'] | null {
  if (
    [
      'organization_owner',
      'organization_admin',
      'campus_admin',
      'principal_director',
      'academic_coordinator',
    ].includes(membershipRole)
  )
    return 'admin';
  if (membershipRole === 'teacher') return 'teacher';
  if (membershipRole === 'accountant_finance_officer') return 'accountant';
  if (membershipRole === 'parent_guardian') return 'parent';
  if (membershipRole === 'student') return 'student';
  return null;
}

function getNavigationItems(
  role: RoleLayoutConfig,
  organizationId?: string,
  referencePreview = false,
): NavigationItem[] {
  const base = workspaceBasePath(role, organizationId);
  const items: NavigationItem[] = [
    { label: 'Dashboard', to: base, icon: LayoutDashboard, end: true },
  ];

  if (!organizationId) {
    if (role.key === 'admin') {
      items.push({
        label: 'Your colleges',
        to: '/admin/organizations',
        icon: GraduationCap,
      });
    }
    return items;
  }

  if (referencePreview) {
    if (role.key === 'admin') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        { label: 'Families', to: base + '/families', icon: UserCheck },
        { label: 'Staff', to: base + '/staff', icon: GraduationCap },
        {
          label: 'Attendance',
          to: base + '/attendance',
          icon: ClipboardCheck,
          children: [
            {
              label: 'Classes',
              to: base + '/attendance',
              icon: GraduationCap,
              queryTab: 'classes',
              end: true,
            },
            {
              label: 'Students',
              to: base + '/attendance?tab=students',
              queryTab: 'students',
              icon: Users,
            },
            {
              label: 'Staff',
              to: base + '/attendance?tab=staff',
              queryTab: 'staff',
              icon: UserCheck,
            },
            {
              label: 'Attendance Settings',
              to: base + '/attendance?tab=settings',
              queryTab: 'settings',
              icon: Settings2,
            },
          ],
        },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Admissions', to: base + '/admissions', icon: UserPlus },
        {
          label: 'Finance',
          to: base + '/finance',
          icon: WalletCards,
          children: [
            {
              label: 'Financial Overview',
              to: base + '/finance?tab=overview',
              queryTab: 'overview',
              icon: LayoutDashboard,
            },
            {
              label: 'Fee Operations',
              to: base + '/finance?tab=fees',
              queryTab: 'fees',
              icon: ReceiptText,
            },
            {
              label: 'Payments & Receipts',
              to: base + '/finance?tab=payments',
              queryTab: 'payments',
              icon: WalletCards,
            },
            {
              label: 'Expense Management',
              to: base + '/finance?tab=expenses',
              queryTab: 'expenses',
              icon: ClipboardList,
            },
            {
              label: 'Payroll & Salaries',
              to: base + '/payroll',
              icon: Users,
            },
            {
              label: 'Accounts & Ledger',
              to: base + '/finance?tab=accounts',
              queryTab: 'accounts',
              icon: BarChart3,
            },
          ],
        },
        {
          label: 'Messages',
          to: base + '/communications/messages',
          icon: MessageSquare,
        },
        {
          label: 'Announcements',
          to: base + '/communications/announcements',
          icon: Bell,
        },
        { label: 'Import & Export', to: base + '/reports', icon: BarChart3 },
        {
          label: 'Settings',
          to: base + '/settings?tab=notifications',
          icon: Settings2,
          children: [
            {
              label: 'Notifications',
              to: base + '/settings?tab=notifications',
              icon: Bell,
              queryTab: 'notifications',
            },
            {
              label: 'My Profile',
              to: base + '/settings?tab=my-profile',
              icon: UserCheck,
              queryTab: 'my-profile',
            },
          ],
        },
      );
    } else if (role.key === 'teacher') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        {
          label: 'Attendance',
          to: base + '/attendance',
          icon: ClipboardCheck,
          children: [
            {
              label: 'Classes',
              to: base + '/attendance',
              icon: GraduationCap,
              queryTab: 'classes',
              end: true,
            },
            {
              label: 'Students',
              to: base + '/attendance?tab=students',
              queryTab: 'students',
              icon: Users,
            },
            {
              label: 'Staff',
              to: base + '/attendance?tab=staff',
              queryTab: 'staff',
              icon: UserCheck,
            },
            {
              label: 'Attendance Settings',
              to: base + '/attendance?tab=settings',
              queryTab: 'settings',
              icon: Settings2,
            },
          ],
        },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        {
          label: 'Messages',
          to: base + '/communications/messages',
          icon: MessageSquare,
        },
        { label: 'Import & Export', to: base + '/reports', icon: BarChart3 },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'accountant') {
      items.push(
        { label: 'Students', to: base + '/students', icon: Users },
        {
          label: 'Finance',
          to: base + '/finance',
          icon: WalletCards,
          children: [
            {
              label: 'Financial Overview',
              to: base + '/finance?tab=overview',
              queryTab: 'overview',
              icon: LayoutDashboard,
            },
            {
              label: 'Fee Operations',
              to: base + '/finance?tab=fees',
              queryTab: 'fees',
              icon: ReceiptText,
            },
            {
              label: 'Payments & Receipts',
              to: base + '/finance?tab=payments',
              queryTab: 'payments',
              icon: WalletCards,
            },
            {
              label: 'Expense Management',
              to: base + '/finance?tab=expenses',
              queryTab: 'expenses',
              icon: ClipboardList,
            },
            {
              label: 'Payroll & Salaries',
              to: base + '/payroll',
              icon: Users,
            },
            {
              label: 'Accounts & Ledger',
              to: base + '/finance?tab=accounts',
              queryTab: 'accounts',
              icon: BarChart3,
            },
          ],
        },
        { label: 'Import & Export', to: base + '/reports', icon: BarChart3 },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'parent') {
      items.push(
        { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
        { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
        { label: 'Daily Diary', to: base + '/homework', icon: BookOpenText },
        { label: 'Results', to: base + '/results', icon: ClipboardList },
        { label: 'Messages', to: base + '/messages', icon: Megaphone },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    } else if (role.key === 'student') {
      items.push(
        { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
        {
          label: 'Homework & Tests',
          to: base + '/homework',
          icon: BookOpenText,
        },
        { label: 'Results', to: base + '/results', icon: ClipboardList },
        { label: 'Messages', to: base + '/messages', icon: Megaphone },
        { label: 'Settings', to: base + '/settings', icon: Settings2 },
      );
    }
    return items;
  }

  // Only expose routes that are implemented for the signed-in live workspace.
  // Similar-looking demo routes are deliberately confined to referencePreview.
  if (role.key === 'admin') {
    items.push(
      {
        label: 'Admission',
        to: base + '/admissions',
        icon: UserPlus,
        children: [
          {
            label: 'Enroll Student',
            to: base + '/admissions/enroll',
            icon: UserPlus,
          },
          {
            label: 'Promote Students',
            to: base + '/admissions/promote',
            icon: GraduationCap,
          },
        ],
      },
      { label: 'Students', to: base + '/students', icon: Users },
      { label: 'Families', to: base + '/families', icon: UserCheck },
      {
        label: 'Curriculum',
        to: base + '/academics',
        icon: BookOpenText,
        children: [
          {
            label: 'Sessions',
            to: base + '/academics?tab=curriculum-sessions',
            icon: BookOpenText,
            queryTab: 'curriculum-sessions',
          },
          {
            label: 'Classes',
            to: base + '/academics?tab=curriculum-classes',
            icon: GraduationCap,
            queryTab: 'curriculum-classes',
          },
          {
            label: 'Sections',
            to: base + '/academics?tab=curriculum-sections',
            icon: Users,
            queryTab: 'curriculum-sections',
          },
          {
            label: 'Subjects',
            to: base + '/academics?tab=curriculum-subjects',
            icon: ClipboardList,
            queryTab: 'curriculum-subjects',
          },
        ],
      },
      {
        label: 'Timetable',
        to: base + '/academics?tab=timetable',
        icon: ClipboardCheck,
        queryTab: 'timetable',
      },
      {
        label: 'Staff',
        to: base + '/staff',
        icon: GraduationCap,
        children: [
          { label: 'Add Staff', to: base + '/staff/new', icon: UserPlus },
          { label: 'All Staff', to: base + '/staff', icon: Users, end: true },
          { label: 'Staff Setup', to: base + '/staff/setup', icon: Settings2 },
        ],
      },
      {
        label: 'Attendance',
        to: base + '/attendance',
        icon: ClipboardCheck,
        children: [
          {
            label: 'Classes',
            to: base + '/attendance',
            icon: GraduationCap,
            queryTab: 'classes',
            end: true,
          },
          {
            label: 'Students',
            to: base + '/attendance?tab=students',
            queryTab: 'students',
            icon: Users,
          },
          {
            label: 'Staff',
            to: base + '/attendance?tab=staff',
            queryTab: 'staff',
            icon: UserCheck,
          },
          {
            label: 'Attendance Settings',
            to: base + '/attendance?tab=settings',
            queryTab: 'settings',
            icon: Settings2,
          },
        ],
      },
      {
        label: 'Tests',
        to: base + '/homework-tests',
        icon: BookOpenText,
      },
      {
        label: 'Exam',
        to: base + '/examinations',
        icon: ClipboardList,
        children: [
          {
            label: 'Overview',
            to: base + '/examinations?tab=exam-overview',
            queryTab: 'exam-overview',
            icon: LayoutDashboard,
          },
          {
            label: 'Exams',
            to: base + '/examinations?tab=exam-exams',
            queryTab: 'exam-exams',
            icon: ClipboardList,
          },
          {
            label: 'Schedule',
            to: base + '/examinations?tab=exam-schedule',
            queryTab: 'exam-schedule',
            icon: CalendarDays,
          },
          {
            label: 'Marks',
            to: base + '/examinations?tab=exam-marks',
            queryTab: 'exam-marks',
            icon: ClipboardCheck,
          },
          {
            label: 'Results',
            to: base + '/examinations?tab=exam-results',
            queryTab: 'exam-results',
            icon: GraduationCap,
          },
        ],
      },
      {
        label: 'Events & Holidays',
        to: base + '/events-holidays',
        icon: CalendarDays,
      },
      {
        label: 'Finance',
        to: base + '/finance',
        icon: WalletCards,
        children: [
          {
            label: 'Financial Overview',
            to: base + '/finance?tab=overview',
            queryTab: 'overview',
            icon: LayoutDashboard,
          },
          {
            label: 'Fee Operations',
            to: base + '/finance?tab=fees',
            queryTab: 'fees',
            icon: ReceiptText,
          },
          {
            label: 'Payments & Receipts',
            to: base + '/finance?tab=payments',
            queryTab: 'payments',
            icon: WalletCards,
          },
          {
            label: 'Expense Management',
            to: base + '/finance?tab=expenses',
            queryTab: 'expenses',
            icon: ClipboardList,
          },
          {
            label: 'Payroll & Salaries',
            to: base + '/payroll',
            icon: Users,
          },
          {
            label: 'Accounts & Ledger',
            to: base + '/finance?tab=accounts',
            queryTab: 'accounts',
            icon: BarChart3,
          },
        ],
      },
      {
        label: 'Messages',
        to: base + '/communications/messages',
        icon: MessageSquare,
      },
      {
        label: 'Announcements',
        to: base + '/communications/announcements',
        icon: Bell,
      },
      { label: 'Import & Export', to: base + '/reports', icon: BarChart3 },
      {
        label: 'Organization',
        to: base + '?tab=overview',
        icon: Building2,
        children: [
          {
            label: 'Organization Profile',
            to: base + '?tab=settings',
            icon: Building2,
            queryTab: 'settings',
          },
          {
            label: 'Campuses',
            to: base + '?tab=campuses',
            icon: GraduationCap,
            queryTab: 'campuses',
          },
          {
            label: 'Members',
            to: base + '?tab=members',
            icon: Users,
            queryTab: 'members',
          },
          {
            label: 'Invitations',
            to: base + '?tab=invitations',
            icon: UserPlus,
            queryTab: 'invitations',
          },
        ],
      },
      { label: 'Settings', to: base + '/settings', icon: Settings2 },
    );
  } else if (role.key === 'teacher') {
    items.push(
      { label: 'My classes & students', to: base + '/students', icon: Users },
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      {
        label: 'Daily Diary',
        to: base + '/homework-tests',
        icon: BookOpenText,
      },
      {
        label: 'Exam',
        to: base + '/examinations?tab=exam-marks',
        icon: ClipboardList,
        children: [
          {
            label: 'Marks',
            to: base + '/examinations?tab=exam-marks',
            queryTab: 'exam-marks',
            icon: ClipboardCheck,
          },
          {
            label: 'Results',
            to: base + '/examinations?tab=exam-results',
            queryTab: 'exam-results',
            icon: GraduationCap,
          },
        ],
      },
      {
        label: 'Messages',
        to: base + '/communications/messages',
        icon: MessageSquare,
      },
      { label: 'Settings', to: base + '/settings', icon: Settings2 },
    );
  } else if (role.key === 'accountant') {
    items.push(
      {
        label: 'Finance',
        to: base + '/finance',
        icon: WalletCards,
        children: [
          {
            label: 'Financial Overview',
            to: base + '/finance?tab=overview',
            queryTab: 'overview',
            icon: LayoutDashboard,
          },
          {
            label: 'Fee Operations',
            to: base + '/finance?tab=fees',
            queryTab: 'fees',
            icon: ReceiptText,
          },
          {
            label: 'Payments & Receipts',
            to: base + '/finance?tab=payments',
            queryTab: 'payments',
            icon: WalletCards,
          },
          {
            label: 'Expense Management',
            to: base + '/finance?tab=expenses',
            queryTab: 'expenses',
            icon: ClipboardList,
          },
          {
            label: 'Payroll & Salaries',
            to: base + '/payroll',
            icon: Users,
          },
          {
            label: 'Accounts & Ledger',
            to: base + '/finance?tab=accounts',
            queryTab: 'accounts',
            icon: BarChart3,
          },
        ],
      },
      { label: 'Import & Export', to: base + '/reports', icon: BarChart3 },
    );
  } else if (role.key === 'parent') {
    items.push(
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
      { label: 'Daily Diary', to: base + '/homework', icon: BookOpenText },
      { label: 'Results', to: base + '/results', icon: ClipboardList },
      { label: 'Messages', to: base + '/messages', icon: Megaphone },
      { label: 'Settings', to: base + '/settings', icon: Settings2 },
    );
  } else if (role.key === 'student') {
    items.push(
      { label: 'Attendance', to: base + '/attendance', icon: ClipboardCheck },
      { label: 'Fees & receipts', to: base + '/fees', icon: WalletCards },
      { label: 'Results', to: base + '/results', icon: ClipboardList },
      { label: 'Messages', to: base + '/messages', icon: Megaphone },
    );
  }

  return items;
}

export function AppShell({ role }: { role: RoleLayoutConfig }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      window.localStorage?.getItem('instituteos-sidebar-collapsed') === 'true',
  );
  const [signOutError, setSignOutError] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const quickActionsRef = useRef<HTMLDivElement>(null);
  const [curriculumExpanded, setCurriculumExpanded] = useState(
    () =>
      new URLSearchParams(window.location.search)
        .get('tab')
        ?.startsWith('curriculum-') ?? false,
  );
  const [examExpanded, setExamExpanded] = useState(() =>
    window.location.pathname.includes('/examinations'),
  );
  const [admissionExpanded, setAdmissionExpanded] = useState(() =>
    window.location.pathname.includes('/admissions'),
  );
  const [staffExpanded, setStaffExpanded] = useState(() =>
    /\/staff(?:\/|$)/.test(window.location.pathname),
  );
  const [attendanceExpanded, setAttendanceExpanded] = useState(() =>
    /\/attendance(?:\/|$)/.test(window.location.pathname),
  );
  const [financeExpanded, setFinanceExpanded] = useState(() =>
    /\/finance(?:\/|$)/.test(window.location.pathname),
  );
  const [settingsExpanded, setSettingsExpanded] = useState(() =>
    window.location.pathname.endsWith('/settings'),
  );
  const [organizationExpanded, setOrganizationExpanded] = useState(() =>
    ['settings', 'campuses', 'members', 'invitations'].includes(
      new URLSearchParams(window.location.search).get('tab') ?? '',
    ),
  );
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const activeTab = new URLSearchParams(location.search).get('tab');
    setCurriculumExpanded(activeTab?.startsWith('curriculum-') ?? false);
    setExamExpanded(location.pathname.includes('/examinations'));
    setAdmissionExpanded(location.pathname.includes('/admissions'));
    setStaffExpanded(/\/staff(?:\/|$)/.test(location.pathname));
    setAttendanceExpanded(/\/attendance(?:\/|$)/.test(location.pathname));
    setFinanceExpanded(/\/finance(?:\/|$)/.test(location.pathname));
    setOrganizationExpanded(
      ['campuses', 'members', 'invitations'].includes(activeTab ?? ''),
    );
    setSettingsExpanded(location.pathname.endsWith('/settings'));
  }, [location.pathname, location.search]);
  const { organizationId } = useParams();
  const auth = useAuth();
  const isDevelopment = import.meta.env.DEV;
  const isDemoPreview =
    isDevelopment &&
    (organizationId === 'preview' ||
      location.pathname.includes('/organizations/preview'));
  const navigationOrganizationId = isDemoPreview ? 'preview' : organizationId;
  const organizationAccess = useQuery({
    queryKey: ['organization-context', organizationId],
    queryFn: () => getOrganizationAccessContext(organizationId!),
    enabled: Boolean(
      organizationId && !isDemoPreview && role.key !== 'platform',
    ),
    retry: (failureCount, error) =>
      failureCount < 2 &&
      (!(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500 ||
        error.status === 408),
    retryDelay: (attempt) => Math.min(700 * 2 ** attempt, 3_000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  });
  const organizationProfile = useQuery({
    queryKey: ['organization-header-profile', organizationId],
    queryFn: () => getOrganizationProfile(organizationId!),
    enabled: Boolean(
      organizationId &&
      !isDemoPreview &&
      role.key === 'admin' &&
      organizationAccess.data?.permissions.includes('organization.read'),
    ),
    retry: (failureCount, error) =>
      failureCount < 2 &&
      (!(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500 ||
        error.status === 408),
    retryDelay: (attempt) => Math.min(700 * 2 ** attempt, 3_000),
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const teacherProfile = useQuery({
    queryKey: ['teacher-profile', organizationId],
    queryFn: () => getTeacherProfile(organizationId!),
    enabled: Boolean(
      organizationId &&
      role.key === 'teacher' &&
      organizationAccess.data?.role === 'teacher',
    ),
    retry: false,
  });
  const parentPortal = useQuery({
    queryKey: ['portal-me', organizationId],
    queryFn: () => getPortalMe(organizationId!),
    enabled: Boolean(
      organizationId &&
      role.key === 'parent' &&
      organizationAccess.data?.role === 'parent_guardian',
    ),
    retry: false,
  });
  const workspaceOrganization = organizationProfile.data?.organization;
  const workspaceOrganizationName =
    workspaceOrganization?.name || 'Institute workspace';
  const workspaceDisplayName =
    (role.key === 'teacher'
      ? teacherProfile.data?.profile?.displayName
      : undefined) ||
    (role.key === 'parent'
      ? parentPortal.data?.guardian?.displayName
      : undefined) ||
    auth.user?.displayName ||
    'Signed-in user';
  const authorizedRoleKey = organizationAccess.data
    ? workspaceKeyForMembershipRole(organizationAccess.data.role)
    : null;
  const roleMismatch = Boolean(
    organizationId &&
    !isDemoPreview &&
    role.key !== 'platform' &&
    authorizedRoleKey &&
    authorizedRoleKey !== role.key,
  );
  const items = useMemo(
    () => getNavigationItems(role, navigationOrganizationId, isDemoPreview),
    [role, navigationOrganizationId, isDemoPreview],
  );
  const visibleItems = useMemo(
    () =>
      role.key === 'admin' && organizationId && !isDemoPreview
        ? filterAdminNavigationItems(
            items,
            organizationAccess.data?.permissions ?? [],
          )
        : items,
    [items, role.key, organizationId, isDemoPreview, organizationAccess.data],
  );
  const navigationGroups = useMemo(() => {
    // Teacher and parent workspaces use direct module links without headings.
    // Admin navigation remains grouped for easier scanning at larger scale.
    if (role.key === 'teacher' || role.key === 'parent')
      return [{ label: '', items: visibleItems }];

    const sectionFor = (label: string) => {
      if (label === 'Dashboard') return '';
      if (
        [
          'Curriculum',
          'Timetable',
          'Homework & Tests',
          'Tests',
          'Exam',
          'Examinations',
          'Events & Holidays',
          'Examinations & Marks',
        ].includes(label)
      )
        return 'Academics';
      if (
        [
          'Students',
          'Families',
          'My classes & students',
          'Family contacts',
          'Staff',
          'Admission',
          'Your colleges',
        ].includes(label)
      )
        return 'People';
      if (label === 'Attendance') return 'Attendance & Leaves';
      if (label === 'Messages' || label === 'Announcements')
        return 'Communication';
      if (['Finance', 'Fees & receipts', 'Concessions'].includes(label))
        return 'Finance';
      if (label === 'Import & Export' || label === 'Results')
        return 'Accounting & Reports';
      if (
        label === 'Organization' ||
        label === 'Settings' ||
        label === 'My Profile'
      )
        return 'System';
      return 'Other';
    };
    const groups = new Map<string, NavigationItem[]>();
    for (const item of visibleItems) {
      const section = sectionFor(item.label);
      const group = groups.get(section) ?? [];
      group.push(item);
      groups.set(section, group);
    }
    const sectionOrder = [
      '',
      'Academics',
      'People',
      'Attendance & Leaves',
      'Finance',
      'Communication',
      'Accounting & Reports',
      'System',
      'Other',
    ];
    return [...groups.entries()]
      .sort(
        ([left], [right]) =>
          sectionOrder.indexOf(left) - sectionOrder.indexOf(right),
      )
      .map(([label, groupItems]) => ({ label, items: groupItems }));
  }, [visibleItems, role.key]);
  const homePath = workspaceBasePath(role, navigationOrganizationId);
  const searchResults = useMemo(() => {
    const query = globalQuery.trim().toLowerCase();
    if (!query) return visibleItems.slice(0, 5);
    const normalizedQuery =
      query === 'fees' || query === 'fee' ? 'finance' : query;
    return visibleItems
      .filter((item) => item.label.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [globalQuery, visibleItems]);
  const quickActions = useMemo(() => {
    const base = homePath;
    const preview = isDemoPreview;
    if (role.key === 'admin') {
      const actions = [
        {
          label: 'Add Student',
          to: base + (preview ? '/students' : '/students/new'),
          permission: 'student.create',
        },
        {
          label: 'Collect Fee',
          to: base + '/finance',
          permission: 'finance.write',
        },
        {
          label: 'Mark Attendance',
          to: base + '/attendance',
          permission: 'attendance.write',
        },
        {
          label: 'Generate Report',
          to: base + '/reports',
          permission: 'reporting.read',
        },
      ];
      if (preview) return actions;
      if (!organizationId) return [];
      const granted = new Set(organizationAccess.data?.permissions ?? []);
      return actions.filter((action) => granted.has(action.permission));
    }
    if (role.key === 'teacher')
      return [
        {
          label: 'My classes & students',
          to: base + (preview ? '/students' : '/students'),
        },
        { label: 'Mark Attendance', to: base + '/attendance' },
        {
          label: 'Daily Diary',
          to: base + (preview ? '/homework' : '/homework-tests'),
        },
        { label: 'Examinations & Marks', to: base + '/examinations' },
        { label: 'Messages', to: base + '/communications' },
      ];
    if (role.key === 'accountant')
      return [
        { label: 'Collect Fee', to: base + '/finance' },
        {
          label: 'Concessions',
          to: base + '/finance?tab=concessions',
        },
        { label: 'Generate Report', to: base + '/reports' },
      ];
    if (role.key === 'parent')
      return [
        { label: 'View Attendance', to: base + '/attendance' },
        { label: 'Fees & receipts', to: base + '/fees' },
        { label: 'Messages', to: base + '/messages' },
      ];
    return isDemoPreview
      ? [
          { label: 'Attendance', to: base + '/attendance' },
          { label: 'Results', to: base + '/results' },
        ]
      : [];
  }, [
    homePath,
    isDemoPreview,
    role.key,
    organizationId,
    organizationAccess.data,
  ]);

  const changePreviewRole = (
    nextRole: (typeof previewRoleOptions)[number]['key'],
  ) => {
    navigate(`/${nextRole}/organizations/preview?preview=demo`);
    setMobileNavOpen(false);
    setQuickActionsOpen(false);
    setSearchOpen(false);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      window.localStorage?.setItem(
        'instituteos-sidebar-collapsed',
        String(next),
      );
      return next;
    });
  };

  const closeMobileNav = () => {
    if (mobileNavOpen) setMobileNavOpen(false);
  };

  const signOut = async () => {
    setSignOutError(false);
    try {
      await auth.logout();
      navigate('/login');
    } catch {
      setSignOutError(true);
    }
  };

  useEffect(() => {
    setMobileNavOpen(false);
    setAccountMenuOpen(false);
    setQuickActionsOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!quickActionsOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!quickActionsRef.current?.contains(event.target as Node)) {
        setQuickActionsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setQuickActionsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [quickActionsOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  const isLiveOrganizationWorkspace = Boolean(
    organizationId && !isDemoPreview && role.key !== 'platform',
  );
  const hasCachedAccessDuringTransientError = Boolean(
    organizationAccess.data &&
    organizationAccess.error instanceof ApiError &&
    (organizationAccess.error.status === 0 ||
      organizationAccess.error.status === 408 ||
      organizationAccess.error.status === 429 ||
      organizationAccess.error.status >= 500),
  );

  if (
    isLiveOrganizationWorkspace &&
    organizationAccess.isPending &&
    !organizationAccess.data
  )
    return (
      <main className="auth-bootstrap">
        <LoadingState message="Verifying your institute workspace access…" />
      </main>
    );

  if (
    isLiveOrganizationWorkspace &&
    organizationAccess.isError &&
    !hasCachedAccessDuringTransientError
  ) {
    if (
      organizationAccess.error instanceof ApiError &&
      organizationAccess.error.status === 404
    )
      return <Navigate to="/dashboard" replace />;

    if (
      organizationAccess.error instanceof ApiError &&
      [401, 403].includes(organizationAccess.error.status)
    )
      return (
        <main className="auth-bootstrap">
          <PermissionDeniedState
            title="Workspace access unavailable"
            description="Your account does not have active access to this institute workspace. Ask the institute owner to check your membership."
          />
          <p>
            <Link to="/dashboard">Return to your assigned workspace</Link>
          </p>
        </main>
      );

    return (
      <main className="auth-bootstrap">
        <ErrorState
          title="Unable to verify workspace access"
          description={
            organizationAccess.error instanceof ApiError &&
            organizationAccess.error.status === 0
              ? 'The API server could not be reached. Your workspace data remains protected. Check your connection and retry.'
              : organizationAccess.error instanceof ApiError &&
                  organizationAccess.error.status === 429
                ? 'Workspace verification was temporarily rate-limited (HTTP 429). Please wait a moment and retry.'
                : organizationAccess.error instanceof ApiError &&
                    organizationAccess.error.status >= 500
                  ? 'The workspace service returned a server error. Please retry in a moment.' +
                    (organizationAccess.error.requestId
                      ? ' Reference: ' + organizationAccess.error.requestId
                      : '')
                  : 'Workspace verification did not complete. Your institute data remains protected. Please retry.'
          }
          onRetry={() => void organizationAccess.refetch()}
        />
      </main>
    );
  }

  if (
    isLiveOrganizationWorkspace &&
    organizationAccess.data &&
    !authorizedRoleKey
  )
    return (
      <main className="auth-bootstrap">
        <PermissionDeniedState
          title="Workspace role not supported"
          description="This account has an organization role that is not assigned to a supported workspace. Contact the institute owner."
        />
      </main>
    );

  if (isLiveOrganizationWorkspace && roleMismatch && authorizedRoleKey)
    return (
      <Navigate
        to={workspaceBasePath(getRoleLayout(authorizedRoleKey), organizationId)}
        replace
      />
    );

  return (
    <div
      className={`app-frame${isDemoPreview ? ' app-frame-demo-preview' : ''}${isLiveOrganizationWorkspace ? ' app-frame-live-organization' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        aria-label="Close navigation"
        className="sidebar-overlay"
        hidden={!mobileNavOpen}
        onClick={closeMobileNav}
        tabIndex={mobileNavOpen ? 0 : -1}
        type="button"
      />
      <aside
        className={`sidebar${mobileNavOpen ? ' sidebar-open' : ''}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}
      >
        <div className="sidebar-top-row">
          <Link
            aria-label={
              sidebarCollapsed ? 'Expand sidebar' : 'InstituteOS home'
            }
            className="brand-lockup"
            onClick={(event) => {
              if (sidebarCollapsed) {
                event.preventDefault();
                toggleSidebar();
              }
            }}
            to={homePath}
          >
            <span aria-hidden="true" className="brand-mark">
              I
            </span>
            <span className="brand-name">
              <strong>InstituteOS</strong>
              <small>College management</small>
            </span>
          </Link>
          {!sidebarCollapsed && (
            <button
              className="sidebar-collapse-button sidebar-top-toggle"
              type="button"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav
          aria-label="Main navigation"
          className="primary-navigation sidebar-navigation-scroll"
          id="main-navigation"
        >
          {navigationGroups.map((group) => (
            <div className="navigation-group" key={group.label || 'primary'}>
              {group.label && (
                <div className="navigation-group-heading">{group.label}</div>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div className="navigation-item-group" key={item.label}>
                    <div className="navigation-parent-row">
                      <NavLink
                        key={item.label}
                        aria-expanded={
                          item.children
                            ? item.label === 'Admission'
                              ? admissionExpanded
                              : item.label === 'Staff'
                                ? staffExpanded
                                : item.label === 'Attendance'
                                  ? attendanceExpanded
                                  : item.label === 'Exam'
                                    ? examExpanded
                                    : item.label === 'Finance'
                                      ? financeExpanded
                                      : item.label === 'Organization'
                                        ? organizationExpanded
                                        : item.label === 'Settings'
                                          ? settingsExpanded
                                          : curriculumExpanded
                            : undefined
                        }
                        className={({ isActive }) => {
                          const activeTab = new URLSearchParams(
                            location.search,
                          ).get('tab');
                          const tabMatches = item.children
                            ? true
                            : item.queryTab
                              ? activeTab === item.queryTab
                              : !activeTab;
                          const pathMatches = item.children
                            ? false
                            : item.queryTab
                              ? true
                              : isActive;
                          return `navigation-link${item.children ? ' navigation-parent-toggle' : ''}${pathMatches && tabMatches ? ' navigation-link-active' : ''}`;
                        }}
                        end={item.end}
                        onClick={
                          item.children
                            ? (event) => {
                                event.preventDefault();
                                if (item.label === 'Admission') {
                                  setAdmissionExpanded((expanded) => !expanded);
                                } else if (item.label === 'Staff') {
                                  setStaffExpanded((expanded) => !expanded);
                                } else if (item.label === 'Attendance') {
                                  setAttendanceExpanded(
                                    (expanded) => !expanded,
                                  );
                                } else if (item.label === 'Exam') {
                                  setExamExpanded((expanded) => !expanded);
                                } else if (item.label === 'Finance') {
                                  setFinanceExpanded((expanded) => !expanded);
                                } else if (item.label === 'Organization') {
                                  setOrganizationExpanded(
                                    (expanded) => !expanded,
                                  );
                                } else if (item.label === 'Settings') {
                                  setSettingsExpanded((expanded) => !expanded);
                                } else {
                                  setCurriculumExpanded(
                                    (expanded) => !expanded,
                                  );
                                }
                              }
                            : closeMobileNav
                        }
                        title={sidebarCollapsed ? item.label : undefined}
                        to={item.to}
                      >
                        <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                        <span>{item.label}</span>
                        {item.children && (
                          <ChevronDown
                            className="navigation-expand-icon"
                            size={15}
                            aria-hidden="true"
                          />
                        )}
                      </NavLink>
                    </div>
                    {item.children &&
                      (item.label === 'Admission'
                        ? admissionExpanded
                        : item.label === 'Staff'
                          ? staffExpanded
                          : item.label === 'Attendance'
                            ? attendanceExpanded
                            : item.label === 'Exam'
                              ? examExpanded
                              : item.label === 'Finance'
                                ? financeExpanded
                                : item.label === 'Organization'
                                  ? organizationExpanded
                                  : item.label === 'Settings'
                                    ? settingsExpanded
                                    : curriculumExpanded) &&
                      item.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink
                            key={child.label}
                            className={({ isActive }) => {
                              const activeTab = new URLSearchParams(
                                location.search,
                              ).get('tab');
                              const activeFinanceTab = [
                                'fee-setup',
                                'create-invoices',
                                'concessions',
                              ].includes(activeTab ?? '')
                                ? 'fees'
                                : activeTab === 'payment-history'
                                  ? 'payments'
                                  : activeTab;
                              const attendanceTab = activeTab ?? 'classes';
                              const isAttendanceChildActive =
                                item.label === 'Attendance' &&
                                isActive &&
                                attendanceTab === (child.queryTab ?? 'classes');
                              const isChildActive =
                                item.label === 'Attendance'
                                  ? isAttendanceChildActive
                                  : isActive &&
                                    (!child.queryTab ||
                                      activeFinanceTab === child.queryTab);
                              return `navigation-link navigation-sublink${isChildActive ? ' navigation-sublink-active' : ''}`;
                            }}
                            onClick={() => {
                              if (item.label === 'Admission')
                                setAdmissionExpanded(true);
                              else if (item.label === 'Staff')
                                setStaffExpanded(true);
                              else if (item.label === 'Attendance')
                                setAttendanceExpanded(true);
                              else if (item.label === 'Exam')
                                setExamExpanded(true);
                              else if (item.label === 'Finance')
                                setFinanceExpanded(true);
                              else if (item.label === 'Organization')
                                setOrganizationExpanded(true);
                              else if (item.label === 'Settings')
                                setSettingsExpanded(true);
                              else setCurriculumExpanded(true);
                              closeMobileNav();
                            }}
                            title={sidebarCollapsed ? child.label : undefined}
                            to={child.to}
                          >
                            <ChildIcon
                              size={16}
                              strokeWidth={1.8}
                              aria-hidden="true"
                            />
                            <span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-leading">
            <button
              aria-controls="main-navigation"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
              className="mobile-menu-button button button-quiet button-icon"
              onClick={(event) => {
                event.stopPropagation();
                setMobileNavOpen((open) => !open);
              }}
              type="button"
            >
              {mobileNavOpen ? (
                <X size={19} aria-hidden="true" />
              ) : (
                <Menu size={19} aria-hidden="true" />
              )}
            </button>
            {role.key === 'admin' &&
            organizationId &&
            !isDemoPreview &&
            organizationAccess.data?.permissions.includes(
              'organization.read',
            ) ? (
              <Link
                className="topbar-org-identity"
                to={homePath + '?tab=settings'}
                aria-label={
                  'Open ' + workspaceOrganizationName + ' organization profile'
                }
              >
                <span className="topbar-org-logo">
                  {workspaceOrganization?.logoDataUrl ? (
                    <img src={workspaceOrganization.logoDataUrl} alt="" />
                  ) : (
                    <Building2 size={18} aria-hidden="true" />
                  )}
                </span>
                <span className="topbar-org-copy">
                  <strong>{workspaceOrganizationName}</strong>
                  <small>
                    {workspaceOrganization?.shortCode || 'Institute workspace'}
                  </small>
                </span>
              </Link>
            ) : (
              <div className="mobile-workspace-identity">
                <strong>{role.label}</strong>
                <span>{workspaceDisplayName}</span>
              </div>
            )}
          </div>

          <div className="topbar-actions">
            {isDevelopment && isDemoPreview && (
              <div
                className="role-switcher"
                role="group"
                aria-label="Sample-data design preview role"
              >
                <span className="role-switcher-label">Sample preview</span>
                {previewRoleOptions.map((option) => (
                  <button
                    aria-pressed={role.key === option.key && isDemoPreview}
                    className={`role-switcher-option${role.key === option.key && isDemoPreview ? ' is-active' : ''}`}
                    key={option.key}
                    onClick={() => changePreviewRole(option.key)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <div className="global-search-wrap">
              <form
                aria-label="Find a workspace section"
                className="global-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (searchResults[0]) {
                    navigate(searchResults[0].to);
                    setSearchOpen(false);
                  }
                }}
                role="search"
              >
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label="Search workspace sections and modules"
                  autoComplete="off"
                  onBlur={() =>
                    window.setTimeout(() => setSearchOpen(false), 120)
                  }
                  onChange={(event) => {
                    setGlobalQuery(event.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setSearchOpen(false);
                  }}
                  placeholder="Search sections and modules..."
                  value={globalQuery}
                />
                <kbd>⌘ K</kbd>
              </form>
              {searchOpen && (
                <div
                  className="global-search-popover"
                  role="listbox"
                  aria-label="Available sections"
                >
                  {searchResults.length ? (
                    searchResults.map((item) => (
                      <Link
                        className="global-search-result"
                        key={item.label}
                        onClick={() => {
                          setSearchOpen(false);
                          setGlobalQuery('');
                        }}
                        role="option"
                        to={item.to}
                      >
                        <span>{item.label}</span>
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </Link>
                    ))
                  ) : (
                    <p className="global-search-empty">
                      No matching sections in this workspace.
                    </p>
                  )}
                  <p className="global-search-hint">
                    Choose a section to search its records.
                  </p>
                </div>
              )}
            </div>
            {quickActions.length > 0 && (
              <div className="topbar-quick-actions" ref={quickActionsRef}>
                <button
                  aria-label="Open quick actions"
                  aria-expanded={quickActionsOpen}
                  className="topbar-add-button"
                  onClick={() => {
                    setQuickActionsOpen((open) => !open);
                    setSearchOpen(false);
                  }}
                  type="button"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
                {quickActionsOpen && (
                  <div
                    className="quick-actions-popover"
                    role="menu"
                    aria-label="Quick actions"
                  >
                    {quickActions.map((action) => (
                      <Link
                        className="quick-action-option"
                        role="menuitem"
                        key={action.label}
                        onClick={() => setQuickActionsOpen(false)}
                        to={action.to}
                      >
                        <Plus size={13} aria-hidden="true" />
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            {role.key === 'admin' &&
              organizationId &&
              !isDemoPreview &&
              organizationAccess.data?.permissions.includes(
                'communication.read',
              ) && (
                <Link
                  className="topbar-icon-link"
                  to={homePath + '/communications/announcements'}
                  aria-label="Open announcements"
                  title="Announcements"
                >
                  <Bell size={18} aria-hidden="true" />
                </Link>
              )}
            <div
              className="account-menu"
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setAccountMenuOpen(false);
              }}
            >
              <button
                className="account-menu-trigger"
                type="button"
                aria-haspopup="menu"
                aria-label={`Open account menu for ${workspaceDisplayName}`}
                aria-expanded={accountMenuOpen}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <span
                  className="user-avatar topbar-user-avatar"
                  aria-hidden="true"
                >
                  {(workspaceDisplayName.trim().charAt(0) || 'U').toUpperCase()}
                </span>
                <span className="current-user-name topbar-user-name">
                  {workspaceDisplayName}
                </span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {accountMenuOpen && (
                <div
                  className="account-menu-popover"
                  role="menu"
                  aria-label="My account"
                >
                  <div className="account-menu-heading">
                    <strong>{workspaceDisplayName}</strong>
                    <small>{auth.user?.email}</small>
                  </div>
                  <Link
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    to={homePath + '/settings?tab=my-profile'}
                  >
                    <CircleUserRound size={15} aria-hidden="true" />
                    My Profile
                  </Link>
                  <button role="menuitem" type="button" onClick={signOut}>
                    <X size={15} aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          {signOutError && (
            <span className="visually-hidden" role="alert">
              Sign out failed. Please try again.
            </span>
          )}
        </header>

        <main className="main-content" id="main-content" tabIndex={-1}>
          <Outlet context={{ role }} />
        </main>
        <footer className="app-footer">
          <span>InstituteOS</span>
          <span>College operations · Punjab, Pakistan</span>
        </footer>
      </div>
    </div>
  );
}
