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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';

interface Venue {
  id: number;
  name: string;
  venue_type: string;
  capacity_min: number | null;
  capacity_max: number | null;
  floor_plan_notes: string | null;
}

const emptyForm = {
  name: '',
  description: '',
  capacity_min: '',
  capacity_max: '',
};

const VenuesPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ venues: Venue[] }>('/api/banquet/venues', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.venues ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const cap = parseInt(data.capacity_max, 10) || 0;
      const capMin = data.capacity_min ? parseInt(data.capacity_min, 10) : Math.max(1, Math.floor(cap * 0.5));
      const response = await apiClient.post('/api/banquet/venues', {
        property_id: selectedPropertyId,
        name: data.name,
        venue_type: 'banquet_hall',
        capacity_min: capMin,
        capacity_max: Math.max(cap, 1),
        floor_plan_notes: data.description || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue created successfully');
      setIsCreateDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to create venue'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form & { id: number }) => {
      const response = await apiClient.put(`/api/banquet/venues/${data.id}`, {
        name: data.name,
        capacity_min: data.capacity_min ? parseInt(data.capacity_min, 10) : null,
        capacity_max: data.capacity_max ? parseInt(data.capacity_max, 10) : null,
        floor_plan_notes: data.description || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue updated successfully');
      setIsEditDialogOpen(false);
      setSelectedVenue(null);
    },
    onError: () => toast.error('Failed to update venue'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/banquet/venues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      toast.success('Venue removed');
      setIsDeleteDialogOpen(false);
      setSelectedVenue(null);
    },
    onError: () => toast.error('Failed to remove venue'),
  });

  const openEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    setForm({
      name: venue.name,
      description: venue.floor_plan_notes ?? '',
      capacity_min: venue.capacity_min != null ? String(venue.capacity_min) : '',
      capacity_max: venue.capacity_max != null ? String(venue.capacity_max) : '',
    });
    setIsEditDialogOpen(true);
  };

  const openDelete = (venue: Venue) => {
    setSelectedVenue(venue);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const VenueForm = ({ onSubmit, isPending, submitLabel }: { onSubmit: (e: React.FormEvent) => void; isPending: boolean; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="venue_name">Venue Name *</Label>
        <Input id="venue_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="capacity_min">Min Capacity</Label>
          <Input id="capacity_min" type="number" min="1" value={form.capacity_min} onChange={(e) => setForm({ ...form, capacity_min: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity_max">Max Capacity *</Label>
          <Input id="capacity_max" type="number" min="1" value={form.capacity_max} onChange={(e) => setForm({ ...form, capacity_max: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="venue_description">Description / Notes</Label>
        <Textarea id="venue_description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setIsCreateDialogOpen(false); setIsEditDialogOpen(false); }}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Banquet Venues</h1>
          <p className="text-gray-500 mt-1">Manage event venues and halls</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Venue
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Venues ({venues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {venues.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No venues found. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {venues.map((venue) => (
                  <TableRow key={venue.id}>
                    <TableCell className="font-medium">{venue.name}</TableCell>
                    <TableCell className="capitalize">{venue.venue_type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      {venue.capacity_min != null || venue.capacity_max != null
                        ? `${venue.capacity_min ?? '—'} – ${venue.capacity_max ?? '—'}`
                        : '—'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-gray-600">
                      {venue.floor_plan_notes ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(venue)} title="Edit">
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDelete(venue)} title="Delete">
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
          <DialogHeader><DialogTitle>Add Venue</DialogTitle></DialogHeader>
          <VenueForm
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            isPending={createMutation.isPending}
            submitLabel="Create"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Venue</DialogTitle></DialogHeader>
          <VenueForm
            onSubmit={(e) => { e.preventDefault(); if (selectedVenue) updateMutation.mutate({ ...form, id: selectedVenue.id }); }}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Remove Venue
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <span className="font-semibold">{selectedVenue?.name}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => selectedVenue && deleteMutation.mutate(selectedVenue.id)}
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

export default VenuesPage;
