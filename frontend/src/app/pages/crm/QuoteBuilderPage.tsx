import React, { useState, useMemo, useEffect } from 'react';
import { useRecentEmails } from '../../hooks/useRecentEmails';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Plus, Trash2, Tag, Mail, FileText, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';

type LineItem = {
  id: string;
  description: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
};

type PolicyEntry = {
  id: string;
  title: string;
  content: string;
  color: 'red' | 'amber' | 'green' | 'blue' | 'slate' | 'indigo';
};

const COLOR_OPTIONS = [
  { value: 'red',    label: '🔴 Red (Cancellation)' },
  { value: 'amber',  label: '🟡 Amber (Liquor/Alcohol)' },
  { value: 'green',  label: '🟢 Green (Payment)' },
  { value: 'blue',   label: '🔵 Blue (Check-in/out)' },
  { value: 'indigo', label: '🟣 Indigo (Special)' },
  { value: 'slate',  label: '⚫ Slate (General)' },
] as const;

const COLOR_MAP: Record<string, string> = {
  red:    'border-red-400 text-red-700',
  amber:  'border-amber-400 text-amber-700',
  green:  'border-green-500 text-green-700',
  blue:   'border-blue-400 text-blue-700',
  indigo: 'border-indigo-400 text-indigo-700',
  slate:  'border-slate-400 text-slate-700',
};

const DEFAULT_POLICIES: PolicyEntry[] = [
  { id: 'p1', title: 'Cancellation Policy',   color: 'red',   content: '100% of total amount will be charged for cancellations made within 48 hours of check-in. 50% will be charged for cancellations within 7 days.' },
  { id: 'p2', title: 'Liquor & Alcohol Policy', color: 'amber', content: 'Liquor is served strictly as per local government regulations and applicable excise laws. Outside liquor is not permitted on hotel premises.' },
  { id: 'p3', title: 'Payment Terms',          color: 'green', content: 'Minimum 50% advance is required to confirm the booking. Balance to be cleared prior to check-in. All payments via Bank Transfer / UPI / Card.' },
  { id: 'p4', title: 'Check-in / Check-out',   color: 'blue',  content: 'Check-in time is 14:00 Hrs. Check-out time is 11:00 Hrs. Early check-in / late check-out is subject to availability and may incur additional charges.' },
  { id: 'p5', title: 'General Notes',          color: 'slate', content: 'A valid photo ID is mandatory for all guests at check-in. The hotel reserves the right to refuse service to anyone violating property policies.' },
];


