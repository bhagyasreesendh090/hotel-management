import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarHeart, Headphones, ListChecks, Phone, PlusCircle, TrendingUp } from 'lucide-react';
import apiClient from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Card, CardContent } from '../../components/ui/card';

type DashboardStats = {
  bookings_created_today: number;
  open_leads: number;
  banquet_next_7_days: number;
};

const AgentDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const first = user?.full_name?.split(/\s+/)[0] ?? 'there';

  const { data, isLoading } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: async () => {
      const { data: d } = await apiClient.get<DashboardStats>('/api/reports/dashboard');
      return d;
    },
  });

  const bigActions = [
    {
      to: '/crm/leads',
      title: 'My leads',
      body: 'See who to call next and update the stage in one place.',
      icon: ListChecks,
      className: 'from-emerald-500 to-teal-600',
    },
    {
      to: '/crs/bookings',
      title: 'New or existing booking',
      body: 'Check availability by room type and lock dates without switching tabs.',
      icon: CalendarHeart,
      className: 'from-blue-500 to-indigo-600',
    },
    {
      to: '/crm/leads',
      title: 'Add a lead',
      body: 'Capture name, phone, and property interest in seconds.',
      icon: PlusCircle,
      className: 'from-violet-500 to-purple-600',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-xl shadow-teal-900/25">
        <p className="text-sm font-medium text-emerald-100">Hello {first},</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">
          Your day in three taps: leads, bookings, follow-up.
        </h1>
        <p className="mt-3 max-w-xl text-sm text-emerald-50/95 leading-relaxed">
          You have the same access as management — this home screen only hides clutter. Tap a card below to work; everything uses plain words, not hotel jargon.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-0 bg-slate-50 shadow-inner">
          <CardContent className="p-4 text-center">
            <TrendingUp className="mx-auto mb-2 h-6 w-6 text-emerald-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leads open</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {isLoading ? '…' : data?.open_leads ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-50 shadow-inner">
          <CardContent className="p-4 text-center">
            <CalendarHeart className="mx-auto mb-2 h-6 w-6 text-blue-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bookings today</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {isLoading ? '…' : data?.bookings_created_today ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-slate-50 shadow-inner">
          <CardContent className="p-4 text-center">
            <Phone className="mx-auto mb-2 h-6 w-6 text-violet-600" />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Events this week</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {isLoading ? '…' : data?.banquet_next_7_days ?? '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">What do you want to do?</h2>
        <div className="grid gap-4">
          {bigActions.map((a) => (
            <Link
              key={a.title}
              to={a.to}
              className={`flex items-stretch overflow-hidden rounded-2xl shadow-lg transition hover:opacity-[0.98] active:scale-[0.99] bg-gradient-to-r ${a.className}`}
            >
              <div className="flex w-16 shrink-0 items-center justify-center bg-black/10">
                <a.icon className="h-7 w-7 text-white" />
              </div>
              <div className="flex flex-1 flex-col justify-center px-5 py-4 text-white">
                <span className="text-lg font-bold">{a.title}</span>
                <span className="text-sm text-white/90">{a.body}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Card className="border-slate-200 bg-amber-50/50">
        <CardContent className="flex gap-4 p-5">
          <Headphones className="h-10 w-10 shrink-0 text-amber-700" />
          <div>
            <p className="font-semibold text-slate-900">Tip</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              After every guest call, open <strong>Leads</strong> and move the stage one step — that keeps your manager&apos;s report accurate without extra forms.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentDashboardPage;
