import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Send, Building2, MapPin, Mail, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';

export default function PublicQuoteView() {
  const { token } = useParams();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public_quote', token],
    queryFn: async () => {
      const res = await apiClient.get(`/api/public/quotations/${token}`);
      return res.data;
    },
    // Don't retry if the token is invalid (404)
    retry: false,
    refetchInterval: 30000 // Poll every 30s to keep chat lively
  });

  const interactMutation = useMutation({
    mutationFn: async ({ action, message }: { action?: string; message?: string }) => {
      const res = await apiClient.post(`/api/public/quotations/${token}/interact`, { action, message });
      return res.data;
    },
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['public_quote', token] });
    },
    onError: () => toast.error('Failed to submit response')
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900">Quotation Unavailable</h1>
        <p className="text-slate-500 mt-2">This link is either invalid, expired, or has been revoked.</p>
      </div>
    );
  }

  const { quotation: q, property: p, interactions } = data;
  const items = q.financial_summary?.items || [];
  const policies = q.policies || {};

  const isLocked = ['accepted', 'rejected', 'expired'].includes(q.status);

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Dynamic Branding Header */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-3">
          <Building2 className="w-12 h-12 mx-auto text-indigo-600" />
          <h1 className="text-3xl font-bold text-slate-900">{p.name || 'Hotel Pramod'}</h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-slate-500 text-sm">
            <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {p.address || 'Central Avenue'}</span>
            <span className="flex items-center gap-1"><Mail className="w-4 h-4"/> {p.email_from || 'sales@hotelpramod.com'}</span>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-xl flex items-center justify-between ${q.status === 'accepted' ? 'bg-green-100 text-green-900 border border-green-200' : q.status === 'rejected' ? 'bg-red-100 text-red-900 border border-red-200' : 'bg-indigo-50 text-indigo-900 border border-indigo-100'}`}>
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5"/> Quotation {q.quotation_number}
            </h2>
            <p className="text-sm opacity-80 mt-1">Generated on {format(new Date(q.created_at), 'MMMM dd, yyyy')}</p>
          </div>
          <Badge variant="outline" className="text-sm px-4 py-1 uppercase bg-white bg-opacity-50">
            {q.status}
          </Badge>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            
            {/* Items Card */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-50 border-b">
                <CardTitle>{q.client_salutation}</CardTitle>
                <p className="text-sm text-slate-600 font-normal">Please find the requested quotation breakdown below. Valid until {q.valid_until ? format(new Date(q.valid_until), 'MMM dd, yyyy') : 'N/A'}.</p>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 border-b">
                    <tr>
                      <th className="p-4 font-medium">Description</th>
                      <th className="p-4 font-medium text-right">Price</th>
                      <th className="p-4 font-medium text-right">Qty</th>
                      <th className="p-4 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((it: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-slate-900 whitespace-normal">{it.description || '-'}</td>
                        <td className="p-4 text-right">₹{Number(it.unit_price).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right">{it.quantity}</td>
                        <td className="p-4 text-right font-medium text-slate-900">₹{(Number(it.unit_price) * Number(it.quantity)).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Terms */}
            {policies.terms && (
              <Card className="shadow-sm border-dashed">
                 <CardHeader><CardTitle className="text-sm uppercase tracking-wide text-slate-500">Terms & Conditions</CardTitle></CardHeader>
                 <CardContent><p className="whitespace-pre-wrap text-sm text-slate-700">{policies.terms}</p></CardContent>
              </Card>
            )}

            {/* Interaction Thread */}
            <Card className="shadow-sm">
              <CardHeader className="bg-slate-50 border-b"><CardTitle>Discussions</CardTitle></CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-64 p-4">
                  <div className="space-y-4">
                    {interactions.length === 0 ? (
                      <p className="text-center text-slate-400 text-sm py-8">No messages yet.</p>
                    ) : (
                      interactions.map((msg: any, i: number) => (
                        <div key={i} className={`flex flex-col ${msg.sender_type === 'client' ? 'items-end' : 'items-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${msg.sender_type === 'client' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-900 rounded-bl-none'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1">{format(new Date(msg.created_at), 'hh:mm a')}</span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                
                {!isLocked && (
                  <div className="p-4 border-t flex gap-2 bg-slate-50 rounded-b-xl">
                    <Textarea 
                      placeholder="Ask a question or request a change..." 
                      className="min-h-[44px] resize-none" 
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <Button size="icon" className="shrink-0" onClick={() => interactMutation.mutate({ message: comment })} disabled={!comment.trim() || interactMutation.isPending}>
                      <Send className="w-4 h-4"/>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-1 space-y-6">
            <Card className="sticky top-6 shadow-xl border-indigo-100 overflow-hidden">
              <div className="bg-slate-900 p-4 text-white">
                <h3 className="font-semibold text-lg">Financial Summary</h3>
              </div>
              <CardContent className="p-6 space-y-4">
                 <div className="flex justify-between text-sm">
                   <span className="text-slate-500">Subtotal</span>
                   <span className="font-medium">₹{Number(q.total_amount).toLocaleString('en-IN')}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-slate-500">GST Taxes</span>
                   <span className="font-medium">₹{Number(q.tax_amount).toLocaleString('en-IN')}</span>
                 </div>
                 {Number(q.discount_amount) > 0 && (
                   <div className="flex justify-between text-sm text-green-600">
                     <span>Discount Applied</span>
                     <span className="font-medium">- ₹{Number(q.discount_amount).toLocaleString('en-IN')}</span>
                   </div>
                 )}
                 <div className="pt-4 border-t flex justify-between items-center">
                   <span className="font-bold text-slate-900">Total Payable</span>
                   <span className="text-2xl font-bold text-indigo-600">₹{Number(q.final_amount).toLocaleString('en-IN')}</span>
                 </div>
              </CardContent>
              
              {!isLocked && (
                <CardFooter className="bg-slate-50 flex-col gap-3 p-4">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white" size="lg"
                    onClick={() => {
                      toast('Processing acceptance...');
                      interactMutation.mutate({ action: 'accept', message: 'I have formally accepted this quotation online.' });
                    }}
                    disabled={interactMutation.isPending}
                  >
                    <CheckCircle2 className="w-5 h-5 mr-2"/> Accept & Confirm
                  </Button>
                  <Button 
                    variant="outline" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200" 
                    onClick={() => {
                      if(window.confirm('Are you sure you want to officially reject this quote?')) {
                        interactMutation.mutate({ action: 'reject', message: 'I have rejected this quotation.' });
                      }
                    }}
                    disabled={interactMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2"/> Decline Quote
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
        </div>
        
      </div>
    </div>
  );
}
