import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import {
  BedDouble, CalendarDays, FileText, FileSignature,
  CheckCircle2, Clock, XCircle, Send, MessageSquare,
  TrendingUp, AlertTriangle, RefreshCw, Eye
} from 'lucide-react';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

/* ─── helpers ─────────────────────────────────── */
const ROOM_STATUS_COLOR: Record<string, string> = {
  INQ: 'bg-slate-100 text-slate-700',
  'QTN-HOLD': 'bg-amber-100 text-amber-800',
  TENT: 'bg-yellow-100 text-yellow-800',
  'CONF-U': 'bg-blue-100 text-blue-800',
  'CONF-P': 'bg-indigo-100 text-indigo-800',
  SOLD: 'bg-green-100 text-green-800',
  CI: 'bg-teal-100 text-teal-800',
  CO: 'bg-gray-100 text-gray-700',
  CXL: 'bg-red-100 text-red-800',
};

const QUOTE_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-indigo-100 text-indigo-800',
  rejected: 'bg-red-100 text-red-800',
  accepted: 'bg-green-100 text-green-800',
  revised: 'bg-purple-100 text-purple-800',
};

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const BANQUET_STATUS_COLOR: Record<string, string> = {
  INQ: 'bg-slate-100 text-slate-700',
  'QTN-HOLD': 'bg-amber-100 text-amber-800',
  TENT: 'bg-yellow-100 text-yellow-800',
  'CONF-U': 'bg-blue-100 text-blue-800',
  'CONF-P': 'bg-indigo-100 text-indigo-800',
  CXL: 'bg-red-100 text-red-800',
};

