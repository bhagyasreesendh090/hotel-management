import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  Hotel,
  LineChart,
  Users,
  UtensilsCrossed,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import apiClient from '../../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

type DashboardStats = {
  bookings_created_today: number;
  open_leads: number;
  banquet_next_7_days: number;
};

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

const ExecutiveDashboardPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: async () => {
      const { data: d } = await apiClient.get<DashboardStats>('/api/reports/dashboard');
      return d;
    },
  });

  const { data: pipelineData } = useQuery({
    queryKey: ['reports-pipeline'],
    queryFn: async () => {
      const { data: d } = await apiClient.get<{ pipeline: { pipeline_stage: string, count: number }[] }>('/api/reports/crm/pipeline');
      return d.pipeline.map(item => ({
        name: item.pipeline_stage.replace(/_/g, ' ').toUpperCase(),
        value: item.count
      }));
    },
  });

  const stats = [
    {
      label: 'Bookings today',
      value: data?.bookings_created_today ?? '—',
      hint: 'New room reservations logged today',
      icon: Hotel,
      accent: 'from-violet-500 to-fuchsia-600',
    },
    {
      label: 'Open leads',
      value: data?.open_leads ?? '—',
      hint: 'Still being worked — call or quote next',
      icon: Users,
      accent: 'from-sky-500 to-cyan-600',
    },
    {
      label: 'Banquets (7 days)',
      value: data?.banquet_next_7_days ?? '—',
      hint: 'Events coming up this week',
      icon: UtensilsCrossed,
      accent: 'from-amber-500 to-orange-600',
    },
  ];

  const shortcuts = [
    { to: '/crm/leads', label: 'Leads', sub: 'Pipeline & follow-ups', icon: ClipboardList },
    { to: '/crs/bookings', label: 'Bookings', sub: 'Reservations & status', icon: CalendarDays },
    { to: '/crs/availability', label: 'Availability', sub: 'Pick dates & property', icon: LineChart },
    { to: '/banquet/bookings', label: 'Banquets', sub: 'Venues & holds', icon: UtensilsCrossed },
  ];

  return (
    <div className="min-h-0 space-y-10 pb-12">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-900 px-6 py-12 sm:px-10 text-white shadow-2xl">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        
        <div className="relative flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-xs font-bold uppercase tracking-widest text-indigo-300">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
               Enterprise Dashboard
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              Intelligence at the <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">Speed of Business.</span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed max-w-xl font-light">
              Real-time analytics across your entire property portfolio. Monitor conversion velocity, banquet utilization, and room inventory from one command center.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button asChild size="lg" className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-lg shadow-indigo-900/40 px-8">
                <Link to="/crm/leads">Generate Reports</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-2xl border-slate-700 bg-transparent text-white hover:bg-white/5 px-8"
              >
                <Link to="/crs/availability">View Inventory</Link>
              </Button>
            </div>
          </div>

          <div className="hidden lg:block w-full max-w-xs">
             <div className="p-6 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
                <div className="flex justify-between items-center mb-6">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Channels</p>
                   <div className="h-2 w-2 rounded-full bg-green-400" />
                </div>
                <div className="space-y-4">
                   {[
                     { label: 'Direct Web', val: '64%', color: 'bg-indigo-500' },
                     { label: 'OTA Sync', val: '28%', color: 'bg-fuchsia-500' },
                     { label: 'Offline', val: '8%', color: 'bg-slate-500' },
                   ].map(c => (
                     <div key={c.label}>
                       <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-slate-300">{c.label}</span>
                          <span className="font-bold">{c.val}</span>
                       </div>
                       <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full ${c.color}`} style={{ width: c.val }} />
                       </div>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {stats.map((s, idx) => {
          const links = ['/crs/bookings', '/crm/leads', '/banquet/bookings'];
          return (
            <Link key={s.label} to={links[idx]} className="block group">
              <Card
                className="border-0 bg-white shadow-xl shadow-slate-200/40 rounded-[2rem] overflow-hidden h-full group-hover:-translate-y-1 transition-all duration-300"
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                  <div className={`rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg ${s.accent}`}>
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div className="text-right">
                    <CardDescription className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{s.label}</CardDescription>
                    <CardTitle className="text-4xl font-black tabular-nums mt-1 text-slate-900">
                      {isLoading ? <span className="text-slate-200 animate-pulse">…</span> : s.value}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                     <div className="h-1 flex-1 bg-slate-50 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '70%' }} />
                     </div>
                     <p className="text-[10px] font-bold text-slate-400 whitespace-nowrap">{s.hint}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Sales Pipeline Chart */}
        <Card className="lg:col-span-2 border-0 bg-white shadow-xl shadow-slate-200/40 rounded-[2rem] overflow-hidden">
          <CardHeader className="border-b border-slate-50 p-8 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black text-slate-900">CRM Conversion Pipeline</CardTitle>
              <CardDescription>Visualizing lead distribution across stages</CardDescription>
            </div>
            <TrendingUp className="text-indigo-500 w-6 h-6" />
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData || []} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                    {(pipelineData || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Quick Access Grid */}
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Rapid Access</h2>
              <p className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">PINNED</p>
           </div>
           <div className="grid gap-4">
              {shortcuts.map((x) => (
                <Link
                  key={x.to}
                  to={x.to}
                  className="group flex items-center gap-4 rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/30 border border-transparent hover:border-indigo-200 hover:shadow-indigo-100 transition-all duration-300"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white transition-transform group-hover:scale-110 shadow-lg shadow-slate-900/20">
                    <x.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight text-sm">{x.label}</p>
                    <p className="text-xs text-slate-500 font-medium">{x.sub}</p>
                  </div>
                  <ArrowRight className="ml-auto w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
           </div>
        </div>
      </div>

      {/* Analytics Footer Callout */}
      <Card className="border-0 bg-gradient-to-r from-indigo-600 to-violet-700 text-white rounded-[2.5rem] shadow-2xl shadow-indigo-900/20 p-2 overflow-hidden relative">
        <div className="absolute top-0 right-0 h-full w-1/3 bg-white/5 -skew-x-12 transform origin-top translate-x-20" />
        <CardHeader className="relative">
          <CardTitle className="text-2xl font-black tracking-tight">Need granular inventory depth?</CardTitle>
          <CardDescription className="text-indigo-100 text-lg font-light max-w-2xl">
            Our high-level summary gives you the pulse. For surgical adjustments to room rates and specific dates, use the CRS Availability grid.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <Button asChild size="lg" className="rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 px-10 font-bold shadow-xl border-0">
            <Link to="/crs/availability">Switch to Availability Engine</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboardPage;
