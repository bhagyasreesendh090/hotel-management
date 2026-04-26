import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import { FileSignature, Search, Plus } from 'lucide-react';
import apiClient from '../../api/client';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export default function ContractsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contracts_all'],
    queryFn: async () => {
      const response = await apiClient.get('/api/crm/contracts');
      return response.data.contracts || [];
    },
  });

  const filteredContracts = React.useMemo(() => {
    if (!data) return [];
    return data.filter((c: any) => 
      c.contract_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.lead_contact?.toLowerCase().includes(search.toLowerCase()) ||
      c.lead_company?.toLowerCase().includes(search.toLowerCase()) ||
      c.corporate_name?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contract Management</h1>
          <p className="text-gray-500 mt-1">Manage formal legal contracts for your Banquet and Corporate bookings.</p>
        </div>
        <Button onClick={() => navigate('/crm/contracts/new')} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Draft Contract
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search contracts, contacts or companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold px-6 py-4">Contract Number</TableHead>
                  <TableHead className="font-semibold py-4">Linked To</TableHead>
                  <TableHead className="font-semibold py-4 hidden md:table-cell">Value</TableHead>
                  <TableHead className="font-semibold py-4 hidden md:table-cell">Payment Deadline</TableHead>
                  <TableHead className="font-semibold py-4">Stage</TableHead>
                  <TableHead className="font-semibold py-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      No contracts found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContracts.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <FileSignature className="w-4 h-4 text-indigo-400" />
                           <span className="font-medium text-slate-900">{c.contract_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {c.corporate_name ? (
                           <>
                             <p className="font-medium text-slate-900">{c.corporate_name}</p>
                             <p className="text-xs text-slate-500 uppercase">Corporate Account</p>
                           </>
                        ) : (
                           <>
                             <p className="font-medium text-slate-900">{c.lead_contact || 'Unlinked'}</p>
                             <p className="text-sm text-slate-500">{c.lead_company}</p>
                           </>
                        )}
                      </TableCell>
                      <TableCell className="py-4 hidden md:table-cell font-medium">
                        ₹{Number(c.total_value).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="py-4 hidden md:table-cell text-slate-600">
                        {c.payment_deadline ? format(new Date(c.payment_deadline), 'MMM dd, yyyy') : 'TBD'}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge 
                           variant="secondary" 
                           className={`uppercase text-xs ${
                             c.status === 'accepted' ? 'bg-green-100 text-green-800' 
                             : c.status === 'rejected' ? 'bg-red-100 text-red-800'
                             : 'bg-indigo-50 text-indigo-800'
                           }`}
                        >
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                           {c.secure_token && (
                              <Button variant="outline" size="sm" onClick={() => window.open(`/public/contract/${c.secure_token}`, '_blank')}>
                                Link
                              </Button>
                           )}
                           <Button size="sm" onClick={() => navigate(`/crm/contracts/${c.id}/edit`)}>
                             Edit
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
