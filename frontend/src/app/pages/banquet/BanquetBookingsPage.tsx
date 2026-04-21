import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, XCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type BanquetBooking = Record<string, unknown> & { id: number; status: string };

const emptyForm = {
  venue_id: '',
  event_category: 'social' as 'corporate' | 'social' | 'group',
  event_date: '',
  guaranteed_pax: '',
  notes: '',
};

const BanquetBookingsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BanquetBooking | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editStatus, setEditStatus] = useState('');
  const [editPax, setEditPax] = useState('');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['banquetBookings', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ banquet_bookings: BanquetBooking[] }>(
        '/api/banquet/banquet-bookings',
        { params: { property_id: selectedPropertyId } }
      );
      return response.data.banquet_bookings ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: venues = [] } = useQuery({
    queryKey: ['venues', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ venues: Record<string, unknown>[] }>('/api/banquet/venues', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.venues ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post('/api/banquet/banquet-bookings', {
        property_id: selectedPropertyId,
        venue_id: parseInt(data.venue_id, 10),
        event_date: data.event_date,
        event_category: data.event_category,
        guaranteed_pax: data.guaranteed_pax ? parseInt(data.guaranteed_pax, 10) : null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banquetBookings'] });
      toast.success('Booking created successfully');
      setIsCreateDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'Failed to create booking';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, guaranteed_pax }: { id: number; status: string; guaranteed_pax?: number | null }) => {
      const response = await apiClient.patch(`/api/banquet/banquet-bookings/${id}`, {
        status,
        ...(guaranteed_pax !== undefined ? { guaranteed_pax } : {}),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banquetBookings'] });
      toast.success('Booking updated');
      setIsEditDialogOpen(false);
      setIsCancelDialogOpen(false);
      setSelectedBooking(null);
    },
    onError: () => toast.error('Failed to update booking'),
  });

  const openEdit = (booking: BanquetBooking) => {
    setSelectedBooking(booking);
    setEditStatus(booking.status);
    setEditPax(booking.guaranteed_pax != null ? String(booking.guaranteed_pax) : '');
    setIsEditDialogOpen(true);
  };

  const openCancel = (booking: BanquetBooking) => {
    setSelectedBooking(booking);
    setIsCancelDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONF-P':
      case 'CONF-U': return 'bg-green-100 text-green-800';
      case 'TENT':
      case 'QTN-HOLD': return 'bg-yellow-100 text-yellow-800';
      case 'CXL': return 'bg-red-100 text-red-800';
      case 'INQ': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-50 text-blue-800';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banquet Bookings</h1>
          <p className="text-gray-500 mt-1">Manage event bookings</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Booking
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No banquet bookings found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venue</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">{String(booking.venue_name ?? '—')}</TableCell>
                    <TableCell className="capitalize">{String(booking.event_category ?? '')}</TableCell>
                    <TableCell>
                      {booking.event_date
                        ? format(new Date(String(booking.event_date)), 'MMM dd, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>{booking.guaranteed_pax != null ? String(booking.guaranteed_pax) : '—'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(String(booking.status ?? ''))}>
                        {String(booking.status ?? '')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {booking.status !== 'CXL' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(booking)}
                              title="Edit Status / Pax"
                            >
                              <Pencil className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openCancel(booking)}
                              title="Cancel Booking"
                            >
                              <XCircle className="w-4 h-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Booking Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Banquet Booking</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Venue *</Label>
                <Select value={form.venue_id} onValueChange={(value) => setForm({ ...form, venue_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                  <SelectContent>
                    {venues.map((venue) => (
                      <SelectItem key={venue.id as number} value={String(venue.id)}>
                        {String(venue.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event Category *</Label>
                <Select value={form.event_category} onValueChange={(value: 'corporate' | 'social' | 'group') => setForm({ ...form, event_category: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_date">Event Date *</Label>
                <Input id="event_date" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guaranteed_pax">Expected Guests</Label>
                <Input id="guaranteed_pax" type="number" value={form.guaranteed_pax} onChange={(e) => setForm({ ...form, guaranteed_pax: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Booking'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Booking</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INQ">Inquiry (INQ)</SelectItem>
                  <SelectItem value="QTN-HOLD">Quotation Hold (QTN-HOLD)</SelectItem>
                  <SelectItem value="TENT">Tentative (TENT)</SelectItem>
                  <SelectItem value="CONF-U">Confirmed Unpaid (CONF-U)</SelectItem>
                  <SelectItem value="CONF-P">Confirmed Paid (CONF-P)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_pax">Guaranteed Pax</Label>
              <Input id="edit_pax" type="number" value={editPax} onChange={(e) => setEditPax(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (selectedBooking) {
                    updateMutation.mutate({
                      id: selectedBooking.id,
                      status: editStatus,
                      guaranteed_pax: editPax ? parseInt(editPax, 10) : null,
                    });
                  }
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Cancel Booking
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel the banquet booking at{' '}
              <span className="font-semibold">{String(selectedBooking?.venue_name ?? '')}</span> on{' '}
              <span className="font-semibold">
                {selectedBooking?.event_date
                  ? format(new Date(String(selectedBooking.event_date)), 'MMM dd, yyyy')
                  : '—'}
              </span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>Keep Booking</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedBooking) updateMutation.mutate({ id: selectedBooking.id, status: 'CXL' });
                }}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BanquetBookingsPage;
