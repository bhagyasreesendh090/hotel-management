import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Plus, Search, FileText } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiClient from '../../api/client';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quotations_all'],
    queryFn: async () => {
      const response = await apiClient.get('/api/crm/quotations');
      return response.data.quotations || [];
    },
  });

  const filteredQuotes = React.useMemo(() => {
    if (!data) return [];
    return data.filter((q: any) => 
      q.quotation_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      q.company?.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotation Management</h1>
          <p className="text-gray-500 mt-1">Manage and track all generated quotes across your leads pipeline.</p>
        </div>
        <Button onClick={() => navigate('/crm/quotes/new')} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Create Direct Quote
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="flex items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search quotes, contacts or companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold px-6 py-4">Quote Number</TableHead>
                  <TableHead className="font-semibold py-4">Client</TableHead>
                  <TableHead className="font-semibold py-4 hidden md:table-cell">Total Value</TableHead>
                  <TableHead className="font-semibold py-4 hidden md:table-cell">Expiry</TableHead>
                  <TableHead className="font-semibold py-4">Status</TableHead>
                  <TableHead className="font-semibold py-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      No quotations found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredQuotes.map((q: any) => (
                    <TableRow key={q.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <FileText className="w-4 h-4 text-indigo-400" />
                           <span className="font-medium text-slate-900">{q.quotation_number}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="font-medium text-slate-900">{q.contact_name || '—'}</p>
                        <p className="text-sm text-slate-500">{q.company}</p>
                      </TableCell>
                      <TableCell className="py-4 hidden md:table-cell">
                        <p className="font-medium text-slate-900">₹{Number(q.final_amount).toLocaleString('en-IN')}</p>
                        {Number(q.discount_amount) > 0 && (
                           <p className="text-xs text-green-600">-₹{Number(q.discount_amount).toLocaleString('en-IN')} disc</p>
                        )}
                      </TableCell>
                      <TableCell className="py-4 hidden md:table-cell text-slate-600">
                        {q.valid_until ? format(new Date(q.valid_until), 'MMM dd, yyyy') : 'No Expiry'}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge 
                           variant="secondary" 
                           className={`uppercase text-xs ${
                             q.status === 'accepted' ? 'bg-green-100 text-green-800' 
                             : q.status === 'rejected' ? 'bg-red-100 text-red-800'
                             : q.status === 'pending_approval' ? 'bg-amber-100 text-amber-800'
                             : 'bg-indigo-50 text-indigo-800'
                           }`}
                        >
                          {q.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                           {q.secure_token && (
                              <Button variant="outline" size="sm" onClick={() => window.open(`/public/quote/${q.secure_token}`, '_blank')}>
                                Link
                              </Button>
                           )}
                           <Button size="sm" onClick={() => navigate(`/crm/quotes/${q.id}/edit${q.lead_id ? '?lead_id=' + q.lead_id : ''}`)}>
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