export default function QuoteBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const roomBookingId = searchParams.get('room_booking_id');
  const banquetBookingId = searchParams.get('banquet_booking_id');
  const { selectedPropertyId } = useProperty();

  const docType = 'Quotation';
  const [status, setStatus] = useState('draft');
  const [clientSalutation, setClientSalutation] = useState("Dear Sir / Ma'am");
  const [validityDays, setValidityDays] = useState(7);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', unit_price: 0, quantity: 1, tax_rate: 18 }
  ]);

  const [policies, setPolicies] = useState<{
    event_details: Record<string, string>;
    policy_list: PolicyEntry[];
  }>({
    event_details: {
      arrival_date: '',
      departure_date: '',
      total_rooms: '',
      extra_beds: '',
      occupants: '',
      package_type: 'CP (Bed & Breakfast)'
    },
    policy_list: DEFAULT_POLICIES
  });

  // Policy CRUD state
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PolicyEntry | null>(null);
  const [isAddingPolicy, setIsAddingPolicy] = useState(false);
  const [newPolicy, setNewPolicy] = useState<Omit<PolicyEntry, 'id'>>({
    title: '',
    content: '',
    color: 'slate'
  });


  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({ to_email: '', cc_email: '', subject: 'Your Quotation from Hotel Pramod', body: '' });
  const { recentEmails, addEmail } = useRecentEmails();
  const [prefillDone, setPrefillDone] = useState(false);

  const isEditing = Boolean(id);

  const { data: existingQuote, isLoading: fetchingQuote } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get(`/api/crm/quotations/${id}`);
      return res.data.quotation;
    },
    enabled: isEditing,
  });

  // ── Fetch linked room booking for pre-fill ────────────────────
  const { data: roomBooking } = useQuery({
    queryKey: ['roomBooking_prefill', roomBookingId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/crs/bookings/${roomBookingId}`);
      return res.data.booking ?? res.data;
    },
    enabled: !!roomBookingId && !isEditing,
  });

  // ── Fetch linked banquet booking for pre-fill ─────────────────
  const { data: banquetBooking } = useQuery({
    queryKey: ['banquetBooking_prefill', banquetBookingId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/banquet/banquet-bookings/${banquetBookingId}`);
      return res.data.booking ?? res.data;
    },
    enabled: !!banquetBookingId && !isEditing,
  });

  // ── Pre-fill from room booking ─────────────────────────────────
  useEffect(() => {
    if (prefillDone || isEditing || !roomBooking) return;
    const b = roomBooking;
    const nights = b.check_in && b.check_out
      ? Math.max(1, Math.round((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
      : 1;
    const rate = Number(b.total_amount ?? 0) / nights || 0;
    setClientSalutation(`Dear ${b.guest_name ?? 'Valued Guest'}`);
    setItems([
      { id: '1', description: `${b.room_types ?? 'Room'} – ${b.meal_plan ?? 'EP'} (${nights} Night${nights > 1 ? 's' : ''})`, unit_price: Math.round(rate), quantity: nights, tax_rate: 12 },
    ]);
    setPolicies((p) => ({
      ...p,
      event_details: {
        ...p.event_details,
        arrival_date: b.check_in ? new Date(b.check_in).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        departure_date: b.check_out ? new Date(b.check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        total_rooms: '1',
        occupants: `${b.total_adults ?? 1} Adult(s), ${b.total_children ?? 0} Child(ren)`,
        package_type: b.meal_plan ?? 'EP',
      },
    }));
    if (b.guest_email) setEmailData((prev) => ({ ...prev, to_email: b.guest_email }));
    setPrefillDone(true);
  }, [roomBooking, isEditing, prefillDone]);


  // ── Pre-fill from banquet booking ──────────────────────────────
  useEffect(() => {
    if (prefillDone || isEditing || !banquetBooking) return;
    const b = banquetBooking;
    const pax = Number(b.guaranteed_pax ?? 50);
    const perPlate = Number(b.per_plate_rate ?? 0);
    setClientSalutation(`Dear Valued Guest`);
    setItems([
      { id: '1', description: `${b.venue_name ?? 'Banquet Hall'} – ${b.slot_label ?? 'Full Day'} (${b.event_category ?? 'Event'})`, unit_price: perPlate || Math.round(Number(b.gross_amount ?? 0) / pax), quantity: pax, tax_rate: 18 },
      { id: '2', description: `Menu Package – ${b.menu_package ?? 'Standard'}`, unit_price: 0, quantity: 1, tax_rate: 0 },
    ]);
    setPolicies((p) => ({
      ...p,
      event_details: {
        ...p.event_details,
        arrival_date: b.event_date ? new Date(b.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        occupants: `${pax} PAX`,
        package_type: b.menu_package ?? 'Standard',
      },
    }));
    setPrefillDone(true);
  }, [banquetBooking, isEditing, prefillDone]);


  useEffect(() => {
    if (existingQuote) {
      setClientSalutation(existingQuote.client_salutation || '');
      setValidityDays(existingQuote.validity_days || 7);
      setDiscountAmount(Number(existingQuote.discount_amount) || 0);
      setStatus(existingQuote.status || 'draft');
      if (existingQuote.financial_summary?.items) {
        setItems(existingQuote.financial_summary.items);
      }
      if (existingQuote.policies) {

        const p = existingQuote.policies;
        // Migrate old format to new dynamic format
        const migratedList: PolicyEntry[] = p.policy_list ?? [
          p.cancellation_policy && { id: 'p1', title: 'Cancellation Policy', color: 'red', content: p.cancellation_policy },
          p.liquor_policy      && { id: 'p2', title: 'Liquor & Alcohol Policy', color: 'amber', content: p.liquor_policy },
          p.payment_terms      && { id: 'p3', title: 'Payment Terms', color: 'green', content: p.payment_terms },
          p.check_in_out_policy && { id: 'p4', title: 'Check-in / Check-out', color: 'blue', content: p.check_in_out_policy },
          p.general_notes      && { id: 'p5', title: 'General Notes', color: 'slate', content: p.general_notes },
          p.terms              && { id: 'p6', title: 'General Terms', color: 'slate', content: p.terms },
        ].filter(Boolean) as PolicyEntry[];
        setPolicies({
          event_details: p.event_details ?? {},
          policy_list: migratedList.length > 0 ? migratedList : DEFAULT_POLICIES,
        });
      }
    }
  }, [existingQuote]);


  const { subTotal, taxTotal, finalTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    items.forEach(it => {
      const lineSub = (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);
      const lineTax = lineSub * ((Number(it.tax_rate) || 0) / 100);
      sub += lineSub;
      tax += lineTax;
    });
    const final = Math.max(0, sub + tax - discountAmount);
    return { subTotal: sub, taxTotal: tax, finalTotal: final };
  }, [items, discountAmount]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        const res = await apiClient.post(`/api/crm/quotations/${id}/revise`, { snapshot: payload });
        await apiClient.patch(`/api/crm/quotations/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/api/crm/quotations', payload);
        return res.data;
      }
    },
    onSuccess: (data) => {
      if (isEditing) {
        toast.success('Quote updated successfully');
        // stay on edit page so Email Quote button remains accessible
      } else {
        const newId = data?.quotation?.id;
        toast.success('Quote created! You can now email it to the customer.');
        if (newId) {
          // Navigate to edit page of the new quote so "Email Quote" button appears
          const params = new URLSearchParams();
          if (leadId) params.set('lead_id', leadId);
          if (roomBookingId) params.set('room_booking_id', roomBookingId);
          if (banquetBookingId) params.set('banquet_booking_id', banquetBookingId);
          navigate(`/crm/quotes/${newId}/edit?${params.toString()}`);
        } else {
          navigate(leadId ? `/crm/leads/${leadId}` : '/crm/quotations');
        }
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save quote');
    }
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/crm/quotations/${id}/send-email`, emailData);
      return res.data;
    },
    onSuccess: () => {
      addEmail(emailData.cc_email);
      addEmail(emailData.to_email);
      toast.success('Quotation safely dispatched to customer!');
      setIsEmailDialogOpen(false);
      navigate(leadId ? `/crm/leads/${leadId}` : '/crm/leads');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Email dispatch failed')
  });

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', unit_price: 0, quantity: 1, tax_rate: 18 }]);
  };

  const updateItem = (index: number, changes: Partial<LineItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...changes };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSave = async (requestedStatus = 'draft') => {
    if (!selectedPropertyId) {
      toast.error('Please select a property from the top bar');
      return;
    }
    const payload = {
      property_id: selectedPropertyId,
      lead_id: leadId ? parseInt(leadId) : (existingQuote?.lead_id || null),
      room_booking_id: roomBookingId ? parseInt(roomBookingId) : undefined,
      banquet_booking_id: banquetBookingId ? parseInt(banquetBookingId) : undefined,
      client_salutation: clientSalutation,
      validity_days: validityDays,
      status: requestedStatus,
      total_amount: subTotal,
      tax_amount: taxTotal,
      discount_amount: discountAmount,
      final_amount: finalTotal,
      financial_summary: { 
        items,
        doc_type: docType
      },
      policies
    };
    saveMutation.mutate(payload);
  };

  if (isEditing && fetchingQuote) {
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none">
                {isEditing ? `Edit Quotation ${existingQuote?.quotation_number}` : `Create New Quotation`}
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-1">Configure line items and generate shareable links.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing && existingQuote?.secure_token && (
            <>
              <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 bg-indigo-50" onClick={() => window.open(`/public/quote/${existingQuote.secure_token}`, '_blank')}>
                View Live Link
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsEmailDialogOpen(true)}>
                <Mail className="w-4 h-4 mr-1 sm:mr-2" /> 
                <span className="hidden xs:inline">Email {docType}</span>
                <span className="xs:hidden">Email</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => (
                <div key={item.id} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label>Description</Label>
                      <Input placeholder="e.g. Deluxe Room (2 Nights)" value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                    </div>
                    <Button variant="ghost" size="icon" className="mt-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label>Unit Price (₹)</Label>
                      <Input type="number" min="0" value={item.unit_price} onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label>Qty</Label>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label>Tax (%)</Label>
                      <Select value={String(item.tax_rate)} onValueChange={(v) => updateItem(idx, { tax_rate: parseFloat(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event & Accommodation Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Arrival Date & Time</Label>
                  <Input 
                    placeholder="e.g. 25th Jan 2027 @14:00 hrs" 
                    value={policies.event_details?.arrival_date || ''} 
                    onChange={(e) => setPolicies({ ...policies, event_details: { ...policies.event_details, arrival_date: e.target.value } })} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Departure Date & Time</Label>
                  <Input 
                    placeholder="e.g. 27th Jan 2027 @11:00 hrs" 
                    value={policies.event_details?.departure_date || ''} 
                    onChange={(e) => setPolicies({ ...policies, event_details: { ...policies.event_details, departure_date: e.target.value } })} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                 <div className="space-y-2">
                   <Label>Total Rooms</Label>
                   <Input value={policies.event_details?.total_rooms || ''} onChange={(e) => setPolicies({ ...policies, event_details: { ...policies.event_details, total_rooms: e.target.value } })} />
                 </div>
                 <div className="space-y-2">
                   <Label>Extra Beds</Label>
                   <Input value={policies.event_details?.extra_beds || ''} onChange={(e) => setPolicies({ ...policies, event_details: { ...policies.event_details, extra_beds: e.target.value } })} />
                 </div>
                 <div className="space-y-2">
                   <Label>Total Occupants</Label>
                   <Input value={policies.event_details?.occupants || ''} onChange={(e) => setPolicies({ ...policies, event_details: { ...policies.event_details, occupants: e.target.value } })} />
                 </div>
                 <div className="space-y-2">
                   <Label>Package Type</Label>
                   <Input value={policies.event_details?.package_type || ''} onChange={(e) => setPolicies({ ...policies, event_details: { ...policies.event_details, package_type: e.target.value } })} />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Client Salutation</Label>
                  <Input value={clientSalutation} onChange={(e) => setClientSalutation(e.target.value)} placeholder="Dear Mr. Smith," />
                </div>
                <div className="space-y-2">
                  <Label>Validity Limit (Days)</Label>
                  <Input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dynamic Policies Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> Hotel Policies
              </CardTitle>
              <Button
                type="button" size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => { setIsAddingPolicy(true); setNewPolicy({ title: '', content: '', color: 'slate' }); }}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Policy
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {policies.policy_list.map((policy) => (
                <div
                  key={policy.id}
                  className={`border-l-4 pl-4 pr-3 py-3 rounded-r-xl bg-slate-50 ${COLOR_MAP[policy.color] ?? COLOR_MAP['slate']}`}
                >
                  {editingPolicyId === policy.id && editDraft ? (
                    /* ── EDIT MODE ── */
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
                    /* ── VIEW MODE ── */
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold uppercase tracking-wide ${COLOR_MAP[policy.color]?.split(' ')[1] ?? 'text-slate-700'}`}>{policy.title}</p>
                        <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{policy.content}</p>
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
                <p className="text-sm text-slate-400 text-center py-6 italic">No policies added yet. Click "Add Policy" to create one.</p>
              )}
            </CardContent>
          </Card>

          {/* Add Policy Dialog */}
          <Dialog open={isAddingPolicy} onOpenChange={setIsAddingPolicy}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Policy</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Policy Title</Label>
                  <Input
                    value={newPolicy.title}
                    onChange={(e) => setNewPolicy({ ...newPolicy, title: e.target.value })}
                    placeholder="e.g. Noise Policy, Pet Policy..."
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
                Financial Summary
                <Badge variant="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700">{status.toUpperCase()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">₹{subTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Estimated Tax</span>
                <span className="font-medium">₹{taxTotal.toLocaleString('en-IN')}</span>
              </div>
              
              <div className="pt-4 border-t space-y-2">
                <Label className="flex items-center gap-2 text-indigo-700"><Tag className="w-3 h-3"/> Apply Discount Override (₹)</Label>
                <Input 
                  type="number" 
                  min="0"
                  className="font-mono"
                  value={discountAmount} 
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} 
                />
                {discountAmount > 5000 && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Discounts over ₹5000 will be flagged for Manager Approval before sending.</p>
                )}
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <span className="font-bold text-slate-900">Grand Total</span>
                <span className="text-2xl font-bold text-indigo-600">₹{finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 rounded-b-xl flex-col gap-2 p-4">
              <Button 
                variant="outline" 
                className="w-full bg-white" 
                onClick={() => handleSave('draft')}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" /> Save as Draft
              </Button>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
                onClick={() => handleSave('sent')}
                disabled={saveMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" /> Mark as Sent
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg">Compose Message</h2>
            </div>
            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">DRAFT</Badge>
          </div>

          {/* Scrollable body */}
          <div className="bg-white divide-y divide-slate-100 overflow-y-auto flex-1">
            <div className="flex items-center px-6 py-3 gap-4">
              <Label className="text-sm font-medium text-slate-500 w-16 shrink-0">To:</Label>
              <Input
                type="email"
                className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm px-0 h-8"
                value={emailData.to_email}
                onChange={e => setEmailData(prev => ({...prev, to_email: e.target.value}))}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="flex items-center px-6 py-3 gap-4">
              <Label className="text-sm font-medium text-slate-500 w-16 shrink-0">Cc:</Label>
              <Input
                type="email"
                list="cc-suggestions"
                className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm px-0 h-8"
                value={emailData.cc_email}
                onChange={e => setEmailData(prev => ({...prev, cc_email: e.target.value}))}
                placeholder="manager@example.com"
              />
              <datalist id="cc-suggestions">
                {recentEmails.map(email => (
                  <option key={email} value={email} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center px-6 py-3 gap-4 bg-slate-50/50">
              <Label className="text-sm font-medium text-slate-500 w-16 shrink-0">Subject:</Label>
              <Input
                className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm font-semibold px-0 h-8"
                value={emailData.subject}
                onChange={e => setEmailData(prev => ({...prev, subject: e.target.value}))}
              />
            </div>
            <div className="px-6 py-5 space-y-4">
              <Textarea
                rows={6}
                value={emailData.body}
                onChange={e => setEmailData(prev => ({...prev, body: e.target.value}))}
                className="border-none focus-visible:ring-0 resize-none p-0 text-slate-700 leading-relaxed w-full"
                placeholder="Write your message here..."
              />
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-white rounded-lg border border-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">Quotation_{existingQuote?.quotation_number || 'Draft'}.pdf</p>
                  <p className="text-xs text-slate-500 mt-0.5">Secure Customer Portal Link Attached</p>
                </div>
                <Badge className="bg-indigo-600 text-white border-none">PORTAL ACCESS</Badge>
              </div>
            </div>
          </div>

          {/* Footer — always visible */}
          <div className="bg-slate-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)} className="text-slate-500 hover:text-slate-700">
              Discard
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 px-8 gap-2"
              onClick={() => emailMutation.mutate()}
              disabled={emailMutation.isPending || !emailData.to_email}
            >
              {emailMutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Quotation</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
