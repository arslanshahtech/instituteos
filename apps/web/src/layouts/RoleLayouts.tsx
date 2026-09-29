import { AppShell } from '../components/layout/AppShell.js';
import { getRoleLayout } from './layoutTypes.js';
import type { RoleLayoutConfig } from './layoutTypes.js';

function RoleLayout({ config }: { config: RoleLayoutConfig }) {
  return <AppShell role={config} />;
}

export function PlatformLayout() {
  return <RoleLayout config={getRoleLayout('platform')} />;
}

export function AdminLayout() {
  return <RoleLayout config={getRoleLayout('admin')} />;
}

export function TeacherLayout() {
  return <RoleLayout config={getRoleLayout('teacher')} />;
}

export function StudentLayout() {
  return <RoleLayout config={getRoleLayout('student')} />;
}

export function ParentLayout() {
  return <RoleLayout config={getRoleLayout('parent')} />;
}
