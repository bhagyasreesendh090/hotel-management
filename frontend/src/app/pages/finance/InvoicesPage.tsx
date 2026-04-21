import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Pencil, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useProperty } from '../../context/PropertyContext';

interface Invoice {
  id: number;
  ds_number: string | null;
  invoice_date: string | null;
  sub_total: number;
  gst_total: number;
  total_amount: number;
  balance_due: number;
  status: string;
  booking_id: number | null;
}

const InvoicesPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [newInvoice, setNewInvoice] = useState({
    booking_id: '',
    issue_date: '',
    due_date: '',
    amount: '',
    tax_amount: '',
    total_amount: '',
    notes: '',
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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/finance/invoices', {
        ...data,
        booking_id: data.booking_id ? parseInt(data.booking_id) : null,
        amount: parseFloat(data.amount),
        tax_amount: parseFloat(data.tax_amount),
        total_amount: parseFloat(data.total_amount),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created');
      setIsCreateDialogOpen(false);
      setNewInvoice({ booking_id: '', issue_date: '', due_date: '', amount: '', tax_amount: '', total_amount: '', notes: '' });
    },
    onError: () => toast.error('Failed to create invoice'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
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

  const openStatusDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setNewStatus(invoice.status);
    setIsStatusDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      case 'outstanding': return 'bg-yellow-100 text-yellow-800';
      case 'void': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 mt-1">Manage billing and invoices</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No invoices found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Booking</TableHead>
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
                    <TableCell className="font-medium">
                      {invoice.ds_number ?? `#${invoice.id}`}
                    </TableCell>
                    <TableCell>
                      {invoice.invoice_date
                        ? format(new Date(invoice.invoice_date), 'MMM dd, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {invoice.booking_id ? `#${invoice.booking_id}` : '—'}
                    </TableCell>
                    <TableCell>₹{Number(invoice.sub_total ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell>₹{Number(invoice.gst_total ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="font-medium">₹{Number(invoice.total_amount ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className={Number(invoice.balance_due) > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>
                      ₹{Number(invoice.balance_due ?? 0).toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.status !== 'void' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStatusDialog(invoice)}
                          title="Update Status"
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
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

      {/* Status Update Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Invoice Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Invoice: <span className="font-medium">{selectedInvoice?.ds_number ?? `#${selectedInvoice?.id}`}</span>
              {' '} — Total: <span className="font-medium">₹{Number(selectedInvoice?.total_amount ?? 0).toLocaleString('en-IN')}</span>
            </p>
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outstanding">Outstanding</SelectItem>
                  <SelectItem value="partial">Partial Payment</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="void">
                    <span className="text-red-600">Void (cancel invoice)</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newStatus === 'void' && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">
                  Voiding an invoice is irreversible. Use this only for erroneous invoices.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
              <Button
                variant={newStatus === 'void' ? 'destructive' : 'default'}
                onClick={() => {
                  if (selectedInvoice) {
                    updateStatusMutation.mutate({ id: selectedInvoice.id, status: newStatus });
                  }
                }}
                disabled={updateStatusMutation.isPending || newStatus === selectedInvoice?.status}
              >
                {updateStatusMutation.isPending ? 'Saving...' : 'Update Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newInvoice); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="booking_id">Booking ID (optional)</Label>
              <Input id="booking_id" type="number" value={newInvoice.booking_id} onChange={(e) => setNewInvoice({ ...newInvoice, booking_id: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issue_date">Issue Date</Label>
                <Input id="issue_date" type="date" value={newInvoice.issue_date} onChange={(e) => setNewInvoice({ ...newInvoice, issue_date: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input id="amount" type="number" step="0.01" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_amount">Tax (₹)</Label>
                <Input id="tax_amount" type="number" step="0.01" value={newInvoice.tax_amount} onChange={(e) => setNewInvoice({ ...newInvoice, tax_amount: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_amount">Total (₹)</Label>
                <Input id="total_amount" type="number" step="0.01" value={newInvoice.total_amount} onChange={(e) => setNewInvoice({ ...newInvoice, total_amount: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={newInvoice.notes} onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicesPage;
