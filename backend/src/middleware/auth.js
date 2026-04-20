import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/pool.js';
import { hasFullAppAccess, canAccessAllProperties } from '../constants/roles.js';

export async function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const u = await query(
      `SELECT id, email, full_name, role, active FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (!u.rows[0]?.active) {
      return res.status(401).json({ error: 'User inactive' });
    }
    req.user = u.rows[0];
    const props = await query(
      `SELECT property_id FROM user_property_access WHERE user_id = $1`,
      [req.user.id]
    );
    req.user.propertyIds = props.rows.map((r) => r.property_id);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (hasFullAppAccess(req.user.role) || roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
}

/** Super admin / sales manager / finance: all properties. Others: intersection with user_property_access. */
export function canAccessProperty(propertyId) {
  return (req, res, next) => {
    const pid = Number(propertyId ?? req.params.propertyId ?? req.body?.property_id);
    if (!pid) return next();
    const unrestricted = canAccessAllProperties(req.user.role);
    if (unrestricted) return next();
    if (!req.user.propertyIds?.length) {
      return res.status(403).json({ error: 'No property access configured' });
    }
    if (!req.user.propertyIds.includes(pid)) {
      return res.status(403).json({ error: 'Property access denied' });
    }
    next();
  };
}
