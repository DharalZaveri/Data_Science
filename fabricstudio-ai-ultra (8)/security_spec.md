# Firebase Security Specification - FabricStudio AI

## 1. Data Invariants
- A `Garment` must be owned by the user who created it (`userId` check).
- A `Catalog` must reference a valid `garmentId` owned by the user and a valid `modelId`.
- Only `admin` role can manage the `models` collection.
- Users can only read/write their own `UserProfile`.
- Public/Global models can be read by all authenticated manufacturers.

## 2. The Dirty Dozen Payloads (Targeting PERMISSION_DENIED)

1. **Identity Spoofing**: Attempt to create a Garment with a `userId` belonging to another user.
2. **Privilege Escalation**: A `manufacturer` attempting to create a new `Model` asset.
3. **Ghost Field Update**: Updating a Garment with an extra field `isPremium: true`.
4. **ID Poisoning**: Attempting to create a document with a 2KB garbage string as an ID.
5. **PII Leak**: Accessing another user's `UserProfile` document.
6. **Orphaned Write**: Creating a Catalog referencing a non-existent `garmentId`.
7. **Immutable Violation**: Trying to change the `createdAt` or `userId` of an existing Garment.
8. **State Shortcutting**: Manually setting a Catalog status to `completed` without the generation process.
9. **Denial of Wallet**: Sending a massive array of 1000 pose images in a single Catalog document.
10. **Spoofing Verification**: Accessing restricted data with an unverified email (if mandatory).
11. **Type Poisoning**: Sending a numeric value for the `garment.name` string field.
12. **Recursive Cost Attack**: Forcing deep lookups in a list query without indexable field filters.

## 3. Test Runner (Mock Tests Illustration)
`firestore.rules.test.ts` would verify these boundaries by attempting these specific operations and asserting `assertFails()`.
