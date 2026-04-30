import React, { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileSignature, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '../../api/client';
import { format } from 'date-fns';
import { DocumentLogo } from '../../components/brand/DocumentLogo';

export default function PublicContractView() {
  const { token } = useParams<{ token: string }>();
  const [rejectMode, setRejectMode] = useState(false);
  const [message, setMessage] = useState('');

  const { data: contractData, isLoading, refetch } = useQuery({
    queryKey: ['publicContract', token],
    queryFn: async () => {
      const res = await apiClient.get(`/api/public/contracts/${token}`);
      return res.data;
    },
    enabled: !!token,
    retry: false
  });

  const interactMutation = useMutation({
    mutationFn: async (action: 'accept' | 'reject') => {
      const res = await apiClient.post(`/api/public/contracts/${token}/interact`, { action, message });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Your response has been legally recorded!');
      refetch();
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to sync response')
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!contractData) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Contract not found or unavailable.</div>;
  }

  const { contract, property } = contractData;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Branding Header */}
        <div className="text-center space-y-4">
          <DocumentLogo logo={property?.document_logo} className="mx-auto h-32 w-full max-w-md" />
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{property?.name || 'Hotel Properties'}</h1>
            <p className="text-slate-500 mt-1">{property?.address}</p>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-xl flex items-center justify-between border ${
            contract.status === 'accepted' ? 'bg-green-50 text-green-900 border-green-200' : 
            contract.status === 'rejected' ? 'bg-red-50 text-red-900 border-red-200' : 
            'bg-slate-100 text-slate-900 border-slate-200'
          }`}>
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FileSignature className="w-5 h-5"/> Contract #{contract.contract_number}
            </h2>
            <p className="text-sm opacity-80 mt-1">Status: {contract.status.toUpperCase()}</p>
          </div>
          {contract.status === 'accepted' && <CheckCircle className="w-8 h-8 text-green-600" />}
          {contract.status === 'rejected' && <XCircle className="w-8 h-8 text-red-600" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-900 text-white p-6">
               <h3 className="text-xl font-bold">Terms & Conditions</h3>
               <p className="text-slate-300 text-sm mt-1">Please read the following stipulations carefully.</p>
             </div>
             <div className="p-8 prose prose-slate max-w-none font-serif leading-relaxed text-slate-800 whitespace-pre-wrap">
                {contract.terms || 'No specific terms documented.'}
             </div>
          </div>

          <div className="space-y-6">
             <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h4 className="font-semibold text-slate-900 mb-4 pb-4 border-b">Legal Deadlines</h4>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                     <Calendar className="w-5 h-5 text-indigo-500 mt-0.5" />
                     <div>
                       <p className="text-sm font-medium text-slate-900">Sign By (Expires On)</p>
                       <p className="text-sm text-slate-600">{contract.expires_on ? format(new Date(contract.expires_on), 'PPP') : 'N/A'}</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-3">
                     <Calendar className="w-5 h-5 text-indigo-500 mt-0.5" />
                     <div>
                       <p className="text-sm font-medium text-slate-900">Payment Deadline</p>
                       <p className="text-sm text-slate-600">{contract.payment_deadline ? format(new Date(contract.payment_deadline), 'PPP') : 'N/A'}</p>
                     </div>
                  </div>
                  <div className="pt-4 border-t mt-4">
                       <p className="text-sm font-medium text-slate-900">Total Liability</p>
                       <p className="text-2xl font-bold text-slate-900">₹{Number(contract.total_value).toLocaleString('en-IN')}</p>
                  </div>
                </div>
             </div>

             {/* Actions */}
             {['sent', 'viewed', 'draft', 'pending_approval'].includes(contract.status) && (
               <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                 {rejectMode ? (
                   <div className="space-y-3">
                     <h4 className="font-medium text-sm">Reason for rejection</h4>
                     <textarea 
                        className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500"
                        rows={3}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Please instruct us on what needs to be changed..."
                     />
                     <div className="flex gap-2">
                        <button className="flex-1 py-2 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200" onClick={() => setRejectMode(false)}>Cancel</button>
                        <button className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50" onClick={() => interactMutation.mutate('reject')} disabled={interactMutation.isPending}>Confirm Reject</button>
                     </div>
                   </div>
                 ) : (
                   <>
                     <button 
                       className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all disabled:opacity-50"
                       onClick={() => interactMutation.mutate('accept')}
                       disabled={interactMutation.isPending}
                     >
                       {interactMutation.isPending ? 'Processing...' : 'Digitally Accept & Sign'}
                     </button>
                     <p className="text-xs text-center text-slate-500">By clicking accept, you formally agree to the stipulations presented above.</p>
                     <button 
                       className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                       onClick={() => setRejectMode(true)}
                     >
                       Decline / Request Changes
                     </button>
                   </>
                 )}
               </div>
             )}

             {contract.signed_ack && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center shadow-sm">
                   <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                     <FileSignature className="w-6 h-6 text-indigo-600" />
                   </div>
                   <h4 className="font-medium text-indigo-900 mb-1">Electronic Signature Active</h4>
                   <p className="text-xs text-indigo-700 opacity-80 break-words font-mono bg-indigo-50">{contract.signed_ack}</p>
                </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
