# Google Drive cloud media plan — «Путь»

## Selected architecture
- IndexedDB: original local media, offline operation and pending-upload queue.
- Google Drive: media cloud archive, authenticated per Google account.
- Supabase (later): application record sync and user/account coordination.
- Provider abstraction: Drive IDs stored as provider-specific references; future R2 migration copies objects and then verifies before switching.

## Drive API access
Use OAuth 2.0 access tokens and the narrow `drive.file` scope, not full Drive access. The user-visible folder is created by the app and only files created/selected for the app are managed through this scope.

Create a user-visible folder named `Путь — облако`, then subfolders for media, journal and backups. Avoid `appDataFolder` for media because it is hidden and has special restrictions.

## Staged provider module
`src/cloud/googleDrive.ts` provides basic folder creation, listing, multipart upload, download and delete functions. It is not yet wired to the app UI, OAuth flow, IndexedDB queue, retry logic, or automatic syncing.

## Next implementation steps
1. Configure a Google Cloud project, enable Drive API and configure OAuth consent.
2. Create OAuth web-client credentials with the published app origin and redirect URI.
3. Implement sign-in/token lifecycle (avoid storing long-lived secrets in the frontend; tokens should be short-lived and safely handled).
4. Add cloud settings UI and explicit connect/disconnect controls.
5. Create Drive folders and persist folder/file IDs locally.
6. Integrate the upload queue, resumable upload for large files, retries and download-on-demand.
7. Verify each upload before marking media as synced; retain local originals.
8. Add migration/export capability so files can be copied to R2 without deleting Drive originals until validation completes.

## Data safety
- Do not delete local originals after upload.
- Never expose public sharing links by default.
- Do not mark media synced until the remote upload and metadata save succeed.
- Keep a full local backup before enabling cloud migration.
