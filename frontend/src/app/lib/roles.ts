/** Matches backend FULL_APP_ACCESS_ROLES */
const FULL_APP_ACCESS = new Set(['super_admin', 'gm', 'sales_agent']);

/** Sees all properties without restriction */
const UNRESTRICTED_PROPERTIES = new Set([
  'super_admin',
  'gm',
  'sales_agent',
  'sales_manager',
  'finance',
]);

export function hasFullAppAccess(role: string | undefined): boolean {
  return Boolean(role && FULL_APP_ACCESS.has(role));
}

export function canAccessAllProperties(role: string | undefined): boolean {
  return Boolean(role && UNRESTRICTED_PROPERTIES.has(role));
}

/** Sales Agent gets the simplified home; everyone else uses the leadership home */
export function isSalesAgentDashboardRole(role: string | undefined): boolean {
  return role === 'sales_agent';
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  gm: 'General Manager',
  sales_agent: 'Sales Agent',
  sales_manager: 'Sales Manager',
  sales_executive: 'Sales Executive',
  branch_manager: 'Branch Manager',
  banquet_coordinator: 'Banquet Coordinator',
  front_desk: 'Front Desk',
  finance: 'Finance',
};

export function formatRoleLabel(role: string | undefined): string {
  if (!role) return 'Guest';
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
