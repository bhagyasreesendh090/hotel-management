import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, format } from 'date-fns';
import { BedDouble, CalendarRange, ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

type DaySummary = {
  date: string;
  total_available: number;
  total_booked: number;
  total_blocked: number;
};

type RoomTypeRow = {
  room_type_id: number;
  category: string;
  base_rate_rbi: number;
  occupancy_max: number;
  total_rooms: number;
  add_on_options?: Array<{
    code?: string;
    label?: string;
    price?: number | string;
    dish_details?: string;
  }>;
  days: Record<string, { available_units: number; booked_units: number; blocked_units: number }>;
};

type AvailabilityResponse = {
  property: {
    id: number;
    code: string;
    name: string;
    advance_rule_note?: string | null;
    cancellation_policy_default?: string | null;
  };
  month: string;
  room_types: RoomTypeRow[];
  summary: DaySummary[];
};

type PublicProperty = {
  id: number;
  code: string;
  name: string;
  slug: string;
};

const advanceModes = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'btc', label: 'BTC' },
];

function toMonthValue(date: Date) {
  return format(date, 'yyyy-MM');
}

function monthStart(monthValue: string) {
  return new Date(`${monthValue}-01T00:00:00`);
}

function formatCurrency(value: number) {
  return `Rs ${Number(value || 0).toLocaleString('en-IN')}`;
}

