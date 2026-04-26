const fs = require('fs');
const raw = fs.readFileSync('backend/src/routes/crs.js', 'utf8');
const lines = raw.split('\n');

// Strip lines 44-144 (meal plans section, 0-indexed: 43-143)
// Fix lines 145-148 (room-types route broken entry, 0-indexed: 144-147)
// Good lines: 0-43 (imports through end of resolveNightlyRate)
// Skip: 44-144 (meal plans - moving to separate file)
// Fix room-types: insert the missing handler beginning at line 145

const goodStart = lines.slice(0, 44); // lines 1-44

// Fixed room-types route beginning
const roomTypesFix = [
'/** ---------- Room types ---------- */',
'router.get(\'/room-types\', qv(\'property_id\').isInt(), async (req, res) => {',
'  const errors = validationResult(req);',
'  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });',
'  const propertyId = Number(req.query.property_id);',
'  if (!assertPropertyAccess(req.user, propertyId)) {',
'    return res.status(403).json({ error: \'Property access denied\' });',
'  }',
];

// Rest starts after line 148 (0-indexed 147) which had the broken early return
const rest = lines.slice(148); // from line 149 onward

const fixed = [...goodStart, '', ...roomTypesFix, ...rest];
fs.writeFileSync('backend/src/routes/crs.js', fixed.join('\n'), 'utf8');
console.log('Done. Total lines:', fixed.length);
// Verify key areas
console.log('\n--- Lines 42-58 (end of resolveNightlyRate + room types start) ---');
fixed.slice(41, 58).forEach((l, i) => console.log(i+42, '|', l.substring(0, 90)));
