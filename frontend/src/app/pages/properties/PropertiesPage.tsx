import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DOCUMENT_LOGOS, DocumentLogo, DocumentLogoKey, normalizeDocumentLogo } from '../../components/brand/DocumentLogo';

interface Property {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  gstin?: string;
  email_from?: string;
  document_logo?: DocumentLogoKey;
}

interface PropertiesResponse {
  properties: Property[];
}

const PropertiesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deleteTargetProperty, setDeleteTargetProperty] = useState<Property | null>(null);
  const [newProperty, setNewProperty] = useState({
    code: '',
    name: '',
    address: '',
    gstin: '',
    email_from: '',
    document_logo: 'pramod_hotels_resorts' as DocumentLogoKey,
  });

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: async () => {
      const response = await apiClient.get<PropertiesResponse>('/api/properties');
      return Array.isArray(response.data?.properties) ? response.data.properties : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (property: typeof newProperty) => {
      const response = await apiClient.post('/api/properties', property);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property created successfully');
      setIsCreateDialogOpen(false);
      setNewProperty({
        code: '',
        name: '',
        address: '',
        gstin: '',
        email_from: '',
        document_logo: 'pramod_hotels_resorts',
      });
    },
    onError: () => {
      toast.error('Failed to create property');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (property: Property) => {
      const response = await apiClient.patch(`/api/properties/${property.id}`, property);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property updated successfully');
      setIsEditDialogOpen(false);
      setEditingProperty(null);
    },
    onError: () => {
      toast.error('Failed to update property');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property deleted successfully');
      setDeleteTargetProperty(null);
    },
    onError: () => {
      toast.error('Failed to delete property');
    },
  });

  const handleEdit = (property: Property) => {
    setEditingProperty({ ...property, document_logo: normalizeDocumentLogo(property.document_logo) });
    setIsEditDialogOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createMutation.mutate(newProperty);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (editingProperty) {
      updateMutation.mutate(editingProperty);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
            <p className="text-gray-500 mt-1">Manage your hotel properties</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Document Logo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">{property.code}</TableCell>
                  <TableCell>{property.name}</TableCell>
                  <TableCell>{property.city}</TableCell>
                  <TableCell>
                    <DocumentLogo logo={property.document_logo} className="h-12 w-36" />
                  </TableCell>
                  <TableCell>{property.email_from || property.email}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(property)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                        onClick={() => setDeleteTargetProperty(property)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Property</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-code">Code</Label>
                <Input
                  id="new-code"
                  value={newProperty.code}
                  onChange={(e) => setNewProperty(prev => ({ ...prev, code: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-name">Name</Label>
                <Input
                  id="new-name"
                  value={newProperty.name}
                  onChange={(e) => setNewProperty(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="new-address">Address</Label>
                <Input
                  id="new-address"
                  value={newProperty.address}
                  onChange={(e) => setNewProperty(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-gstin">GSTIN</Label>
                <Input
                  id="new-gstin"
                  value={newProperty.gstin}
                  onChange={(e) => setNewProperty(prev => ({ ...prev, gstin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email-from">Email From</Label>
                <Input
                  id="new-email-from"
                  type="email"
                  value={newProperty.email_from}
                  onChange={(e) => setNewProperty(prev => ({ ...prev, email_from: e.target.value }))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Document Logo</Label>
                <Select value={newProperty.document_logo} onValueChange={(value) => setNewProperty(prev => ({ ...prev, document_logo: value as DocumentLogoKey }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_LOGOS.map((logo) => (
                      <SelectItem key={logo.value} value={logo.value}>{logo.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-md border bg-white p-4">
                  <DocumentLogo logo={newProperty.document_logo} className="mx-auto h-24 w-full max-w-md" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Add Property'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Property</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editingProperty?.name || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, name: e.target.value } : null)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={editingProperty?.code || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, code: e.target.value } : null)}
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={editingProperty?.address || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, address: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={editingProperty?.city || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, city: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={editingProperty?.state || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, state: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={editingProperty?.phone || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, phone: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_from">Email From</Label>
                <Input
                  id="email_from"
                  type="email"
                  value={editingProperty?.email_from || editingProperty?.email || ''}
                  onChange={(e) => setEditingProperty(prev => prev ? { ...prev, email_from: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Document Logo</Label>
                <Select
                  value={normalizeDocumentLogo(editingProperty?.document_logo)}
                  onValueChange={(value) => setEditingProperty(prev => prev ? { ...prev, document_logo: value as DocumentLogoKey } : null)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_LOGOS.map((logo) => (
                      <SelectItem key={logo.value} value={logo.value}>{logo.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="rounded-md border bg-white p-4">
                  <DocumentLogo logo={editingProperty?.document_logo} className="mx-auto h-24 w-full max-w-md" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTargetProperty} onOpenChange={(open) => { if (!open) setDeleteTargetProperty(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Property?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-slate-900">{deleteTargetProperty?.name}</span>?
            This will soft-delete the property and hide it from all users. This action can only be undone from the database.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTargetProperty(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTargetProperty) deleteMutation.mutate(deleteTargetProperty.id);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Property'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PropertiesPage;
