# eDNA Explorer — Security Specification (Phase 0)

## 1. Data Invariants

1. **Identity & Privilege Invariant**: Every newly registered user in `/users/{userId}` MUST have `role == 'user'` and `accountStatus == 'active'`. Users can NEVER set `role: 'admin'` or modify their own `role` or `accountStatus`.
2. **PII Isolation Invariant**: `/users/{userId}` contains `email` and personal profile data. Read access (`get`) is strictly limited to the document owner (`request.auth.uid == userId`) or a verified administrator (`isAdmin()`). `list` access is restricted exclusively to verified administrators.
3. **Email Verification Invariant**: Administrative access (`isAdmin()`) and standard project/notification mutations strictly require `request.auth.token.email_verified == true`.
4. **Immutable Ownership & Temporal Integrity**: `ownerUid` / `uid` and `createdAt` fields are immutable after creation, and `createdAt` / `updatedAt` / `lastLogin` MUST equal `request.time`.
5. **Immutable Audit Trail**: `/adminAuditLogs/{logId}` can only be created by verified administrators with `actorUid == request.auth.uid` and can NEVER be updated or deleted.
6. **Trusted Admin Registry**: `/admins/{userId}` is read-only from client SDKs; no client can elevate privileges by writing to `/admins`.
7. **Terminal State Locking**: Archived projects (`status == 'archived'`) cannot be modified by standard users (only administrators may intervene).

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Assigned Admin Role on Registration**: `POST /users/{uid}` with `{ uid, fullName: "Attacker", email: "a@b.com", role: "admin", accountStatus: "active", emailVerified: true }` -> MUST return `PERMISSION_DENIED`.
2. **Role Escalation on Profile Update**: `PATCH /users/{uid}` by owner changing `{ role: "admin" }` -> MUST return `PERMISSION_DENIED`.
3. **Shadow Ghost Field Injection**: `POST /users/{uid}` with valid required fields plus `{ isSuperuser: true }` -> MUST return `PERMISSION_DENIED`.
4. **Suspended Account Self-Reactivation**: `PATCH /users/{uid}` by owner changing `{ accountStatus: "active" }` -> MUST return `PERMISSION_DENIED`.
5. **Cross-User PII Read**: `GET /users/{otherUid}` by authenticated non-admin user -> MUST return `PERMISSION_DENIED`.
6. **User Collection Scraping**: `LIST /users` by authenticated non-admin user -> MUST return `PERMISSION_DENIED`.
7. **Unverified Admin Email Spoof**: Request with `email: "anushka1367@gmail.com"` and `email_verified: false` attempting `LIST /users` -> MUST return `PERMISSION_DENIED`.
8. **Project Ownership Hijack**: `POST /projects/{id}` with `{ ownerUid: "victimUid", ... }` -> MUST return `PERMISSION_DENIED`.
9. **Archived Project Tampering**: `PATCH /projects/{id}` on a document where existing `status == "archived"` by non-admin owner -> MUST return `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: `POST /projects/{id}` with `createdAt: "2020-01-01T00:00:00Z"` instead of `serverTimestamp()` -> MUST return `PERMISSION_DENIED`.
11. **Audit Log Tampering**: `DELETE /adminAuditLogs/{logId}` or `UPDATE /adminAuditLogs/{logId}` even by an admin -> MUST return `PERMISSION_DENIED`.
12. **Admin Registry Self-Grant**: `POST /admins/{uid}` by any authenticated user -> MUST return `PERMISSION_DENIED`.
