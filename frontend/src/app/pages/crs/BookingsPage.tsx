import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import { CheckCircle, Eye, Plus, XCircle } from 'lucide-react';
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    room_type_id: '',
    meal_plan: 'ROOM_ONLY',
    check_in_date: '',
    check_out_date: '',
    num_adults: '1',
    num_children: '0',
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof newBooking) => {
      if (!selectedPropertyId) throw new Error('Select a property');
      const roomType = roomTypes.find((item) => item.id === parseInt(data.room_type_id, 10));
      if (!roomType) throw new Error('Select a room type');
      const response = await apiClient.post('/api/crs/bookings', {
        property_id: selectedPropertyId,
        guest_name: data.guest_name,
        guest_email: data.guest_email,
        guest_phone: data.guest_phone,
        booker_same_as_guest: true,
        booker_type: 'individual',
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
        meal_plan: 'ROOM_ONLY',
        check_in_date: '',
        check_out_date: '',
        num_adults: '1',
        num_children: '0',
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate(newBooking);
  };

  const selectedCreateRoomType = roomTypes.find((item) => item.id === parseInt(newBooking.room_type_id || '0', 10));
  const availableMealPlans =
    Array.isArray(selectedCreateRoomType?.add_on_options) && selectedCreateRoomType.add_on_options.length > 0
      ? selectedCreateRoomType.add_on_options
      : [
          { code: 'ROOM_ONLY', label: 'Room only' },
          { code: 'CP', label: 'CP' },
          { code: 'MAP', label: 'MAP' },
          { code: 'AP', label: 'AP' },
          { code: 'CUSTOM', label: 'Custom' },
        ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONF-P':
      case 'CONF-U':
        return 'bg-green-100 text-green-800';
      case 'CI':
        return 'bg-blue-100 text-blue-800';
      case 'CO':
        return 'bg-gray-100 text-gray-800';
      case 'CXL':
        return 'bg-red-100 text-red-800';
      case 'INQ':
      case 'QTN-HOLD':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-slate-100 text-slate-800';
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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Booking
        </Button>
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
              {bookings.map((booking) => (
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
                      {['TENT', 'CONF-U', 'CONF-P'].includes(booking.status) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsCheckInDialogOpen(true);
                          }}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedBooking ? String(selectedBooking.ds_number ?? `Booking #${selectedBooking.id}`) : 'Booking details'}
            </DialogTitle>
          </DialogHeader>
          {selectedBooking ? (
            <div className="grid gap-4 md:grid-cols-2">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex justify-end gap-2">
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
              <Label htmlFor="room_id">Room Number</Label>
              <Input id="room_id" name="room_id" required placeholder="Enter room ID" />
            </div>
            <div className="flex justify-end gap-2">
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

      <Dialog open={isCheckOutDialogOpen} onOpenChange={setIsCheckOutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check Out Guest</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Are you sure you want to check out this guest?</p>
            <div className="flex justify-end gap-2">
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
