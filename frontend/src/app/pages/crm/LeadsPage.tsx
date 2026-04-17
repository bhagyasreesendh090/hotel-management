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
import { Plus, Eye } from 'lucide-react';

interface Lead {
  id: number;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  lead_source: string | null;
  status: string;
  pipeline_stage: string;
}

interface LeadsResponse {
  leads: Lead[];
}

const LeadsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDuplicateCheckOpen, setIsDuplicateCheckOpen] = useState(false);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [newLead, setNewLead] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    company: '',
    segment: 'room',
    inquiry_type: 'accommodation',
    lead_source: 'direct',
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
    onSuccess: (data) => {
      if (data.duplicates && data.duplicates.length > 0) {
        setDuplicates(data.duplicates);
        setIsDuplicateCheckOpen(true);
      } else {
        createMutation.mutate(newLead);
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
      setNewLead({
        name: '',
        email: '',
        phone: '',
        company: '',
        source: 'website',
        notes: '',
      });
    },
    onError: () => {
      toast.error('Failed to create lead');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkDuplicateMutation.mutate({
      contact_email: newLead.contact_email,
      contact_phone: newLead.contact_phone,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'quotation_sent':
        return 'bg-purple-100 text-purple-800';
      case 'negotiating':
        return 'bg-orange-100 text-orange-800';
      case 'won':
        return 'bg-green-100 text-green-800';
      case 'lost':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Lead
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Leads</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
              <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.contact_name}</TableCell>
                  <TableCell>{lead.company}</TableCell>
                  <TableCell>{lead.contact_email}</TableCell>
                  <TableCell>{lead.contact_phone}</TableCell>
                  <TableCell className="capitalize">{lead.lead_source || 'direct'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/crm/leads/${lead.id}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Name</Label>
              <Input
                id="contact_name"
                value={newLead.contact_name}
                onChange={(e) => setNewLead({ ...newLead, contact_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={newLead.contact_email}
                onChange={(e) => setNewLead({ ...newLead, contact_email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Phone</Label>
              <Input
                id="contact_phone"
                value={newLead.contact_phone}
                onChange={(e) => setNewLead({ ...newLead, contact_phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={newLead.company}
                onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead_source">Source</Label>
              <Select
                value={newLead.lead_source}
                onValueChange={(value) => setNewLead({ ...newLead, lead_source: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <Textarea
                id="notes"
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={checkDuplicateMutation.isPending}>
                {checkDuplicateMutation.isPending ? 'Checking...' : 'Create Lead'}
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
            <p className="text-sm text-gray-600">
              We found similar leads. Do you want to proceed anyway?
            </p>
            <div className="space-y-2">
              {duplicates.map((dup, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded border">
                  <p className="font-medium">{dup.name}</p>
                  <p className="text-sm text-gray-600">{dup.email} • {dup.phone}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDuplicateCheckOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => createMutation.mutate(newLead)} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Anyway'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsPage;
