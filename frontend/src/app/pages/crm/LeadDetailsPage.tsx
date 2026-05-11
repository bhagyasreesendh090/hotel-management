import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, 
  Plus, 
  CheckCircle, 
  FileText, 
  FileSignature, 
  Calendar, 
  Mail, 
  History 
} from 'lucide-react';

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
  const { selectedPropertyId } = useProperty();
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

  const { data, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crm/leads/${id}`);
      return response.data;
    },
  });

  const leadData = data?.lead;
  const quotations = data?.quotations || [];
  const contracts = data?.contracts || [];

  const { data: actionPoints } = useQuery({
    queryKey: ['actionPoints', id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/crm/leads/${id}`);
      return response.data.action_points || [];
    },
  });

  const createActionPointMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(`/api/crm/leads/${id}/action-points`, {
        task: data.description,
        due_date: data.due_date,
      });
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
        property_id: selectedPropertyId,
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
          <h1 className="text-2xl font-bold text-gray-900">{leadData?.contact_name}</h1>
          <p className="text-gray-500">{leadData?.company}</p>
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
              <p className="font-medium">{leadData?.contact_email || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Phone</p>
              <p className="font-medium">{leadData?.contact_phone || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Source</p>
              <p className="font-medium capitalize">{leadData?.lead_source || 'direct'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge>{leadData?.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{leadData?.notes || 'No notes available'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="actions">
        <TabsList className="bg-stone-100 p-1 rounded-xl">
          <TabsTrigger value="actions" className="rounded-lg">Action Points</TabsTrigger>
          <TabsTrigger value="quotations" className="rounded-lg">Room Quotations</TabsTrigger>
          <TabsTrigger value="contracts" className="rounded-lg">Banquet Contracts</TabsTrigger>
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
                              status: 'done',
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
              <div>
                <CardTitle>Room Quotations</CardTitle>
                <p className="text-xs text-stone-500 mt-1">Best for room blocks and individual stay proposals.</p>
              </div>
              <Button 
                onClick={() => navigate(`/crm/quotes/new?lead_id=${id}`)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Build Room Quotation
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quotations.length > 0 ? (
                  quotations.map((quote: any) => (
                    <div key={quote.id} className="flex items-center justify-between p-4 bg-gray-50 rounded border">
                      <div className="flex-1">
                         <div className="flex items-center gap-2">
                           <p className="font-semibold text-indigo-700">{quote.quotation_number}</p>
                           <Badge variant="outline" className="bg-white uppercase">{quote.status}</Badge>
                         </div>
                         <p className="text-sm text-gray-500 mt-1">₹{Number(quote.final_amount).toLocaleString('en-IN')} • {quote.valid_until ? `Valid until ${format(new Date(quote.valid_until), 'MMM dd')}` : 'No expiry set'}</p>
                      </div>
                      <div className="flex gap-2">
                         {quote.secure_token && (
                            <Button variant="outline" size="sm" onClick={() => window.open(`/public/quote/${quote.secure_token}`, '_blank')}>
                              View Link
                            </Button>
                         )}
                         <Button size="sm" onClick={() => navigate(`/crm/quotes/${quote.id}/edit?lead_id=${id}`)}>
                            Edit
                         </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No quotations created yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="contracts">
          <Card className="rounded-[24px] border-stone-200/80 shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Banquet Contracts</CardTitle>
                <p className="text-xs text-stone-500 mt-1">Formal legal agreements for venues and catering.</p>
              </div>
              <Button 
                onClick={() => navigate(`/crm/contracts/new?lead_id=${id}`)}
                className="bg-stone-950 hover:bg-black text-white rounded-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Build Banquet Contract
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {contracts.length > 0 ? (
                  contracts.map((contract: any) => (
                    <div key={contract.id} className="flex items-center justify-between p-4 bg-stone-50/50 rounded-2xl border border-stone-200/60">
                      <div className="flex-1">
                         <div className="flex items-center gap-2">
                           <p className="font-bold text-stone-900">{contract.contract_number}</p>
                           <Badge variant="secondary" className="bg-white text-[10px] font-bold uppercase tracking-wider border-stone-200">
                             {contract.status}
                           </Badge>
                         </div>
                         <p className="text-xs text-stone-500 mt-1 flex items-center gap-2">
                           <Calendar className="h-3 w-3" />
                           ₹{Number(contract.total_value).toLocaleString('en-IN')} • Signed: {contract.signed_at ? format(new Date(contract.signed_at), 'MMM dd') : 'Pending'}
                         </p>
                      </div>
                      <div className="flex gap-2">
                         {contract.secure_token && (
                            <Button variant="ghost" size="sm" className="text-stone-600 hover:text-stone-900" onClick={() => window.open(`/public/contract/${contract.secure_token}`, '_blank')}>
                              Preview
                            </Button>
                         )}
                         <Button variant="outline" size="sm" className="rounded-full border-stone-200" onClick={() => navigate(`/crm/contracts/${contract.id}/edit?lead_id=${id}`)}>
                            Edit
                         </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-stone-400 text-center py-12 text-sm italic">No contracts drafted yet for this event.</p>
                )}
              </div>
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
    </div>
  );
};

export default LeadDetailsPage;
