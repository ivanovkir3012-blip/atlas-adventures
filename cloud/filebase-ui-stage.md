# Cloud UI integration notes

Queue and adapter modules are now available. They are deliberately not wired into automatic sync/UI until a backend endpoint is configured. This prevents a mobile PWA from exposing Filebase credentials or uploading unexpectedly.

Next UI stage: create a settings card with:
- cloud connection status (not configured/configured)
- queue counts and bytes
- explicit "queue local media" and "start sync" actions
- progress, retry failed items
- Wi-Fi-only option
- clear explanation that local originals remain

Do not place S3 secrets in client-side environment variables, IndexedDB, or GitHub source.
