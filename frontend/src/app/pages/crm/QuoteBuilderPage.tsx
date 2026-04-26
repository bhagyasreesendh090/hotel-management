import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Save, Send, Plus, Trash2, Tag, Percent } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Mail } from 'lucide-react';

type LineItem = {
  id: string;
  description: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
};

export default function QuoteBuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const { selectedPropertyId } = useProperty();

  const [status, setStatus] = useState('draft');
  const [clientSalutation, setClientSalutation] = useState("Dear Sir / Ma'am");
  const [validityDays, setValidityDays] = useState(7);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [items, setItems] = useState<LineItem[]>([
    { id: '1', description: '', unit_price: 0, quantity: 1, tax_rate: 18 }
  ]);
  const [policies, setPolicies] = useState({ terms: 'Standard hotel terms apply.' });

  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailData, setEmailData] = useState({ to_email: '', cc_email: '', subject: 'Your Quotation from Hotel Pramod', body: '' });

  const isEditing = Boolean(id);

  const { data: existingQuote, isLoading: fetchingQuote } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await apiClient.get(`/api/crm/quotations/${id}`);
      return res.data.quotation;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingQuote) {
      setClientSalutation(existingQuote.client_salutation || '');
      setValidityDays(existingQuote.validity_days || 7);
      setDiscountAmount(Number(existingQuote.discount_amount) || 0);
      setStatus(existingQuote.status || 'draft');
      if (existingQuote.financial_summary?.items) {
        setItems(existingQuote.financial_summary.items);
      }
      if (existingQuote.policies) {
        setPolicies(existingQuote.policies);
      }
    }
  }, [existingQuote]);

  const { subTotal, taxTotal, finalTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    items.forEach(it => {
      const lineSub = (Number(it.unit_price) || 0) * (Number(it.quantity) || 1);
      const lineTax = lineSub * ((Number(it.tax_rate) || 0) / 100);
      sub += lineSub;
      tax += lineTax;
    });
    const final = Math.max(0, sub + tax - discountAmount);
    return { subTotal: sub, taxTotal: tax, finalTotal: final };
  }, [items, discountAmount]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (isEditing) {
        const res = await apiClient.post(`/api/crm/quotations/${id}/revise`, { snapshot: payload });
        // After revise, we also patch the normal status/amounts
        await apiClient.patch(`/api/crm/quotations/${id}`, payload);
        return res.data;
      } else {
        const res = await apiClient.post('/api/crm/quotations', payload);
        return res.data;
      }
    },
    onSuccess: (data) => {
      toast.success(isEditing ? 'Quote updated' : 'Quote created successfully');
      navigate(leadId ? `/crm/leads/${leadId}` : '/crm/leads');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save quote');
    }
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/crm/quotations/${id}/send-email`, emailData);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Quotation safely dispatched to customer!');
      setIsEmailDialogOpen(false);
      navigate(leadId ? `/crm/leads/${leadId}` : '/crm/leads');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Email dispatch failed')
  });

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', unit_price: 0, quantity: 1, tax_rate: 18 }]);
  };

  const updateItem = (index: number, changes: Partial<LineItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...changes };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSave = (requestedStatus = 'draft') => {
    if (!selectedPropertyId) {
      toast.error('Please select a property from the top bar');
      return;
    }
    const payload = {
      property_id: selectedPropertyId,
      lead_id: leadId ? parseInt(leadId) : (existingQuote?.lead_id || null),
      client_salutation: clientSalutation,
      validity_days: validityDays,
      status: requestedStatus,
      total_amount: subTotal,
      tax_amount: taxTotal,
      discount_amount: discountAmount,
      final_amount: finalTotal,
      financial_summary: { items },
      policies
    };
    saveMutation.mutate(payload);
  };

  if (isEditing && fetchingQuote) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEditing ? `Edit Quote ${existingQuote?.quotation_number}` : 'Create New Quote'}</h1>
            <p className="text-gray-500 mt-1">Configure line items, apply discounts, and generate shareable links.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing && existingQuote?.secure_token && (
            <>
              <Button variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50" onClick={() => window.open(`/public/quote/${existingQuote.secure_token}`, '_blank')}>
                View Live Link
              </Button>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => {
                // Try grabbing lead email if it exists (which we don't fetch directly here but user can type it in)
                setIsEmailDialogOpen(true);
              }}>
                <Mail className="w-4 h-4 mr-2" /> Email Quote
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, idx) => (
                <div key={item.id} className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label>Description</Label>
                      <Input placeholder="e.g. Deluxe Room (2 Nights)" value={item.description} onChange={(e) => updateItem(idx, { description: e.target.value })} />
                    </div>
                    <Button variant="ghost" size="icon" className="mt-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeItem(idx)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 space-y-1">
                      <Label>Unit Price (₹)</Label>
                      <Input type="number" min="0" value={item.unit_price} onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label>Qty</Label>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="w-32 space-y-1">
                      <Label>Tax (%)</Label>
                      <Select value={String(item.tax_rate)} onValueChange={(v) => updateItem(idx, { tax_rate: parseFloat(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="5">5%</SelectItem>
                          <SelectItem value="12">12%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                          <SelectItem value="28">28%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full border-dashed" onClick={addItem}>
                <Plus className="w-4 h-4 mr-2" /> Add Item
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Terms & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client Salutation</Label>
                  <Input value={clientSalutation} onChange={(e) => setClientSalutation(e.target.value)} placeholder="Dear Mr. Smith," />
                </div>
                <div className="space-y-2">
                  <Label>Validity Limit (Days)</Label>
                  <Input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Policy / Notes</Label>
                <Textarea rows={4} value={policies.terms} onChange={(e) => setPolicies({ ...policies, terms: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-slate-900 text-white rounded-t-xl">
              <CardTitle className="text-lg flex justify-between items-center">
                Financial Summary
                <Badge variant="secondary" className="bg-slate-800 text-slate-100 hover:bg-slate-700">{status.toUpperCase()}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium">₹{subTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Estimated Tax</span>
                <span className="font-medium">₹{taxTotal.toLocaleString('en-IN')}</span>
              </div>
              
              <div className="pt-4 border-t space-y-2">
                <Label className="flex items-center gap-2 text-indigo-700"><Tag className="w-3 h-3"/> Apply Discount Override (₹)</Label>
                <Input 
                  type="number" 
                  min="0"
                  className="font-mono"
                  value={discountAmount} 
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} 
                />
                {discountAmount > 5000 && (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Discounts over ₹5000 will be flagged for Manager Approval before sending.</p>
                )}
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <span className="font-bold text-slate-900">Grand Total</span>
                <span className="text-2xl font-bold text-indigo-600">₹{finalTotal.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 rounded-b-xl flex-col gap-2 p-4">
              <Button 
                variant="outline" 
                className="w-full bg-white" 
                onClick={() => handleSave('draft')}
                disabled={saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" /> Save as Draft
              </Button>
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" 
                onClick={() => handleSave('sent')}
                disabled={saveMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" /> Mark as Sent
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Quotation to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Email (To)</Label>
                <Input 
                  value={emailData.to_email} 
                  onChange={e => setEmailData(prev => ({...prev, to_email: e.target.value}))} 
                  placeholder="customer@example.com" 
                />
              </div>
              <div className="space-y-2">
                <Label>CC Email (Optional)</Label>
                <Input 
                  value={emailData.cc_email} 
                  onChange={e => setEmailData(prev => ({...prev, cc_email: e.target.value}))} 
                  placeholder="manager@example.com" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subject Line</Label>
              <Input 
                value={emailData.subject} 
                onChange={e => setEmailData(prev => ({...prev, subject: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <Label>Email Body Message (URL auto-appended)</Label>
              <Textarea 
                rows={4}
                value={emailData.body} 
                onChange={e => setEmailData(prev => ({...prev, body: e.target.value}))} 
                placeholder="Hi there, please find your quotation attached to this link..." 
              />
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-800 rounded text-sm break-all font-mono">
              Attached Link: {window.location.origin}/public/quote/{existingQuote?.secure_token}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => emailMutation.mutate()} disabled={emailMutation.isPending || !emailData.to_email}>
              {emailMutation.isPending ? 'Sending...' : 'Dispatch Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
