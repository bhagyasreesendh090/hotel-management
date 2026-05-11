import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function addDigitalSignature(doc, x, y, name, role) {
  const dateStr = new Date().toLocaleString();
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(x, y, 70, 30); // Signature box
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Digitally Signed By:', x + 5, y + 8);
  
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(name || 'Authorized Signatory', x + 5, y + 15);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(role || 'Hotel Representative', x + 5, y + 20);
  
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Date: ${dateStr}`, x + 5, y + 26);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
}

export async function generateQuotationPDF(quote, lead, property) {
  const doc = new jsPDF();
  const summary = quote.financial_summary || {};
  const items = summary.items || [];
  const policies = quote.policies || {};

  // Header
  doc.setFontSize(20);
  doc.text(property.name || 'Hotel Pramod', 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.text(property.address || '', 105, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('PROPOSAL / QUOTATION', 105, 35, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Quote #: ${quote.quotation_number}`, 15, 45);
  doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, 15, 50);
  doc.text(`Valid Until: ${new Date(quote.valid_until).toLocaleDateString()}`, 15, 55);

  // Client Info
  doc.setFontSize(12);
  doc.text('Client Details:', 15, 70);
  doc.setFontSize(10);
  doc.text(`${lead?.contact_name || 'Valued Guest'}`, 15, 75);
  if (lead?.company) doc.text(lead.company, 15, 80);
  if (lead?.contact_email) doc.text(lead.contact_email, 15, 85);

  // Table
  const tableRows = items.map(it => [
    it.description,
    `INR ${it.unit_price}`,
    it.quantity,
    `${it.tax_rate}%`,
    `INR ${(it.unit_price * it.quantity * (1 + it.tax_rate/100)).toFixed(2)}`
  ]);

  doc.autoTable({
    startY: 95,
    head: [['Description', 'Rate', 'Qty', 'Tax', 'Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
  });

  const finalY = doc.lastAutoTable.finalY || 150;

  // Summary
  doc.text(`Sub-Total: INR ${quote.total_amount}`, 140, finalY + 10);
  doc.text(`Tax: INR ${quote.tax_amount}`, 140, finalY + 15);
  if (quote.discount_amount > 0) doc.text(`Discount: INR ${quote.discount_amount}`, 140, finalY + 20);
  doc.setFontSize(12);
  doc.text(`Final Amount: INR ${quote.final_amount}`, 140, finalY + 28);

  // Terms
  doc.setFontSize(11);
  doc.text('Terms & Policies:', 15, finalY + 45);
  doc.setFontSize(9);
  const polArr = [
    policies.cancellation_policy ? `Cancellation: ${policies.cancellation_policy}` : null,
    policies.payment_terms ? `Payment: ${policies.payment_terms}` : null,
    policies.check_in_out_policy ? `Stay: ${policies.check_in_out_policy}` : null,
  ].filter(Boolean);
  
  doc.text(polArr, 15, finalY + 52, { maxWidth: 180 });

  // Digital Signature
  const sigY = Math.max(finalY + 80, 240);
  addDigitalSignature(doc, 125, sigY, quote.created_by_name, quote.created_by_role);

  return Buffer.from(doc.output('arraybuffer'));
}

export async function generateContractPDF(contract, lead, property) {
  const doc = new jsPDF();
  const policies = typeof contract.policies === 'string' ? JSON.parse(contract.policies) : (contract.policies || {});

  // Header
  doc.setFontSize(20);
  doc.text(property.name || 'Hotel Pramod', 105, 15, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('FORMAL AGREEMENT / CONTRACT', 105, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Contract #: ${contract.contract_number}`, 15, 40);
  doc.text(`Date: ${new Date(contract.created_at).toLocaleDateString()}`, 15, 45);

  // Body
  doc.setFontSize(12);
  doc.text('Between:', 15, 60);
  doc.setFontSize(10);
  doc.text(`${property.name} (Hotel)`, 20, 65);
  doc.text('AND', 20, 70);
  doc.text(`${lead?.contact_name || 'Client'} (${lead?.company || 'Organization'})`, 20, 75);

  doc.setFontSize(11);
  doc.text('Agreement Details:', 15, 90);
  doc.setFontSize(10);
  doc.text(`Total Contract Value: INR ${contract.total_value}`, 15, 97);
  doc.text(`Payment Deadline: ${contract.payment_deadline ? new Date(contract.payment_deadline).toLocaleDateString() : 'N/A'}`, 15, 102);

  doc.setFontSize(11);
  doc.text('Terms & Conditions:', 15, 115);
  doc.setFontSize(9);
  const terms = contract.terms || 'Standard hotel policies apply.';
  doc.text(terms, 15, 122, { maxWidth: 180 });

  // Signatures
  const bottomY = 240;
  addDigitalSignature(doc, 15, bottomY, contract.updated_by_name, 'Hotel Authorized Signatory');
  
  doc.setDrawColor(200, 200, 200);
  doc.line(130, bottomY + 25, 195, bottomY + 25);
  doc.setFontSize(9);
  doc.text('Client Signature / Stamp', 130, bottomY + 30);

  return Buffer.from(doc.output('arraybuffer'));
}
