import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { 
  CalendarHeart, 
  Headphones, 
  ListChecks, 
  Phone, 
  PlusCircle, 
  TrendingUp,
  FileSignature,
  FileText,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  Coffee,
  ChevronRight,
  Target
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
import { useAuth } from '../../auth/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { format } from 'date-fns';

type DashboardStats = {
  bookings_created_today: number;
  open_leads: number;
  banquet_next_7_days: number;
};

const CHART_COLORS = ['#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

const AgentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const first = user?.full_name?.split(/\\s+/)[0] ?? 'Agent';
  const [greeting, setGreeting] = useState({ text: 'Good day', icon: Coffee });

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting({ text: 'Good morning', icon: Coffee });
    else if (hour < 18) setGreeting({ text: 'Good afternoon', icon: Sun });
    else setGreeting({ text: 'Good evening', icon: Moon });
  }, []);

  const { data, isLoading } = useQuery({
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
      })).slice(0, 5);
    },
  });


  const quickLinks = [
    {
      to: '/crm/leads',
      title: 'Manage Leads',
      body: 'Track your pipeline and convert inquiries.',
      icon: ListChecks,
      bg: 'bg-emerald-500',
      hover: 'hover:shadow-emerald-200'
    },
    {
      to: '/crm/quotations',
      title: 'Quotations',
      body: 'Draft and track active customer quotes.',
      icon: FileText,
      bg: 'bg-indigo-500',
      hover: 'hover:shadow-indigo-200'
    },
    {
      to: '/crm/contracts',
      title: 'Contracts',
      body: 'Execute formal agreements and terms.',
      icon: FileSignature,
      bg: 'bg-blue-500',
      hover: 'hover:shadow-blue-200'
    },
    {
      to: '/crs/bookings',
      title: 'New Booking',
      body: 'Check live availability and lock dates.',
      icon: CalendarHeart,
      bg: 'bg-violet-500',
      hover: 'hover:shadow-violet-200'
    },
    {
      to: '/banquet/bookings',
      title: 'Banquets',
      body: 'Manage venue slots, events, and food packages.',
      icon: Headphones,
      bg: 'bg-amber-500',
      hover: 'hover:shadow-amber-200'
    },
  ];


  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-[3rem] bg-slate-900 p-8 sm:p-14 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -m-16 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -m-16 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 text-sm font-semibold tracking-wide">
              <greeting.icon className="w-4 h-4 text-emerald-400" />
              <span>{greeting.text}, {first}</span>
              <span className="w-1 h-1 rounded-full bg-white/30 mx-1" />
              <span className="opacity-60">{format(new Date(), 'EEEE, MMMM do')}</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.1]">
              Close more <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">deals today.</span>
            </h1>
            <p className="max-w-xl text-xl text-slate-300/90 leading-relaxed font-light">
              Your conversion engine is running at full capacity. Use the live metrics below to prioritize high-value leads and upcoming events.
            </p>
          </div>
          
          <div className="hidden lg:block">
            <div className="p-8 rounded-[2.5rem] bg-white/5 backdrop-blur-2xl border border-white/10 text-center min-w-[240px] shadow-inner">
               <Clock className="mx-auto h-10 w-10 text-indigo-400 mb-4 opacity-80" />
               <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Efficiency Window</p>
               <p className="text-5xl font-black text-white mt-2">Active</p>
            </div>
          </div>
        </div>
      </div>


      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Link to="/crm/leads" className="block group">
          <Card className="border-0 bg-white shadow-xl shadow-slate-200/40 rounded-[2rem] overflow-hidden group-hover:-translate-y-1 transition-all duration-300 h-full">
            <CardContent className="p-8 relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-24 h-24 text-emerald-600" />
              </div>
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
                 <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Open Leads</p>
              <p className="text-5xl font-black text-slate-900 tracking-tighter">
                {isLoading ? '…' : data?.open_leads ?? '0'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/crs/bookings" className="block group">
          <Card className="border-0 bg-white shadow-xl shadow-slate-200/40 rounded-[2rem] overflow-hidden group-hover:-translate-y-1 transition-all duration-300 h-full">
            <CardContent className="p-8 relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <CalendarHeart className="w-24 h-24 text-indigo-600" />
              </div>
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 shadow-sm">
                 <CalendarHeart className="h-6 w-6 text-indigo-600" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Bookings Today</p>
              <p className="text-5xl font-black text-slate-900 tracking-tighter">
                {isLoading ? '…' : data?.bookings_created_today ?? '0'}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/banquet/bookings" className="block group">
          <Card className="border-0 bg-white shadow-xl shadow-slate-200/40 rounded-[2rem] overflow-hidden group-hover:-translate-y-1 transition-all duration-300 h-full">
            <CardContent className="p-8 relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Phone className="w-24 h-24 text-violet-600" />
              </div>
              <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mb-6 border border-violet-100 shadow-sm">
                 <Phone className="h-6 w-6 text-violet-600" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Events This Week</p>
              <p className="text-5xl font-black text-slate-900 tracking-tighter">
                {isLoading ? '…' : data?.banquet_next_7_days ?? '0'}
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2">
            <Card className="border-0 bg-white shadow-xl shadow-slate-200/40 rounded-[2.5rem] overflow-hidden h-full">
               <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Conversion Momentum</h3>
                    <p className="text-sm text-slate-500 font-medium">Your active lead distribution</p>
                  </div>
                  <Target className="w-6 h-6 text-indigo-500 opacity-40" />
               </div>
               <div className="p-8">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pipelineData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }} />
                        <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={45}>
                          {(pipelineData || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </Card>
         </div>

         <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest">Rapid Launch</h2>
                <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
            </div>
            <div className="grid gap-4">
              {quickLinks.slice(0, 4).map((link) => (
                <Link
                  key={link.title}
                  to={link.to}
                  className="group flex items-center gap-4 p-5 bg-white rounded-3xl shadow-lg shadow-slate-200/40 border border-transparent hover:border-indigo-100 hover:shadow-indigo-100 transition-all duration-300"
                >
                  <div className={`w-12 h-12 ${link.bg} rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110`}>
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{link.title}</h3>
                    <p className="text-[10px] text-slate-500 font-bold opacity-60">Ready to execute</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
         </div>
      </div>

      {/* Action Grid (Horizontal) */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Enterprise Modules</h2>
            <Link to="/crm/leads" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group bg-indigo-50 px-4 py-2 rounded-full">
               Open Pipeline <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          {quickLinks.slice(0, 3).map((link) => (
            <Link
              key={link.title}
              to={link.to}
              className={`group relative overflow-hidden p-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 hover:-translate-y-1 transition-all duration-300 ${link.hover}`}
            >
              <div className="relative z-10 space-y-6">
                  <div className={`w-16 h-16 ${link.bg} rounded-2xl flex items-center justify-center text-white shadow-xl group-hover:scale-110 transition-transform`}>
                    <link.icon className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{link.title}</h3>
                    <p className="text-sm text-slate-500 font-medium mt-2 leading-relaxed opacity-80">{link.body}</p>
                  </div>
                  <div className="flex items-center text-xs font-black text-indigo-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                     Initialize Workflow <ArrowRight className="w-4 h-4 ml-2" />
                  </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tip Callout */}
      <Card className="border-0 bg-slate-900 text-white rounded-[3rem] overflow-hidden shadow-2xl relative">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-indigo-500/5 -skew-x-12 translate-x-20" />
        <CardContent className="flex flex-col sm:flex-row items-center gap-8 p-12 relative z-10">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-3xl flex items-center justify-center shadow-inner shrink-0 border border-white/10">
             <Headphones className="h-10 w-10 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h4 className="font-black text-2xl tracking-tight">Maximize your yield.</h4>
            <p className="text-slate-400 text-lg leading-relaxed max-w-4xl font-light">
              Don't just log inquiries. Use the <strong>Quotations</strong> engine to send professional, color-coded price sheets. Proactive quoting increases lead conversion by <strong>42%</strong> on average across our portfolio.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentDashboardPage;
