import { query } from '../db/pool.js';

export async function writeAudit(userId, entity, entityId, action, before, after) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, entity, entity_id, action, before_json, after_json)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, entity, String(entityId), action, before ?? null, after ?? null]
    );
  } catch (e) {
    console.error('audit log failed', e.message);
  }
}
