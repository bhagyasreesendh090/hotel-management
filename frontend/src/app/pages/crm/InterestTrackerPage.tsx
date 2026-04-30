import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ThumbsUp, ThumbsDown, Phone, Clock, CheckCircle2,
  BedDouble, CalendarDays, Search, Filter, RefreshCw,
  MessageSquare, TrendingUp, XCircle, Sparkles, PlusCircle,
} from 'lucide-react';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { toast } from 'sonner';

/* ─── Types ───────────────────────────────────────── */
interface Lead {
  id: number;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  status: string;
  pipeline_stage: string;
  lead_source: string | null;
  segment: string;
  notes: string | null;
  created_at: string;
}

interface Booking {
  id: number;
  lead_id: number | null;
  guest_name: string | null;
  status: string;
  check_in: string | null;
  check_out: string | null;
  room_types: string | null;
  total_amount: number;
  ds_number: string | null;
}

interface BanquetBooking {
  id: number;
  lead_id: number | null;
  status: string;
  event_date: string | null;
  event_category: string | null;
  venue_name: string | null;
  slot_label: string | null;
}

/* ─── Interest config ─────────────────────────────── */
const INTEREST_OPTIONS = [
  { value: 'new',           label: 'New',           color: 'bg-slate-100 text-slate-700',    icon: <Sparkles className="w-3.5 h-3.5" /> },
  { value: 'interested',    label: 'Interested',    color: 'bg-green-100 text-green-800',    icon: <ThumbsUp className="w-3.5 h-3.5" /> },
  { value: 'not_interested',label: 'Not Interested',color: 'bg-red-100 text-red-800',        icon: <ThumbsDown className="w-3.5 h-3.5" /> },
  { value: 'follow_up',     label: 'Follow Up',     color: 'bg-amber-100 text-amber-800',    icon: <Phone className="w-3.5 h-3.5" /> },
  { value: 'in_progress',   label: 'In Progress',   color: 'bg-blue-100 text-blue-800',      icon: <Clock className="w-3.5 h-3.5" /> },
  { value: 'negotiating',   label: 'Negotiating',   color: 'bg-purple-100 text-purple-800',  icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { value: 'won',           label: 'Won / Converted', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { value: 'lost',          label: 'Lost',          color: 'bg-gray-100 text-gray-600',      icon: <XCircle className="w-3.5 h-3.5" /> },
];

const BOOKING_STATUS_COLOR: Record<string, string> = {
  INQ: 'bg-slate-100 text-slate-600',
  'QTN-HOLD': 'bg-amber-100 text-amber-800',
  TENT: 'bg-yellow-100 text-yellow-800',
  'CONF-U': 'bg-blue-100 text-blue-800',
  'CONF-P': 'bg-indigo-100 text-indigo-800',
  SOLD: 'bg-green-100 text-green-800',
  CI: 'bg-teal-100 text-teal-800',
  CO: 'bg-gray-100 text-gray-600',
  CXL: 'bg-red-100 text-red-800',
};

function interestOption(status: string) {
  return INTEREST_OPTIONS.find((o) => o.value === status) ?? INTEREST_OPTIONS[0];
}

/* ─── Row card ────────────────────────────────────── */
function LeadRow({
  lead,
  bookings,
  banquets,
  onUpdateStatus,
  onOpenNote,
  onBookRoom,
  updatingId,
}: {
  lead: Lead;
  bookings: Booking[];
  banquets: BanquetBooking[];
  onUpdateStatus: (id: number, status: string) => void;
  onOpenNote: (lead: Lead) => void;
  onBookRoom: (lead: Lead) => void;
  updatingId: number | null;
}) {
  const opt = interestOption(lead.status);
  const isUpdating = updatingId === lead.id;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-4 sm:p-5 space-y-4">
      {/* Top row: name + interest badge */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-slate-900 truncate">{lead.contact_name}</h3>
            {lead.company && <span className="text-xs text-slate-500 font-medium">{lead.company}</span>}
          </div>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-500">
            {lead.contact_phone && <span>📞 {lead.contact_phone}</span>}
            {lead.contact_email && <span>✉ {lead.contact_email}</span>}
            <span className="capitalize">Source: {lead.lead_source ?? 'direct'}</span>
            <span>Segment: {lead.segment}</span>
            <span>{format(new Date(lead.created_at), 'dd MMM yyyy')}</span>
          </div>
        </div>
        {/* Current interest badge */}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${opt.color}`}>
          {opt.icon}{opt.label}
        </span>
      </div>

      {/* Linked room bookings */}
      {bookings.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5" /> Room Bookings
          </p>
          <div className="flex flex-wrap gap-2">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-mono font-semibold text-indigo-700">{b.ds_number ?? `#${b.id}`}</span>
                <span className="text-slate-500">{b.room_types}</span>
                {b.check_in && <span className="text-slate-400">{format(new Date(b.check_in), 'dd MMM')} → {b.check_out ? format(new Date(b.check_out), 'dd MMM') : '?'}</span>}
                <span className={`rounded-full px-2 py-0.5 font-bold uppercase ${BOOKING_STATUS_COLOR[b.status] ?? 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Linked banquet bookings */}
      {banquets.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> Banquet Bookings
          </p>
          <div className="flex flex-wrap gap-2">
            {banquets.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                <span className="font-mono font-semibold text-teal-700">#{b.id}</span>
                <span className="capitalize text-slate-600">{b.event_category} — {b.venue_name}</span>
                {b.event_date && <span className="text-slate-400">{format(new Date(b.event_date), 'dd MMM yyyy')}</span>}
                <span className={`rounded-full px-2 py-0.5 font-bold uppercase ${BOOKING_STATUS_COLOR[b.status] ?? 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No bookings yet */}
      {bookings.length === 0 && banquets.length === 0 && (
        <p className="text-xs text-slate-400 italic">No room or banquet bookings linked yet.</p>
      )}

      {/* Notes preview */}
      {lead.notes && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border line-clamp-2">
          💬 {lead.notes}
        </p>
      )}

      {/* Quick action buttons */}
      <div className="border-t border-slate-100 pt-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400 font-medium mr-1">Mark as:</span>
        {INTEREST_OPTIONS.filter((o) => o.value !== lead.status).map((o) => (
          <button
            key={o.value}
            onClick={() => onUpdateStatus(lead.id, o.value)}
            disabled={isUpdating}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition-all
              hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
              ${o.color} border-current/20`}
          >
            {o.icon}{o.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => onOpenNote(lead)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Add Note
          </button>
          <button
            onClick={() => onBookRoom(lead)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Book Room
          </button>
        </div>
      </div>
    </div>
  );
}

const emptyBooking = {
  room_type_id: '',
  meal_plan: '',
  check_in_date: '',
  check_out_date: '',
  num_adults: '1',
  num_children: '0',
};

/* ─── Main page ───────────────────────────────────── */
export default function InterestTrackerPage() {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'room' | 'banquet' | 'no_booking'>('all');
  const [noteDialog, setNoteDialog] = useState<Lead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [bookLead, setBookLead] = useState<Lead | null>(null);
  const [bookingForm, setBookingForm] = useState(emptyBooking);

  /* data */
  const { data: leads = [], isLoading: loadingLeads } = useQuery<Lead[]>({
    queryKey: ['interest_leads'],
    queryFn: async () => {
      const r = await apiClient.get('/api/crm/leads');
      return r.data.leads ?? [];
    },
  });

  const { data: bookings = [], isLoading: loadingBookings } = useQuery<Booking[]>({
    queryKey: ['interest_bookings', selectedPropertyId],
    queryFn: async () => {
      const r = await apiClient.get('/api/crs/bookings', {
        params: selectedPropertyId ? { property_id: selectedPropertyId } : {},
      });
      return r.data.bookings ?? [];
    },
  });

  const { data: banquets = [], isLoading: loadingBanquets } = useQuery<BanquetBooking[]>({
    queryKey: ['interest_banquets', selectedPropertyId],
    queryFn: async () => {
      const r = await apiClient.get('/api/banquet/banquet-bookings', {
        params: selectedPropertyId ? { property_id: selectedPropertyId } : {},
      });
      return r.data.banquet_bookings ?? [];
    },
  });

  /* room types & meal plans for booking dialog */
  const { data: roomTypes = [] } = useQuery<{ id: number; category: string; base_rate_rbi: number }[]>({
    queryKey: ['roomTypes', selectedPropertyId],
    queryFn: async () => {
      const r = await apiClient.get('/api/crs/room-types', { params: { property_id: selectedPropertyId } });
      return r.data.room_types ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: mealPlans = [] } = useQuery<{ code: string; name: string }[]>({
    queryKey: ['mealPlans', selectedPropertyId],
    queryFn: async () => {
      const r = await apiClient.get('/api/meal-plans', { params: { property_id: selectedPropertyId } });
      return r.data.meal_plans ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  /* mutations */
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiClient.patch(`/api/crm/leads/${id}`, { status });
    },
    onMutate: ({ id }) => setUpdatingId(id),
    onSettled: () => setUpdatingId(null),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['interest_leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Status updated to "${interestOption(status).label}"`);
    },
    onError: () => toast.error('Failed to update status'),
  });

  const createBookingMutation = useMutation({
    mutationFn: async ({ lead, form }: { lead: Lead; form: typeof emptyBooking }) => {
      if (!selectedPropertyId) throw new Error('Select a property first');
      await apiClient.post('/api/crs/bookings', {
        property_id: selectedPropertyId,
        lead_id: lead.id,
        guest_name: lead.contact_name,
        guest_email: lead.contact_email,
        guest_phone: lead.contact_phone,
        booker_same_as_guest: true,
        booker_type: 'individual',
        lines: [{
          room_type_id: parseInt(form.room_type_id, 10),
          check_in: form.check_in_date,
          check_out: form.check_out_date,
          adults: parseInt(form.num_adults, 10) || 1,
          children: parseInt(form.num_children, 10) || 0,
          meal_plan: form.meal_plan,
          rate_type: 'RBI',
        }],
      });
      // also update lead status to in_progress
      await apiClient.patch(`/api/crm/leads/${lead.id}`, { status: 'in_progress' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interest_leads'] });
      queryClient.invalidateQueries({ queryKey: ['interest_bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Room booking created and lead updated to In Progress!');
      setBookLead(null);
      setBookingForm(emptyBooking);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to create booking'),
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      await apiClient.patch(`/api/crm/leads/${id}`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interest_leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Note saved');
      setNoteDialog(null);
      setNoteText('');
    },
    onError: () => toast.error('Failed to save note'),
  });

  /* indexes */
  const bookingsByLead = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const b of bookings) {
      if (b.lead_id == null) continue;
      const arr = map.get(b.lead_id) ?? [];
      arr.push(b);
      map.set(b.lead_id, arr);
    }
    return map;
  }, [bookings]);

  const banquetsByLead = useMemo(() => {
    const map = new Map<number, BanquetBooking[]>();
    for (const b of banquets) {
      if (b.lead_id == null) continue;
      const arr = map.get(b.lead_id) ?? [];
      arr.push(b);
      map.set(b.lead_id, arr);
    }
    return map;
  }, [banquets]);

  /* stats */
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return counts;
  }, [leads]);

  /* filtered */
  const filtered = useMemo(() => {
    let list = leads.filter((l) => l.status !== 'lost' || filterStatus === 'lost');
    if (filterStatus !== 'all') list = list.filter((l) => l.status === filterStatus);
    if (filterType === 'room') list = list.filter((l) => bookingsByLead.has(l.id));
    if (filterType === 'banquet') list = list.filter((l) => banquetsByLead.has(l.id));
    if (filterType === 'no_booking') list = list.filter((l) => !bookingsByLead.has(l.id) && !banquetsByLead.has(l.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.contact_name.toLowerCase().includes(q) ||
        l.contact_email?.toLowerCase().includes(q) ||
        l.contact_phone?.includes(q) ||
        l.company?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, filterStatus, filterType, search, bookingsByLead, banquetsByLead]);

  const isLoading = loadingLeads || loadingBookings || loadingBanquets;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-indigo-700 to-blue-700 text-white px-6 py-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium mb-3">
              <TrendingUp className="w-3.5 h-3.5" /> Lead Interest Tracker
            </div>
            <h1 className="text-2xl font-black tracking-tight">Who's Interested?</h1>
            <p className="mt-1 text-sm text-indigo-200 max-w-lg">
              Track every customer's interest level for room bookings and banquet inquiries. Update status instantly with one click.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Interested', count: stats['interested'] ?? 0, color: 'bg-green-400/20 text-green-100' },
              { label: 'Follow Up', count: stats['follow_up'] ?? 0, color: 'bg-amber-400/20 text-amber-100' },
              { label: 'In Progress', count: stats['in_progress'] ?? 0, color: 'bg-blue-400/20 text-blue-100' },
              { label: 'Won', count: stats['won'] ?? 0, color: 'bg-emerald-400/20 text-emerald-100' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`rounded-xl px-4 py-3 text-center ${color}`}>
                <p className="text-2xl font-black">{count}</p>
                <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, phone or company…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Interest Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {INTEREST_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="w-44">
                <BedDouble className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="Booking Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leads</SelectItem>
                <SelectItem value="room">Has Room Booking</SelectItem>
                <SelectItem value="banquet">Has Banquet Booking</SelectItem>
                <SelectItem value="no_booking">No Booking Yet</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries()} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
            <span className="text-xs text-slate-400 font-medium ml-auto">
              {filtered.length} of {leads.filter(l => l.status !== 'lost' || filterStatus === 'lost').length} leads
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Interest Summary Pills */}
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setFilterStatus(filterStatus === o.value ? 'all' : o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all
              ${o.color} ${filterStatus === o.value ? 'ring-2 ring-offset-1 ring-indigo-400 scale-105' : 'opacity-70 hover:opacity-100'}`}
          >
            {o.icon}{o.label}
            <span className="ml-1 rounded-full bg-black/10 px-1.5 py-0.5 font-black">{stats[o.value] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-slate-400">Loading leads and bookings…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <TrendingUp className="w-12 h-12 text-slate-300 mb-3" />
          <p className="text-slate-600 font-semibold">No leads match your filters.</p>
          <p className="text-slate-400 text-sm mt-1">Try changing the filter or creating a new lead.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              bookings={bookingsByLead.get(lead.id) ?? []}
              banquets={banquetsByLead.get(lead.id) ?? []}
              onUpdateStatus={(id, status) => updateStatusMutation.mutate({ id, status })}
              onOpenNote={(l) => { setNoteDialog(l); setNoteText(l.notes ?? ''); }}
              onBookRoom={(l) => { setBookLead(l); setBookingForm(emptyBooking); }}
              updatingId={updatingId}
            />
          ))}
        </div>
      )}

      {/* Note Dialog */}
      <Dialog open={!!noteDialog} onOpenChange={(open) => { if (!open) setNoteDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add / Edit Note — {noteDialog?.contact_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Write follow-up notes, interest details, callback time…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setNoteDialog(null)}>Cancel</Button>
              <Button
                onClick={() => noteDialog && updateNoteMutation.mutate({ id: noteDialog.id, notes: noteText })}
                disabled={updateNoteMutation.isPending}
              >
                {updateNoteMutation.isPending ? 'Saving…' : 'Save Note'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Book Room Dialog */}
      <Dialog open={!!bookLead} onOpenChange={(open) => { if (!open) setBookLead(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>📅 Book Room for {bookLead?.contact_name}</DialogTitle>
          </DialogHeader>
          {bookLead && (
            <form
              onSubmit={(e) => { e.preventDefault(); createBookingMutation.mutate({ lead: bookLead, form: bookingForm }); }}
              className="space-y-4"
            >
              {/* Guest info (read-only) */}
              <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3 text-sm space-y-0.5">
                <p className="font-semibold text-indigo-900">{bookLead.contact_name}</p>
                {bookLead.contact_phone && <p className="text-indigo-700">📞 {bookLead.contact_phone}</p>}
                {bookLead.contact_email && <p className="text-indigo-700">✉ {bookLead.contact_email}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Check-In Date *</Label>
                  <Input type="date" value={bookingForm.check_in_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, check_in_date: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Check-Out Date *</Label>
                  <Input type="date" value={bookingForm.check_out_date}
                    onChange={(e) => setBookingForm({ ...bookingForm, check_out_date: e.target.value })} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Room Type *</Label>
                  <Select value={bookingForm.room_type_id}
                    onValueChange={(v) => setBookingForm({ ...bookingForm, room_type_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select room type" /></SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={String(rt.id)}>
                          {rt.category} — ₹{rt.base_rate_rbi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Meal Plan</Label>
                  <Select value={bookingForm.meal_plan}
                    onValueChange={(v) => setBookingForm({ ...bookingForm, meal_plan: v })}>
                    <SelectTrigger><SelectValue placeholder="Select meal plan" /></SelectTrigger>
                    <SelectContent>
                      {mealPlans.map((mp) => (
                        <SelectItem key={mp.code} value={mp.code}>{mp.code} — {mp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Adults</Label>
                  <Input type="number" min="1" value={bookingForm.num_adults}
                    onChange={(e) => setBookingForm({ ...bookingForm, num_adults: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Children</Label>
                  <Input type="number" min="0" value={bookingForm.num_children}
                    onChange={(e) => setBookingForm({ ...bookingForm, num_children: e.target.value })} />
                </div>
              </div>

              <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                ✅ Booking will be linked to this lead automatically. Lead status will update to <strong>In Progress</strong>.
              </p>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setBookLead(null)}>Cancel</Button>
                <Button type="submit" disabled={createBookingMutation.isPending || !bookingForm.room_type_id}>
                  {createBookingMutation.isPending ? 'Creating…' : 'Create Booking'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
