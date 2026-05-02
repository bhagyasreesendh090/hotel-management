import React, { useState, useEffect } from 'react';
import { useRecentEmails } from '../../hooks/useRecentEmails';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Trash2, Link as LinkIcon, Mail, FileSignature, Edit2, X, Check, Plus } from 'lucide-react';

import { toast } from 'sonner';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

interface PolicyEntry {
  id: string;
  title: string;
  content: string;
  color: 'red' | 'amber' | 'green' | 'blue' | 'indigo' | 'slate';
}

const COLOR_OPTIONS = [
  { label: 'Critical (Red)', value: 'red' },
  { label: 'Warning (Amber)', value: 'amber' },
  { label: 'Positive (Green)', value: 'green' },
  { label: 'Info (Blue)', value: 'blue' },
  { label: 'Primary (Indigo)', value: 'indigo' },
  { label: 'Neutral (Slate)', value: 'slate' },
] as const;

const COLOR_MAP: Record<string, string> = {
  red: 'bg-red-50 text-red-700 border-red-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-100',
};

const DEFAULT_CONTRACT_TEMPLATE = `Contract ID: {{CONTRACT_ID}}						Date: {{DATE}}

To: {{CLIENT_NAME}}
{{ADDRESS}}
Cell: {{PHONE}}
Email: {{EMAIL}}

Sub: Accommodation and banquet event contract between {{CLIENT_NAME}} & [Hotel Name] for the [Event Name] of {{EVENT_NAME}} on {{EVENT_DATES}}

Dear {{CLIENT_NAME}},

Thank you for choosing [Hotel Name]. According to your requirements, we are happy to confirm the following rates and arrangements for "{{EVENT_NAME}}".

(i) Accommodations
(Room types, charges with inclusions/exclusions)	Annexure - A
(ii) Food & Beverage arrangements
(Banquet Venue, Food & Beverage details, flow of events, others)	Annexure - B
(iii) Schedule of payments, cancellation policy
(Reservation, Cancellation & Payment modalities)	Annexure - C
(iv) Most important terms and conditions	Annexure - D

Dates	Event Name	Minimum Guaranteed Event Revenue
{{EVENT_DATES}}	{{EVENT_NAME}}	Rs. {{AMOUNT}} + GST

If this contract accurately sets forth the understanding and agreement between us, please indicate your acceptance by signing and returning a copy of this contract and furnishing the initial deposit.

For [Company Name]	I understand and accept the contract.


[Manager Name]
[Manager Title]
[Hotel Name]
Contact No: [Phone]
Email: [Email]

{{CLIENT_NAME}}
{{ADDRESS}}
Cell: {{PHONE}}
Email: {{EMAIL}}

Annexure- A
ACCOMMODATION:

[Insert Accommodation Table Here]

A1.	GST as applicable shall be additional to above tariffs.
A2.	Room service, laundry, spa services, bar and travel services will be billed separately and must be settled on a direct payment basis by guests.
A3.	Any reduction in rooms is subject to the terms agreed.
A4.	Standard check-in time is 2 pm. 
A5.	Standard check-out time is 11 am.
A6.	Any requirement for rooms will be charged as per the above tariffs.
A7.	These tariffs are valid for the event dates only.
A8.	Please share your guest list for hassle-free check-in.

Inclusions:
●	Non-alcoholic welcome drink on arrival.
●	Accommodation as specified.
●	Buffet breakfast at our restaurant.
●	Complimentary wi-fi and pool usage.

Annexure- B
FOOD & BEVERAGE:

[Insert F&B Table Here]

B1.	GST as applicable shall be additional to above tariffs.
B2.	These tariffs are for the minimum guaranteed persons.
B3.	These tariffs are valid for the event dates only.

Inclusions:
●	Standard Menu selections.
●	Flow of events as per mutual agreement.

Annexure- C
SCHEDULE OF PAYMENTS:

[Insert Payment Schedule Here]

BANKING INFORMATION:

C1.	Standard payment terms apply. 100% of the minimum guaranteed revenue must be received before the event.
C2.	Payments must be cleared before guest arrival.
C3.	Hotel reserves the right to cancel if payment schedules are not met.

Annexure- D
MOST IMPORTANT TERMS AND CONDITIONS:

D1.	Cancellation policies as per standard hotel norms apply.
D2.	Proof of identity is mandatory for all guests.
D3.	All government regulations must be followed during the event.
D4.	Force Majeure clause applies to all bookings.`;

