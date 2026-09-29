export interface RoleLayoutConfig {
  key: 'platform' | 'admin' | 'teacher' | 'student' | 'parent';
  label: string;
  workspaceTitle: string;
  description: string;
}

export const roleLayouts = [
  {
    key: 'platform',
    label: 'Platform admin',
    workspaceTitle: 'Platform workspace',
    description: 'A shared foundation for operating the InstituteOS platform.',
  },
  {
    key: 'admin',
    label: 'Organization admin',
    workspaceTitle: 'Organization workspace',
    description:
      'A flexible workspace foundation for an education organization.',
  },
  {
    key: 'teacher',
    label: 'Teacher',
    workspaceTitle: 'Teaching workspace',
    description: 'A focused workspace foundation for teaching teams.',
  },
  {
    key: 'student',
    label: 'Student',
    workspaceTitle: 'Student workspace',
    description: 'A clear workspace foundation for learners.',
  },
  {
    key: 'parent',
    label: 'Parent / guardian',
    workspaceTitle: 'Family workspace',
    description: 'A connected workspace foundation for families.',
  },
] as const satisfies readonly RoleLayoutConfig[];

export function getRoleLayout(key: RoleLayoutConfig['key']): RoleLayoutConfig {
  return roleLayouts.find((layout) => layout.key === key) ?? roleLayouts[0];
}
