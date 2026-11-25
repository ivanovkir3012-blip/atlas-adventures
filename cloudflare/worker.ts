interface Env {
  MEDIA_BUCKET: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  ALLOWED_ORIGIN?: string;
}
function cors(origin: string, allowed: string) {
  const permitted = origin === allowed || origin === "http://localhost:5173";
  return {
    "Access-Control-Allow-Origin": permitted ? origin : allowed,
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-File-Name",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
async function auth(request: Request, env: Env) {
  const token = request.headers.get("Authorization");
  if (!token?.startsWith("Bearer ")) return null;
  const response = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { Authorization: token, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id || null;
}
function safeKey(userId: string, id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  return userId + "/" + id;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "https://ivanovkir3012-blip.github.io";
    const headers = cors(origin, allowed);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    const userId = await auth(request, env);
    if (!userId) return new Response("Unauthorized", { status: 401, headers });
    const url = new URL(request.url);
    const id = url.pathname.replace(/^\//, "");
    const key = safeKey(userId, id);
    if (!key) return new Response("Invalid object key", { status: 400, headers });
    if (request.method === "PUT") {
      const type = request.headers.get("Content-Type") || "application/octet-stream";
      if (!/^image\//.test(type) && !/^video\//.test(type) && !/^audio\//.test(type)) {
        return new Response("Unsupported file type", { status: 415, headers });
      }
      const body = request.body;
      if (!body) return new Response("Empty body", { status: 400, headers });
      await env.MEDIA_BUCKET.put(key, body, { httpMetadata: { contentType: type } });
      return new Response(JSON.stringify({ key, uploaded: true }), { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
    }
    if (request.method === "GET") {
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) return new Response("Not found", { status: 404, headers });
      const responseHeaders = new Headers(headers);
      object.writeHttpMetadata(responseHeaders);
      responseHeaders.set("Content-Disposition", "inline");
      return new Response(object.body, { headers: responseHeaders });
    }
    if (request.method === "DELETE") {
      await env.MEDIA_BUCKET.delete(key);
      return new Response(null, { status: 204, headers });
    }
    return new Response("Method not allowed", { status: 405, headers });
  },
} satisfies ExportedHandler<Env>;
