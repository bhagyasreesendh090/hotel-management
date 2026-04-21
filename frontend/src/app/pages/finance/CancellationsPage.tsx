import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useProperty } from '../../context/PropertyContext';

const CancellationsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCancellation, setNewCancellation] = useState({
    booking_id: '',
    cancellation_date: '',
    refund_amount: '',
    cancellation_fee: '',
    reason: '',
  });

  const { data: cancellations = [], isLoading } = useQuery({
    queryKey: ['cancellations', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ cancellations: Record<string, unknown>[] }>(
        '/api/finance/cancellations',
        {
          params: { property_id: selectedPropertyId },
        }
      );
      return response.data.cancellations ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newCancellation) => {
      const response = await apiClient.post('/api/finance/cancellations', {
        booking_id: parseInt(data.booking_id, 10),
        amount_forfeited: parseFloat(data.cancellation_fee) || 0,
        refund_due: parseFloat(data.refund_amount) || 0,
        notes: data.reason || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancellations'] });
      toast.success('Cancellation created');
      setIsCreateDialogOpen(false);
      setNewCancellation({
        booking_id: '',
        cancellation_date: '',
        refund_amount: '',
        cancellation_fee: '',
        reason: '',
      });
    },
    onError: () => {
      toast.error('Failed to create cancellation');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.patch(`/api/finance/cancellations/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cancellations'] });
      toast.success('Cancellation approved');
    },
    onError: () => {
      toast.error('Failed to approve cancellation');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newCancellation);
  };

  const getStatusColor = (approved: boolean) =>
    approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cancellations</h1>
          <p className="text-gray-500 mt-1">Manage booking cancellations and refunds</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Cancellation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cancellations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking ID</TableHead>
                <TableHead>Cancelled at</TableHead>
                <TableHead>Refund due</TableHead>
                <TableHead>Forfeited</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cancellations.map((cancellation: Record<string, unknown>) => {
                const approved = Boolean(cancellation.finance_approved);
                return (
                  <TableRow key={cancellation.id as number}>
                    <TableCell className="font-medium">#{cancellation.booking_id as number}</TableCell>
                    <TableCell>
                      {cancellation.cancelled_at
                        ? format(new Date(String(cancellation.cancelled_at)), 'MMM dd, yyyy')
                        : '—'}
                    </TableCell>
                    <TableCell>₹{Number(cancellation.refund_due ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell>₹{Number(cancellation.amount_forfeited ?? 0).toLocaleString('en-IN')}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {String(cancellation.notes ?? '—')}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(approved)}>
                        {approved ? 'Approved' : 'Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {!approved && (
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(cancellation.id as number)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Cancellation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="booking_id">Booking ID</Label>
              <Input
                id="booking_id"
                type="number"
                value={newCancellation.booking_id}
                onChange={(e) => setNewCancellation({ ...newCancellation, booking_id: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancellation_date">Cancellation Date</Label>
              <Input
                id="cancellation_date"
                type="date"
                value={newCancellation.cancellation_date}
                onChange={(e) => setNewCancellation({ ...newCancellation, cancellation_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="refund_amount">Refund Amount (₹)</Label>
              <Input
                id="refund_amount"
                type="number"
                step="0.01"
                value={newCancellation.refund_amount}
                onChange={(e) => setNewCancellation({ ...newCancellation, refund_amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancellation_fee">Cancellation Fee (₹)</Label>
              <Input
                id="cancellation_fee"
                type="number"
                step="0.01"
                value={newCancellation.cancellation_fee}
                onChange={(e) => setNewCancellation({ ...newCancellation, cancellation_fee: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={newCancellation.reason}
                onChange={(e) => setNewCancellation({ ...newCancellation, reason: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CancellationsPage;
