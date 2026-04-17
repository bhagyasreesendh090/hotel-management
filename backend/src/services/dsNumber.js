import { indianFinancialYearLabel } from './financial.js';

export async function nextDsNumber(client, propertyId, propertyCode) {
  const fy = indianFinancialYearLabel();
  const r = await client.query(
    `INSERT INTO ds_sequences (property_id, financial_year, last_number)
     VALUES ($1, $2, 1)
     ON CONFLICT (property_id, financial_year)
     DO UPDATE SET last_number = ds_sequences.last_number + 1
     RETURNING last_number`,
    [propertyId, fy]
  );
  const n = r.rows[0].last_number;
  const seq = String(n).padStart(5, '0');
  return `${propertyCode}-${fy}-${seq}`;
}