export default function ContractBuilderPage() {

  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const bookingId = searchParams.get('booking_id');
  const corporateId = searchParams.get('corporate_account_id');
  
  const { selectedPropertyId } = useProperty();

  const [status, setStatus] = useState('draft');
  const [terms, setTerms] = useState('');
  const [flow, setFlow] = useState('hotel_proposes');
  const [paymentDeadline, setPaymentDeadline] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [totalValue, setTotalValue] = useState(0);
  const [policies, setPolicies] = useState<{ policy_list: PolicyEntry[] }>({ policy_list: [] });
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PolicyEntry | null>(null);
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState<Omit<PolicyEntry, 'id'>>({
    title: '',
    content: '',
    color: 'slate',
  });


  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({ to_email: '', cc_email: '', subject: 'Formal Contract Details from Hotel Pramod', body: '' });
  const { recentEmails, addEmail } = useRecentEmails();

  const isEditing = Boolean(id);

  const explicitBookingId = searchParams.get('booking_id');
  const explicitBanquetBookingId = searchParams.get('banquet_booking_id');

  const { data: banquetBookings } = useQuery({
    queryKey: ['banquet_bookings_all', selectedPropertyId],
    queryFn: async () => {
      if (!selectedPropertyId) return { banquet_bookings: [] };
      const res = await apiClient.get(`/api/banquet/banquet-bookings`, { params: { property_id: selectedPropertyId } });
      return res.data;
    },
    enabled: !!selectedPropertyId,
  });

  const activeBanquet = explicitBanquetBookingId ? banquetBookings?.banquet_bookings?.find((b: any) => b.id === Number(explicitBanquetBookingId)) : null;
  const derivedBookingId = explicitBookingId || activeBanquet?.linked_booking_id?.toString() || null;

  const { data: crsBooking } = useQuery({
    queryKey: ['booking', derivedBookingId],
    queryFn: async () => {
      if (!derivedBookingId) return null;
      const res = await apiClient.get(`/api/crs/bookings/${derivedBookingId}`);
      return res.data;
    },
    enabled: !!derivedBookingId,
  });

  const handleAutofill = () => {
    const bData = crsBooking?.booking;
    const lines = crsBooking?.lines || [];
    
    const clientName = bData?.guest_name || bData?.booker_name || '[Client Name]';
    const address = bData?.address || '[Address]';
    const phone = bData?.guest_phone || bData?.booker_phone || '[Phone]';
    const email = bData?.guest_email || bData?.booker_email || '[Email]';
    let totalAmount = Number(bData?.total_amount || 0);
    
    const linkedBanquets = banquetBookings?.banquet_bookings?.filter((b: any) => 
      (derivedBookingId && b.linked_booking_id === Number(derivedBookingId)) || b.id === Number(explicitBanquetBookingId)
    ) || [];

    const eventName = linkedBanquets.length > 0 ? (linkedBanquets[0].event_sub_type || linkedBanquets[0].event_category || 'Event').toUpperCase() : 'Event';
    const eventDates = linkedBanquets.length > 0 ? linkedBanquets[0].event_date : (bData?.check_in || '[Dates]');

    let annexureA = '';
    if (lines.length > 0) {
      annexureA += 'Accommodation\tRooms\tTariff\tTotal\n';
      lines.forEach((line: any) => {
        annexureA += `${line.room_type_name}\t${line.quantity}\t${Number(line.rate).toLocaleString('en-IN')}\t${(Number(line.rate) * line.quantity).toLocaleString('en-IN')}\n`;
      });
    } else {
      annexureA = '[Insert Accommodation Details/Tables Here]';
    }

    let annexureB = '';
    if (linkedBanquets.length > 0) {
      annexureB += 'Food & Beverage\tVenue\tPax\tTariff\tTotal\tGST%\tGST\tAmount\n';
      linkedBanquets.forEach((b: any) => {
        let pricing = typeof b.pricing === 'string' ? JSON.parse(b.pricing) : (b.pricing || {});
        let gstSplit = typeof b.gst_split === 'string' ? JSON.parse(b.gst_split) : (b.gst_split || {});
        let gstPct = gstSplit.gst_pct || (b.with_room ? 18 : 5);
        
        let pax = Number(b.guaranteed_pax || 0);
        let rate = Number(pricing.per_plate_rate || 0);
        let total = pax * rate;
        let gst = total * (gstPct / 100);
        let amount = total + gst;
        
        totalAmount += amount; // sum up banquet charges
        
        annexureB += `${(b.menu_package || b.event_sub_type || 'Event').replace('_', ' ')}\t${b.venue_name}\t${pax}\t${rate.toLocaleString('en-IN')}\t${total.toLocaleString('en-IN')}\t${gstPct}%\t${gst.toLocaleString('en-IN')}\t${amount.toLocaleString('en-IN')}\n`;
        
        // Venue/Hall charges
        let hallCharges = Number(pricing.hall_charges || 0) + Number(pricing.venue_charges || 0);
        if (hallCharges > 0) {
          let hGst = hallCharges * 0.18;
          let hAmount = hallCharges + hGst;
          totalAmount += hAmount;
          annexureB += `Venue Charges\t${b.venue_name}\t-\t-\t${hallCharges.toLocaleString('en-IN')}\t18%\t${hGst.toLocaleString('en-IN')}\t${hAmount.toLocaleString('en-IN')}\n`;
        }
      });
    } else {
      annexureB = 'No Food & Beverage details for this event.';
    }

    let newTerms = DEFAULT_CONTRACT_TEMPLATE;
    newTerms = newTerms.replace(/\{\{CLIENT_NAME\}\}/g, clientName);
    newTerms = newTerms.replace(/\{\{ADDRESS\}\}/g, address);
    newTerms = newTerms.replace(/\{\{PHONE\}\}/g, phone);
    newTerms = newTerms.replace(/\{\{EMAIL\}\}/g, email);
    newTerms = newTerms.replace(/\{\{EVENT_NAME\}\}/g, eventName);
    newTerms = newTerms.replace(/\{\{EVENT_DATES\}\}/g, eventDates);
    newTerms = newTerms.replace(/\{\{AMOUNT\}\}/g, Number(totalAmount).toLocaleString('en-IN'));
    newTerms = newTerms.replace(/\{\{CONTRACT_ID\}\}/g, '[Auto Generated]');
    newTerms = newTerms.replace(/\{\{DATE\}\}/g, new Date().toLocaleDateString('en-GB'));
    
    // A quick hack to replace the static table blocks if present
    // Since the user might have modified it, we just prepend the dynamic tables if they aren't empty, 
    // or we can just let them edit. Given complexity, replacing the entire template is safer.
    
    const dynamicTemplate = `Contract ID: [Auto Generated]						Date: ${new Date().toLocaleDateString('en-GB')}

To: ${clientName}
${address}
Cell: ${phone}
Email: ${email}

Sub: Accommodation and banquet event contract between ${clientName} & [Hotel Name] for the ${eventName} on ${eventDates}

Dear ${clientName},

Thank you for choosing [Hotel Name]. According to your requirements, we are happy to confirm the following rates and arrangements for "${eventName}".

(i) Accommodations
(Room types, charges with inclusions/exclusions)	Annexure - A
(ii) Food & Beverage arrangements
(Banquet Venue, Food & Beverage details, flow of events, others)	Annexure - B
(iii) Schedule of payments, cancellation policy
(Reservation, Cancellation & Payment modalities)	Annexure - C
(iv) Most important terms and conditions	Annexure - D

Dates	Event Name	Minimum Guaranteed Event Revenue
${eventDates}	${eventName}	Rs. ${Number(totalAmount).toLocaleString('en-IN')} + GST

If this contract accurately sets forth the understanding and agreement between us, please indicate your acceptance by signing and returning a copy of this contract and furnishing the initial deposit.

For [Company Name]	I understand and accept the contract.


[Manager Name]
[Manager Title]
[Hotel Name]
Contact No: [Phone]
Email: [Email]

${clientName}
${address}
Cell: ${phone}
Email: ${email}

Annexure- A
ACCOMMODATION:

${annexureA}

A1.	GST as applicable shall be additional to above tariffs.
A2.	Room service, laundry, spa services, bar and travel services will be billed separately and must be settled on a direct payment basis by guests.
A3.	Any reduction in rooms is subject to the terms agreed.
A4.	Standard check-in time is 2 pm. 
A5.	Standard check-out time is 11 am.
A6.	Any requirement for rooms will be charged as per the above tariffs.
A7.	These tariffs are valid for event dates only. In case the dates of event change the tariff will also be revised accordingly.
A8.	Please share your guest list for hassle free check in.
Inclusions:
●	Non-alcoholic welcome drink on arrival.
●	Accommodation as specified.
●	Buffet breakfast at our restaurant.
●	Complimentary wi-fi and pool usage.

Annexure- B
FOOD & BEVERAGE:

${annexureB}

B1.	GST as applicable shall be additional to above tariffs.
B2.	These tariffs are for the minimum guaranteed persons.
B3.	These tariffs are valid for event dates only. In case the dates of event change the tariff will also be revised accordingly.
Inclusions:
●	Standard Menu selections.
●	Flow of events as per mutual agreement.
Flow of Events:

Date	Event details
[Insert Flow of Events here]

Annexure- C
SCHEDULE OF PAYMENTS:

Date	Description	Total	GST	Amount
[Insert Schedule of Payments here]

Minimum guaranteed revenue for event		Rs. ${Number(totalAmount).toLocaleString('en-IN')}

BANKING INFORMATION:

C1.	Standard payment terms apply. 100% of the minimum guaranteed revenue must be received before the event.
C2.	Payments must be cleared before guest arrival.
C3.	Hotel reserves the right to cancel if payment schedules are not met.

CANCELLATIONS/ AMENDMENTS/ RETENTION CHARGES:
C5.	Standard cancellation policy applies.

Annexure- D

MOST IMPORTANT TERMS AND CONDITIONS:

D1.	Cancellation policies as per standard hotel norms apply.
D2.	Proof of identity is mandatory for all guests.
D3.	All government regulations must be followed during the event.
D4.	Force Majeure clause applies to all bookings.`;

    setTerms(dynamicTemplate);
    if (totalAmount) {
      setTotalValue(totalAmount);
    }
    toast.success('Template populated with booking details!');
  };

  const { data: existingContract, isLoading: fetchingContract } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get(`/api/crm/contracts/${id}`);
      return res.data.contract;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingContract) {
      setTerms(existingContract.terms || '');
      setFlow(existingContract.flow || 'hotel_proposes');
      if (existingContract.payment_deadline) {
         setPaymentDeadline(existingContract.payment_deadline.split('T')[0]);
      }
      if (existingContract.expires_on) {
         setExpiresOn(existingContract.expires_on.split('T')[0]);
      }
      setTotalValue(Number(existingContract.total_value) || 0);
      setStatus(existingContract.status || 'draft');
      if (existingContract.policies) {
        setPolicies(existingContract.policies);
      }
    }
  }, [existingContract]);

  useEffect(() => {
    const b = crsBooking?.booking;
    if (b?.guest_email) {
      setEmailData(prev => ({ ...prev, to_email: b.guest_email }));
    }
  }, [crsBooking]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        const res = await apiClient.post(`/api/crm/contracts/${id}/revise`, { snapshot: payload });
        await apiClient.patch(`/api/crm/contracts/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/api/crm/contracts', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Contract updated' : 'Contract formally drafted');
      navigate('/crm/contracts');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to sync contract');
    }
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/crm/contracts/${id}/send-email`, emailData);
      return res.data;
    },
    onSuccess: () => {
      addEmail(emailData.cc_email);
      addEmail(emailData.to_email);
      toast.success('Digital Contract physically dispatched!');
      setIsEmailDialogOpen(false);
      navigate('/crm/contracts');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed connecting to dispatch engine')
  });

  const handleSave = (requestedStatus = 'draft') => {
    if (!selectedPropertyId) {
      toast.error('Property selection required');
      return;
    }

    // Validation for "Sent" status
    if (requestedStatus === 'sent') {
      if (totalValue <= 0) {
        toast.error('Please enter a total value for the contract before sending.');
        return;
      }
      if (terms.length < 20 && policies.policy_list.length === 0) {
        toast.error('Please provide legal terms or add policies before recording as sent.');
        return;
      }
    }


    const payload = {
      property_id: selectedPropertyId,
      booking_id: bookingId ? parseInt(bookingId) : (existingContract?.booking_id || null),
      lead_id: leadId ? parseInt(leadId) : (existingContract?.lead_id || null),
      corporate_account_id: corporateId ? parseInt(corporateId) : (existingContract?.corporate_account_id || null),
      flow,
      terms,
      policies,
      payment_deadline: paymentDeadline || null,
      expires_on: expiresOn || null,
      total_value: totalValue,
      status: requestedStatus,
    };
    saveMutation.mutate(payload);
  };

  if (isEditing && fetchingContract) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none">
              {isEditing ? `Edit Contract ${existingContract?.contract_number}` : 'Draft Legal Contract'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Bind leads and corporate accounts digitally.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(bookingId || searchParams.get('banquet_booking_id')) && (
            <Button variant="outline" size="sm" className="border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={handleAutofill}>
              Auto-fill from Booking
            </Button>
          )}
          {isEditing && existingContract?.secure_token && (
            <>
              <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 bg-indigo-50" onClick={() => window.open(`/public/contract/${existingContract.secure_token}`, '_blank')}>
                Preview Layout
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsEmailDialogOpen(true)}>
                <Mail className="w-4 h-4 mr-1 sm:mr-2" /> 
                <span className="hidden xs:inline">Dispatch Email</span>
                <span className="xs:hidden">Dispatch</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b rounded-t-xl">
              <CardTitle>Legal Stipulations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Text Block Document</Label>
                <Textarea 
                  rows={25}
                  value={terms} 
                  onChange={(e) => setTerms(e.target.value)} 
                  className="font-serif leading-relaxed"
                  placeholder="Insert clauses, refund instructions, and liabilities here..."
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b">

              <CardTitle>Detailed Policies & Clauses</CardTitle>
              <Button size="sm" onClick={() => setIsAddingPolicy(true)} className="bg-indigo-600 text-white">
                <Plus className="w-4 h-4 mr-1" /> Add Policy
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {policies.policy_list.map((policy) => (
                <div key={policy.id} className={`p-4 rounded-xl border-2 transition-all ${COLOR_MAP[policy.color] ?? 'bg-slate-50 text-slate-700 border-slate-100'}`}>
                  {editingPolicyId === policy.id && editDraft ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          className="flex-1 h-8 text-sm font-semibold"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                          placeholder="Policy title"
                        />
                        <Select
                          value={editDraft.color}
                          onValueChange={(v) => setEditDraft({ ...editDraft, color: v as PolicyEntry['color'] })}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {COLOR_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        rows={3}
                        className="text-sm"
                        value={editDraft.content}
                        onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })}
                        placeholder="Policy content..."
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500" onClick={() => { setEditingPolicyId(null); setEditDraft(null); }}>
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                        <Button size="sm" className="h-7 px-3 bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                          setPolicies((prev) => ({ ...prev, policy_list: prev.policy_list.map((p) => p.id === editDraft.id ? editDraft : p) }));
                          setEditingPolicyId(null); setEditDraft(null);
                        }}>
                          <Check className="w-3 h-3 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide opacity-70">{policy.title}</p>
                        <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">{policy.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                          onClick={() => { setEditingPolicyId(policy.id); setEditDraft({ ...policy }); }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(`Delete "${policy.title}"?`)) {
                              setPolicies((prev) => ({ ...prev, policy_list: prev.policy_list.filter((p) => p.id !== policy.id) }));
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {policies.policy_list.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6 italic border-2 border-dashed border-slate-100 rounded-xl">No specific policies added yet.</p>
              )}
            </CardContent>
          </Card>

          <Dialog open={isAddingPolicy} onOpenChange={setIsAddingPolicy}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Policy</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Policy Title</Label>
                  <Input
                    value={newPolicy.title}
                    onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                    placeholder="e.g. Cancellation Policy, Liquor Policy..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color / Category</Label>
                  <Select
                    value={newPolicy.color}
                    onValueChange={(v) => setNewPolicy({ ...newPolicy, color: v as PolicyEntry['color'] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Policy Content</Label>
                  <Textarea
                    rows={4}
                    value={newPolicy.content}
                    onChange={(e) => setNewPolicy({ ...newPolicy, content: e.target.value })}
                    placeholder="Write the policy text here..."
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setIsAddingPolicy(false)}>Cancel</Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => {
                      if (!newPolicy.title.trim() || !newPolicy.content.trim()) {
                        toast.error('Please fill in both title and content.');
                        return;
                      }
                      const entry: PolicyEntry = { ...newPolicy, id: `p${Date.now()}` };
                      setPolicies((prev) => ({ ...prev, policy_list: [...prev.policy_list, entry] }));
                      setIsAddingPolicy(false);
                      setNewPolicy({ title: '', content: '', color: 'slate' });
                      toast.success(`Policy "${entry.title}" added.`);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Policy
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>


        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-slate-900 text-white rounded-t-xl">
              <CardTitle className="text-lg flex justify-between items-center">
                Governance
                <Badge variant="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700">{status.toUpperCase()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              
              <div className="space-y-2">
                 <Label className="flex items-center gap-1 text-slate-700"><LinkIcon className="w-3 h-3"/> Parent Links Attached</Label>
                 <div className="text-sm font-mono bg-slate-50 border rounded p-2">
                    {leadId || existingContract?.lead_id ? `Lead ID: ${leadId || existingContract.lead_id}` : ''}
                    {bookingId || existingContract?.booking_id ? `Booking ID: ${bookingId || existingContract.booking_id}` : ''}
                    {corporateId || existingContract?.corporate_account_id ? `Corporate ID: ${corporateId || existingContract.corporate_account_id}` : ''}
                    {!leadId && !bookingId && !corporateId && !existingContract && 'No IDs Mapped'}
                 </div>
              </div>

              <div className="space-y-2">
                <Label>Required Overarching Value (₹)</Label>
                <Input type="number" min="0" value={totalValue} onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)} />
                <p className="text-xs text-slate-400">Can be independent or matching Quotation subtotal.</p>
              </div>

              <div className="space-y-2">
                <Label>Contract Expiration (Sign by)</Label>
                <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Payment Due Index</Label>
                <Input type="date" value={paymentDeadline} onChange={(e) => setPaymentDeadline(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Signature Mapping Flow</Label>
                <Select value={flow} onValueChange={setFlow}>
                   <SelectTrigger><SelectValue/></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="hotel_proposes">Standard (Hotel Initiates)</SelectItem>
                      <SelectItem value="client_submits">Client Initiates (B2B)</SelectItem>
                   </SelectContent>
                </Select>
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50 rounded-b-xl flex-col gap-2 p-4">
              <Button variant="outline" className="w-full bg-white" onClick={() => handleSave('draft')} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save to Drafts
              </Button>
              <Button className="w-full bg-slate-900 hover:bg-black text-white" onClick={() => handleSave('sent')} disabled={saveMutation.isPending}>
                <Send className="w-4 h-4 mr-2" /> Record as Sent Natively
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg">Legal Contract Dispatch</h2>
            </div>
            <Badge className="bg-amber-500 text-white border-none">FORMAL</Badge>
          </div>
          
          <div className="p-0 bg-white">
            <div className="border-b">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">To:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                  value={emailData.to_email} 
                  onChange={e => setEmailData(prev => ({...prev, to_email: e.target.value}))} 
                  placeholder="client@domain.com"
                />
              </div>
            </div>
            <div className="border-b">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">Cc:</span>
                <input 
                  list="cc-suggestions"
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                  value={emailData.cc_email} 
                  onChange={e => setEmailData(prev => ({...prev, cc_email: e.target.value}))} 
                  placeholder="legal@hotel.com"
                />
                <datalist id="cc-suggestions">
                  {recentEmails.map(email => (
                    <option key={email} value={email} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="border-b bg-slate-50/50">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">Subject:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold py-1"
                  value={emailData.subject} 
                  onChange={e => setEmailData(prev => ({...prev, subject: e.target.value}))} 
                />
              </div>
            </div>
            
            <div className="px-6 py-6 space-y-4">
              <Textarea 
                rows={8}
                value={emailData.body} 
                onChange={e => setEmailData(prev => ({...prev, body: e.target.value}))} 
                className="min-h-[200px] border-none focus-visible:ring-0 resize-none p-0 text-slate-700 leading-relaxed"
                placeholder="Enter formal covering message..." 
              />
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-4 text-white">
                 <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-700">
                    <FileSignature className="w-5 h-5 text-indigo-400" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">Contract_{existingContract?.contract_number || 'Draft'}.pdf</p>
                    <p className="text-xs text-slate-400 mt-0.5">Digital Signature Portal Token Attached</p>
                 </div>
                 <Badge variant="outline" className="border-slate-700 text-slate-300">SECURE</Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)} className="text-slate-500">
              Cancel
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8" 
              onClick={() => emailMutation.mutate()} 
              disabled={emailMutation.isPending || !emailData.to_email}
            >
              {emailMutation.isPending ? 'Connecting...' : 'Dispatch Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
