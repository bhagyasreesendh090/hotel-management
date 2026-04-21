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

interface CorporateAccount {
  id: number;
  company_name: string;
  primary_contact: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  address: string | null;
  billing_mode: string | null;
}

const emptyForm = {
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  billing_address: '',
  credit_limit: '',
};

const CorporateAccountsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<CorporateAccount | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['corporateAccounts', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ corporate_accounts: CorporateAccount[] }>(
        '/api/corporate/corporate-accounts'
      );
      return response.data.corporate_accounts ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post('/api/corporate/corporate-accounts', {
        company_name: data.company_name,
        address: data.billing_address || null,
        primary_contact: data.contact_person || null,
        primary_email: data.email || null,
        primary_phone: data.phone || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateAccounts', selectedPropertyId] });
      toast.success('Corporate account created successfully');
      setIsCreateDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to create account'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form & { id: number }) => {
      const response = await apiClient.put(`/api/corporate/corporate-accounts/${data.id}`, {
        company_name: data.company_name,
        address: data.billing_address || null,
        primary_contact: data.contact_person || null,
        primary_email: data.email || null,
        primary_phone: data.phone || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateAccounts', selectedPropertyId] });
      toast.success('Corporate account updated successfully');
      setIsEditDialogOpen(false);
      setSelectedAccount(null);
    },
    onError: () => toast.error('Failed to update account'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/corporate/corporate-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateAccounts', selectedPropertyId] });
      toast.success('Corporate account removed');
      setIsDeleteDialogOpen(false);
      setSelectedAccount(null);
    },
    onError: () => toast.error('Failed to remove account'),
  });

  const openEdit = (account: CorporateAccount) => {
    setSelectedAccount(account);
    setForm({
      company_name: account.company_name,
      contact_person: account.primary_contact ?? '',
      email: account.primary_email ?? '',
      phone: account.primary_phone ?? '',
      billing_address: account.address ?? '',
      credit_limit: '',
    });
    setIsEditDialogOpen(true);
  };

  const openDelete = (account: CorporateAccount) => {
    setSelectedAccount(account);
    setIsDeleteDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const AccountForm = ({ onSubmit, isPending, submitLabel }: { onSubmit: (e: React.FormEvent) => void; isPending: boolean; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="company_name">Company Name *</Label>
        <Input id="company_name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contact_person">Contact Person</Label>
        <Input id="contact_person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
        <Label htmlFor="billing_address">Billing Address</Label>
        <Input id="billing_address" value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
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
          <h1 className="text-2xl font-bold text-gray-900">Corporate Accounts</h1>
          <p className="text-gray-500 mt-1">Manage corporate clients</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsCreateDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Corporate Accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No corporate accounts found. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.company_name}</TableCell>
                    <TableCell>{account.primary_contact ?? '—'}</TableCell>
                    <TableCell>{account.primary_email ?? '—'}</TableCell>
                    <TableCell>{account.primary_phone ?? '—'}</TableCell>
                    <TableCell>{account.billing_mode ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(account)} title="Edit">
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDelete(account)} title="Delete">
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
            <DialogTitle>Create Corporate Account</DialogTitle>
          </DialogHeader>
          <AccountForm
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
            <DialogTitle>Edit Corporate Account</DialogTitle>
          </DialogHeader>
          <AccountForm
            onSubmit={(e) => { e.preventDefault(); if (selectedAccount) updateMutation.mutate({ ...form, id: selectedAccount.id }); }}
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
              Remove Corporate Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <span className="font-semibold">{selectedAccount?.company_name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => selectedAccount && deleteMutation.mutate(selectedAccount.id)}
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

export default CorporateAccountsPage;
