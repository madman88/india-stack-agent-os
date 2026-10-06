// Only references and status metadata are persisted. No financial payloads or keys.
export function createAaStore(db, actor = {}) {
  if (!db?.prepare) throw new Error("AA history storage is unavailable");
  const statement = (sql, ...values) => db.prepare(sql).bind(...values);
  return {
    async record(kind, consentId, value) {
      const id = `${kind}:${value.id}`;
      const now = new Date().toISOString();
      const previous = await statement("SELECT status FROM aa_rail_records WHERE id = ?", id).first();
      const operations = [statement("INSERT INTO aa_rail_records (id, kind, consent_id, status, observed_at, expires_at, data_from, data_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, observed_at=excluded.observed_at, expires_at=COALESCE(excluded.expires_at, aa_rail_records.expires_at), data_from=COALESCE(excluded.data_from, aa_rail_records.data_from), data_to=COALESCE(excluded.data_to, aa_rail_records.data_to)", id, kind, consentId, value.status, now, value.expiresAt ?? null, value.dataRange?.from ?? value.detail?.dataRange?.from ?? null, value.dataRange?.to ?? value.detail?.dataRange?.to ?? null)];
      if (previous?.status !== value.status) operations.push(statement("INSERT INTO aa_audit_events (id, consent_id, session_id, action, status, created_at, actor_user_id, actor_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", crypto.randomUUID(), consentId, kind === "session" ? value.id : null, `${kind}.observed`, value.status, now, actor.userId ?? null, actor.role ?? null));
      await db.batch(operations);
    },
    async audit(consentId, action, status, sessionId = null) {
      await statement("INSERT INTO aa_audit_events (id, consent_id, session_id, action, status, created_at, actor_user_id, actor_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", crypto.randomUUID(), consentId, sessionId, action, status, new Date().toISOString(), actor.userId ?? null, actor.role ?? null).run();
    },
    async history(consentId) {
      const [records, events] = await Promise.all([
        statement("SELECT * FROM aa_rail_records WHERE consent_id = ? ORDER BY observed_at DESC LIMIT 30", consentId).all(),
        statement("SELECT * FROM aa_audit_events WHERE consent_id = ? ORDER BY created_at DESC LIMIT 30", consentId).all()
      ]);
      return { records: records.results, auditLogs: events.results.map((r) => ({ rail: "AA", action: r.action, consentId: r.consent_id, sessionId: r.session_id, status: r.status, createdAt: r.created_at, actorRole: r.actor_role })) };
    },
    async fetchRequest(consentId) { return statement("SELECT * FROM aa_fetch_requests WHERE consent_id = ?", consentId).first(); },
    async acquire(consentId, requestId) {
      const result = await statement("INSERT INTO aa_fetch_requests (consent_id, request_id, state, created_at) VALUES (?, ?, 'INFLIGHT', ?) ON CONFLICT(consent_id) DO UPDATE SET request_id=excluded.request_id, state='INFLIGHT', session_id=NULL, created_at=excluded.created_at WHERE aa_fetch_requests.state='FAILED'", consentId, requestId, new Date().toISOString()).run();
      return result.meta.changes === 1;
    },
    async finish(consentId, requestId, state, sessionId = null) {
      await statement("UPDATE aa_fetch_requests SET state=?, session_id=? WHERE consent_id=? AND request_id=?", state, sessionId, consentId, requestId).run();
    },
    async allowRetry(consentId, sessionId) {
      await statement("UPDATE aa_fetch_requests SET state='FAILED' WHERE consent_id=? AND session_id=? AND state='SENT'", consentId, sessionId).run();
    }
  };
}
