import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useNavigate } from 'react-router';
import {
  CalendarDays, LayoutGrid, Plus, UtensilsCrossed, Search, Edit2, Trash2,
  X, Check, ChevronDown, IndianRupee, Users, Tag, PlusCircle, Send,
  Building2, Clock3, ClipboardList, Sparkles, MapPin, CircleDot, CalendarCheck,
} from 'lucide-react';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

type BookingStatus = 'INQ' | 'QTN-HOLD' | 'TENT' | 'CONF-U' | 'CONF-P' | 'CXL';
type EventCategory = 'corporate' | 'social' | 'group';

type BanquetBooking = Record<string, unknown> & {
  id: number;
  status: BookingStatus;
  slot_color?: string;
};

type Venue = {
  id: number;
  name: string;
  venue_type: string;
  capacity_min: number | null;
  capacity_max: number | null;
  floor_plan_notes: string | null;
};

type VenueSlot = {
  id: number;
  venue_id: number;
  label: string;
  start_time: string;
  end_time: string;
  session_kind: string;
};

type Metadata = {
  event_categories: EventCategory[];
  event_sub_types: Record<EventCategory, string[]>;
  banquet_types: { value: string; label: string; gst_percent: number }[];
  menu_packages: {
    code: string;
    label: string;
    per_plate_rate: number;
    event_categories: EventCategory[];
    items: string[];
  }[];
  statuses: BookingStatus[];
};

type AvailabilityRow = {
  venue: Venue;
  sessions: {
    slot_id: number;
    label: string;
    start_time: string;
    end_time: string;
    session_kind: string;
    state: 'red' | 'amber' | 'blue';
    booking_status: BookingStatus | null;
    booking_id: number | null;
    event_category: EventCategory | null;
    event_sub_type: string | null;
    menu_package: string | null;
    with_room: boolean;
    linked_guest_name: string | null;
  }[];
};

const todayString = format(new Date(), 'yyyy-MM-dd');

const emptyForm = {
  venue_id: '',
  venue_slot_id: '',
  event_category: 'social' as EventCategory,
  event_sub_type: '',
  event_date: todayString,
  banquet_type: 'without_room',
  linked_booking_id: '',
  guaranteed_pax: '',
  menu_package: 'deluxe',
  publish_rate: '',
  discount_pct: '',
  hall_charges: '',
  venue_charges: '',
  per_plate_rate: '',
  notes: '',
};

const slotToneClasses: Record<string, string> = {
  red:   'border-l-rose-400   bg-rose-50   text-rose-800',
  amber: 'border-l-amber-400  bg-amber-50  text-amber-900',
  blue:  'border-l-blue-500   bg-blue-50   text-blue-800',
};

const slotPillDot: Record<string, string> = {
  red:   'bg-rose-400',
  amber: 'bg-amber-400',
  blue:  'bg-blue-500',
};

const statusToneClasses: Record<string, string> = {
  INQ:       'bg-slate-100 text-slate-700',
  'QTN-HOLD':'bg-rose-100  text-rose-700',
  TENT:      'bg-amber-100 text-amber-800',
  'CONF-U':  'bg-blue-100  text-blue-700',
  'CONF-P':  'bg-emerald-100 text-emerald-700',
  CXL:       'bg-red-100   text-red-700',
};

const venueTypeLabel: Record<string, string> = {
  banquet_hall: 'Banquet Hall',
  lawn: 'Lawn',
  conference_room: 'Conference Room',
  terrace: 'Terrace',
  other: 'Other',
};

const venueTypeAccent: Record<string, string> = {
  banquet_hall: 'from-slate-800 to-slate-700',
  lawn: 'from-emerald-700 to-teal-700',
  conference_room: 'from-sky-800 to-indigo-800',
  terrace: 'from-amber-700 to-orange-700',
  other: 'from-zinc-800 to-stone-700',
};

