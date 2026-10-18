export interface RoleLayoutConfig {
  key: 'platform' | 'admin' | 'teacher' | 'accountant' | 'student' | 'parent';
  label: string;
  workspaceTitle: string;
  description: string;
}

export const roleLayouts = [
  {
    key: 'platform',
    label: 'Platform admin',
    workspaceTitle: 'Platform workspace',
    description: 'Manage the InstituteOS platform and its organizations.',
  },
  {
    key: 'admin',
    label: 'College admin',
    workspaceTitle: 'Organization workspace',
    description:
      'A clear view of your college operations and what needs attention.',
  },
  {
    key: 'teacher',
    label: 'Teacher',
    workspaceTitle: 'Teaching workspace',
    description:
      'Your assigned classes, attendance and academic tasks in one place.',
  },
  {
    key: 'accountant',
    label: 'Accountant',
    workspaceTitle: 'Finance workspace',
    description: 'Fee collection, outstanding dues and payment records.',
  },
  {
    key: 'student',
    label: 'Student',
    workspaceTitle: 'Student workspace',
    description: 'A clear view of your academic information.',
  },
  {
    key: 'parent',
    label: 'Parent / guardian',
    workspaceTitle: 'Family workspace',
    description: 'Your child’s fees, attendance, results and college messages.',
  },
] as const satisfies readonly RoleLayoutConfig[];

export function getRoleLayout(key: RoleLayoutConfig['key']): RoleLayoutConfig {
  return roleLayouts.find((layout) => layout.key === key) ?? roleLayouts[0];
}
