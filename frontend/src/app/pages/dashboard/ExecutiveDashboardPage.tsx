import React from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ClipboardList,
  Hotel,
  LineChart,
  Sparkles,
  Users,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import apiClient from '../../api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

type DashboardStats = {
  bookings_created_today: number;
  open_leads: number;
  banquet_next_7_days: number;
};

const ExecutiveDashboardPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports-dashboard'],
    queryFn: async () => {
      const { data: d } = await apiClient.get<DashboardStats>('/api/reports/dashboard');
      return d;
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
    { to: '/finance/invoices', label: 'Invoices', sub: 'Billing snapshot', icon: Wallet },
    { to: '/reports/pipeline', label: 'Reports', sub: 'CRM & GST views', icon: Sparkles },
  ];

  return (
    <div className="min-h-0 space-y-10 pb-12">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 px-6 py-10 sm:px-10 text-white shadow-xl shadow-indigo-950/30">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative max-w-2xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200/90">Leadership overview</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Run the whole portfolio without digging through menus.
          </h1>
          <p className="text-sm sm:text-base text-indigo-100/90 leading-relaxed">
            The numbers below refresh from your live data. Use the tiles to jump into sales, CRS availability, or banquets — room counts roll up by room type.
          </p>
          {isError && (
            <p className="text-sm text-amber-200">Live stats could not load; grids and shortcuts still work.</p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild className="rounded-full bg-white text-slate-900 hover:bg-indigo-50">
              <Link to="/crm/leads">Open leads</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-white/40 bg-white/5 text-white hover:bg-white/10"
            >
              <Link to="/crs/bookings">Today&apos;s bookings</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="border-slate-200/80 shadow-md shadow-slate-200/40 overflow-hidden"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardDescription className="text-slate-500 font-medium">{s.label}</CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums mt-1 text-slate-900">
                  {isLoading ? <span className="text-slate-300">…</span> : s.value}
                </CardTitle>
              </div>
              <div
                className={`rounded-2xl bg-gradient-to-br p-2.5 text-white shadow-lg ${s.accent}`}
              >
                <s.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500 leading-snug">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Quick access</h2>
            <p className="text-sm text-slate-500">Pick a job — the app opens the right screen for you.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((x) => (
            <Link
              key={x.to}
              to={x.to}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-transform group-hover:scale-105">
                <x.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">{x.label}</p>
                <p className="text-xs text-slate-500">{x.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Card className="border-slate-200/80 bg-slate-50/50">
        <CardHeader>
          <CardTitle>Need the month grid?</CardTitle>
          <CardDescription>
            Inventory is organized as room types (each type lists how many rooms exist). Use CRS → Availability for the full calendar; this home screen stays high-level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="rounded-full" variant="default">
            <Link to="/crs/availability">Open availability</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExecutiveDashboardPage;
