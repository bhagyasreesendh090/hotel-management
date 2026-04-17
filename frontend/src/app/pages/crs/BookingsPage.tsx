import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Eye, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Booking {
  id: number;
  booking_code: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  room_type_name: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_amount: number;
}

const BookingsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCheckInDialogOpen, setIsCheckInDialogOpen] = useState(false);
  const [isCheckOutDialogOpen, setIsCheckOutDialogOpen] = useState(false);
  const [newBooking, setNewBooking] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    room_type_id: '',
    check_in_date: '',
    check_out_date: '',
    num_adults: '1',
    num_children: '0',
    total_amount: '',
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get('/api/crs/bookings', {
        params: { property_id: selectedPropertyId },
      });
      return response.data;
    },
    enabled: !!selectedPropertyId,
  });

  const { data: roomTypes } = useQuery({
    queryKey: ['roomTypes', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get('/api/crs/room-types', {
        params: { property_id: selectedPropertyId },
      });
      return response.data;
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/crs/bookings', {
        ...data,
        property_id: selectedPropertyId,
        room_type_id: parseInt(data.room_type_id),
        num_adults: parseInt(data.num_adults),
        num_children: parseInt(data.num_children),
        total_amount: parseFloat(data.total_amount),
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
        check_in_date: '',
        check_out_date: '',
        num_adults: '1',
        num_children: '0',
        total_amount: '',
      });
    },
    onError: () => {
      toast.error('Failed to create booking');
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
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ id, room_id }: { id: number; room_id: string }) => {
      const response = await apiClient.post(`/api/crs/bookings/${id}/check-in`, {
        room_id: parseInt(room_id),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newBooking);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'checked_in':
        return 'bg-blue-100 text-blue-800';
      case 'checked_out':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };


  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 mt-1">Manage room reservations</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
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
                <TableHead>Booking Code</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room Type</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings?.map((booking: Booking) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium">{booking.booking_code}</TableCell>
                  <TableCell>
                    <div>
                      <div>{booking.guest_name}</div>
                      <div className="text-sm text-gray-500">{booking.guest_phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>{booking.room_type_name}</TableCell>
                  <TableCell>{format(new Date(booking.check_in_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{format(new Date(booking.check_out_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>₹{booking.total_amount}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status.replace('_', ' ')}
                    </Badge>
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
                        <Eye className="w-4 h-4" />
                      </Button>
                      {booking.status === 'confirmed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsCheckInDialogOpen(true);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                      {booking.status === 'checked_in' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsCheckOutDialogOpen(true);
                          }}
                        >
                          <XCircle className="w-4 h-4 text-blue-600" />
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

      {/* Create Booking Dialog */}
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
                  onChange={(e) => setNewBooking({ ...newBooking, guest_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_email">Email</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={newBooking.guest_email}
                  onChange={(e) => setNewBooking({ ...newBooking, guest_email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_phone">Phone</Label>
                <Input
                  id="guest_phone"
                  value={newBooking.guest_phone}
                  onChange={(e) => setNewBooking({ ...newBooking, guest_phone: e.target.value })}
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
                    {roomTypes?.map((type: any) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name} - ₹{type.base_rate}
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
                  onChange={(e) => setNewBooking({ ...newBooking, check_in_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="check_out_date">Check Out</Label>
                <Input
                  id="check_out_date"
                  type="date"
                  value={newBooking.check_out_date}
                  onChange={(e) => setNewBooking({ ...newBooking, check_out_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_adults">Adults</Label>
                <Input
                  id="num_adults"
                  type="number"
                  value={newBooking.num_adults}
                  onChange={(e) => setNewBooking({ ...newBooking, num_adults: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num_children">Children</Label>
                <Input
                  id="num_children"
                  type="number"
                  value={newBooking.num_children}
                  onChange={(e) => setNewBooking({ ...newBooking, num_children: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total Amount (₹)</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={newBooking.total_amount}
                  onChange={(e) => setNewBooking({ ...newBooking, total_amount: e.target.value })}
                  required
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

      {/* Check In Dialog */}
      <Dialog open={isCheckInDialogOpen} onOpenChange={setIsCheckInDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check In Guest</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
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

      {/* Check Out Dialog */}
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
