# Firestore Security Specification & Invariants

## 1. Data Invariants
- **User Profile Isolation**: `/users/{userId}` can only be read or written by the authenticated user whose `request.auth.uid == userId`.
- **Case Ownership**: Any document under `/users/{userId}/cases/{caseId}` belongs strictly to `{userId}`. `incoming().userId` must strictly equal `request.auth.uid` and `{userId}`.
- **Immortal Keys**: On update, the `id`, `userId`, and `createdAt` cannot be altered.
- **Strict Fields**: No shadow/ghost fields are allowed on write.
- **Sanitized IDs**: Path variables must conform to `^[a-zA-Z0-9_\-]+$` and length `<= 128`.
- **Default Deny**: All other collections and wildcards are strictly blocked (`allow read, write: if false;`).

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Unauthenticated Profile Read**: Attempting to read `/users/target-user-123` with `auth == null`.
2. **Cross-User Profile Read**: User `alice-uid` attempting to read `/users/bob-uid`.
3. **Cross-User Profile Write**: User `alice-uid` attempting to write `/users/bob-uid`.
4. **Profile Privilege Escalation (Ghost Field)**: Writing `{ id: "alice-uid", email: "alice@test.com", isAdmin: true }` to `/users/alice-uid`.
5. **Path ID Injection**: Creating a document at `/users/alice-uid/cases/<script>alert(1)</script>`.
6. **Orphaned Case Write**: Writing to `/users/alice-uid/cases/case-1` with `{ userId: "bob-uid" }`.
7. **Cross-User Case Read / Exfiltration**: User `bob-uid` attempting to read `/users/alice-uid/cases/case-1`.
8. **Cross-User Case Listing / Query Scraping**: User `bob-uid` querying `/users/alice-uid/cases`.
9. **Tampering with Case Immutable Owner**: Updating an existing case at `/users/alice-uid/cases/case-1` with `{ userId: "attacker-uid" }`.
10. **Denial-of-Wallet Payload**: Creating a case with a 2MB description string.
11. **Type Poisoning**: Creating a case with `timestamp: "not-a-number"`.
12. **Blanket Collection Traversal**: Listing `/users` without scoping to a single user document.
