import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, AlertTriangle, Clock, ChevronDown, ChevronRight,
  Wrench, CalendarOff, PlusCircle,
} from 'lucide-react';
import { format } from 'date-fns';

// ── Types ── ──────────────────────────────────────────────────────────────────
interface Venue {
  id: number;
  name: string;
  venue_type: string;
  capacity_min: number | null;
  capacity_max: number | null;
  floor_plan_notes: string | null;
}

interface VenueSlot {
  id: number;
  venue_id: number;
  label: string;
  start_time: string;
  end_time: string;
  session_kind: string;
}

interface MaintenanceBlock {
  id: number;
  venue_id: number;
  venue_slot_id: number | null;
  block_date: string;
  reason: string;
  venue_name?: string;
  slot_label?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SESSION_KINDS = ['morning', 'afternoon', 'evening', 'full_day', 'custom'] as const;
type SessionKind = typeof SESSION_KINDS[number];

const kindDefaults: Record<SessionKind, { start: string; end: string }> = {
  morning:   { start: '09:00', end: '13:00' },
  afternoon: { start: '13:00', end: '17:00' },
  evening:   { start: '18:00', end: '23:00' },
  full_day:  { start: '09:00', end: '23:00' },
  custom:    { start: '10:00', end: '18:00' },
};

const kindColors: Record<string, string> = {
  morning:   'bg-amber-100 text-amber-800',
  afternoon: 'bg-sky-100 text-sky-800',
  evening:   'bg-violet-100 text-violet-800',
  full_day:  'bg-rose-100 text-rose-800',
  custom:    'bg-slate-100 text-slate-700',
};

const emptyVenueForm = { name: '', description: '', capacity_min: '', capacity_max: '' };
const emptySlotForm  = { label: '', start_time: '09:00', end_time: '23:00', session_kind: 'morning' as SessionKind };
const emptyMBlock    = { venue_id: '', venue_slot_id: '', block_date: '', reason: '' };

// ── Component ─────────────────────────────────────────────────────────────────
const VenuesPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  // Venue state
  const [isCreateOpen, setIsCreateOpen]   = useState(false);
  const [isEditOpen, setIsEditOpen]       = useState(false);
  const [isDeleteOpen, setIsDeleteOpen]   = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [venueForm, setVenueForm]         = useState(emptyVenueForm);

  // Sessions state
  const [expandedVenueId, setExpandedVenueId] = useState<number | null>(null);
  const [isSlotCreateOpen, setIsSlotCreateOpen] = useState(false);
  const [isSlotEditOpen, setIsSlotEditOpen]     = useState(false);
  const [isSlotDeleteOpen, setIsSlotDeleteOpen] = useState(false);
  const [selectedSlot, setSelectedSlot]         = useState<VenueSlot | null>(null);
  const [slotForm, setSlotForm]                 = useState(emptySlotForm);
  const [slotVenueId, setSlotVenueId]           = useState<number | null>(null);

