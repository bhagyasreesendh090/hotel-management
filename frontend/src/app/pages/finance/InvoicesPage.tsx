import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, Plus } from 'lucide-react';
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
import { toast } from 'sonner';

type InvoiceStatus = 'outstanding' | 'partial' | 'paid' | 'cancelled';

type Invoice = {
  id: number;
  ds_number: string | null;
  invoice_date: string | null;
  sub_total: number;
  gst_total: number;
  total_amount: number;
  balance_due: number;
  status: InvoiceStatus;
  booking_id: number | null;
  banquet_booking_id: number | null;
  banquet_event_category?: string | null;
  banquet_event_sub_type?: string | null;
  banquet_venue_name?: string | null;
};

type BanquetBooking = {
  id: number;
  event_date: string;
  status: string;
  guaranteed_pax: number | null;
  actual_pax: number | null;
  venue_name: string;
  event_category: string | null;
  event_sub_type: string | null;
  menu_package: string | null;
  pricing?: {
    per_plate_rate?: number;
    hall_charges?: number;
    venue_charges?: number;
  };
  gst_split?: {
    gst_pct?: number;
  };
};

const today = format(new Date(), 'yyyy-MM-dd');

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleize(value: string | null | undefined) {
  if (!value) return '--';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function InvoicesPage() {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newStatus, setNewStatus] = useState<InvoiceStatus>('outstanding');
  const [newInvoice, setNewInvoice] = useState({
    banquet_booking_id: '',
    invoice_date: today,
    transaction_date: today,
    advance_applied: '',
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ invoices: Invoice[] }>('/api/finance/invoices', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.invoices ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: banquetBookings = [] } = useQuery({
    queryKey: ['invoiceBanquetBookings', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ banquet_bookings: BanquetBooking[] }>('/api/banquet/banquet-bookings', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.banquet_bookings ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const invoiceCandidates = useMemo(
    () =>
      banquetBookings.filter((booking) => booking.status === 'CONF-U' || booking.status === 'CONF-P'),
    [banquetBookings]
  );

  const selectedBanquetBooking = useMemo(
    () => invoiceCandidates.find((booking) => String(booking.id) === newInvoice.banquet_booking_id) ?? null,
    [invoiceCandidates, newInvoice.banquet_booking_id]
  );

  const billingPax = Math.max(Number(selectedBanquetBooking?.guaranteed_pax ?? 0), Number(selectedBanquetBooking?.actual_pax ?? 0), 0);
  const perPlateRate = Number(selectedBanquetBooking?.pricing?.per_plate_rate ?? 0);
  const hallCharges = Number(selectedBanquetBooking?.pricing?.hall_charges ?? 0);
  const venueCharges = Number(selectedBanquetBooking?.pricing?.venue_charges ?? 0);
  const subTotal = perPlateRate * billingPax + hallCharges + venueCharges;
  const gstPercent = Number(selectedBanquetBooking?.gst_split?.gst_pct ?? 0);
  const gstTotal = subTotal * (gstPercent / 100);
  const grandTotal = subTotal + gstTotal;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPropertyId) throw new Error('No property selected');
      const response = await apiClient.post('/api/finance/invoices', {
        property_id: selectedPropertyId,
        banquet_booking_id: parseInt(newInvoice.banquet_booking_id, 10),
        invoice_date: newInvoice.invoice_date,
        transaction_date: newInvoice.transaction_date,
        advance_applied: newInvoice.advance_applied ? parseFloat(newInvoice.advance_applied) : 0,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Banquet invoice created');
      setIsCreateDialogOpen(false);
      setNewInvoice({ banquet_booking_id: '', invoice_date: today, transaction_date: today, advance_applied: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error ?? 'Failed to create invoice');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: InvoiceStatus }) => {
      const response = await apiClient.patch(`/api/finance/invoices/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice status updated');
      setIsStatusDialogOpen(false);
      setSelectedInvoice(null);
    },
    onError: () => toast.error('Failed to update invoice status'),
  });

  const getStatusColor = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      case 'outstanding':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-1 text-gray-500">Generate banquet invoices directly from confirmed events.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Banquet Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No invoices found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Sub-Total</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.ds_number ?? `#${invoice.id}`}</TableCell>
                    <TableCell>{invoice.invoice_date ? format(new Date(invoice.invoice_date), 'MMM dd, yyyy') : '--'}</TableCell>
                    <TableCell>
                      <div className="font-medium">{invoice.banquet_venue_name ?? `Booking #${invoice.booking_id ?? '--'}`}</div>
                      <div className="text-xs text-slate-500">
                        {titleize(invoice.banquet_event_category)} / {titleize(invoice.banquet_event_sub_type)}
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(invoice.sub_total)}</TableCell>
                    <TableCell>{formatCurrency(invoice.gst_total)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(invoice.total_amount)}</TableCell>
                    <TableCell className={Number(invoice.balance_due) > 0 ? 'font-medium text-red-600' : 'text-green-600'}>
                      {formatCurrency(invoice.balance_due)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setNewStatus(invoice.status);
                            setIsStatusDialogOpen(true);
                          }}
                        >
                          Update
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Banquet Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2 md:col-span-3">
                <Label>Confirmed Banquet Booking</Label>
                <Select value={newInvoice.banquet_booking_id} onValueChange={(value) => setNewInvoice({ ...newInvoice, banquet_booking_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select confirmed event" /></SelectTrigger>
                  <SelectContent>
                    {invoiceCandidates.map((booking) => (
                      <SelectItem key={booking.id} value={String(booking.id)}>
                        {booking.venue_name} - {titleize(booking.event_category)} / {titleize(booking.event_sub_type)} - {format(new Date(booking.event_date), 'MMM dd, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input type="date" value={newInvoice.invoice_date} onChange={(e) => setNewInvoice({ ...newInvoice, invoice_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Transaction Date</Label>
                <Input type="date" value={newInvoice.transaction_date} onChange={(e) => setNewInvoice({ ...newInvoice, transaction_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Advance Applied</Label>
                <Input type="number" step="0.01" min="0" value={newInvoice.advance_applied} onChange={(e) => setNewInvoice({ ...newInvoice, advance_applied: e.target.value })} />
              </div>
            </div>

            <Card className="border-slate-200 bg-slate-50">
              <CardHeader>
                <CardTitle className="text-base">Invoice Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Billing PAX</span><span>{billingPax}</span></div>
                <div className="flex justify-between"><span>Per plate</span><span>{formatCurrency(perPlateRate)}</span></div>
                <div className="flex justify-between"><span>Hall charges</span><span>{formatCurrency(hallCharges)}</span></div>
                <div className="flex justify-between"><span>Venue charges</span><span>{formatCurrency(venueCharges)}</span></div>
                <div className="flex justify-between"><span>Sub-total</span><span>{formatCurrency(subTotal)}</span></div>
                <div className="flex justify-between"><span>GST ({gstPercent}%)</span><span>{formatCurrency(gstTotal)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !newInvoice.banquet_booking_id}>
                {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Invoice Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Invoice: <span className="font-medium">{selectedInvoice?.ds_number ?? `#${selectedInvoice?.id}`}</span>{' '}
              Total: <span className="font-medium">{formatCurrency(Number(selectedInvoice?.total_amount ?? 0))}</span>
            </p>
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(value: InvoiceStatus) => setNewStatus(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newStatus === 'cancelled' && (
              <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-sm text-red-700">Use cancelled only for invalid or voided invoices.</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
              <Button
                variant={newStatus === 'cancelled' ? 'destructive' : 'default'}
                onClick={() => selectedInvoice && updateStatusMutation.mutate({ id: selectedInvoice.id, status: newStatus })}
                disabled={updateStatusMutation.isPending || newStatus === selectedInvoice?.status}
              >
                {updateStatusMutation.isPending ? 'Saving...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
