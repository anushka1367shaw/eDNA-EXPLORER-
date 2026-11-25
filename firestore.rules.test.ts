/**
 * Phase 0: Security Rules Verification Specification for eDNA Explorer
 * Verifies the "Dirty Dozen" adversarial payloads against firestore.rules invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Role on Registration',
    collectionPath: '/users/user_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Rejects incoming().role == "admin" during user document creation.',
  },
  {
    id: 2,
    name: 'Role Escalation on Profile Update',
    collectionPath: '/users/user_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Rejects profile update when role differs from existing().role.',
  },
  {
    id: 3,
    name: 'Shadow Ghost Field Injection',
    collectionPath: '/users/user_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Rejects undocumented keys via data.keys().hasOnly(...).',
  },
  {
    id: 4,
    name: 'Suspended Account Self-Reactivation',
    collectionPath: '/users/user_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Rejects non-admin update to accountStatus.',
  },
  {
    id: 5,
    name: 'Cross-User PII Read',
    collectionPath: '/users/user_2',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    description: 'Rejects get on another user profile for non-admins.',
  },
  {
    id: 6,
    name: 'User Collection Scraping',
    collectionPath: '/users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Rejects list on /users for non-admins.',
  },
  {
    id: 7,
    name: 'Unverified Admin Email Spoof',
    collectionPath: '/users',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Requires request.auth.token.email_verified == true inside isAdmin().',
  },
  {
    id: 8,
    name: 'Project Ownership Hijack',
    collectionPath: '/projects/proj_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Enforces incoming().ownerUid == request.auth.uid.',
  },
  {
    id: 9,
    name: 'Archived Project Tampering',
    collectionPath: '/projects/proj_archived',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Blocks updates when existing().status == "archived" for non-admins.',
  },
  {
    id: 10,
    name: 'Client Timestamp Forgery',
    collectionPath: '/projects/proj_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Enforces createdAt == request.time and updatedAt == request.time.',
  },
  {
    id: 11,
    name: 'Audit Log Tampering',
    collectionPath: '/adminAuditLogs/log_1',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    description: 'Audit logs forbid update and delete for all users including admins.',
  },
  {
    id: 12,
    name: 'Admin Registry Self-Grant',
    collectionPath: '/admins/user_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Client SDKs cannot create or modify /admins documents.',
  },
];