  // Maintenance state
  const [isMBlockOpen, setIsMBlockOpen]   = useState(false);
  const [mblockForm, setMBlockForm]       = useState(emptyMBlock);
  const [mblockDeleteId, setMblockDeleteId] = useState<number | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues', selectedPropertyId],
    queryFn: async () => {
      const res = await apiClient.get<{ venues: Venue[] }>('/api/banquet/venues', {
        params: { property_id: selectedPropertyId },
      });
      return res.data.venues ?? [];
    },
    enabled: !!selectedPropertyId && Number.isFinite(selectedPropertyId),
  });

  const { data: allSlots = [] } = useQuery({
    queryKey: ['venueSlots', selectedPropertyId],
    queryFn: async () => {
      const res = await apiClient.get<{ slots: VenueSlot[] }>('/api/banquet/venue-slots', {
        params: { property_id: selectedPropertyId },
      });
      return res.data.slots ?? [];
    },
    enabled: !!selectedPropertyId && Number.isFinite(selectedPropertyId),
  });

  const { data: mblocks = [] } = useQuery({
    queryKey: ['maintenanceBlocks', selectedPropertyId],
    queryFn: async () => {
      const res = await apiClient.get<{ blocks: MaintenanceBlock[] }>('/api/banquet/maintenance-blocks', {
        params: { property_id: selectedPropertyId },
      });
      return res.data.blocks ?? [];
    },
    enabled: !!selectedPropertyId && Number.isFinite(selectedPropertyId),
  });

  // ── Venue mutations ───────────────────────────────────────────────────────────
  const createVenueMutation = useMutation({
    mutationFn: async (data: typeof emptyVenueForm) => {
      const cap    = parseInt(data.capacity_max, 10) || 0;
      const capMin = data.capacity_min ? parseInt(data.capacity_min, 10) : Math.max(1, Math.floor(cap * 0.5));
      await apiClient.post('/api/banquet/venues', {
        property_id: selectedPropertyId,
        name: data.name,
        venue_type: 'banquet_hall',
        capacity_min: capMin,
        capacity_max: Math.max(cap, 1),
        floor_plan_notes: data.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue created');
      setIsCreateOpen(false);
      setVenueForm(emptyVenueForm);
    },
    onError: () => toast.error('Failed to create venue'),
  });

  const updateVenueMutation = useMutation({
    mutationFn: async (data: typeof emptyVenueForm & { id: number }) => {
      await apiClient.put(`/api/banquet/venues/${data.id}`, {
        name: data.name,
        capacity_min: data.capacity_min ? parseInt(data.capacity_min, 10) : null,
        capacity_max: data.capacity_max ? parseInt(data.capacity_max, 10) : null,
        floor_plan_notes: data.description || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue updated');
      setIsEditOpen(false);
    },
    onError: () => toast.error('Failed to update venue'),
  });

  const deleteVenueMutation = useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/banquet/venues/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue removed');
      setIsDeleteOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to remove venue'),
  });

  // ── Slot mutations ────────────────────────────────────────────────────────────
  const createSlotMutation = useMutation({
    mutationFn: async (data: typeof emptySlotForm & { venue_id: number }) => {
      await apiClient.post('/api/banquet/venue-slots', {
        venue_id: data.venue_id,
        property_id: selectedPropertyId,
        label: data.label,
        start_time: data.start_time,
        end_time: data.end_time,
        session_kind: data.session_kind,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueSlots'] });
      toast.success('Session created');
      setIsSlotCreateOpen(false);
      setSlotForm(emptySlotForm);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to create session'),
  });

  const updateSlotMutation = useMutation({
    mutationFn: async (data: typeof emptySlotForm & { id: number }) => {
      await apiClient.put(`/api/banquet/venue-slots/${data.id}`, {
        label: data.label,
        start_time: data.start_time,
        end_time: data.end_time,
        session_kind: data.session_kind,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueSlots'] });
      toast.success('Session updated');
      setIsSlotEditOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to update session'),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/banquet/venue-slots/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venueSlots'] });
      toast.success('Session removed');
      setIsSlotDeleteOpen(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to remove session'),
  });

  // ── Maintenance mutations ─────────────────────────────────────────────────────
  const createMBlockMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/api/banquet/maintenance-blocks', {
        venue_id: parseInt(mblockForm.venue_id, 10),
        property_id: selectedPropertyId,
        venue_slot_id: mblockForm.venue_slot_id ? parseInt(mblockForm.venue_slot_id, 10) : null,
        block_date: mblockForm.block_date,
        reason: mblockForm.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceBlocks'] });
      toast.success('Maintenance block added');
      setIsMBlockOpen(false);
      setMBlockForm(emptyMBlock);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'Failed to add block'),
  });

  const deleteMBlockMutation = useMutation({
    mutationFn: async (id: number) => { await apiClient.delete(`/api/banquet/maintenance-blocks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenanceBlocks'] });
      toast.success('Block removed');
      setMblockDeleteId(null);
    },
    onError: () => toast.error('Failed to remove block'),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const openEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    setVenueForm({
      name: venue.name,
      description: venue.floor_plan_notes ?? '',
      capacity_min: venue.capacity_min != null ? String(venue.capacity_min) : '',
      capacity_max: venue.capacity_max != null ? String(venue.capacity_max) : '',
    });
    setIsEditOpen(true);
  };

  const openSlotCreate = (venueId: number) => {
    setSlotVenueId(venueId);
    setSlotForm(emptySlotForm);
    setIsSlotCreateOpen(true);
  };

  const openSlotEdit = (slot: VenueSlot) => {
    setSelectedSlot(slot);
    setSlotForm({
      label: slot.label,
      start_time: slot.start_time.slice(0, 5),
      end_time: slot.end_time.slice(0, 5),
      session_kind: slot.session_kind as SessionKind,
    });
    setIsSlotEditOpen(true);
  };

  const handleKindChange = (kind: SessionKind) => {
    const def = kindDefaults[kind];
    setSlotForm((f) => ({ ...f, session_kind: kind, start_time: def.start, end_time: def.end }));
  };

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banquet Venues</h1>
          <p className="mt-1 text-gray-500">Manage venues, session slots, and maintenance blocks</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setMBlockForm(emptyMBlock); setIsMBlockOpen(true); }}>
            <CalendarOff className="mr-2 h-4 w-4 text-rose-500" />
            Add Maintenance Block
          </Button>
          <Button onClick={() => { setVenueForm(emptyVenueForm); setIsCreateOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Venue
          </Button>
        </div>
      </div>

      {/* ── Venues list ── */}
      <div className="space-y-4">
        {venues.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-slate-400">
            <span className="text-4xl">🏛️</span>
            <p className="mt-3 text-sm">No venues yet. Add one to get started.</p>
          </div>
        ) : (
          venues.map((venue) => {
            const venueSlots = allSlots.filter((s) => s.venue_id === venue.id);
            const isExpanded = expandedVenueId === venue.id;
            return (
              <Card key={venue.id} className="overflow-hidden">
                {/* Venue header row */}
                <div className="flex items-center gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setExpandedVenueId(isExpanded ? null : venue.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-5 w-5 text-white/60 shrink-0" />
                      : <ChevronRight className="h-5 w-5 text-white/60 shrink-0" />
                    }
                    <div>
                      <div className="font-bold text-white">{venue.name}</div>
                      <div className="text-xs text-slate-300">
                        {venue.venue_type.replace(/_/g, ' ')}
                        {(venue.capacity_min || venue.capacity_max) &&
                          ` · ${venue.capacity_min ?? '—'}–${venue.capacity_max ?? '—'} pax`}
                      </div>
                    </div>
                    <Badge className="ml-2 bg-white/10 text-white text-[11px]">
                      {venueSlots.length} session{venueSlots.length !== 1 ? 's' : ''}
                    </Badge>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => openEdit(venue)} title="Edit venue">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-rose-300 hover:text-rose-200 hover:bg-white/10"
                      onClick={() => { setSelectedVenue(venue); setIsDeleteOpen(true); }} title="Delete venue">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded: sessions panel */}
                {isExpanded && (
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Clock className="h-4 w-4 text-indigo-500" />
                        Sessions / Time Slots
                      </h3>
                      <Button size="sm" variant="outline" onClick={() => openSlotCreate(venue.id)}>
                        <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                        Add Session
                      </Button>
                    </div>

                    {venueSlots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center text-sm text-slate-400">
                        No sessions defined yet.{' '}
                        <button className="text-indigo-500 underline" onClick={() => openSlotCreate(venue.id)}>
                          Add one
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {venueSlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="group relative flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-[170px]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 text-sm">{slot.label}</span>
                              <Badge className={`text-[10px] ${kindColors[slot.session_kind] ?? kindColors.custom}`}>
                                {slot.session_kind.replace('_', ' ')}
                              </Badge>
                            </div>
                            <span className="text-xs text-slate-500">
                              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                            </span>
                            <div className="mt-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openSlotEdit(slot)}
                                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { setSelectedSlot(slot); setIsSlotDeleteOpen(true); }}
                                className="rounded bg-rose-50 px-2 py-0.5 text-[11px] text-rose-600 hover:bg-rose-100"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* ── Maintenance Blocks list ── */}
      {mblocks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-rose-500" />
              Maintenance / Buffer Blocks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mblocks.map((block) => (
                  <TableRow key={block.id}>
                    <TableCell className="font-medium">{block.venue_name}</TableCell>
                    <TableCell className="text-slate-500">{block.slot_label ?? 'All sessions'}</TableCell>
                    <TableCell>{format(new Date(block.block_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-slate-600">{block.reason}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost" size="sm"
                        className="text-rose-500 hover:text-rose-700"
                        onClick={() => setMblockDeleteId(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ────────────────── Dialogs ────────────────── */}

      {/* Create Venue */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Venue</DialogTitle></DialogHeader>
          <VenueForm form={venueForm} setForm={setVenueForm}
            onSubmit={(e) => { e.preventDefault(); createVenueMutation.mutate(venueForm); }}
            isPending={createVenueMutation.isPending}
            onCancel={() => setIsCreateOpen(false)} submitLabel="Create Venue" />
        </DialogContent>
      </Dialog>

      {/* Edit Venue */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Venue</DialogTitle></DialogHeader>
          <VenueForm form={venueForm} setForm={setVenueForm}
            onSubmit={(e) => { e.preventDefault(); if (selectedVenue) updateVenueMutation.mutate({ ...venueForm, id: selectedVenue.id }); }}
            isPending={updateVenueMutation.isPending}
            onCancel={() => setIsEditOpen(false)} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Delete Venue */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" /> Remove Venue
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Remove <span className="font-semibold">{selectedVenue?.name}</span>? This cannot be undone and will fail if active bookings exist.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteVenueMutation.isPending}
              onClick={() => selectedVenue && deleteVenueMutation.mutate(selectedVenue.id)}>
              {deleteVenueMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Session Slot */}
      <Dialog open={isSlotCreateOpen} onOpenChange={setIsSlotCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Session Slot</DialogTitle></DialogHeader>
          <SlotForm form={slotForm} setForm={setSlotForm} onKindChange={handleKindChange}
            onSubmit={(e) => {
              e.preventDefault();
              if (slotVenueId) createSlotMutation.mutate({ ...slotForm, venue_id: slotVenueId });
            }}
            isPending={createSlotMutation.isPending}
            onCancel={() => setIsSlotCreateOpen(false)} submitLabel="Add Session" />
        </DialogContent>
      </Dialog>

      {/* Edit Session Slot */}
      <Dialog open={isSlotEditOpen} onOpenChange={setIsSlotEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Session Slot</DialogTitle></DialogHeader>
          <SlotForm form={slotForm} setForm={setSlotForm} onKindChange={handleKindChange}
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedSlot) updateSlotMutation.mutate({ ...slotForm, id: selectedSlot.id });
            }}
            isPending={updateSlotMutation.isPending}
            onCancel={() => setIsSlotEditOpen(false)} submitLabel="Save Changes" />
        </DialogContent>
      </Dialog>

      {/* Delete Session */}
      <Dialog open={isSlotDeleteOpen} onOpenChange={setIsSlotDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" /> Remove Session
          </DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">
            Remove session <span className="font-semibold">{selectedSlot?.label}</span>?
            This will fail if there are active bookings using this slot.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsSlotDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteSlotMutation.isPending}
              onClick={() => selectedSlot && deleteSlotMutation.mutate(selectedSlot.id)}>
              {deleteSlotMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Maintenance Block */}
      <Dialog open={isMBlockOpen} onOpenChange={setIsMBlockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-rose-500" /> Add Maintenance Block
          </DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMBlockMutation.mutate(); }} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Venue *</Label>
              <Select value={mblockForm.venue_id}
                onValueChange={(v) => setMBlockForm((f) => ({ ...f, venue_id: v, venue_slot_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Session Slot (optional — leave empty to block all sessions)</Label>
              <Select value={mblockForm.venue_slot_id}
                onValueChange={(v) => setMBlockForm((f) => ({ ...f, venue_slot_id: v }))}>
                <SelectTrigger><SelectValue placeholder="All sessions" /></SelectTrigger>
                <SelectContent>
                  {allSlots
                    .filter((s) => String(s.venue_id) === mblockForm.venue_id)
                    .map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.label} ({s.start_time.slice(0,5)}–{s.end_time.slice(0,5)})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Block Date *</Label>
              <Input type="date" value={mblockForm.block_date}
                onChange={(e) => setMBlockForm((f) => ({ ...f, block_date: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea value={mblockForm.reason} required
                placeholder="e.g. Deep cleaning, AV setup, buffer after wedding"
                onChange={(e) => setMBlockForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setIsMBlockOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMBlockMutation.isPending}>
                {createMBlockMutation.isPending ? 'Adding…' : 'Add Block'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Maintenance Block */}
      <Dialog open={!!mblockDeleteId} onOpenChange={(open) => { if (!open) setMblockDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Block?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">This will re-open the slot for new bookings on that date.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMblockDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMBlockMutation.isPending}
              onClick={() => mblockDeleteId && deleteMBlockMutation.mutate(mblockDeleteId)}>
              {deleteMBlockMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Sub-forms ─────────────────────────────────────────────────────────────────
function VenueForm({ form, setForm, onSubmit, isPending, onCancel, submitLabel }: {
  form: typeof emptyVenueForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyVenueForm>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="venue_name">Name *</Label>
        <Input id="venue_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Min Capacity</Label>
          <Input type="number" min="1" value={form.capacity_min}
            onChange={(e) => setForm({ ...form, capacity_min: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Max Capacity *</Label>
          <Input type="number" min="1" value={form.capacity_max} required
            onChange={(e) => setForm({ ...form, capacity_max: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Floor Notes</Label>
        <Textarea value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Layout details, AV setup notes…" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}

function SlotForm({ form, setForm, onKindChange, onSubmit, isPending, onCancel, submitLabel }: {
  form: typeof emptySlotForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptySlotForm>>;
  onKindChange: (kind: SessionKind) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Session Label *</Label>
        <Input value={form.label} required placeholder="e.g. Morning, Evening, Full Day"
          onChange={(e) => setForm({ ...form, label: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Session Kind *</Label>
        <Select value={form.session_kind} onValueChange={(v) => onKindChange(v as SessionKind)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SESSION_KINDS.map((k) => (
              <SelectItem key={k} value={k}>{k.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start Time *</Label>
          <Input type="time" value={form.start_time} required
            onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>End Time *</Label>
          <Input type="time" value={form.end_time} required
            onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}

export default VenuesPage;
