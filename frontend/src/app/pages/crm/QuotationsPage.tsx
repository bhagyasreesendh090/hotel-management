import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Plus, Search, FileText, Mail, Send } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiClient from '../../api/client';
import { toast } from 'sonner';

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = React.useState('');
  const [emailDialog, setEmailDialog] = React.useState<any | null>(null);
  const [emailData, setEmailData] = React.useState({ to_email: '', cc_email: '', subject: 'Your Quotation from Hotel Pramod', body: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['quotations_all'],
    queryFn: async () => {
      const response = await apiClient.get('/api/crm/quotations');
      return response.data.quotations || [];
    },
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!emailDialog) throw new Error('No quote selected');
      await apiClient.post(`/api/crm/quotations/${emailDialog.id}/send-email`, emailData);
    },
    onSuccess: () => {
      toast.success('Quotation email sent to customer!');
      setEmailDialog(null);
      setEmailData({ to_email: '', cc_email: '', subject: 'Your Quotation from Hotel Pramod', body: '' });
      refetch();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'Email failed — check SMTP settings'),
  });

  function openEmailDialog(q: any) {
    setEmailDialog(q);
    setEmailData({
      to_email: q.contact_email ?? '',
      cc_email: '',
      subject: `Quotation ${q.quotation_number} from Hotel Pramod`,
      body: `Dear ${q.contact_name ?? 'Guest'},\n\nPlease find your quotation attached via the link below.\n\nQuote No: ${q.quotation_number}\nAmount: ₹${Number(q.final_amount).toLocaleString('en-IN')}\nValid Until: ${q.valid_until ? format(new Date(q.valid_until), 'dd MMM yyyy') : 'N/A'}\n\nKindly review and revert at your earliest convenience.\n\nWarm regards,\nHotel Pramod Team`,
    });
  }

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
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                              onClick={() => openEmailDialog(q)}
                            >
                              <Mail className="w-3.5 h-3.5" /> Email
                            </Button>
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

      {/* Send Email Dialog */}
      <Dialog open={!!emailDialog} onOpenChange={(open) => { if (!open) setEmailDialog(null); }}>
        <DialogContent className="max-w-2xl p-0 border-none shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg">Send Quotation Email</h2>
            </div>
            {emailDialog && <span className="text-xs text-slate-400 font-mono">{emailDialog.quotation_number}</span>}
          </div>

          {/* Scrollable body */}
          <div className="bg-white divide-y divide-slate-100 overflow-y-auto flex-1">
            <div className="flex items-center px-6 py-3 gap-4">
              <Label className="text-sm font-medium text-slate-500 w-16 shrink-0">To:</Label>
              <Input
                type="email"
                className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm px-0 h-8"
                value={emailData.to_email}
                onChange={e => setEmailData(p => ({ ...p, to_email: e.target.value }))}
                placeholder="customer@example.com"
              />
            </div>
            <div className="flex items-center px-6 py-3 gap-4">
              <Label className="text-sm font-medium text-slate-500 w-16 shrink-0">Cc:</Label>
              <Input
                type="email"
                className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm px-0 h-8"
                value={emailData.cc_email}
                onChange={e => setEmailData(p => ({ ...p, cc_email: e.target.value }))}
                placeholder="manager@hotel.com (optional)"
              />
            </div>
            <div className="flex items-center px-6 py-3 gap-4 bg-slate-50/50">
              <Label className="text-sm font-medium text-slate-500 w-16 shrink-0">Subject:</Label>
              <Input
                className="flex-1 border-0 shadow-none focus-visible:ring-0 text-sm font-semibold px-0 h-8"
                value={emailData.subject}
                onChange={e => setEmailData(p => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="px-6 py-5">
              <Textarea
                rows={6}
                value={emailData.body}
                onChange={e => setEmailData(p => ({ ...p, body: e.target.value }))}
                className="border-none focus-visible:ring-0 resize-none p-0 text-slate-700 leading-relaxed w-full"
                placeholder="Write your message here..."
              />
              {emailDialog?.secure_token && (
                <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{emailDialog.quotation_number}</p>
                    <p className="text-xs text-slate-500">Secure customer portal link will be appended automatically</p>
                  </div>
                  <Badge className="ml-auto bg-indigo-600 text-white border-none text-xs">PORTAL LINK</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Footer — always visible */}
          <div className="bg-slate-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
            <Button variant="ghost" onClick={() => setEmailDialog(null)} className="text-slate-500">
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 px-8 gap-2"
              onClick={() => emailMutation.mutate()}
              disabled={emailMutation.isPending || !emailData.to_email}
            >
              {emailMutation.isPending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Quotation</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
