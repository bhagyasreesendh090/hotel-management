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
  Coffee
} from 'lucide-react';
import apiClient from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, CardContent } from '../../components/ui/card';
import { format } from 'date-fns';

type DashboardStats = {
  bookings_created_today: number;
  open_leads: number;
  banquet_next_7_days: number;
};

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
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Premium Hero Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 p-8 sm:p-12 text-white shadow-2xl">
        {/* Dynamic Background Elements */}
        <div className="absolute top-0 right-0 -m-16 w-64 h-64 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -m-16 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-medium">
              <greeting.icon className="w-4 h-4 text-emerald-400" />
              <span>{greeting.text}, {first}</span>
              <span className="w-1 h-1 rounded-full bg-white/30 mx-1" />
              <span className="opacity-80">{format(new Date(), 'EEEE, MMMM do')}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white/95 max-w-2xl">
              Your day in three taps: <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-indigo-400">Leads, Quotes, Wins.</span>
            </h1>
            <p className="max-w-xl text-lg text-slate-300 leading-relaxed font-light">
              This home screen cuts the clutter. Everything uses plain English. Tap a card below to orchestrate your workflow natively.
            </p>
          </div>
          
          <div className="hidden lg:block">
            <div className="p-6 rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 text-center min-w-[200px]">
               <Clock className="mx-auto h-8 w-8 text-indigo-400 mb-3" />
               <p className="text-sm font-medium text-slate-300 uppercase tracking-widest">Time to Follow-up</p>
               <p className="text-4xl font-bold text-white mt-1">Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <TrendingUp className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 border border-emerald-200">
               <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">Open Leads</p>
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              {isLoading ? '…' : data?.open_leads ?? '0'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <CalendarHeart className="w-24 h-24 text-indigo-600" />
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 border border-indigo-200">
               <CalendarHeart className="h-6 w-6 text-indigo-600" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">Bookings Today</p>
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              {isLoading ? '…' : data?.bookings_created_today ?? '0'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300">
          <CardContent className="p-6 relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
              <Phone className="w-24 h-24 text-violet-600" />
            </div>
            <div className="w-12 h-12 bg-violet-100 rounded-2xl flex items-center justify-center mb-4 border border-violet-200">
               <Phone className="h-6 w-6 text-violet-600" />
            </div>
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">Events This Week</p>
            <p className="text-4xl font-black text-slate-900 tracking-tight">
              {isLoading ? '…' : data?.banquet_next_7_days ?? '0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Grid */}
      <div className="space-y-6 pt-4">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Core Modules</h2>
            <Link to="/crm/leads" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group">
               View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              to={link.to}
              className={`group flex flex-col justify-between p-6 bg-white rounded-3xl shadow-lg border border-slate-100 hover:-translate-y-1 transition-all duration-300 ${link.hover}`}
            >
              <div className="space-y-4">
                  <div className={`w-14 h-14 ${link.bg} rounded-2xl flex flex-shrink-0 items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{link.title}</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed">{link.body}</p>
                  </div>
              </div>
              <div className="mt-8 flex items-center text-sm font-bold text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity">
                 Start working <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-2 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tip Callout */}
      <Card className="border-0 bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl overflow-hidden shadow-inner pt-2">
        <CardContent className="flex flex-col sm:flex-row items-center gap-6 p-8">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
             <Headphones className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h4 className="font-bold text-lg text-amber-900 mb-1">Pro Tip</h4>
            <p className="text-amber-800/80 font-medium leading-relaxed max-w-4xl">
              After answering calls and pitching rates, dive right into <strong>Quotations</strong> from the Leads profile. Generating a digital quote link and sending it explicitly triggers backend tracking instantly so you can get credit for the deal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentDashboardPage;
