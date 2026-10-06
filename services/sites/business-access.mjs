// These identity headers are supplied by the Sites dispatcher, never by the UI.
export function siteUser(request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  return userId && email ? { userId, email: email.trim().toLowerCase() } : null;
}
export function accessError(status, message) { return Object.assign(new Error(message), { status }); }
const json = (body, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function authorizeBusiness(request, env, ownerOnly = false) {
  const user = siteUser(request);
  if (!user) throw accessError(401, "Sign in with ChatGPT to access this workspace.");
  const businessId = request.headers.get("x-business-id");
  const configuredId = env.AA_BUSINESS_ID ?? "ravi-stores";
  if (businessId !== configuredId) throw accessError(403, "You do not have access to this business.");
  if (!env.DB?.prepare) throw accessError(503, "Access records are temporarily unavailable.");
  const sql = (text, ...values) => env.DB.prepare(text).bind(...values);
  let business = await sql("SELECT * FROM business_access WHERE id = ?", businessId).first();
  // One-time, server-configured owner enrollment. Bind to a stable Site subject;
  // later owner checks never depend on a mutable email address.
  if (!business && env.AA_OWNER_EMAIL && user.email === env.AA_OWNER_EMAIL.toLowerCase()) {
    if (!env.AA_SANDBOX_CONSENT_ID) throw accessError(503, "This business has no configured consent.");
    await sql("INSERT INTO business_access (id, owner_user_id, consent_id) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING", businessId, user.userId, env.AA_SANDBOX_CONSENT_ID).run();
    business = await sql("SELECT * FROM business_access WHERE id = ?", businessId).first();
  }
  if (!business) throw accessError(403, "Ask the business owner to grant you reviewer access.");
  let role;
  if (business.owner_user_id === user.userId) role = "owner";
  else {
    // A previously enrolled subject remains stable even if its email changes.
    let grant = await sql("SELECT * FROM reviewer_access WHERE business_id = ? AND user_id = ? AND active = 1", businessId, user.userId).first();
    if (!grant) {
      grant = await sql("SELECT * FROM reviewer_access WHERE business_id = ? AND email = ? AND active = 1", businessId, user.email).first();
      if (grant && grant.user_id == null) {
        await sql("UPDATE reviewer_access SET user_id = ? WHERE business_id = ? AND email = ? AND user_id IS NULL AND active = 1", user.userId, businessId, user.email).run();
        grant = await sql("SELECT * FROM reviewer_access WHERE business_id = ? AND email = ? AND active = 1", businessId, user.email).first();
      }
      if (grant?.user_id !== user.userId) grant = null;
    }
    if (grant) role = "reviewer";
  }
  if (!role || (ownerOnly && role !== "owner")) throw accessError(403, "Only the business owner can perform this action.");
  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (body && request.headers.get("origin") !== (env.APP_ORIGIN ?? new URL(request.url).origin)) throw accessError(403, "This action must originate from your workspace.");
  return { ...user, role, businessId, consentId: business.consent_id };
}

export async function handleBusinessAccess(request, env) {
  const url = new URL(request.url);
  const profile = url.pathname === "/v1/auth/me";
  const grants = url.pathname === "/v1/access/reviewers";
  if (!profile && !grants) return null;
  const user = siteUser(request);
  const signInPath = "/signin-with-chatgpt?return_to=%2Fworkspace";
  if (profile && request.method === "GET") {
    if (!user) return json({ authenticated: false, signInPath });
    try {
      const access = await authorizeBusiness(request, env);
      return json({ authenticated: true, email: user.email, businessId: access.businessId, role: access.role, signInPath });
    } catch (error) {
      return json({ authenticated: true, email: user.email, role: null, message: error.message, signInPath }, error.status ?? 503);
    }
  }
  try {
    const access = await authorizeBusiness(request, env, true);
    const sql = (text, ...values) => env.DB.prepare(text).bind(...values);
    if (request.method === "GET") {
      const rows = await sql("SELECT email, active, user_id, updated_at FROM reviewer_access WHERE business_id = ? ORDER BY email", access.businessId).all();
      return json({ reviewers: rows.results.map((r) => ({ email: r.email, active: Boolean(r.active), enrolled: Boolean(r.user_id), updatedAt: r.updated_at })) });
    }
    if (!["POST", "DELETE"].includes(request.method)) return json({ error: "method_not_allowed" }, 405);
    const input = await request.json();
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email === access.email) return json({ error: "invalid_email", message: "Enter the reviewer's email address." }, 400);
    const active = request.method === "POST" ? 1 : 0;
    // The role is fixed to reviewer; client-supplied role/user IDs are ignored.
    await env.DB.batch([
      sql("INSERT INTO reviewer_access (business_id, email, active, granted_by, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(business_id, email) DO UPDATE SET active=excluded.active, granted_by=excluded.granted_by, updated_at=excluded.updated_at", access.businessId, email, active, access.userId, new Date().toISOString()),
      sql("INSERT INTO aa_audit_events (id, consent_id, action, status, created_at, actor_user_id, actor_role) VALUES (?, ?, ?, ?, ?, ?, ?)", crypto.randomUUID(), access.consentId, active ? "reviewer.granted" : "reviewer.revoked", active ? "ACTIVE" : "REVOKED", new Date().toISOString(), access.userId, access.role)
    ]);
    return json({ email, active: Boolean(active) });
  } catch (error) { return json({ error: "access_denied", message: error.status ? error.message : "Access records are temporarily unavailable." }, error.status ?? 503); }
}