const statusLabel = (s: string) => s.replace(/_/g, ' ').replace(/-/g, '-');

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color.replace('text-', 'bg-').replace('-800', '-100').replace('-700', '-100')}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── main component ───────────────────────────── */
export default function StatusTrackerPage() {
  const navigate = useNavigate();
  const { selectedPropertyId } = useProperty();
  const [activeTab, setActiveTab] = useState('overview');

  const pid = selectedPropertyId;

  const { data: bookingsData, isLoading: loadingBookings } = useQuery({
    queryKey: ['tracker_bookings', pid],
    queryFn: async () => {
      const r = await apiClient.get('/api/crs/bookings', { params: pid ? { property_id: pid } : {} });
      return r.data.bookings || [];
    },
  });

  const { data: banquetData, isLoading: loadingBanquet } = useQuery({
    queryKey: ['tracker_banquet', pid],
    queryFn: async () => {
      const r = await apiClient.get('/api/banquet/banquet-bookings', { params: pid ? { property_id: pid } : {} });
      return r.data.banquet_bookings || [];
    },
  });

  const { data: quotationsData, isLoading: loadingQuotations } = useQuery({
    queryKey: ['tracker_quotations', pid],
    queryFn: async () => {
      const r = await apiClient.get('/api/crm/quotations', { params: pid ? { property_id: pid } : {} });
      return r.data.quotations || [];
    },
  });

  const { data: contractsData, isLoading: loadingContracts } = useQuery({
    queryKey: ['tracker_contracts', pid],
    queryFn: async () => {
      const r = await apiClient.get('/api/crm/contracts', { params: pid ? { property_id: pid } : {} });
      return r.data.contracts || [];
    },
  });

  const bookings: any[] = bookingsData || [];
  const banquets: any[] = banquetData || [];
  const quotations: any[] = quotationsData || [];
  const contracts: any[] = contractsData || [];

  const isLoading = loadingBookings || loadingBanquet || loadingQuotations || loadingContracts;

  /* ─ stats ─ */
  const roomByStatus = bookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1; return acc;
  }, {});

  const banquetByStatus = banquets.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1; return acc;
  }, {});

  const quoteByStatus = quotations.reduce<Record<string, number>>((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1; return acc;
  }, {});

  const contractByStatus = contracts.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1; return acc;
  }, {});

  const totalSent = (quoteByStatus['sent'] || 0);
  const totalAccepted = (quoteByStatus['accepted'] || 0);
  const totalPending = (quoteByStatus['pending_approval'] || 0);
  const totalRejected = (quoteByStatus['rejected'] || 0);
  const replyRate = quotations.length > 0
    ? Math.round(((totalAccepted + totalRejected + totalPending) / quotations.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading status data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Booking & Quotation Tracker</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Live status of all room bookings, banquet bookings, quotations sent, and contract replies.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BedDouble className="w-5 h-5" />} label="Room Bookings" value={bookings.length}
          sub={`${roomByStatus['CI'] || 0} checked-in`} color="text-indigo-700" />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="Banquet Bookings" value={banquets.length}
          sub={`${banquetByStatus['CONF-P'] || 0} confirmed`} color="text-teal-700" />
        <StatCard icon={<Send className="w-5 h-5" />} label="Quotes Sent" value={totalSent}
          sub={`${replyRate}% reply rate`} color="text-blue-700" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Quotes Accepted" value={totalAccepted}
          sub={`${totalRejected} rejected`} color="text-green-700" />
      </div>

      {/* Quotation Reply Stats */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" />
            Quotation Reply Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Draft', count: quoteByStatus['draft'] || 0, icon: <FileText className="w-4 h-4" />, color: 'bg-slate-50 border-slate-200 text-slate-600' },
              { label: 'Sent (Awaiting Reply)', count: quoteByStatus['sent'] || 0, icon: <Send className="w-4 h-4" />, color: 'bg-blue-50 border-blue-200 text-blue-700' },
              { label: 'Pending Approval', count: quoteByStatus['pending_approval'] || 0, icon: <Clock className="w-4 h-4" />, color: 'bg-amber-50 border-amber-200 text-amber-700' },
              { label: 'Accepted', count: quoteByStatus['accepted'] || 0, icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-green-50 border-green-200 text-green-700' },
              { label: 'Revised', count: quoteByStatus['revised'] || 0, icon: <RefreshCw className="w-4 h-4" />, color: 'bg-purple-50 border-purple-200 text-purple-700' },
              { label: 'Rejected', count: quoteByStatus['rejected'] || 0, icon: <XCircle className="w-4 h-4" />, color: 'bg-red-50 border-red-200 text-red-700' },
              { label: 'Contracts Signed', count: contractByStatus['accepted'] || 0, icon: <FileSignature className="w-4 h-4" />, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
              { label: 'Contracts Pending', count: (contractByStatus['sent'] || 0) + (contractByStatus['draft'] || 0), icon: <AlertTriangle className="w-4 h-4" />, color: 'bg-orange-50 border-orange-200 text-orange-700' },
            ].map(({ label, count, icon, color }) => (
              <div key={label} className={`flex items-center gap-3 p-3 rounded-xl border ${color}`}>
                {icon}
                <div>
                  <p className="text-xl font-black">{count}</p>
                  <p className="text-xs font-medium leading-tight">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="overview" className="gap-2"><TrendingUp className="w-4 h-4" />Overview</TabsTrigger>
          <TabsTrigger value="room" className="gap-2"><BedDouble className="w-4 h-4" />Room Bookings</TabsTrigger>
          <TabsTrigger value="banquet" className="gap-2"><CalendarDays className="w-4 h-4" />Banquet</TabsTrigger>
          <TabsTrigger value="quotes" className="gap-2"><FileText className="w-4 h-4" />Quotations</TabsTrigger>
          <TabsTrigger value="contracts" className="gap-2"><FileSignature className="w-4 h-4" />Contracts</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Room booking breakdown */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BedDouble className="w-4 h-4 text-indigo-500" />Room Booking Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(ROOM_STATUS_COLOR).map(([s, cls]) => (
                    <div key={s} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{statusLabel(s)}</span>
                      <span className="font-black text-slate-800 text-lg">{roomByStatus[s] || 0}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            {/* Banquet breakdown */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CalendarDays className="w-4 h-4 text-teal-500" />Banquet Status Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(BANQUET_STATUS_COLOR).map(([s, cls]) => (
                    <div key={s} className="flex items-center justify-between py-1.5 border-b last:border-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{statusLabel(s)}</span>
                      <span className="font-black text-slate-800 text-lg">{banquetByStatus[s] || 0}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ROOM BOOKINGS TAB */}
        <TabsContent value="room">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['Booking #', 'Guest', 'Room Types', 'Check-in', 'Check-out', 'Amount', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-slate-400">No room bookings found.</td></tr>
                    ) : bookings.map((b: any) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700 text-xs">{b.ds_number || `#${b.id}`}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{b.guest_name || b.booker_name || '—'}</p>
                          <p className="text-xs text-slate-400">{b.guest_email || b.booker_email || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{b.room_types || '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{b.check_in ? format(new Date(b.check_in), 'dd MMM') : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{b.check_out ? format(new Date(b.check_out), 'dd MMM') : '—'}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">₹{Number(b.total_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${ROOM_STATUS_COLOR[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" onClick={() => navigate('/crs/bookings')} className="gap-1 text-xs">
                            <Eye className="w-3 h-3" />View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BANQUET TAB */}
        <TabsContent value="banquet">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['ID', 'Venue', 'Event Date', 'Category', 'Session', 'PAX', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {banquets.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-slate-400">No banquet bookings found.</td></tr>
                    ) : banquets.map((b: any) => (
                      <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-teal-700 text-xs">#{b.id}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{b.venue_name}</td>
                        <td className="px-4 py-3 text-slate-600">{b.event_date ? format(new Date(b.event_date), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{b.event_category || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{b.slot_label || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{b.guaranteed_pax || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${BANQUET_STATUS_COLOR[b.status] || 'bg-slate-100 text-slate-600'}`}>{b.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" onClick={() => navigate('/banquet/bookings')} className="gap-1 text-xs">
                            <Eye className="w-3 h-3" />View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUOTATIONS TAB */}
        <TabsContent value="quotes">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['Quote #', 'Customer', 'Company', 'Amount', 'Valid Until', 'Reply Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-slate-400">No quotations found.</td></tr>
                    ) : quotations.map((q: any) => {
                      const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === 'sent';
                      return (
                        <tr key={q.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-blue-700 text-xs">{q.quotation_number}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{q.contact_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{q.company || '—'}</td>
                          <td className="px-4 py-3 font-semibold">₹{Number(q.final_amount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3">
                            {q.valid_until ? (
                              <span className={`text-xs ${isExpired ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                {isExpired && '⚠ '}{format(new Date(q.valid_until), 'dd MMM yyyy')}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${QUOTE_STATUS_COLOR[q.status] || 'bg-slate-100 text-slate-600'}`}>
                              {statusLabel(q.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/crm/quotes/${q.id}/edit${q.lead_id ? '?lead_id=' + q.lead_id : ''}`)} className="gap-1 text-xs">
                              <Eye className="w-3 h-3" />View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTRACTS TAB */}
        <TabsContent value="contracts">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {['Contract #', 'Client', 'Value', 'Payment Deadline', 'Expires On', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-slate-400">No contracts found.</td></tr>
                    ) : contracts.map((c: any) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700 text-xs">{c.contract_number}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{c.corporate_name || c.lead_contact || '—'}</p>
                          <p className="text-xs text-slate-400">{c.lead_company || ''}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold">₹{Number(c.total_value || 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-slate-600">{c.payment_deadline ? format(new Date(c.payment_deadline), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3 text-slate-600">{c.expires_on ? format(new Date(c.expires_on), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${CONTRACT_STATUS_COLOR[c.status] || 'bg-slate-100 text-slate-600'}`}>
                            {statusLabel(c.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/crm/contracts/${c.id}/edit`)} className="gap-1 text-xs">
                            <Eye className="w-3 h-3" />View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
