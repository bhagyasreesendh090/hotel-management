import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, XCircle, Send, Building2, MapPin, Mail, AlertTriangle, FileText, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { ScrollArea } from '../../components/ui/scroll-area';
import { DocumentLogo } from '../../components/brand/DocumentLogo';

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
      toast.success('Response submitted successfully');
    },
    onError: () => toast.error('Failed to submit response')
  });

  const payMutation = useMutation({
    mutationFn: async ({ amount, type }: { amount: number, type: 'full' | 'advance' }) => {
      const res = await apiClient.post(`/api/public/quotations/${token}/pay-demo`, { amount, type });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Payment successful! Your booking is confirmed.');
      queryClient.invalidateQueries({ queryKey: ['public_quote', token] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Payment failed')
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

  const { quotation: q, property: p, interactions, lead } = data;
  const items = q.financial_summary?.items || [];
  const policies = q.policies || {};

  const isLocked = ['accepted', 'rejected', 'expired', 'paid'].includes(q.status);

  // Group items if possible (e.g. by description keywords or if we had a type field)
  const accommodationItems = items.filter((it: any) => 
    it.description.toLowerCase().includes('room') || 
    it.description.toLowerCase().includes('stay') || 
    it.description.toLowerCase().includes('bed') ||
    it.description.toLowerCase().includes('pax')
  );
  
  const fbItems = items.filter((it: any) => 
    it.description.toLowerCase().includes('lunch') || 
    it.description.toLowerCase().includes('dinner') || 
    it.description.toLowerCase().includes('breakfast') || 
    it.description.toLowerCase().includes('snack') ||
    it.description.toLowerCase().includes('buffet') ||
    it.description.toLowerCase().includes('tea')
  );

  const otherItems = items.filter((it: any) => 
    !accommodationItems.includes(it) && !fbItems.includes(it)
  );

  return (
    <div className="min-h-screen bg-slate-200 py-8 px-4 sm:px-6 font-serif">
      <div className="max-w-[1000px] mx-auto space-y-6">
        
        {/* Document Actions (Non-printable) */}
        <div className="flex justify-end gap-3 no-print">
           <Button variant="outline" className="bg-white" onClick={() => window.print()}>
             Print / Download PDF
           </Button>
           {!isLocked && (
             <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => interactMutation.mutate({ action: 'accept', message: 'I have formally accepted this quotation online.' })}>
               Accept Online
             </Button>
           )}
        </div>

        {/* The Paper Document */}
        <div className="bg-white shadow-2xl p-12 min-h-[1400px] text-slate-800 relative border border-slate-300">
           
           {/* Header with Branding */}
           <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8 mb-8">
              <div className="space-y-2">
                 <DocumentLogo logo={p.document_logo} className="h-28 w-80" />
                 <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{p.name || 'Pramod Hotels & Resorts'}</p>
              </div>
              <div className="text-right text-xs space-y-1">
                 <p className="font-bold">Date: {format(new Date(q.created_at), 'MMMM dd, yyyy')}</p>
                 <p>Ref: {q.quotation_number}</p>
              </div>
           </div>

           {/* Client Details */}
           <div className="space-y-6 mb-10">
              <div>
                 <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">To,</p>
                 <h2 className="text-xl font-bold text-slate-900">{lead?.contact_name || 'Valued Guest'}</h2>
                 {lead?.contact_phone && <p className="text-sm text-slate-700">{lead.contact_phone}</p>}
                 {lead?.contact_email && <p className="text-sm text-slate-700">{lead.contact_email}</p>}
              </div>

              <div>
                 <p className="text-lg font-medium">{q.client_salutation},</p>
                 <p className="mt-4 leading-relaxed">
                    Greetings from <span className="font-bold">{p.name || 'Pramod Lands End Resort, Gopalpur'}</span>. 
                    Based on your requirements, we are pleased to share our special quotation for your planned event as follows;
                 </p>
              </div>
           </div>

           {/* Event Summary Section */}
           {policies.event_details && (
             <div className="bg-slate-50 border-2 border-slate-200 p-6 rounded-lg mb-10 text-xs grid grid-cols-2 gap-y-2">
                <p><span className="font-bold">Arrival date:</span> {policies.event_details.arrival_date || 'N/A'}</p>
                <p><span className="font-bold">Departure date:</span> {policies.event_details.departure_date || 'N/A'}</p>
                <p><span className="font-bold">Total Rooms:</span> {policies.event_details.total_rooms || 'N/A'}</p>
                <p><span className="font-bold">Extra beds:</span> {policies.event_details.extra_beds || 'N/A'}</p>
                <p><span className="font-bold">Occupants:</span> {policies.event_details.occupants || 'N/A'}</p>
                <p><span className="font-bold">Accommodation package:</span> {policies.event_details.package_type || 'N/A'}</p>
             </div>
           )}

           {/* Accommodation Section */}
           {accommodationItems.length > 0 && (
             <div className="space-y-4 mb-10">
                <h3 className="text-lg font-bold border-b-2 border-slate-200 pb-1">Accommodation Details:</h3>
                <table className="w-full border-collapse border border-slate-800 text-xs">
                   <thead className="bg-slate-50">
                      <tr>
                         <th className="border border-slate-800 p-2 text-left w-1/3">Room type</th>
                         <th className="border border-slate-800 p-2 text-center">Qty / Pax</th>
                         <th className="border border-slate-800 p-2 text-right">Tariff</th>
                         <th className="border border-slate-800 p-2 text-center">GST %</th>
                         <th className="border border-slate-800 p-2 text-right">Total (Incl. Tax)</th>
                      </tr>
                   </thead>
                   <tbody>
                      {accommodationItems.map((it: any, i: number) => {
                         const sub = Number(it.unit_price) * Number(it.quantity);
                         const tax = sub * (Number(it.tax_rate) / 100);
                         return (
                            <tr key={i}>
                               <td className="border border-slate-800 p-2 font-medium">{it.description}</td>
                               <td className="border border-slate-800 p-2 text-center">{it.quantity}</td>
                               <td className="border border-slate-800 p-2 text-right">₹{Number(it.unit_price).toLocaleString('en-IN')}</td>
                               <td className="border border-slate-800 p-2 text-center">{it.tax_rate}%</td>
                               <td className="border border-slate-800 p-2 text-right font-bold">₹{(sub + tax).toLocaleString('en-IN')}</td>
                            </tr>
                         );
                      })}
                   </tbody>
                </table>
             </div>
           )}

           {/* F&B Section */}
           {fbItems.length > 0 && (
             <div className="space-y-4 mb-10">
                <h3 className="text-lg font-bold border-b-2 border-slate-200 pb-1">Food & Beverage Details:</h3>
                <table className="w-full border-collapse border border-slate-800 text-xs">
                   <thead className="bg-slate-50">
                      <tr>
                         <th className="border border-slate-800 p-2 text-left w-1/3">Details</th>
                         <th className="border border-slate-800 p-2 text-center">Pax</th>
                         <th className="border border-slate-800 p-2 text-right">Rate / Person</th>
                         <th className="border border-slate-800 p-2 text-center">GST %</th>
                         <th className="border border-slate-800 p-2 text-right">Total</th>
                      </tr>
                   </thead>
                   <tbody>
                      {fbItems.map((it: any, i: number) => {
                        const sub = Number(it.unit_price) * Number(it.quantity);
                        const tax = sub * (Number(it.tax_rate) / 100);
                        return (
                          <tr key={i}>
                             <td className="border border-slate-800 p-2 font-medium">{it.description}</td>
                             <td className="border border-slate-800 p-2 text-center">{it.quantity}</td>
                             <td className="border border-slate-800 p-2 text-right">₹{Number(it.unit_price).toLocaleString('en-IN')}</td>
                             <td className="border border-slate-800 p-2 text-center">{it.tax_rate}%</td>
                             <td className="border border-slate-800 p-2 text-right font-bold">₹{(sub + tax).toLocaleString('en-IN')}</td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
             </div>
           )}

           {/* Grand Summary */}
           <div className="flex justify-end mb-12">
              <div className="w-1/2 space-y-2 border-t-4 border-slate-900 pt-4">
                 <div className="flex justify-between text-sm">
                    <span className="font-medium">Total Estimate Cost:</span>
                    <span className="font-bold">₹{Number(q.total_amount + q.tax_amount).toLocaleString('en-IN')}</span>
                 </div>
                 {Number(q.discount_amount) > 0 && (
                   <div className="flex justify-between text-sm text-green-700">
                      <span>Discount:</span>
                      <span>- ₹{Number(q.discount_amount).toLocaleString('en-IN')}</span>
                   </div>
                 )}
                 <div className="flex justify-between text-xl bg-slate-900 text-white p-3 rounded mt-2">
                    <span className="font-black uppercase tracking-tighter">Final Total</span>
                    <span className="font-black italic">₹{Number(q.final_amount).toLocaleString('en-IN')}</span>
                 </div>
              </div>
           </div>

           {/* Policy & Notes */}
           <div className="grid grid-cols-2 gap-10 mb-10 text-[10px] leading-relaxed">
              <div className="space-y-4">
                 <h4 className="font-bold border-b border-slate-300">Bank Details for Payment:</h4>
                 <div className="grid grid-cols-2 gap-x-2">
                    <span className="text-slate-500">Name of Company:</span><span className="font-bold">Padma Eastern Hotels Private Limited</span>
                    <span className="text-slate-500">Bank Name:</span><span className="font-bold">HDFC Bank</span>
                    <span className="text-slate-500">Account Name:</span><span className="font-bold">Padma Eastern Hotels Private Limited</span>
                    <span className="text-slate-500">Account Number:</span><span className="font-bold">50200090446011</span>
                    <span className="text-slate-500">IFSC Code:</span><span className="font-bold">HDFC0001107</span>
                    <span className="text-slate-500">Branch:</span><span>Berhampur, Odisha</span>
                 </div>
                 <p className="bg-amber-50 p-2 italic border-l-2 border-amber-400">Payment advice to be shared by the guest on every transaction to the hotel for payment acknowledgement against the booking.</p>
              </div>

              <div className="space-y-4">
                 <h4 className="font-bold border-b border-slate-300">Important Notes:</h4>
                 <ul className="list-disc pl-4 space-y-1">
                    <li>Address proof with photo is mandatory for check-in.</li>
                    <li>Check-in time is 14:00 Hrs, and check-out time is 11:00 Hrs.</li>
                    <li>Early check-in/Late check-out subject to availability.</li>
                    <li>Menu confirmation required at least 15 days prior to event.</li>
                    <li>Minimum advance of 5,00,000/- is mandatory for confirmation.</li>
                 </ul>
              </div>
           </div>

           {/* Policies Section */}
           <div className="border-t-2 border-slate-900 pt-8 mb-10">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-700 mb-4">Terms, Conditions & Hotel Policies</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[9px] leading-relaxed">
                {(() => {
                  // Support both new dynamic policy_list and old flat field format
                  const COLOR_BORDER: Record<string, string> = {
                    red: 'border-red-400', amber: 'border-amber-400', green: 'border-green-500',
                    blue: 'border-blue-400', indigo: 'border-indigo-400', slate: 'border-slate-400',
                  };
                  const COLOR_TEXT: Record<string, string> = {
                    red: 'text-red-700', amber: 'text-amber-700', green: 'text-green-700',
                    blue: 'text-blue-700', indigo: 'text-indigo-700', slate: 'text-slate-700',
                  };

                  // Build a unified list from whatever format is stored
                  const list: Array<{ id: string; title: string; content: string; color: string }> =
                    policies.policy_list?.length > 0
                      ? policies.policy_list
                      : [
                          policies.cancellation_policy && { id: 'p1', title: 'Cancellation Policy', color: 'red', content: policies.cancellation_policy },
                          policies.liquor_policy       && { id: 'p2', title: 'Liquor & Alcohol Policy', color: 'amber', content: policies.liquor_policy },
                          policies.payment_terms       && { id: 'p3', title: 'Payment Terms', color: 'green', content: policies.payment_terms },
                          policies.check_in_out_policy && { id: 'p4', title: 'Check-in / Check-out', color: 'blue', content: policies.check_in_out_policy },
                          policies.general_notes       && { id: 'p5', title: 'General Notes', color: 'slate', content: policies.general_notes },
                          policies.terms               && { id: 'p6', title: 'General Terms', color: 'slate', content: policies.terms },
                        ].filter(Boolean) as typeof list;

                  if (list.length === 0) {
                    return <p className="text-slate-400 italic col-span-2">No policies were specified for this quotation.</p>;
                  }
                  return list.map((p) => (
                    <div key={p.id} className={`space-y-1 border-l-2 pl-3 ${COLOR_BORDER[p.color] ?? 'border-slate-400'}`}>
                      <p className={`font-bold text-[10px] uppercase ${COLOR_TEXT[p.color] ?? 'text-slate-700'}`}>{p.title}</p>
                      <p className="text-slate-600 whitespace-pre-wrap">{p.content}</p>
                    </div>
                  ));
                })()}
              </div>
           </div>


           {/* Signature Footer */}
           <div className="flex justify-between items-end mt-20 pt-10 border-t border-slate-100 text-[10px]">
              <div>
                 <p className="font-bold">Thanks & regards,</p>
                 <p className="text-lg font-bold mt-2 text-slate-900 uppercase">Sales & Marketing Team</p>
                 <p>{p.name || 'Pramod Hotels & Resorts'}</p>
                 <p>{p.address || 'Odisha, India'}</p>
              </div>
              <div className="text-right italic text-slate-400">
                 This is a computer generated document and does not require a physical signature.
              </div>
           </div>

        </div>

        {/* Discussion / Actions Sidebar (Non-printable) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
           <div className="md:col-span-2">
             <Card className="shadow-sm">
                <CardHeader className="bg-slate-50 border-b"><CardTitle className="text-sm">Discussions & Queries</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-48 p-4">
                    <div className="space-y-4">
                      {interactions.length === 0 ? (
                        <p className="text-center text-slate-400 text-sm py-8 italic">Start a conversation with our sales manager...</p>
                      ) : (
                        interactions.map((msg: any, i: number) => (
                          <div key={i} className={`flex flex-col ${msg.sender_type === 'client' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[80%] rounded-xl px-4 py-2 ${msg.sender_type === 'client' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-900 rounded-bl-none'}`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1">{format(new Date(msg.created_at), 'hh:mm a')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {!isLocked && (
                    <div className="p-4 border-t flex gap-2 bg-slate-50">
                      <Textarea 
                        placeholder="Request a change or ask a question..." 
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
              {!isLocked && (
                <div className="space-y-3">
                   <Button 
                     className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold" 
                     onClick={() => interactMutation.mutate({ action: 'accept', message: 'I have formally accepted this quotation online.' })}
                     disabled={interactMutation.isPending}
                   >
                     Confirm Quote
                   </Button>
                   <Button 
                     variant="outline" className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50"
                     onClick={() => { if(window.confirm('Officially decline this quote?')) interactMutation.mutate({ action: 'reject', message: 'Decline.' }); }}
                     disabled={interactMutation.isPending}
                   >
                     Decline
                   </Button>
                </div>
              )}

              {q.status === 'accepted' && (
                <Card className="border-indigo-200 bg-indigo-50 shadow-md">
                  <CardHeader className="pb-3 border-b border-indigo-100">
                    <CardTitle className="text-indigo-900 flex items-center gap-2 text-base">
                      <CreditCard className="w-5 h-5 text-indigo-600" /> Payment Required
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-sm text-indigo-800 leading-relaxed">
                      Your quotation is accepted and room/venue is on <strong>HOLD</strong>. 
                      Please complete your payment to confirm the booking.
                    </p>
                    <div className="space-y-2">
                      <Button 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12"
                        onClick={() => {
                          if (window.confirm(`Process demo payment of ₹${Number(q.final_amount).toLocaleString('en-IN')}?`)) {
                            payMutation.mutate({ amount: Number(q.final_amount), type: 'full' });
                          }
                        }}
                        disabled={payMutation.isPending}
                      >
                        Pay Full (₹{Number(q.final_amount).toLocaleString('en-IN')})
                      </Button>
                      <Button 
                        variant="outline"
                        className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-100 bg-white h-12"
                        onClick={() => {
                          const advance = Number(q.final_amount) * 0.5;
                          if (window.confirm(`Process 50% advance demo payment of ₹${advance.toLocaleString('en-IN')}?`)) {
                            payMutation.mutate({ amount: advance, type: 'advance' });
                          }
                        }}
                        disabled={payMutation.isPending}
                      >
                        Pay 50% Advance (₹{(Number(q.final_amount) * 0.5).toLocaleString('en-IN')})
                      </Button>
                    </div>
                    <p className="text-xs text-indigo-500 text-center">
                      * This is a demo payment gateway.
                    </p>
                  </CardContent>
                </Card>
              )}

              {q.status === 'paid' && (
                <Card className="border-green-200 bg-green-50 shadow-md">
                  <CardContent className="pt-6 space-y-4 text-center">
                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-green-900 text-lg">Booking Confirmed</h3>
                      <p className="text-sm text-green-800 mt-1">Payment has been successfully received.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
           </div>
        </div>
        
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; padding: 0 !important; }
          .min-h-screen { min-height: auto !important; padding: 0 !important; }
          .max-w-[1000px] { max-width: none !important; margin: 0 !important; }
          .shadow-2xl { box-shadow: none !important; border: none !important; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700;900&display=swap');
        .font-serif { font-family: 'Crimson Pro', serif; }
      `}} />
    </div>
  );
}
