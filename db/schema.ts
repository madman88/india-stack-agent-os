import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core";
export const aaRecords = sqliteTable("aa_rail_records", {
  id: text("id").primaryKey(), kind: text("kind").notNull(), consentId: text("consent_id").notNull(),
  status: text("status").notNull(), observedAt: text("observed_at").notNull(),
  expiresAt: text("expires_at"), dataFrom: text("data_from"), dataTo: text("data_to")
}, (t) => [index("idx_aa_records_consent").on(t.consentId, t.kind, t.observedAt)]);
export const aaAudit = sqliteTable("aa_audit_events", {
  id: text("id").primaryKey(), consentId: text("consent_id").notNull(), sessionId: text("session_id"),
  action: text("action").notNull(), status: text("status").notNull(), createdAt: text("created_at").notNull(),
  actorUserId: text("actor_user_id"), actorRole: text("actor_role")
}, (t) => [index("idx_aa_audit_consent_time").on(t.consentId, t.createdAt)]);
export const aaFetch = sqliteTable("aa_fetch_requests", {
  consentId: text("consent_id").primaryKey(), requestId: text("request_id").notNull(),
  state: text("state").notNull(), sessionId: text("session_id"), createdAt: text("created_at").notNull()
});
export const businesses = sqliteTable("business_access", {
  id: text("id").primaryKey(), ownerUserId: text("owner_user_id").notNull(), consentId: text("consent_id").notNull()
});
export const reviewers = sqliteTable("reviewer_access", {
  businessId: text("business_id").notNull(), email: text("email").notNull(), userId: text("user_id"),
  active: integer("active").notNull().default(1), grantedBy: text("granted_by").notNull(), updatedAt: text("updated_at").notNull()
}, (t) => [primaryKey({ columns: [t.businessId, t.email] }), index("idx_reviewer_business_user").on(t.businessId, t.userId)]);
