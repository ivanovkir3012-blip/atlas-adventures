# Filebase cloud-media plan — «Путь»

## Architecture
- **IndexedDB:** local originals, offline access, and upload queue.
- **Supabase (later):** app records/account sync, if adopted.
- **Filebase:** cloud media objects via S3-compatible storage.
- **Client adapter:** only calls an authenticated backend gateway for short-lived presigned URLs. No S3 secret or access key in the PWA.
- **Provider-neutral metadata:** retain provider/object-key fields so migration to R2 can be copy-and-verify.

## Browser security
The PWA must never contain Filebase S3 credentials. A backend endpoint must authenticate the user, validate request size/type and ownership, generate a unique object key, and return a short-lived presigned PUT URL. Download URLs must also be short-lived and authorized. Do not expose public buckets or arbitrary object-key access.

## Client groundwork
`src/cloud/filebase.ts` implements the browser-side presigned URL gateway and upload/download helpers. It is not yet wired into the app UI, upload queue, or a live backend.

Gateway contract:
- POST upload endpoint with JSON `{fileName,mimeType,size,outingId,mediaId}`; returns `{url,method?,headers?,objectKey}`.
- GET download endpoint with `objectKey` query; returns `{url,headers?}`.
- Backend must authorize the request and return only short-lived signed URLs.

## Rollout
1. Confirm Filebase account/bucket and storage costs/limits before committing to it.
2. Set up a trusted backend gateway; do not put Filebase credentials in GitHub, app source, or browser storage.
3. Connect the app's media queue and persist remote object keys/provider status additively.
4. Upload a test file, download it, compare bytes/hash, then test offline behavior.
5. Add retries, pause/resume, queue status and upload-on-Wi-Fi controls.
6. Copy and verify cloud media before any provider migration; never delete local originals or old cloud copies during migration without explicit confirmation.

## Data safety
- Local IndexedDB blobs remain the source of truth until verified upload and download tests pass.
- Do not change or clear the current database.
- Existing full backup remains the safety net.
