import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Trash2, Link as LinkIcon, Mail, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';

export default function ContractBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const bookingId = searchParams.get('booking_id');
  const corporateId = searchParams.get('corporate_account_id');
  
  const { selectedPropertyId } = useProperty();

  const [status, setStatus] = useState('draft');
  const [terms, setTerms] = useState('1. OVERVIEW\\n\\n2. CANCELLATION POLICY\\n\\n3. PAYMENT STIPULATIONS\\n\\n4. LIABILITY');
  const [flow, setFlow] = useState('hotel_proposes');
  const [paymentDeadline, setPaymentDeadline] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [totalValue, setTotalValue] = useState(0);

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({ to_email: '', cc_email: '', subject: 'Formal Contract Details from Hotel Pramod', body: '' });

  const isEditing = Boolean(id);

  const { data: existingContract, isLoading: fetchingContract } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get(`/api/crm/contracts/${id}`);
      return res.data.contract;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingContract) {
      setTerms(existingContract.terms || '');
      setFlow(existingContract.flow || 'hotel_proposes');
      if (existingContract.payment_deadline) {
         setPaymentDeadline(existingContract.payment_deadline.split('T')[0]);
      }
      if (existingContract.expires_on) {
         setExpiresOn(existingContract.expires_on.split('T')[0]);
      }
      setTotalValue(Number(existingContract.total_value) || 0);
      setStatus(existingContract.status || 'draft');
    }
  }, [existingContract]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        const res = await apiClient.post(`/api/crm/contracts/${id}/revise`, { snapshot: payload });
        await apiClient.patch(`/api/crm/contracts/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/api/crm/contracts', payload);
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Contract updated' : 'Contract formally drafted');
      navigate('/crm/contracts');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to sync contract');
    }
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/crm/contracts/${id}/send-email`, emailData);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Digital Contract physically dispatched!');
      setIsEmailDialogOpen(false);
      navigate('/crm/contracts');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed connecting to dispatch engine')
  });

  const handleSave = (requestedStatus = 'draft') => {
    if (!selectedPropertyId) {
      toast.error('Property selection required');
      return;
    }
    const payload = {
      property_id: selectedPropertyId,
      booking_id: bookingId ? parseInt(bookingId) : (existingContract?.booking_id || null),
      lead_id: leadId ? parseInt(leadId) : (existingContract?.lead_id || null),
      corporate_account_id: corporateId ? parseInt(corporateId) : (existingContract?.corporate_account_id || null),
      flow,
      terms,
      payment_deadline: paymentDeadline || null,
      expires_on: expiresOn || null,
      total_value: totalValue,
      status: requestedStatus,
    };
    saveMutation.mutate(payload);
  };

  if (isEditing && fetchingContract) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-none">
              {isEditing ? `Edit Contract ${existingContract?.contract_number}` : 'Draft Legal Contract'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">Bind leads and corporate accounts digitally.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing && existingContract?.secure_token && (
            <>
              <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 bg-indigo-50" onClick={() => window.open(`/public/contract/${existingContract.secure_token}`, '_blank')}>
                Preview Layout
              </Button>
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsEmailDialogOpen(true)}>
                <Mail className="w-4 h-4 mr-1 sm:mr-2" /> 
                <span className="hidden xs:inline">Dispatch Email</span>
                <span className="xs:hidden">Dispatch</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center bg-slate-50 border-b rounded-t-xl">
              <CardTitle>Legal Stipulations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Text Block Document</Label>
                <Textarea 
                  rows={25}
                  value={terms} 
                  onChange={(e) => setTerms(e.target.value)} 
                  className="font-serif leading-relaxed"
                  placeholder="Insert clauses, refund instructions, and liabilities here..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-slate-900 text-white rounded-t-xl">
              <CardTitle className="text-lg flex justify-between items-center">
                Governance
                <Badge variant="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700">{status.toUpperCase()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              
              <div className="space-y-2">
                 <Label className="flex items-center gap-1 text-slate-700"><LinkIcon className="w-3 h-3"/> Parent Links Attached</Label>
                 <div className="text-sm font-mono bg-slate-50 border rounded p-2">
                    {leadId || existingContract?.lead_id ? `Lead ID: ${leadId || existingContract.lead_id}` : ''}
                    {bookingId || existingContract?.booking_id ? `Booking ID: ${bookingId || existingContract.booking_id}` : ''}
                    {corporateId || existingContract?.corporate_account_id ? `Corporate ID: ${corporateId || existingContract.corporate_account_id}` : ''}
                    {!leadId && !bookingId && !corporateId && !existingContract && 'No IDs Mapped'}
                 </div>
              </div>

              <div className="space-y-2">
                <Label>Required Overarching Value (₹)</Label>
                <Input type="number" min="0" value={totalValue} onChange={(e) => setTotalValue(parseFloat(e.target.value) || 0)} />
                <p className="text-xs text-slate-400">Can be independent or matching Quotation subtotal.</p>
              </div>

              <div className="space-y-2">
                <Label>Contract Expiration (Sign by)</Label>
                <Input type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>Payment Due Index</Label>
                <Input type="date" value={paymentDeadline} onChange={(e) => setPaymentDeadline(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Signature Mapping Flow</Label>
                <Select value={flow} onValueChange={setFlow}>
                   <SelectTrigger><SelectValue/></SelectTrigger>
                   <SelectContent>
                      <SelectItem value="hotel_proposes">Standard (Hotel Initiates)</SelectItem>
                      <SelectItem value="client_submits">Client Initiates (B2B)</SelectItem>
                   </SelectContent>
                </Select>
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50 rounded-b-xl flex-col gap-2 p-4">
              <Button variant="outline" className="w-full bg-white" onClick={() => handleSave('draft')} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" /> Save to Drafts
              </Button>
              <Button className="w-full bg-slate-900 hover:bg-black text-white" onClick={() => handleSave('sent')} disabled={saveMutation.isPending}>
                <Send className="w-4 h-4 mr-2" /> Record as Sent Natively
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-lg">Legal Contract Dispatch</h2>
            </div>
            <Badge className="bg-amber-500 text-white border-none">FORMAL</Badge>
          </div>
          
          <div className="p-0 bg-white">
            <div className="border-b">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">To:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                  value={emailData.to_email} 
                  onChange={e => setEmailData(prev => ({...prev, to_email: e.target.value}))} 
                  placeholder="client@domain.com"
                />
              </div>
            </div>
            <div className="border-b">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">Cc:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1"
                  value={emailData.cc_email} 
                  onChange={e => setEmailData(prev => ({...prev, cc_email: e.target.value}))} 
                  placeholder="legal@hotel.com"
                />
              </div>
            </div>
            <div className="border-b bg-slate-50/50">
              <div className="flex items-center px-6 py-3 gap-4">
                <span className="text-sm font-medium text-slate-500 w-16">Subject:</span>
                <input 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold py-1"
                  value={emailData.subject} 
                  onChange={e => setEmailData(prev => ({...prev, subject: e.target.value}))} 
                />
              </div>
            </div>
            
            <div className="px-6 py-6 space-y-4">
              <Textarea 
                rows={8}
                value={emailData.body} 
                onChange={e => setEmailData(prev => ({...prev, body: e.target.value}))} 
                className="min-h-[200px] border-none focus-visible:ring-0 resize-none p-0 text-slate-700 leading-relaxed"
                placeholder="Enter formal covering message..." 
              />
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-4 text-white">
                 <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center shrink-0 border border-slate-700">
                    <FileSignature className="w-5 h-5 text-indigo-400" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">Contract_{existingContract?.contract_number || 'Draft'}.pdf</p>
                    <p className="text-xs text-slate-400 mt-0.5">Digital Signature Portal Token Attached</p>
                 </div>
                 <Badge variant="outline" className="border-slate-700 text-slate-300">SECURE</Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="bg-slate-50 px-6 py-4 border-t gap-3">
            <Button variant="ghost" onClick={() => setIsEmailDialogOpen(false)} className="text-slate-500">
              Cancel
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8" 
              onClick={() => emailMutation.mutate()} 
              disabled={emailMutation.isPending || !emailData.to_email}
            >
              {emailMutation.isPending ? 'Connecting...' : 'Dispatch Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
