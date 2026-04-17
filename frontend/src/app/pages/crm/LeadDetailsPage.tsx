import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ActionPoint {
  id: number;
  description: string;
  due_date: string;
  status: string;
  created_at: string;
}

const LeadDetailsPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isActionPointDialogOpen, setIsActionPointDialogOpen] = useState(false);
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false);
  const [newActionPoint, setNewActionPoint] = useState({
    description: '',
    due_date: '',
  });
  const [newQuotation, setNewQuotation] = useState({
    valid_until: '',
    items: '',
    total_amount: '',
    notes: '',
  });

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crm/leads/${id}`);
      return response.data;
    },
  });

  const { data: actionPoints } = useQuery({
    queryKey: ['actionPoints', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crm/leads/${id}`);
      return response.data.action_points || [];
    },
  });

  const createActionPointMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(`/api/crm/leads/${id}/action-points`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionPoints', id] });
      toast.success('Action point created');
      setIsActionPointDialogOpen(false);
      setNewActionPoint({ description: '', due_date: '' });
    },
    onError: () => {
      toast.error('Failed to create action point');
    },
  });

  const updateActionPointMutation = useMutation({
    mutationFn: async ({ actionPointId, status }: { actionPointId: number; status: string }) => {
      const response = await apiClient.patch(`/api/crm/action-points/${actionPointId}`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actionPoints', id] });
      toast.success('Action point updated');
    },
    onError: () => {
      toast.error('Failed to update action point');
    },
  });

  const createQuotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const items = data.items.split('\n').filter(Boolean).map((item: string) => {
        const [description, amount] = item.split('|');
        return {
          description: description.trim(),
          amount: parseFloat(amount.trim()),
        };
      });

      const response = await apiClient.post('/api/crm/quotations', {
        lead_id: parseInt(id!),
        valid_until: data.valid_until,
        items,
        total_amount: parseFloat(data.total_amount),
        notes: data.notes,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Quotation created successfully');
      setIsQuotationDialogOpen(false);
      setNewQuotation({ valid_until: '', items: '', total_amount: '', notes: '' });
    },
    onError: () => {
      toast.error('Failed to create quotation');
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/crm/leads')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead?.name}</h1>
          <p className="text-gray-500">{lead?.company}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{lead?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{lead?.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium capitalize">{lead?.source}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge>{lead?.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{lead?.notes || 'No notes available'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="actions">
        <TabsList>
          <TabsTrigger value="actions">Action Points</TabsTrigger>
          <TabsTrigger value="quotations">Quotations</TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Action Points</CardTitle>
              <Button onClick={() => setIsActionPointDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Action
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actionPoints?.length > 0 ? (
                  actionPoints.map((action: ActionPoint) => (
                    <div key={action.id} className="flex items-center justify-between p-4 bg-gray-50 rounded border">
                      <div className="flex-1">
                        <p className="font-medium">{action.description}</p>
                        <p className="text-sm text-gray-500">
                          Due: {format(new Date(action.due_date), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge>{action.status}</Badge>
                        {action.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => updateActionPointMutation.mutate({
                              actionPointId: action.id,
                              status: 'completed',
                            })}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No action points yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quotations">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quotations</CardTitle>
              <Button onClick={() => setIsQuotationDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Quotation
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">No quotations created yet</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Point Dialog */}
      <Dialog open={isActionPointDialogOpen} onOpenChange={setIsActionPointDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action Point</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createActionPointMutation.mutate(newActionPoint);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newActionPoint.description}
                onChange={(e) => setNewActionPoint({ ...newActionPoint, description: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={newActionPoint.due_date}
                onChange={(e) => setNewActionPoint({ ...newActionPoint, due_date: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsActionPointDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createActionPointMutation.isPending}>
                {createActionPointMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quotation Dialog */}
      <Dialog open={isQuotationDialogOpen} onOpenChange={setIsQuotationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Quotation</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createQuotationMutation.mutate(newQuotation);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="valid_until">Valid Until</Label>
              <Input
                id="valid_until"
                type="date"
                value={newQuotation.valid_until}
                onChange={(e) => setNewQuotation({ ...newQuotation, valid_until: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="items">Items (one per line: description | amount)</Label>
              <Textarea
                id="items"
                value={newQuotation.items}
                onChange={(e) => setNewQuotation({ ...newQuotation, items: e.target.value })}
                placeholder="Room booking | 5000&#10;Banquet hall | 10000"
                rows={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_amount">Total Amount (₹)</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={newQuotation.total_amount}
                onChange={(e) => setNewQuotation({ ...newQuotation, total_amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newQuotation.notes}
                onChange={(e) => setNewQuotation({ ...newQuotation, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsQuotationDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createQuotationMutation.isPending}>
                {createQuotationMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadDetailsPage;
