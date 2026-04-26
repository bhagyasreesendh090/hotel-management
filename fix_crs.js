const fs = require('fs');
const raw = fs.readFileSync('backend/src/routes/crs.js', 'utf8');
const lines = raw.split('\n');

// Lines 1-31 are good (imports + start of resolveNightlyRate up to client.query for base_rate_rbi)
// Lines 32-75 are a corrupted duplicate block injected inside the function
// Lines 76+ are good again (meal plans routes, room types, etc.)

const goodStart = lines.slice(0, 31); // lines 1-31

// Complete resolveNightlyRate cleanly
const patch = [
'  const base = Number(rows[0]?.base_rate_rbi ?? 0);',
"  if (line.rate_type === 'CONTRACT' && corporateAccountId) {",
'    const cr = await client.query(',
'      `SELECT contract_rate FROM corporate_rate_lines',
'       WHERE corporate_account_id = $1 AND room_type_id = $2',
'       ORDER BY valid_from DESC NULLS LAST LIMIT 1`,',
'      [corporateAccountId, line.room_type_id]',
'    );',
'    if (cr.rows[0]) return Number(cr.rows[0].contract_rate);',
'  }',
'  return base;',
'}',
''
];

// From line 76 onward (0-indexed: 75), but skip blank/duplicate lines at the start
const rest = lines.slice(75);

const fixed = [...goodStart, ...patch, ...rest];
fs.writeFileSync('backend/src/routes/crs.js', fixed.join('\n'), 'utf8');
console.log('Done. Total lines:', fixed.length);
// Verify lines 28-50
fixed.slice(27, 50).forEach((l, i) => console.log(i+28, '|', l.substring(0, 80)));
