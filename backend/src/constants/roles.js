/** Same powers as legacy super_admin for API route checks */
export const FULL_APP_ACCESS_ROLES = new Set(['super_admin', 'gm', 'sales_agent']);

/** Sees all properties without user_property_access rows */
export const UNRESTRICTED_PROPERTY_ROLES = new Set([
  'super_admin',
  'gm',
  'sales_agent',
  'sales_manager',
  'finance',
]);

export function hasFullAppAccess(role) {
  return FULL_APP_ACCESS_ROLES.has(role);
}

export function canAccessAllProperties(role) {
  return UNRESTRICTED_PROPERTY_ROLES.has(role);
}
