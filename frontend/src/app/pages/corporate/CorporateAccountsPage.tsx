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
import { Plus } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';

const CorporateAccountsPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    billing_address: '',
    credit_limit: '',
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['corporateAccounts', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get('/api/corporate/corporate-accounts', {
        params: { property_id: selectedPropertyId },
      });
      return response.data;
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/corporate/corporate-accounts', {
        ...data,
        property_id: selectedPropertyId,
        credit_limit: parseFloat(data.credit_limit),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateAccounts', selectedPropertyId] });
      toast.success('Corporate account created');
      setIsCreateDialogOpen(false);
      setNewAccount({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        billing_address: '',
        credit_limit: '',
      });
    },
    onError: () => {
      toast.error('Failed to create account');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newAccount);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corporate Accounts</h1>
          <p className="text-gray-500 mt-1">Manage corporate clients</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Corporate Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Credit Limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts?.map((account: any) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.company_name}</TableCell>
                  <TableCell>{account.contact_person}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>{account.phone}</TableCell>
                  <TableCell>₹{account.credit_limit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Corporate Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={newAccount.company_name}
                onChange={(e) => setNewAccount({ ...newAccount, company_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                value={newAccount.contact_person}
                onChange={(e) => setNewAccount({ ...newAccount, contact_person: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newAccount.email}
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newAccount.phone}
                onChange={(e) => setNewAccount({ ...newAccount, phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_address">Billing Address</Label>
              <Input
                id="billing_address"
                value={newAccount.billing_address}
                onChange={(e) => setNewAccount({ ...newAccount, billing_address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
              <Input
                id="credit_limit"
                type="number"
                step="0.01"
                value={newAccount.credit_limit}
                onChange={(e) => setNewAccount({ ...newAccount, credit_limit: e.target.value })}
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

export default CorporateAccountsPage;
