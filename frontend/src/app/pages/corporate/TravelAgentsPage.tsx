import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';

interface TravelAgent {
  id: number;
  agency_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  commission_pct: number;
}

const emptyForm = {
  agency_name: '',
  contact_name: '',
  email: '',
  phone: '',
  commission_pct: '',
};

const TravelAgentsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<TravelAgent | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['travelAgents', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ travel_agents: TravelAgent[] }>(
        '/api/corporate/travel-agents'
      );
      return response.data.travel_agents ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post('/api/corporate/travel-agents', {
        agency_name: data.agency_name,
        contact_name: data.contact_name || null,
        email: data.email || null,
        phone: data.phone || null,
        commission_pct: parseFloat(data.commission_pct) || 0,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelAgents'] });
      toast.success('Travel agent created successfully');
      setIsCreateDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to create travel agent'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form & { id: number }) => {
      const response = await apiClient.put(`/api/corporate/travel-agents/${data.id}`, {
        agency_name: data.agency_name,
        contact_name: data.contact_name || null,
        email: data.email || null,
        phone: data.phone || null,
        commission_pct: parseFloat(data.commission_pct) || 0,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelAgents'] });
      toast.success('Travel agent updated successfully');
      setIsEditDialogOpen(false);
      setSelectedAgent(null);
    },
    onError: () => toast.error('Failed to update travel agent'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/corporate/travel-agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travelAgents'] });
      toast.success('Travel agent removed');
      setIsDeleteDialogOpen(false);
      setSelectedAgent(null);
    },
    onError: () => toast.error('Failed to remove travel agent'),
  });

  const openEdit = (agent: TravelAgent) => {
    setSelectedAgent(agent);
    setForm({
      agency_name: agent.agency_name,
      contact_name: agent.contact_name ?? '',
      email: agent.email ?? '',
      phone: agent.phone ?? '',
      commission_pct: String(agent.commission_pct),
    });
    setIsEditDialogOpen(true);
  };

  const openDelete = (agent: TravelAgent) => {
    setSelectedAgent(agent);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const AgentForm = ({ onSubmit, isPending, submitLabel }: { onSubmit: (e: React.FormEvent) => void; isPending: boolean; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agency_name">Agency Name *</Label>
        <Input id="agency_name" value={form.agency_name} onChange={(e) => setForm({ ...form, agency_name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact_name">Contact Person</Label>
        <Input id="contact_name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="commission_pct">Commission Rate (%)</Label>
        <Input id="commission_pct" type="number" step="0.01" min="0" max="100" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} />
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); setIsEditDialogOpen(false); }}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Agents</h1>
          <p className="text-gray-500 mt-1">Manage travel agent partnerships</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Travel Agent
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Travel Agents ({agents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No travel agents found. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agency Name</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Commission Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.agency_name}</TableCell>
                    <TableCell>{agent.contact_name ?? '—'}</TableCell>
                    <TableCell>{agent.email ?? '—'}</TableCell>
                    <TableCell>{agent.phone ?? '—'}</TableCell>
                    <TableCell>{agent.commission_pct}%</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(agent)} title="Edit">
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDelete(agent)} title="Delete">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Travel Agent</DialogTitle>
          </DialogHeader>
          <AgentForm
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            isPending={createMutation.isPending}
            submitLabel="Create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Travel Agent</DialogTitle>
          </DialogHeader>
          <AgentForm
            onSubmit={(e) => { e.preventDefault(); if (selectedAgent) updateMutation.mutate({ ...form, id: selectedAgent.id }); }}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Remove Travel Agent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <span className="font-semibold">{selectedAgent?.agency_name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => selectedAgent && deleteMutation.mutate(selectedAgent.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TravelAgentsPage;
