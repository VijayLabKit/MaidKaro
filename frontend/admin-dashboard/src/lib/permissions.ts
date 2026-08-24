export type StaffRole = 'SUPER_ADMIN' | 'OPERATIONS' | 'VERIFICATION' | 'SUPPORT' | 'FINANCE';
export type Capability = 'verification' | 'support' | 'finance' | 'operations' | 'staff_management';

// Mirrors app.database.models.STAFF_PERMISSIONS on the backend. This is a
// UX convenience only (hide buttons the user can't use) — the backend
// enforces every one of these checks independently via
// require_staff_permission, so this list drifting out of sync would only
// ever be a UI annoyance, never a security hole.
const STAFF_PERMISSIONS: Record<Capability, StaffRole[]> = {
  verification: ['SUPER_ADMIN', 'VERIFICATION', 'OPERATIONS'],
  support: ['SUPER_ADMIN', 'SUPPORT', 'OPERATIONS'],
  finance: ['SUPER_ADMIN', 'FINANCE'],
  operations: ['SUPER_ADMIN', 'OPERATIONS'],
  staff_management: ['SUPER_ADMIN'],
};

export function hasPermission(staffRole: StaffRole | undefined, capability: Capability): boolean {
  if (!staffRole) return false;
  if (staffRole === 'SUPER_ADMIN') return true;
  return STAFF_PERMISSIONS[capability].includes(staffRole);
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  OPERATIONS: 'Operations',
  VERIFICATION: 'Verification',
  SUPPORT: 'Customer Support',
  FINANCE: 'Finance',
};
