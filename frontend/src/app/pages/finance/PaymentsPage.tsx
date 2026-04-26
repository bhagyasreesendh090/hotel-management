import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';

type Invoice = {
  id: number;
  ds_number: string;
  total_amount: number;
  balance_due: number;
  status: string;
  booking_id: number | null;
  banquet_booking_id: number | null;
  banquet_venue_name?: string | null;
};

type Payment = {
  id: number;
  created_at: string;
  booking_id: number | null;
  banquet_booking_id: number | null;
  amount: number;
  mode: string;
  payment_type: string;
  reference: string | null;
};

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PaymentsPage() {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    invoice_id: '',
    amount: '',
    mode: 'cash',
    payment_type: 'advance',
    reference: '',
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ payments: Payment[] }>('/api/finance/payments', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.payments ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ invoices: Invoice[] }>('/api/finance/invoices', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.invoices ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/api/finance/payments', {
        invoice_id: parseInt(newPayment.invoice_id, 10),
        amount: parseFloat(newPayment.amount),
        mode: newPayment.mode,
        payment_type: newPayment.payment_type,
        reference: newPayment.reference || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Payment recorded');
      setIsCreateDialogOpen(false);
      setNewPayment({ invoice_id: '', amount: '', mode: 'cash', payment_type: 'advance', reference: '' });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error ?? 'Failed to record payment');
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-gray-500">Record banquet invoice payments and keep balances in sync.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Record Payment
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No payments recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recorded At</TableHead>
                  <TableHead>Linked Booking</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.created_at ? format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm') : '--'}</TableCell>
                    <TableCell className="font-medium">
                      {payment.banquet_booking_id ? `Banquet #${payment.banquet_booking_id}` : payment.booking_id ? `Booking #${payment.booking_id}` : '--'}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="capitalize">{payment.mode.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="capitalize">{payment.payment_type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{payment.reference || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Invoice Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Invoice</Label>
              <Select value={newPayment.invoice_id} onValueChange={(value) => setNewPayment({ ...newPayment, invoice_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select invoice" /></SelectTrigger>
                <SelectContent>
                  {invoices.filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'cancelled').map((invoice) => (
                    <SelectItem key={invoice.id} value={String(invoice.id)}>
                      {invoice.ds_number} - {invoice.banquet_venue_name ?? `Invoice #${invoice.id}`} - Balance {formatCurrency(invoice.balance_due)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newPayment.mode} onValueChange={(value) => setNewPayment({ ...newPayment, mode: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="btc">BTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={newPayment.payment_type} onValueChange={(value) => setNewPayment({ ...newPayment, payment_type: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="balance">Balance</SelectItem>
                    <SelectItem value="full_prepay">Full Prepay</SelectItem>
                    <SelectItem value="refund">Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input value={newPayment.reference} onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })} placeholder="Txn id / cheque no / remarks" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !newPayment.invoice_id}>
                {createMutation.isPending ? 'Recording...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