function formatCurrency(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function titleize(code: string | null | undefined) {
  if (!code) return '--';
  return code
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-semibold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function BanquetBookingsPage() {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('availability');
  const [availabilityDate, setAvailabilityDate] = useState(todayString);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BanquetBooking | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus>('INQ');
  const [editActualPax, setEditActualPax] = useState('');
  const [form, setForm] = useState(emptyForm);

  // ── Menu Grid local state ──────────────────────────────────────────────────
  type MenuPackage = Metadata['menu_packages'][number];
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<EventCategory | 'all'>('all');
  const [localPackages, setLocalPackages] = useState<MenuPackage[] | null>(null);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);
  const emptyPkg: MenuPackage = {
    code: '',
    label: '',
    per_plate_rate: 0,
    event_categories: ['social'],
    items: [],
  };
  const [editingPkg, setEditingPkg] = useState<MenuPackage>(emptyPkg);
  const [newItemText, setNewItemText] = useState('');

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['banquetBookings', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ banquet_bookings: BanquetBooking[] }>('/api/banquet/banquet-bookings', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.banquet_bookings ?? [];
    },
    enabled: !!selectedPropertyId && Number.isFinite(selectedPropertyId),
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ venues: Venue[] }>('/api/banquet/venues', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.venues ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['venueSlots', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ slots: VenueSlot[] }>('/api/banquet/venue-slots', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.slots ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: metadata } = useQuery({
    queryKey: ['banquetMetadata'],
    queryFn: async () => {
      const response = await apiClient.get<Metadata>('/api/banquet/metadata');
      return response.data;
    },
  });

  const { data: availability = [], isLoading: availabilityLoading } = useQuery({
    queryKey: ['banquetAvailability', selectedPropertyId, availabilityDate],
    queryFn: async () => {
      const response = await apiClient.get<{ availability: AvailabilityRow[] }>('/api/banquet/availability', {
        params: { property_id: selectedPropertyId, event_date: availabilityDate },
      });
      return response.data.availability ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: roomBookings = [] } = useQuery({
    queryKey: ['roomBookings_simple', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ bookings: any[] }>('/api/crs/bookings', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.bookings ?? [];
    },
    enabled: !!selectedPropertyId,
  });


  const availableSlotsForVenue = useMemo(
    () => slots.filter((slot) => String(slot.venue_id) === form.venue_id),
    [form.venue_id, slots]
  );

  const selectedPackage = useMemo(
    () => metadata?.menu_packages.find((pkg) => pkg.code === form.menu_package) ?? null,
    [form.menu_package, metadata]
  );

  const packageOptions = useMemo(
    () => (metadata?.menu_packages ?? []).filter((pkg) => pkg.event_categories.includes(form.event_category)),
    [form.event_category, metadata]
  );

  const selectedVenue = useMemo(
    () => venues.find((venue) => String(venue.id) === form.venue_id) ?? null,
    [form.venue_id, venues]
  );

  const guaranteedPax = Number(form.guaranteed_pax || 0);
  const baseRate = Number(form.publish_rate || selectedPackage?.per_plate_rate || 0);
  const discountPct = Number(form.discount_pct || 0);
  const netPerPlate = Number(form.per_plate_rate || (baseRate - (baseRate * discountPct) / 100) || 0);
  const hallCharges = Number(form.hall_charges || 0);
  const venueCharges = Number(form.venue_charges || 0);
  const taxableAmount = netPerPlate * guaranteedPax + hallCharges + venueCharges;
  const gstPct = form.banquet_type === 'with_room' ? 18 : 5;
  const gstAmount = taxableAmount * (gstPct / 100);
  const grossAmount = taxableAmount + gstAmount;

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post('/api/banquet/banquet-bookings', {
        property_id: selectedPropertyId,
        venue_id: parseInt(data.venue_id, 10),
        venue_slot_id: parseInt(data.venue_slot_id, 10),
        event_date: data.event_date,
        event_category: data.event_category,
        event_sub_type: data.event_sub_type || null,
        with_room: data.banquet_type === 'with_room',
        linked_booking_id: data.banquet_type === 'with_room' && data.linked_booking_id ? parseInt(data.linked_booking_id, 10) : null,
        guaranteed_pax: data.guaranteed_pax ? parseInt(data.guaranteed_pax, 10) : null,
        menu_package: data.menu_package,
        pricing: {
          publish_rate: baseRate,
          discount_pct: discountPct,
          hall_charges: hallCharges,
          venue_charges: venueCharges,
          per_plate_rate: netPerPlate,
          package_code: data.menu_package,
          notes: data.notes || null,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banquetBookings'] });
      queryClient.invalidateQueries({ queryKey: ['banquetAvailability'] });
      toast.success('Banquet booking created');
      setIsCreateDialogOpen(false);
      setForm(emptyForm);
      setActiveTab('bookings');
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      if (data?.errors) {
        toast.error(data.errors.map((e: any) => `${e.path || e.param}: ${e.msg}`).join(', '));
      } else {
        toast.error(data?.error ?? 'Failed to create banquet booking');
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, actual_pax }: { id: number; status: BookingStatus; actual_pax?: number | null }) => {
      const response = await apiClient.patch(`/api/banquet/banquet-bookings/${id}`, {
        status,
        ...(actual_pax !== undefined ? { actual_pax } : {}),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banquetBookings'] });
      queryClient.invalidateQueries({ queryKey: ['banquetAvailability'] });
      toast.success('Booking updated');
      setIsEditDialogOpen(false);
      setSelectedBooking(null);
    },
    onError: (error: any) => {
      const data = error?.response?.data;
      if (data?.errors) {
        toast.error(data.errors.map((e: any) => `${e.path || e.param}: ${e.msg}`).join(', '));
      } else {
        toast.error(data?.error ?? 'Failed to update booking');
      }
    },
  });

  const handleAvailabilityPick = (venue: Venue, slotId: number) => {
    const firstPackage = metadata?.menu_packages.find((pkg) => pkg.event_categories.includes(form.event_category))?.code ?? 'deluxe';
    setForm((current) => ({
      ...current,
      venue_id: String(venue.id),
      venue_slot_id: String(slotId),
      event_date: availabilityDate,
      menu_package: current.menu_package || firstPackage,
    }));
    setIsCreateDialogOpen(true);
  };

  const openEdit = (booking: BanquetBooking) => {
    setSelectedBooking(booking);
    setEditStatus(booking.status);
    setEditActualPax(booking.actual_pax != null ? String(booking.actual_pax) : '');
    setIsEditDialogOpen(true);
  };

  const isLoading = bookingsLoading || !metadata;
  const availabilitySummary = useMemo(() => {
    const sessions = availability.flatMap((row) => row.sessions);
    return {
      venues: availability.length,
      total: sessions.length,
      open: sessions.filter((session) => !session.booking_id).length,
      tentative: sessions.filter((session) => session.state === 'amber').length,
      confirmed: sessions.filter((session) => session.state === 'blue').length,
    };
  }, [availability]);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== 'CXL'),
    [bookings]
  );

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 bg-[linear-gradient(135deg,#0f172a_0%,#334155_58%,#0f766e_100%)] px-6 py-6 text-white lg:grid-cols-[1.35fr,1fr]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
              <Sparkles className="h-3.5 w-3.5" />
              Banquet operations
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Banquet Availability & Bookings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                Plan venue sessions, hold banquet slots, and review event packages from one working board.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-white text-slate-900 hover:bg-slate-100">
                <Plus className="h-4 w-4" />
                New Banquet Booking
              </Button>
              <Button type="button" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setActiveTab('bookings')}>
                <ClipboardList className="h-4 w-4" />
                View Bookings
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/15 bg-white/10 p-4">
              <Building2 className="h-5 w-5 text-teal-100" />
              <div className="mt-3 text-2xl font-bold">{availabilitySummary.venues}</div>
              <div className="text-xs text-slate-200">Venues</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4">
              <Clock3 className="h-5 w-5 text-sky-100" />
              <div className="mt-3 text-2xl font-bold">{availabilitySummary.total}</div>
              <div className="text-xs text-slate-200">Sessions</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4">
              <CircleDot className="h-5 w-5 text-emerald-100" />
              <div className="mt-3 text-2xl font-bold">{availabilitySummary.open}</div>
              <div className="text-xs text-slate-200">Open slots</div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 p-4">
              <CalendarCheck className="h-5 w-5 text-amber-100" />
              <div className="mt-3 text-2xl font-bold">{activeBookings.length}</div>
              <div className="text-xs text-slate-200">Active bookings</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:w-[560px]">
          <TabsTrigger value="availability">
            <CalendarDays className="h-4 w-4" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="bookings">
            <LayoutGrid className="h-4 w-4" />
            Bookings
          </TabsTrigger>
          <TabsTrigger value="menu-grid">
            <UtensilsCrossed className="h-4 w-4" />
            Menu Grid
          </TabsTrigger>
        </TabsList>

        <TabsContent value="availability" className="space-y-5">

          {/* ── Toolbar: date picker + legend ── */}
          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm lg:flex-row lg:items-center">
            <div>
              <div className="text-sm font-semibold text-slate-900">Availability Board</div>
              <div className="text-xs text-slate-500">Pick a date, then choose an open session to create a booking.</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <CalendarDays className="h-5 w-5 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Event Date</span>
              <Input
                id="availability_date"
                type="date"
                value={availabilityDate}
                onChange={(e) => setAvailabilityDate(e.target.value)}
                  className="h-8 w-40 rounded-md border-slate-200 bg-white text-sm"
              />
            </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                Open / Enquiry
              </span>
                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Tentative
              </span>
                <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Confirmed
              </span>
              </div>
            </div>
          </div>

          {/* ── Venue cards ── */}
          {availabilityLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
              <p className="mt-3 text-sm text-slate-400">Loading venues…</p>
            </div>
          ) : availability.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Building2 className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-700">No active venues found</p>
              <p className="mt-1 text-xs text-slate-500">Add venues and session slots before using the availability board.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availability.map((row) => (
                <div
                  key={row.venue.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  {/* Venue header */}
                  <div className={`flex items-center gap-4 border-b border-slate-100 bg-gradient-to-r ${venueTypeAccent[row.venue.venue_type] ?? venueTypeAccent.other} px-6 py-4`}>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-white">{row.venue.name}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-200">
                        <span>{venueTypeLabel[row.venue.venue_type] ?? titleize(row.venue.venue_type)}</span>
                        {row.venue.capacity_min != null || row.venue.capacity_max != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {row.venue.capacity_min ?? '--'} - {row.venue.capacity_max ?? '--'} pax
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {row.venue.floor_plan_notes && (
                      <span className="hidden max-w-xs truncate rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200 sm:inline">
                        <MapPin className="mr-1 inline h-3.5 w-3.5" />
                        {row.venue.floor_plan_notes}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
                      {row.sessions.length} session{row.sessions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Sessions row */}
                  <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                    {row.sessions.map((session) => {
                      const tone = session.state as 'red' | 'amber' | 'blue';
                      const isBlocked = tone === 'blue';
                      return (
                        <button
                          key={session.slot_id}
                          type="button"
                          onClick={() => handleAvailabilityPick(row.venue, session.slot_id)}
                          disabled={isBlocked}
                          className={`group relative flex min-h-[118px] flex-col justify-between gap-2 rounded-xl border border-l-4 px-4 py-3 text-left shadow-sm transition-all
                            ${slotToneClasses[tone] ?? slotToneClasses.red}
                            ${isBlocked ? 'cursor-not-allowed opacity-75' : 'hover:-translate-y-0.5 hover:shadow-md active:scale-95'}`}
                        >
                          {/* Status dot + label */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-sm">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${slotPillDot[tone] ?? slotPillDot.red}`} />
                              {session.label}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusToneClasses[session.booking_status ?? ''] ?? 'bg-slate-100 text-slate-500'}`}>
                              {session.booking_status ?? 'Open'}
                            </span>
                          </div>

                          {/* Time */}
                          <span className="inline-flex items-center gap-1.5 text-xs opacity-70">
                            <Clock3 className="h-3.5 w-3.5" />
                            {session.start_time.slice(0, 5)} – {session.end_time.slice(0, 5)}
                          </span>

                          {/* Event info or CTA */}
                          <span className="rounded-lg bg-white/60 px-2.5 py-1.5 text-xs font-medium opacity-90">
                            {session.booking_id
                              ? (session as any).linked_guest_name 
                                ? `With Room: ${(session as any).linked_guest_name}`
                                : `${titleize(session.event_category)} / ${titleize(session.event_sub_type)}`
                              : isBlocked ? 'Fully booked' : '+ Create booking'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-white">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-lg">Current Banquet Bookings</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Review status, event mix, pax, and session assignments.</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="text-base font-bold text-slate-900">{bookings.length}</div>
                    <div className="text-slate-500">Total</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="text-base font-bold text-emerald-800">{activeBookings.length}</div>
                    <div className="text-emerald-700">Active</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-base font-bold text-amber-800">{bookings.filter((booking) => booking.status === 'TENT').length}</div>
                    <div className="text-amber-700">Tentative</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                </div>
              ) : bookings.length === 0 ? (
                <p className="py-8 text-center text-gray-500">No banquet bookings found yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Venue</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>PAX</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow key={booking.id} className="hover:bg-slate-50">
                          <TableCell>
                            <div className="font-medium text-slate-900">{booking.event_date ? format(new Date(String(booking.event_date)), 'MMM dd, yyyy') : '--'}</div>
                            <div className="text-xs text-slate-500">#{booking.id}</div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{String(booking.venue_name ?? '--')}</div>
                            <div className="text-xs text-slate-500">
                              {booking.with_room ? (
                                <span className="text-indigo-600 font-medium">
                                  With Room: {String(booking.linked_guest_name ?? `#${booking.linked_booking_id}`)}
                                </span>
                              ) : (
                                'Banquet only'
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                              {String(booking.slot_label ?? '--')}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>{titleize(String(booking.event_category ?? ''))}</div>
                            <div className="text-xs text-slate-500">{titleize(String(booking.event_sub_type ?? ''))}</div>
                          </TableCell>
                          <TableCell>{titleize(String(booking.menu_package ?? ''))}</TableCell>
                          <TableCell>
                            G: {booking.guaranteed_pax ?? '--'}
                            <div className="text-xs text-slate-500">A: {booking.actual_pax ?? '--'}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusToneClasses[String(booking.status)] ?? 'bg-slate-100 text-slate-700'}>
                              {String(booking.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {booking.status !== 'CXL' && (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost" size="sm"
                                  title="Send Quotation"
                                  disabled={['QTN-HOLD','CONF-U','CONF-P'].includes(String(booking.status))}
                                  onClick={() => {
                                    const params = new URLSearchParams();
                                    params.set('banquet_booking_id', String(booking.id));
                                    if (booking.lead_id) params.set('lead_id', String(booking.lead_id));
                                    navigate(`/crm/quotes/new?${params.toString()}`);
                                  }}
                                >
                                  <Send className="h-4 w-4 text-indigo-600" />
                                </Button>
                                {['CONF-U', 'CONF-P', 'TENT'].includes(String(booking.status)) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const params = new URLSearchParams();
                                      params.set('banquet_booking_id', String(booking.id));
                                      if (booking.lead_id) params.set('lead_id', String(booking.lead_id));
                                      navigate(`/crm/contracts/new?${params.toString()}`);
                                    }}
                                    title="Generate Contract"
                                  >
                                    <FileText className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => openEdit(booking)}>
                                  Update
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="menu-grid" className="space-y-6">
          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search packages…"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={menuCategoryFilter} onValueChange={(v) => setMenuCategoryFilter(v as EventCategory | 'all')}>
              <SelectTrigger className="w-44">
                <Tag className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(metadata?.event_categories ?? []).map((cat) => (
                  <SelectItem key={cat} value={cat}>{titleize(cat)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setEditingPkg({ ...emptyPkg, code: `pkg_${Date.now()}` });
                setNewItemText('');
                setIsMenuDialogOpen(true);
              }}
              className="gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Add Package
            </Button>
          </div>

          {/* ── Package Cards ── */}
          {(() => {
            const basePackages = localPackages ?? metadata?.menu_packages ?? [];
            const filtered = basePackages.filter((pkg) => {
              const matchesSearch = pkg.label.toLowerCase().includes(menuSearch.toLowerCase()) ||
                pkg.items.some((i) => i.toLowerCase().includes(menuSearch.toLowerCase()));
              const matchesCat = menuCategoryFilter === 'all' || pkg.event_categories.includes(menuCategoryFilter);
              return matchesSearch && matchesCat;
            });

            const catColors: Record<string, string> = {
              corporate: 'bg-blue-100 text-blue-700 border-blue-200',
              social: 'bg-purple-100 text-purple-700 border-purple-200',
              group: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            };

            const gradients: string[] = [
              'from-violet-500 to-indigo-600',
              'from-rose-500 to-pink-600',
              'from-amber-500 to-orange-600',
              'from-teal-500 to-cyan-600',
              'from-slate-600 to-slate-800',
            ];

            if (filtered.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-slate-400">
                  <UtensilsCrossed className="mb-3 h-10 w-10 opacity-40" />
                  <p className="text-sm">No packages match your filters.</p>
                </div>
              );
            }

            return (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((pkg, idx) => (
                  <div
                    key={pkg.code}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg"
                  >
                    {/* Gradient header */}
                    <div className={`bg-gradient-to-br ${gradients[idx % gradients.length]} px-5 py-5 text-white`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-bold tracking-tight">{pkg.label}</h3>
                          <p className="mt-0.5 text-sm text-white/70">{pkg.items.length} item{pkg.items.length !== 1 ? 's' : ''} included</p>
                        </div>
                        {/* Action buttons */}
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPkg({ ...pkg, items: [...pkg.items] });
                              setNewItemText('');
                              setIsMenuDialogOpen(true);
                            }}
                            className="rounded-lg bg-white/20 p-1.5 hover:bg-white/30"
                            title="Edit package"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmCode(pkg.code)}
                            className="rounded-lg bg-white/20 p-1.5 hover:bg-red-400/60"
                            title="Delete package"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Price badge */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-sm font-semibold">
                          <IndianRupee className="h-3.5 w-3.5" />
                          {pkg.per_plate_rate > 0 ? pkg.per_plate_rate.toLocaleString('en-IN') : 'Custom'}
                          <span className="font-normal opacity-80">/plate</span>
                        </span>
                      </div>

                      {/* Category chips */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pkg.event_categories.map((cat) => (
                          <span
                            key={cat}
                            className="rounded-full border bg-white/20 px-2 py-0.5 text-xs font-medium"
                          >
                            {titleize(cat)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Menu items list */}
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      {pkg.items.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No items defined yet.</p>
                      ) : (
                        pkg.items.map((item, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                            <span className="text-sm text-slate-700">{item}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Add / Edit Package Dialog ── */}
          <Dialog open={isMenuDialogOpen} onOpenChange={setIsMenuDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{(localPackages ?? metadata?.menu_packages ?? []).some(p => p.code === editingPkg.code) ? 'Edit Package' : 'Add Package'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Package Name</Label>
                    <Input
                      value={editingPkg.label}
                      onChange={(e) => setEditingPkg({ ...editingPkg, label: e.target.value })}
                      placeholder="e.g. Grand Feast"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Per Plate Rate (₹)</Label>
                    <Input
                      type="number" min="0"
                      value={editingPkg.per_plate_rate}
                      onChange={(e) => setEditingPkg({ ...editingPkg, per_plate_rate: Number(e.target.value) })}
                      placeholder="0 = Custom"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Event Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {(metadata?.event_categories ?? ['corporate', 'social', 'group']).map((cat) => {
                      const active = editingPkg.event_categories.includes(cat as EventCategory);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? editingPkg.event_categories.filter((c) => c !== cat)
                              : [...editingPkg.event_categories, cat as EventCategory];
                            setEditingPkg({ ...editingPkg, event_categories: next });
                          }}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                            active ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-500'
                          }`}
                        >
                          {titleize(cat)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Menu Items</Label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {editingPkg.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <span className="flex-1 text-slate-700">{item}</span>
                        <button
                          type="button"
                          onClick={() => setEditingPkg({ ...editingPkg, items: editingPkg.items.filter((_, idx) => idx !== i) })}
                          className="text-rose-400 hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add item (e.g. Welcome drink)"
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newItemText.trim()) {
                          e.preventDefault();
                          setEditingPkg({ ...editingPkg, items: [...editingPkg.items, newItemText.trim()] });
                          setNewItemText('');
                        }
                      }}
                    />
                    <Button
                      type="button" variant="outline" size="icon"
                      disabled={!newItemText.trim()}
                      onClick={() => {
                        if (!newItemText.trim()) return;
                        setEditingPkg({ ...editingPkg, items: [...editingPkg.items, newItemText.trim()] });
                        setNewItemText('');
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsMenuDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (!editingPkg.label.trim()) {
                        toast.error('Package name is required');
                        return;
                      }
                      const base = localPackages ?? metadata?.menu_packages ?? [];
                      const exists = base.some((p) => p.code === editingPkg.code);
                      const next = exists
                        ? base.map((p) => (p.code === editingPkg.code ? editingPkg : p))
                        : [...base, editingPkg];
                      setLocalPackages(next);
                      setIsMenuDialogOpen(false);
                      toast.success(exists ? 'Package updated' : 'Package added');
                    }}
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Save Package
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Delete Confirmation Dialog ── */}
          <Dialog open={!!deleteConfirmCode} onOpenChange={(open) => { if (!open) setDeleteConfirmCode(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete Package?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-slate-600">
                Are you sure you want to remove this menu package? This is a local change and will not affect existing bookings.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setDeleteConfirmCode(null)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (!deleteConfirmCode) return;
                    const base = localPackages ?? metadata?.menu_packages ?? [];
                    setLocalPackages(base.filter((p) => p.code !== deleteConfirmCode));
                    setDeleteConfirmCode(null);
                    toast.success('Package removed');
                  }}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Banquet Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.7fr,0.9fr]">
              <div className="space-y-5">
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Event Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Event Date</Label>
                      <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Venue</Label>
                      <Select value={form.venue_id} onValueChange={(value) => setForm((current) => ({ ...current, venue_id: value, venue_slot_id: '' }))}>
                        <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                        <SelectContent>
                          {venues.map((venue) => (
                            <SelectItem key={venue.id} value={String(venue.id)}>
                              {venue.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Session</Label>
                      <Select value={form.venue_slot_id} onValueChange={(value) => setForm({ ...form, venue_slot_id: value })}>
                        <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                        <SelectContent>
                          {availableSlotsForVenue.map((slot) => (
                            <SelectItem key={slot.id} value={String(slot.id)}>
                              {slot.label} ({slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Banquet Type</Label>
                      <Select value={form.banquet_type} onValueChange={(value) => setForm({ ...form, banquet_type: value, linked_booking_id: '' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(metadata?.banquet_types ?? []).map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label} (GST {type.gst_percent}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Booking Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Event Category</Label>
                      <Select
                        value={form.event_category}
                        onValueChange={(value: EventCategory) => {
                          const nextPackage = metadata?.menu_packages.find((pkg) => pkg.event_categories.includes(value))?.code ?? 'deluxe';
                          setForm((current) => ({
                            ...current,
                            event_category: value,
                            event_sub_type: '',
                            menu_package: nextPackage,
                          }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(metadata?.event_categories ?? []).map((category) => (
                            <SelectItem key={category} value={category}>
                              {titleize(category)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sub-Type</Label>
                      <Select value={form.event_sub_type} onValueChange={(value) => setForm({ ...form, event_sub_type: value })}>
                        <SelectTrigger><SelectValue placeholder="Select subtype" /></SelectTrigger>
                        <SelectContent>
                          {(metadata?.event_sub_types?.[form.event_category] ?? []).map((subType) => (
                            <SelectItem key={subType} value={subType}>
                              {titleize(subType)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Guaranteed PAX</Label>
                      <Input type="number" min="1" value={form.guaranteed_pax} onChange={(e) => setForm({ ...form, guaranteed_pax: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Linked Room Booking</Label>
                      <Select
                        disabled={form.banquet_type !== 'with_room'}
                        value={form.linked_booking_id}
                        onValueChange={(value) => setForm({ ...form, linked_booking_id: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={form.banquet_type === 'with_room' ? "Select room booking" : "Only for with room"} />
                        </SelectTrigger>
                        <SelectContent>
                          {roomBookings
                            .filter(b => b.status !== 'CXL')
                            .map((b) => (
                              <SelectItem key={b.id} value={String(b.id)}>
                                #{b.id} - {b.guest_name} ({b.check_in ? format(new Date(b.check_in), 'MMM dd') : ''})
                              </SelectItem>
                            ))}
                          {roomBookings.length === 0 && (
                            <SelectItem value="none" disabled>No active room bookings</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

              </div>

              <div className="space-y-5 xl:self-start">
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Package & Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Menu Package</Label>
                      <Select
                        value={form.menu_package}
                        onValueChange={(value) => {
                          const pkg = metadata?.menu_packages.find((item) => item.code === value);
                          setForm({
                            ...form,
                            menu_package: value,
                            per_plate_rate: pkg?.per_plate_rate ? String(pkg.per_plate_rate) : form.per_plate_rate,
                            publish_rate: pkg?.per_plate_rate ? String(pkg.per_plate_rate) : form.publish_rate,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {packageOptions.map((pkg) => (
                            <SelectItem key={pkg.code} value={pkg.code}>
                              {pkg.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Publish Rate / Plate</Label>
                        <Input type="number" min="0" value={form.publish_rate} onChange={(e) => setForm({ ...form, publish_rate: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Net Per Plate</Label>
                        <Input type="number" min="0" value={form.per_plate_rate} onChange={(e) => setForm({ ...form, per_plate_rate: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Discount %</Label>
                        <Input type="number" min="0" max="100" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Hall Charges</Label>
                        <Input type="number" min="0" value={form.hall_charges} onChange={(e) => setForm({ ...form, hall_charges: e.target.value })} />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Venue Charges</Label>
                        <Input type="number" min="0" value={form.venue_charges} onChange={(e) => setForm({ ...form, venue_charges: e.target.value })} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Operational Notes</Label>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Function notes, setup remarks, custom menu instructions..."
                        className="min-h-[92px]"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Package Snapshot</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="font-semibold">{selectedPackage?.label ?? 'No package selected'}</div>
                      <div className="mt-1 text-slate-500">
                        Venue capacity: {selectedVenue ? `${selectedVenue.capacity_min ?? '--'} - ${selectedVenue.capacity_max ?? '--'} pax` : 'Select a venue'}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(selectedPackage?.items ?? ['Choose a package to view included menu items']).map((item) => (
                        <div key={item} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                          {item}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-slate-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Pricing Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <SummaryRow label="Billing PAX" value={guaranteedPax || 0} />
                    <SummaryRow label="Rate after discount" value={`Rs. ${formatCurrency(netPerPlate || 0)}`} />
                    <SummaryRow label="Taxable amount" value={`Rs. ${formatCurrency(taxableAmount || 0)}`} />
                    <SummaryRow label={`GST (${gstPct}%)`} value={`Rs. ${formatCurrency(gstAmount || 0)}`} />
                    <div className="border-t border-slate-200 pt-2">
                      <SummaryRow label="Gross amount" value={`Rs. ${formatCurrency(grossAmount || 0)}`} bold />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Create Booking
                  </span>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Banquet Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(value: BookingStatus) => setEditStatus(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(metadata?.statuses ?? []).filter((status) => status !== 'CXL').map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                  <SelectItem value="CXL">CXL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Actual PAX</Label>
              <Input type="number" min="0" value={editActualPax} onChange={(e) => setEditActualPax(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                onClick={() => {
                  if (!selectedBooking) return;
                  updateMutation.mutate({
                    id: selectedBooking.id,
                    status: editStatus,
                    actual_pax: editActualPax ? parseInt(editActualPax, 10) : null,
                  });
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Save Changes
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
