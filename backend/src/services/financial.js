/** Room GST per SRS: ≤ ₹7,500/night → 5%; above → 18%. Banquet F&B default 5%. */

export function roomGstPercent(nightlyRateBeforeTax, overridePct = null) {
  if (overridePct != null && overridePct !== '') return Number(overridePct);
  const r = Number(nightlyRateBeforeTax);
  if (Number.isNaN(r)) return 18;
  return r <= 7500 ? 5 : 18;
}

export function splitCgstSgst(gstPercent) {
  const half = Number(gstPercent) / 2;
  return { cgstPct: half, sgstPct: half };
}

export function calcLineAmounts({ nightlyRate, nights, pax, gstPct }) {
  const sub = Number(nightlyRate) * Number(nights) * Number(pax);
  const gst = (sub * Number(gstPct)) / 100;
  return {
    line_sub_total: round2(sub),
    line_gst: round2(gst),
    line_total: round2(sub + gst),
  };
}

export function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  const ms = b - a;
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function indianFinancialYearLabel(d = new Date()) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  if (m >= 4) return `${y}-${String(y + 1).slice(-2)}`;
  return `${y - 1}-${String(y).slice(-2)}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function banquetFbGstPercent(withRoomComponent) {
  return withRoomComponent ? 18 : 5;
}
