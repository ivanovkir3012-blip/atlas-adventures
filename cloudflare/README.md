# Cloudflare R2 media gateway for «Путь»

This Worker is a staged backend component; it is not deployed or connected to the app yet.

## Setup
1. In Cloudflare, create an R2 bucket named `put-media` (private; no public access).
2. Create a Worker from this directory and deploy it using Wrangler.
3. Bind the bucket in Worker settings as `MEDIA_BUCKET`.
4. Add Worker secrets/variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (the public anon key; never use service-role key)
   - `ALLOWED_ORIGIN` = `https://ivanovkir3012-blip.github.io`
5. Set up Supabase Auth and its users. The Worker validates each bearer token with Supabase Auth.
6. Test PUT, GET and DELETE against an authenticated account before wiring uploads into the app.

The app should upload object IDs (not arbitrary paths); the Worker prefixes each key with the authenticated user ID.

## Important
- Bucket remains private; no R2 public URL is exposed.
- The Worker does not accept Supabase service-role credentials.
- This is a prototype gateway: add rate limits, upload-size enforcement, and production CORS/origin hardening before production use.
- This is not yet a sync or migration implementation. Existing IndexedDB media is unchanged.
