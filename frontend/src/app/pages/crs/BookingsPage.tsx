import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import { CheckCircle, Edit2, Eye, Plus, Send, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

type BookingRow = Record<string, unknown> & {
  id: number;
  status: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  total_amount?: number;
  ds_number?: string;
  primary_room_line_id?: number;
  check_in?: string;
  check_out?: string;
  room_types?: string;
  meal_plan?: string;
  total_adults?: number;
  total_children?: number;
  total_rooms?: number;
  special_notes?: string;
  booking_source?: string;
};

type RoomTypeOption = {
  id: number;
  category: string;
  base_rate_rbi: number;
  add_on_options?: Array<{
    code?: string;
    label?: string;
    price?: number | string;
    dish_details?: string;
  }>;
};

const BookingsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [newBooking, setNewBooking] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    room_type_id: '',
    meal_plan: '',
    check_in_date: '',
    check_out_date: '',
    num_adults: '1',
    num_children: '0',
    booker_type: 'individual',
    corporate_account_id: '',
    travel_agent_id: '',
  });

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ bookings: BookingRow[] }>('/api/crs/bookings', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.bookings ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: allRooms = [] } = useQuery({
    queryKey: ['rooms', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ rooms: any[] }>('/api/crs/rooms', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.rooms ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: roomTypes = [] } = useQuery<RoomTypeOption[]>({
    queryKey: ['roomTypes', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ room_types: RoomTypeOption[] }>(
        '/api/crs/room-types',
        {
          params: { property_id: selectedPropertyId },
        }
      );
      return response.data.room_types ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: mealPlans = [] } = useQuery({
    queryKey: ['mealPlans', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get('/api/meal-plans', {
        params: { property_id: selectedPropertyId },
      });
      return (response.data.meal_plans ?? []).map((mp: any) => ({
        code: mp.code,
        label: mp.name,
        price: Number(mp.per_person_rate) || 0
      }));
    },
    enabled: !!selectedPropertyId,
  });

  const { data: corporateAccounts = [] } = useQuery({
    queryKey: ['corporateAccounts'],
    queryFn: async () => {
      const response = await apiClient.get('/api/corporate/corporate-accounts');
      return response.data.accounts ?? [];
    },
  });

  const { data: travelAgents = [] } = useQuery({
    queryKey: ['travelAgents'],
    queryFn: async () => {
      const response = await apiClient.get('/api/corporate/travel-agents');
      return response.data.agents ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newBooking) => {
      if (!selectedPropertyId) throw new Error('Select a property');
      const roomType = roomTypes.find((item) => item.id === parseInt(data.room_type_id, 10));
      if (!roomType) throw new Error('Select a room type');
      const response = await apiClient.post('/api/crs/bookings', {
        property_id: selectedPropertyId,
        status: 'CONF-U',
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        guest_phone: data.guest_phone,
        booker_same_as_guest: data.booker_type === 'individual',
        booker_type: data.booker_type,
        corporate_account_id: data.booker_type === 'corporate' ? data.corporate_account_id : undefined,
        travel_agent_id: data.booker_type === 'travel_agent' ? data.travel_agent_id : undefined,
        lines: [
          {
            room_type_id: parseInt(data.room_type_id, 10),
            check_in: data.check_in_date,
            check_out: data.check_out_date,
            adults: parseInt(data.num_adults, 10) || 1,
            children: parseInt(data.num_children, 10) || 0,
            meal_plan: data.meal_plan,
            rate_type: 'RBI',
          },
        ],
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking created successfully');
      setIsCreateDialogOpen(false);
      setNewBooking({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        room_type_id: '',
        meal_plan: '',
        check_in_date: '',
        check_out_date: '',
        num_adults: '1',
        num_children: '0',
        booker_type: 'individual',
        corporate_account_id: '',
        travel_agent_id: '',
      });
    },
    onError: () => {
      toast.error('Failed to create booking');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ id, room_id }: { id: number; room_id: string }) => {
      if (!selectedBooking?.primary_room_line_id) {
        throw new Error('Room line not available for check-in');
      }
      const response = await apiClient.post(`/api/crs/bookings/${id}/check-in`, {
        room_line_id: selectedBooking.primary_room_line_id,
        room_id: parseInt(room_id, 10),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Guest checked in successfully');
      setIsCheckInDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to check in');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/api/crs/bookings/${id}/check-out`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Guest checked out successfully');
      setIsCheckOutDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to check out');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiClient.patch(`/api/crs/bookings/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking status updated');
      setIsStatusDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update status');
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (_: any) => {},
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate(newBooking);
  };

  const selectedCreateRoomType = roomTypes.find((item) => item.id === parseInt(newBooking.room_type_id || '0', 10));

  const availableMealPlans = mealPlans;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONF-P':
      case 'CONF-U':
      case 'SOLD':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'CI':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CO':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'CXL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'INQ':
      case 'QTN-HOLD':
      case 'TENT':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatStay = (booking: BookingRow) => {
    if (!booking.check_in || !booking.check_out) return 'Stay details not available';
    const checkIn = new Date(String(booking.check_in));
    const checkOut = new Date(String(booking.check_out));
    const nights = Math.max(1, differenceInCalendarDays(checkOut, checkIn));
    return `${format(checkIn, 'dd MMM yyyy')} - ${format(checkOut, 'dd MMM yyyy')} | ${nights} night${nights === 1 ? '' : 's'}`;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="mt-1 text-gray-500">Manage room reservations</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="INQ">Inquiry</SelectItem>
              <SelectItem value="QTN-HOLD">Hold</SelectItem>
              <SelectItem value="TENT">Tentative</SelectItem>
              <SelectItem value="CONF-U">Confirmed (Unpaid)</SelectItem>
              <SelectItem value="CONF-P">Confirmed (Paid)</SelectItem>
              <SelectItem value="CI">Checked In</SelectItem>
              <SelectItem value="CO">Checked Out</SelectItem>
              <SelectItem value="CXL">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Booking
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Stay</TableHead>
                <TableHead>Booked Details</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings
                .filter((b) => statusFilter === 'ALL' || b.status === statusFilter)
                .map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{String(booking.ds_number ?? `Booking #${booking.id}`)}</TableCell>
                  <TableCell>
                    <div>
                      <div>{String(booking.guest_name ?? '—')}</div>
                      <div className="text-sm text-gray-500">{String(booking.guest_phone ?? '')}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{formatStay(booking)}</div>
                    <div className="text-sm text-gray-500">Source: {String(booking.booking_source ?? 'direct')}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{String(booking.room_types ?? 'Room type not set')}</div>
                    <div className="text-sm text-gray-500">
                      {Number(booking.total_adults ?? 0)} adult(s), {Number(booking.total_children ?? 0)} child(ren)
                    </div>
                    <div className="text-sm text-gray-500">
                      Meal plan: {String(booking.meal_plan ?? 'ROOM_ONLY')} | Rooms: {Number(booking.total_rooms ?? 1)}
                    </div>
                  </TableCell>
                  <TableCell>₹{Number(booking.total_amount ?? 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(booking.status)}>{booking.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('room_booking_id', String(booking.id));
                            if (booking.lead_id) params.set('lead_id', String(booking.lead_id));
                            navigate(`/crm/quotes/new?${params.toString()}`);
                          }}
                          title="Send Quotation"
                          disabled={['CONF-U','CONF-P','CI','CO','CXL'].includes(booking.status)}
                        >
                          <Send className="h-4 w-4 text-indigo-600" />
                        </Button>
                        {['CONF-U', 'CONF-P', 'TENT'].includes(booking.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const params = new URLSearchParams();
                              params.set('room_booking_id', String(booking.id));
                              if (booking.lead_id) params.set('lead_id', String(booking.lead_id));
                              navigate(`/crm/quotes/new?${params.toString()}`);
                            }}
                            title="Generate Contract"
                          >
                            <FileText className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setStatusToUpdate(booking.status);
                          setIsStatusDialogOpen(true);
                        }}
                        title="Update Status"
                      >
                        <Edit2 className="h-4 w-4 text-slate-600" />
                      </Button>
                      {['TENT', 'CONF-U', 'CONF-P'].includes(booking.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsCheckInDialogOpen(true);
                          }}
                          title="Check In"
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {booking.status === 'CI' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsCheckOutDialogOpen(true);
                          }}
                          title="Check Out"
                        >
                          <XCircle className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedBooking ? String(selectedBooking.ds_number ?? `Booking #${selectedBooking.id}`) : 'Booking details'}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Guest</p>
                <p className="mt-1 font-semibold text-gray-900">{String(selectedBooking.guest_name ?? '—')}</p>
                <p className="text-sm text-gray-600">{String(selectedBooking.guest_phone ?? '—')}</p>
                <p className="text-sm text-gray-600">{String(selectedBooking.guest_email ?? '—')}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Stay</p>
                <p className="mt-1 font-semibold text-gray-900">{formatStay(selectedBooking)}</p>
                <p className="text-sm text-gray-600">Status: {selectedBooking.status}</p>
                <p className="text-sm text-gray-600">
                  Amount: ₹{Number(selectedBooking.total_amount ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Room Details</p>
                <p className="mt-1 font-semibold text-gray-900">{String(selectedBooking.room_types ?? '—')}</p>
                <p className="text-sm text-gray-600">Meal plan: {String(selectedBooking.meal_plan ?? 'ROOM_ONLY')}</p>
                <p className="text-sm text-gray-600">
                  Guests: {Number(selectedBooking.total_adults ?? 0)} adult(s), {Number(selectedBooking.total_children ?? 0)} child(ren)
                </p>
                <p className="text-sm text-gray-600">Rooms: {Number(selectedBooking.total_rooms ?? 1)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                  {String(selectedBooking.special_notes ?? 'No additional notes')}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guest_name">Guest Name</Label>
                <Input
                  id="guest_name"
                  value={newBooking.guest_name}
                  onChange={(event) => setNewBooking({ ...newBooking, guest_name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_email">Email</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={newBooking.guest_email}
                  onChange={(event) => setNewBooking({ ...newBooking, guest_email: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_phone">Phone</Label>
                <Input
                  id="guest_phone"
                  value={newBooking.guest_phone}
                  onChange={(event) => setNewBooking({ ...newBooking, guest_phone: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="booker_type">Booker Type</Label>
                <Select
                  value={newBooking.booker_type}
                  onValueChange={(value) => setNewBooking({ ...newBooking, booker_type: value, corporate_account_id: '', travel_agent_id: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select booker type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="travel_agent">Travel Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newBooking.booker_type === 'corporate' && (
                <div className="space-y-2">
                  <Label htmlFor="corporate_account_id">Corporate Account</Label>
                  <Select
                    value={newBooking.corporate_account_id}
                    onValueChange={(value) => setNewBooking({ ...newBooking, corporate_account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select corporate account" />
                    </SelectTrigger>
                    <SelectContent>
                      {corporateAccounts.map((acc: any) => (
                        <SelectItem key={acc.id} value={acc.id.toString()}>
                          {acc.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {newBooking.booker_type === 'travel_agent' && (
                <div className="space-y-2">
                  <Label htmlFor="travel_agent_id">Travel Agent</Label>
                  <Select
                    value={newBooking.travel_agent_id}
                    onValueChange={(value) => setNewBooking({ ...newBooking, travel_agent_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select travel agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {travelAgents.map((ag: any) => (
                        <SelectItem key={ag.id} value={ag.id.toString()}>
                          {ag.agency_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="room_type_id">Room Type</Label>
                <Select
                  value={newBooking.room_type_id}
                  onValueChange={(value) => setNewBooking({ ...newBooking, room_type_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.category} - ₹{type.base_rate_rbi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meal_plan">Meal Plan</Label>
                <Select
                  value={newBooking.meal_plan}
                  onValueChange={(value) => setNewBooking({ ...newBooking, meal_plan: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select meal plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMealPlans.map((plan, index) => (
                      <SelectItem key={`${plan.code ?? 'PLAN'}-${index}`} value={String(plan.code ?? 'CUSTOM')}>
                        {String(plan.code ?? 'PLAN')} - {String(plan.label ?? 'Custom plan')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="check_in_date">Check In</Label>
                <Input
                  id="check_in_date"
                  type="date"
                  value={newBooking.check_in_date}
                  onChange={(event) => setNewBooking({ ...newBooking, check_in_date: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check_out_date">Check Out</Label>
                <Input
                  id="check_out_date"
                  type="date"
                  value={newBooking.check_out_date}
                  onChange={(event) => setNewBooking({ ...newBooking, check_out_date: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_adults">Adults</Label>
                <Input
                  id="num_adults"
                  type="number"
                  value={newBooking.num_adults}
                  onChange={(event) => setNewBooking({ ...newBooking, num_adults: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_children">Children</Label>
                <Input
                  id="num_children"
                  type="number"
                  value={newBooking.num_children}
                  onChange={(event) => setNewBooking({ ...newBooking, num_children: event.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Booking'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In Guest</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const room_id = formData.get('room_id') as string;
              if (selectedBooking) {
                checkInMutation.mutate({ id: selectedBooking.id, room_id });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="room_id">Select Room</Label>
              <Select name="room_id" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select available room" />
                </SelectTrigger>
                <SelectContent>
                  {allRooms
                    .filter((r) => {
                      // Filter rooms that match the booked room type
                      const line = selectedBooking?.room_types; // Note: row.room_types is a string aggregation in this view
                      // We should ideally have the room_type_id in the booking row, but let's try to match by category
                      return r.room_type_category === selectedBooking?.room_types && r.status === 'available';
                    })
                    .map((room) => (
                      <SelectItem key={room.id} value={room.id.toString()}>
                        Room {room.room_number} ({room.room_type_category})
                      </SelectItem>
                    ))}
                  {allRooms.filter(r => r.room_type_category === selectedBooking?.room_types && r.status === 'available').length === 0 && (
                    <SelectItem value="none" disabled>No available rooms found</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setIsCheckInDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={checkInMutation.isPending}>
                {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Booking Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusToUpdate} onValueChange={setStatusToUpdate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INQ">Inquiry</SelectItem>
                  <SelectItem value="QTN-HOLD">Hold</SelectItem>
                  <SelectItem value="TENT">Tentative</SelectItem>
                  <SelectItem value="CONF-U">Confirmed (Unpaid)</SelectItem>
                  <SelectItem value="CONF-P">Confirmed (Paid)</SelectItem>
                  <SelectItem value="CXL">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedBooking) {
                    updateStatusMutation.mutate({ id: selectedBooking.id, status: statusToUpdate });
                  }
                }}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Are you sure you want to check out this guest?</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setIsCheckOutDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedBooking) {
                    checkOutMutation.mutate(selectedBooking.id);
                  }
                }}
                disabled={checkOutMutation.isPending}
              >
                {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingsPage;
