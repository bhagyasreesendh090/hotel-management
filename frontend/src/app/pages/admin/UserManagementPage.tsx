import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, UserCog, ShieldCheck, Mail, Phone, Building, Trash2 } from 'lucide-react';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  active: boolean;
  property_ids: number[];
}

interface Property {
  id: number;
  name: string;
  code: string;
}

const UserManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'sales_executive',
    phone: '',
    property_ids: [] as number[],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiClient.get<{ users: User[] }>('/api/users');
      return response.data.users;
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['properties-list'],
    queryFn: async () => {
      const response = await apiClient.get<{ properties: Property[] }>('/api/properties');
      return response.data.properties;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (user: typeof newUser) => {
      // Basic validation
      if (!user.email || !user.full_name || !user.password) {
        throw new Error('Please fill all required fields');
      }
      if (user.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }
      const response = await apiClient.post('/api/users', user);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      setIsCreateDialogOpen(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'sales_executive',
        phone: '',
        property_ids: [],
      });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || 'Failed to create user';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (user: any) => {
      const { id, ...data } = user;
      const response = await apiClient.patch(`/api/users/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.delete(`/api/users/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted permanently');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser({
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      phone: user.phone || '',
      active: user.active,
      property_ids: user.property_ids || [],
    });
    setIsEditDialogOpen(true);
  };

  const roles = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'gm', label: 'GM' },
    { value: 'sales_agent', label: 'Sales Agent' },
    { value: 'branch_manager', label: 'Branch Manager' },
    { value: 'sales_manager', label: 'Sales Manager' },
    { value: 'sales_executive', label: 'Sales Executive' },
    { value: 'banquet_coordinator', label: 'Banquet Coordinator' },
    { value: 'front_desk', label: 'Front Desk' },
    { value: 'finance', label: 'Finance' },
  ];

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-950">User Management</h1>
          <p className="text-stone-500 mt-1">Manage system users, roles and property access.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-full px-6">
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Card className="rounded-[24px] border-stone-200/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-stone-50/50">
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-stone-950">{user.full_name}</span>
                      <span className="text-xs text-stone-500 flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {user.email}
                      </span>
                      {user.phone && (
                        <span className="text-xs text-stone-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {user.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize bg-stone-100/50 text-stone-700 border-stone-200">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {user.role === 'super_admin' || user.role === 'gm' ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">All Properties</Badge>
                      ) : user.property_ids?.length > 0 ? (
                        user.property_ids.map(pid => {
                          const p = properties.find(prop => prop.id === pid);
                          return p ? (
                            <Badge key={pid} variant="secondary" className="text-[10px] bg-stone-100 text-stone-600">
                              {p.code}
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-xs text-stone-400 italic">No access</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Active
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-stone-400 font-medium text-xs">
                        <div className="h-1.5 w-1.5 rounded-full bg-stone-400" /> Inactive
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(user)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to permanently delete user ${user.full_name}?`)) {
                            deleteMutation.mutate(user.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Fill in the details below to create a new system user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                placeholder="e.g. John Doe" 
                value={newUser.full_name}
                onChange={e => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input 
                type="email" 
                placeholder="john@hotelpramod.local" 
                value={newUser.email}
                onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input 
                type="password" 
                placeholder="Min 6 characters" 
                value={newUser.password}
                onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser(prev => ({ ...prev, role: v }))}>
                  <SelectTrigger className="capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.value} value={r.value} className="capitalize">{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone (Optional)</Label>
                <Input 
                  placeholder="+91..." 
                  value={newUser.phone}
                  onChange={e => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Property Access</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl max-h-[120px] overflow-y-auto">
                {properties.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id={`p-${p.id}`}
                      checked={newUser.property_ids.includes(p.id)}
                      onChange={e => {
                        const ids = e.target.checked 
                          ? [...newUser.property_ids, p.id]
                          : newUser.property_ids.filter(id => id !== p.id);
                        setNewUser(prev => ({ ...prev, property_ids: ids }));
                      }}
                      className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                    />
                    <label htmlFor={`p-${p.id}`} className="text-xs text-stone-700 cursor-pointer">{p.name} ({p.code})</label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(newUser)} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details and property access permissions.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input 
                  value={editingUser.full_name}
                  onChange={e => setEditingUser((prev: any) => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editingUser.role} onValueChange={v => setEditingUser((prev: any) => ({ ...prev, role: v }))}>
                    <SelectTrigger className="capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(r => (
                        <SelectItem key={r.value} value={r.value} className="capitalize">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input 
                    value={editingUser.phone}
                    onChange={e => setEditingUser((prev: any) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reset Password (Optional)</Label>
                <Input 
                  type="password" 
                  placeholder="Leave blank to keep current" 
                  onChange={e => setEditingUser((prev: any) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 py-2">
                <input 
                  type="checkbox" 
                  id="user-active"
                  checked={editingUser.active}
                  onChange={e => setEditingUser((prev: any) => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                />
                <Label htmlFor="user-active" className="cursor-pointer">User Account Active</Label>
              </div>
              <div className="space-y-2">
                <Label>Property Access</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-xl max-h-[120px] overflow-y-auto">
                  {properties.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id={`edit-p-${p.id}`}
                        checked={editingUser.property_ids.includes(p.id)}
                        onChange={e => {
                          const ids = e.target.checked 
                            ? [...editingUser.property_ids, p.id]
                            : editingUser.property_ids.filter((id: number) => id !== p.id);
                          setEditingUser((prev: any) => ({ ...prev, property_ids: ids }));
                        }}
                        className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                      />
                      <label htmlFor={`edit-p-${p.id}`} className="text-xs text-stone-700 cursor-pointer">{p.name} ({p.code})</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate(editingUser)} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