const PublicBookingPage: React.FC = () => {
  const { propertyRef = '' } = useParams();
  const queryClient = useQueryClient();
  const normalizedPropertyRef = String(propertyRef || '').trim();
  const hasUsablePropertyRef =
    normalizedPropertyRef.length > 0 && normalizedPropertyRef.toLowerCase() !== 'propertycode';
  const [month, setMonth] = useState(() => toMonthValue(new Date()));
  const [form, setForm] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    room_type_id: '',
    check_in: format(new Date(), 'yyyy-MM-dd'),
    nights: '1',
    adults: '2',
    children: '0',
    meal_plan: 'ROOM_ONLY',
    advance_received: '0',
    advance_mode: 'cash',
    payment_reference: '',
    special_notes: '',
  });

  const propertiesQuery = useQuery<{ properties: PublicProperty[] }>({
    queryKey: ['public-properties'],
    queryFn: async () => {
      const response = await apiClient.get<{ properties: PublicProperty[] }>('/api/public/properties');
      return response.data;
    },
  });

  const availabilityQuery = useQuery<AvailabilityResponse>({
    queryKey: ['public-availability', propertyRef, month],
    enabled: hasUsablePropertyRef,
    queryFn: async () => {
      const response = await apiClient.get<AvailabilityResponse>(
        `/api/public/properties/${propertyRef}/monthly-availability`,
        { params: { month } }
      );
      return response.data;
    },
  });

  const selectedRoomType =
    availabilityQuery.data?.room_types.find((roomType) => String(roomType.room_type_id) === form.room_type_id) ??
    null;
  const availableMealPlans =
    Array.isArray(selectedRoomType?.add_on_options) && selectedRoomType.add_on_options.length > 0
      ? selectedRoomType.add_on_options
      : [
          { code: 'ROOM_ONLY', label: 'Room only' },
          { code: 'CP', label: 'CP' },
          { code: 'MAP', label: 'MAP' },
          { code: 'AP', label: 'AP' },
          { code: 'CUSTOM', label: 'Custom' },
        ];
  const pax = Math.max(1, Number(form.adults || 0) + Number(form.children || 0));
  const nights = Math.max(1, Number(form.nights || 1));
  const estimatedBase = Number(selectedRoomType?.base_rate_rbi ?? 0) * pax * nights;
  const estimatedGst = estimatedBase * (Number(selectedRoomType?.base_rate_rbi ?? 0) <= 7500 ? 0.05 : 0.18);
  const estimatedTotal = estimatedBase + estimatedGst;

  const bookingMutation = useMutation({
    mutationFn: async () => {
      const checkOut = format(addDays(new Date(`${form.check_in}T00:00:00`), nights), 'yyyy-MM-dd');
      const response = await apiClient.post(`/api/public/properties/${propertyRef}/bookings`, {
        guest_name: form.guest_name,
        guest_phone: form.guest_phone,
        guest_email: form.guest_email || null,
        room_type_id: Number(form.room_type_id),
        check_in: form.check_in,
        check_out: checkOut,
        adults: Number(form.adults),
        children: Number(form.children),
        meal_plan: form.meal_plan,
        advance_received: Number(form.advance_received || 0),
        advance_mode: form.advance_mode,
        payment_reference: form.payment_reference || null,
        special_notes: form.special_notes || null,
      });
      return response.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['public-availability', propertyRef] });
      toast.success(`Booking saved as ${data?.booking?.status ?? 'TENT'} and inventory updated.`);
      setForm((current) => ({
        ...current,
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        payment_reference: '',
        special_notes: '',
        advance_received: '0',
      }));
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error ?? 'Failed to create booking');
    },
  });

  const summary = availabilityQuery.data?.summary ?? [];
  const roomTypes = availabilityQuery.data?.room_types ?? [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,240,214,0.95),_rgba(251,247,240,0.96)_42%,_#f6f2eb_100%)] text-stone-900">
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-6 lg:px-8">
        {!hasUsablePropertyRef ? (
          <div className="grid gap-6">
            <div className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/80 px-5 py-6 shadow-[0_24px_80px_rgba(120,83,38,0.12)] backdrop-blur md:px-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900">
                <BedDouble className="h-3.5 w-3.5" />
                Public Booking
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
                Choose a property
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 md:text-base">
                Open the booking board by property name. Do not use the old placeholder `PROPERTYCODE`.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(propertiesQuery.data?.properties ?? []).map((property) => (
                <Link
                  key={property.id}
                  to={`/public/book/${property.slug}`}
                  className="rounded-[24px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_16px_40px_rgba(92,71,38,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(92,71,38,0.14)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Property</p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-950">{property.name}</h2>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/80 shadow-[0_24px_80px_rgba(120,83,38,0.12)] backdrop-blur">
              <div className="grid gap-6 px-5 py-6 md:px-8 lg:grid-cols-[1.4fr_0.9fr]">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900">
                    <BedDouble className="h-3.5 w-3.5" />
                    Sales Booking Link
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
                    {availabilityQuery.data?.property?.name ?? 'Property availability board'}
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 md:text-base">
                    Share this page with your sales team to check daily room availability and book immediately. Every
                    new booking reduces the live availability on this board.
                  </p>
                </div>
                <div className="grid gap-3 rounded-[24px] bg-stone-950 p-5 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center gap-3">
                    <CalendarRange className="h-5 w-5 text-amber-300" />
                    <div>
                      <p className="text-sm text-stone-300">Live estimate</p>
                      <p className="text-2xl font-semibold">{formatCurrency(estimatedTotal)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-stone-400">Room type</p>
                      <p className="mt-1 text-lg font-semibold">{selectedRoomType?.category ?? 'Not selected'}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-stone-400">Nights</p>
                      <p className="mt-1 text-lg font-semibold">{nights}</p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-stone-400">Guests</p>
                      <p className="mt-1 text-lg font-semibold">{pax}</p>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-stone-400">
                    Estimate uses the existing base rate logic from the CRS and applies GST automatically.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
              <section className="overflow-hidden rounded-[28px] border border-stone-200/70 bg-white/88 shadow-[0_18px_55px_rgba(92,71,38,0.1)]">
                <div className="flex flex-col gap-4 border-b border-stone-200/80 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Availability Matrix</p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-950">{format(monthStart(month), 'MMMM yyyy')}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-stone-300 bg-transparent"
                      onClick={() => setMonth(toMonthValue(addMonths(monthStart(month), -1)))}
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-stone-300 bg-transparent"
                      onClick={() => setMonth(toMonthValue(addMonths(monthStart(month), 1)))}
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {availabilityQuery.isLoading ? (
                  <div className="flex min-h-[320px] items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
                  </div>
                ) : availabilityQuery.isError ? (
                  <div className="px-6 py-10 text-sm text-red-700">Unable to load public availability for this property.</div>
                ) : (
                  <div className="overflow-x-auto px-3 pb-5 pt-4 md:px-4">
                    <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 min-w-[220px] border border-stone-300 bg-stone-100 px-3 py-3 text-left font-semibold">
                            Room type / occupancy
                          </th>
                          {summary.map((day) => (
                            <th key={day.date} className="min-w-[58px] border border-stone-300 bg-stone-100 px-2 py-2">
                              <div>{format(new Date(`${day.date}T00:00:00`), 'd')}</div>
                              <div className="text-[11px] font-normal text-stone-500">
                                {format(new Date(`${day.date}T00:00:00`), 'EEE')}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {roomTypes.map((roomType) => (
                          <tr key={roomType.room_type_id}>
                            <td className="sticky left-0 z-10 border border-stone-300 bg-white px-3 py-3 text-left align-middle">
                              <div className="font-semibold text-stone-900">{roomType.category}</div>
                              <div className="text-xs text-stone-500">{roomType.occupancy_max} pax</div>
                            </td>
                            {summary.map((day) => {
                              const cell = roomType.days[day.date];
                              const available = Number(cell?.available_units ?? 0);
                              return (
                                <td
                                  key={`${roomType.room_type_id}-${day.date}`}
                                  className={`border px-2 py-2 font-medium ${
                                    available === 0
                                      ? 'border-red-200 bg-red-50 text-red-700'
                                      : available <= 2
                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                        : 'border-stone-300 bg-white text-stone-800'
                                  }`}
                                >
                                  {available}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        <tr>
                          <td className="sticky left-0 z-10 border border-stone-300 bg-stone-950 px-3 py-3 text-left font-semibold text-white">
                            Rooms Available
                          </td>
                          {summary.map((day) => (
                            <td key={`available-${day.date}`} className="border border-stone-300 bg-stone-950 px-2 py-2 font-semibold text-white">
                              {day.total_available}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="sticky left-0 z-10 border border-stone-300 bg-stone-800 px-3 py-3 text-left font-semibold text-stone-100">
                            Rooms Booked
                          </td>
                          {summary.map((day) => (
                            <td key={`booked-${day.date}`} className="border border-stone-300 bg-stone-800 px-2 py-2 font-semibold text-stone-100">
                              {day.total_booked}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-stone-200/70 bg-white/88 p-5 shadow-[0_18px_55px_rgba(92,71,38,0.1)] md:p-6">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-amber-100 p-3 text-amber-900">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Create booking</p>
                    <h2 className="mt-2 text-2xl font-semibold text-stone-950">Reserve from this link</h2>
                  </div>
                </div>

                <form
                  className="mt-6 grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    bookingMutation.mutate();
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="guest_name">Guest name</Label>
                      <Input
                        id="guest_name"
                        value={form.guest_name}
                        onChange={(event) => setForm({ ...form, guest_name: event.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="guest_phone">Phone</Label>
                      <Input
                        id="guest_phone"
                        value={form.guest_phone}
                        onChange={(event) => setForm({ ...form, guest_phone: event.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="guest_email">Email</Label>
                    <Input
                      id="guest_email"
                      type="email"
                      value={form.guest_email}
                      onChange={(event) => setForm({ ...form, guest_email: event.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Room type</Label>
                      <Select value={form.room_type_id} onValueChange={(value) => setForm({ ...form, room_type_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select room type" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomTypes.map((roomType) => (
                            <SelectItem key={roomType.room_type_id} value={String(roomType.room_type_id)}>
                          {roomType.category} | {formatCurrency(roomType.base_rate_rbi)}
                        </SelectItem>
                      ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Meal plan</Label>
                      <Select value={form.meal_plan} onValueChange={(value) => setForm({ ...form, meal_plan: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select meal plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableMealPlans.map((mealPlan, index) => (
                            <SelectItem key={`${mealPlan.code ?? 'PLAN'}-${index}`} value={String(mealPlan.code ?? 'CUSTOM')}>
                              {String(mealPlan.code ?? 'PLAN')} | {String(mealPlan.label ?? 'Custom plan')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="check_in">Check-in</Label>
                      <Input
                        id="check_in"
                        type="date"
                        value={form.check_in}
                        onChange={(event) => setForm({ ...form, check_in: event.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nights">Nights</Label>
                      <Input
                        id="nights"
                        type="number"
                        min="1"
                        value={form.nights}
                        onChange={(event) => setForm({ ...form, nights: event.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="adults">Adults</Label>
                      <Input
                        id="adults"
                        type="number"
                        min="1"
                        value={form.adults}
                        onChange={(event) => setForm({ ...form, adults: event.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="children">Children</Label>
                      <Input
                        id="children"
                        type="number"
                        min="0"
                        value={form.children}
                        onChange={(event) => setForm({ ...form, children: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="checkout_preview">Check-out</Label>
                      <Input
                        id="checkout_preview"
                        value={format(addDays(new Date(`${form.check_in}T00:00:00`), nights), 'yyyy-MM-dd')}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="advance_received">Advance received</Label>
                      <Input
                        id="advance_received"
                        type="number"
                        min="0"
                        value={form.advance_received}
                        onChange={(event) => setForm({ ...form, advance_received: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Advance mode</Label>
                      <Select value={form.advance_mode} onValueChange={(value) => setForm({ ...form, advance_mode: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                          {advanceModes.map((mode) => (
                            <SelectItem key={mode.value} value={mode.value}>
                              {mode.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_reference">Payment reference</Label>
                    <Input
                      id="payment_reference"
                      value={form.payment_reference}
                      onChange={(event) => setForm({ ...form, payment_reference: event.target.value })}
                      placeholder="UPI / card / bank ref"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="special_notes">Additional notes</Label>
                    <Textarea
                      id="special_notes"
                      value={form.special_notes}
                      onChange={(event) => setForm({ ...form, special_notes: event.target.value })}
                      placeholder="Special request, extra instruction, pickup note, food preference..."
                      rows={4}
                    />
                  </div>

                  <div className="rounded-[24px] bg-stone-100 p-4 text-sm text-stone-700">
                    <p className="font-semibold text-stone-900">Current property note</p>
                    <p className="mt-1 leading-6">
                      {availabilityQuery.data?.property?.advance_rule_note ||
                        availabilityQuery.data?.property?.cancellation_policy_default ||
                        'No advance or cancellation note has been configured yet.'}
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={bookingMutation.isPending || !form.room_type_id}
                    className="h-12 rounded-2xl bg-stone-950 text-white hover:bg-stone-800"
                  >
                    {bookingMutation.isPending ? 'Saving booking...' : 'Book and update inventory'}
                  </Button>
                </form>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PublicBookingPage;
