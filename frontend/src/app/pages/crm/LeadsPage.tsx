import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
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
import { Plus, Eye, Pencil, Trash2, AlertTriangle } from 'lucide-react';

interface Lead {
  id: number;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  lead_source: string | null;
  status: string;
  pipeline_stage: string;
  notes: string | null;
}

interface LeadsResponse {
  leads: Lead[];
}

const emptyForm = {
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  company: '',
  segment: 'room',
  inquiry_type: 'accommodation',
  lead_source: 'direct',
  notes: '',
};

const LeadsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDuplicateCheckOpen, setIsDuplicateCheckOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    company: '',
    lead_source: 'direct',
    status: 'new',
    notes: '',
  });

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: async () => {
      const response = await apiClient.get<LeadsResponse>('/api/crm/leads');
      return Array.isArray(response.data?.leads) ? response.data.leads : [];
    },
  });

  const checkDuplicateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/crm/leads/check-duplicate', data);
      return response.data;
    },
    onSuccess: (data: { matches?: unknown[]; duplicate?: boolean }) => {
      const matches = data.matches ?? [];
      if (data.duplicate && matches.length > 0) {
        setDuplicates(matches);
        setIsDuplicateCheckOpen(true);
      } else {
        createMutation.mutate({
          ...form,
          property_ids: selectedPropertyId ? [selectedPropertyId] : [],
        });
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/crm/leads', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully');
      setIsCreateDialogOpen(false);
      setIsDuplicateCheckOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to create lead'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm & { id: number }) => {
      const response = await apiClient.patch(`/api/crm/leads/${data.id}`, {
        contact_name: data.contact_name,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        company: data.company || null,
        lead_source: data.lead_source || null,
        status: data.status,
        notes: data.notes || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated successfully');
      setIsEditDialogOpen(false);
      setSelectedLead(null);
    },
    onError: () => toast.error('Failed to update lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      // Mark as lost — soft-delete via status field using existing PATCH
      await apiClient.patch(`/api/crm/leads/${id}`, {
        status: 'lost',
        lost_reason: 'Deleted by user',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead removed from list');
      setIsDeleteDialogOpen(false);
      setSelectedLead(null);
    },
    onError: () => toast.error('Failed to remove lead'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    checkDuplicateMutation.mutate({
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
    });
  };

  const openEdit = (lead: Lead) => {
    setSelectedLead(lead);
    setEditForm({
      contact_name: lead.contact_name,
      contact_email: lead.contact_email ?? '',
      contact_phone: lead.contact_phone ?? '',
      company: lead.company ?? '',
      lead_source: lead.lead_source ?? 'direct',
      status: lead.status,
      notes: lead.notes ?? '',
    });
    setIsEditDialogOpen(true);
  };

  const openDelete = (lead: Lead) => {
    setSelectedLead(lead);
    setIsDeleteDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'quotation_sent': return 'bg-purple-100 text-purple-800';
      case 'negotiating': return 'bg-orange-100 text-orange-800';
      case 'won': return 'bg-green-100 text-green-800';
      case 'lost': return 'bg-red-100 text-red-800';
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
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 mt-1">Manage sales leads and opportunities</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          New Lead
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No leads found. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.contact_name}</TableCell>
                    <TableCell>{lead.company ?? '—'}</TableCell>
                    <TableCell>{lead.contact_email ?? '—'}</TableCell>
                    <TableCell>{lead.contact_phone ?? '—'}</TableCell>
                    <TableCell className="capitalize">{lead.lead_source ?? 'direct'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(lead.status)}>
                        {lead.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/crm/leads/${lead.id}`)}
                          title="View"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(lead)}
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDelete(lead)}
                          title="Remove"
                          disabled={lead.status === 'lost'}
                        >
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

      {/* Create Lead Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Name *</Label>
              <Input id="contact_name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input id="contact_email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input id="contact_phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.lead_source} onValueChange={(value) => setForm({ ...form, lead_source: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={checkDuplicateMutation.isPending}>
                {checkDuplicateMutation.isPending ? 'Checking...' : 'Create Lead'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedLead) updateMutation.mutate({ ...editForm, id: selectedLead.id });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit_contact_name">Name *</Label>
              <Input id="edit_contact_name" value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_contact_email">Email</Label>
                <Input id="edit_contact_email" type="email" value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_contact_phone">Phone</Label>
                <Input id="edit_contact_phone" value={editForm.contact_phone} onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_company">Company</Label>
              <Input id="edit_company" value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={editForm.lead_source} onValueChange={(value) => setEditForm({ ...editForm, lead_source: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="quotation_sent">Quotation Sent</SelectItem>
                    <SelectItem value="negotiating">Negotiating</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea id="edit_notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Check Dialog */}
      <Dialog open={isDuplicateCheckOpen} onOpenChange={setIsDuplicateCheckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Potential Duplicates Found</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">We found similar leads. Do you want to proceed anyway?</p>
            <div className="space-y-2">
              {duplicates.map((dup: Record<string, unknown>, index: number) => (
                <div key={index} className="p-3 bg-gray-50 rounded border">
                  <p className="font-medium">{String(dup.contact_name ?? '')}</p>
                  <p className="text-sm text-gray-600">
                    {String(dup.contact_email ?? '')} • {String(dup.contact_phone ?? '')}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDuplicateCheckOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate({
                  ...form,
                  property_ids: selectedPropertyId ? [selectedPropertyId] : [],
                })}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Anyway'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Remove Lead
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove the lead for{' '}
              <span className="font-semibold">{selectedLead?.contact_name}</span>?
              This will mark the lead as <strong>Lost</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => selectedLead && deleteMutation.mutate(selectedLead.id)}
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

export default LeadsPage;
