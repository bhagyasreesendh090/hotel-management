import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format } from 'date-fns';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';

type DaySummary = {
  date: string;
  total_available: number;
  total_booked: number;
  total_blocked: number;
};

type RoomTypeRow = {
  room_type_id: number;
  category: string;
  base_rate_rbi: number;
  occupancy_max: number;
  total_rooms: number;
  days: Record<string, { available_units: number; booked_units: number; blocked_units: number }>;
};

type AvailabilityResponse = {
  property: {
    id: number;
    code: string;
    name: string;
  };
  month: string;
  room_types: RoomTypeRow[];
  summary: DaySummary[];
};

function toMonthValue(date: Date) {
  return format(date, 'yyyy-MM');
}

function monthStart(monthValue: string) {
  return new Date(`${monthValue}-01T00:00:00`);
}

const AvailabilityPage: React.FC = () => {
  const { selectedProperty, selectedPropertyId } = useProperty();
  const [filterType, setFilterType] = useState<'month' | 'year' | 'custom'>('month');
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [customStart, setCustomStart] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(addMonths(new Date(), 1), 'yyyy-MM-dd'));

  const { data, isLoading, isError } = useQuery<AvailabilityResponse>({
    queryKey: ['crm-availability-matrix', selectedPropertyId, selectedProperty?.code, filterType, selectedYear, selectedMonth, customStart, customEnd],
    enabled: Boolean(selectedProperty?.code),
    queryFn: async () => {
      const params: any = {};
      if (filterType === 'month') {
        params.month = `${selectedYear}-${selectedMonth}`;
      } else if (filterType === 'year') {
        params.startDate = `${selectedYear}-01-01`;
        params.endDate = `${selectedYear}-12-31`;
      } else {
        params.startDate = customStart;
        params.endDate = customEnd;
      }
      const response = await apiClient.get<AvailabilityResponse>(
        `/api/public/properties/${selectedProperty?.code}/monthly-availability`,
        { params }
      );
      return response.data;
    },
  });

  const summary = data?.summary ?? [];
  const roomTypes = data?.room_types ?? [];
  const displayRange = filterType === 'month' 
    ? format(new Date(Number(selectedYear), Number(selectedMonth) - 1, 1), 'MMMM yyyy')
    : filterType === 'year'
      ? `Full Year ${selectedYear}`
      : `${format(new Date(customStart), 'dd MMM yyyy')} - ${format(new Date(customEnd), 'dd MMM yyyy')}`;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90 shadow-sm">
        <div className="grid gap-6 px-5 py-6 md:px-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Availability Matrix</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950">
              {selectedProperty?.name ?? 'Room Availability'}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
              The CRM availability page now uses the same live matrix as the public booking page, so internal users see
              the same daily room counts.
            </p>
          </div>
          <div className="grid gap-3 rounded-[24px] bg-stone-950 p-5 text-stone-50">
            <div className="flex items-center gap-3">
              <CalendarRange className="h-5 w-5 text-amber-300" />
              <div>
                <p className="text-sm text-stone-300">View range</p>
                <p className="text-2xl font-semibold">{displayRange}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-stone-400">Room types</p>
                <p className="mt-1 text-lg font-semibold">{roomTypes.length}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-stone-400">Selected property</p>
                <p className="mt-1 text-lg font-semibold">{selectedProperty?.code ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[28px] border-stone-200/80 shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col gap-4 border-b border-stone-200/80 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Property Availability</p>
                <h2 className="mt-2 text-2xl font-semibold text-stone-950">{displayRange}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex rounded-lg border border-stone-200 bg-stone-50 p-1">
                  <button
                    onClick={() => setFilterType('month')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      filterType === 'month' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setFilterType('year')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      filterType === 'year' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Yearly
                  </button>
                  <button
                    onClick={() => setFilterType('custom')}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      filterType === 'custom' ? 'bg-white text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    Custom Range
                  </button>
                </div>

                {filterType === 'month' || filterType === 'year' ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y.toString()}>{y}</option>
                      ))}
                    </select>
                    {filterType === 'month' && (
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                      >
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = (i + 1).toString().padStart(2, '0');
                          return (
                            <option key={m} value={m}>
                              {format(new Date(2000, i, 1), 'MMMM')}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <span className="text-stone-400">to</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-stone-300 bg-transparent px-3"
                onClick={() => {
                  if (filterType === 'month') {
                    const current = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);
                    const prev = addMonths(current, -1);
                    setSelectedYear(prev.getFullYear().toString());
                    setSelectedMonth((prev.getMonth() + 1).toString().padStart(2, '0'));
                  } else if (filterType === 'year') {
                    setSelectedYear((Number(selectedYear) - 1).toString());
                  }
                }}
                disabled={filterType === 'custom'}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-stone-300 bg-transparent px-3"
                onClick={() => {
                  if (filterType === 'month') {
                    const current = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1);
                    const next = addMonths(current, 1);
                    setSelectedYear(next.getFullYear().toString());
                    setSelectedMonth((next.getMonth() + 1).toString().padStart(2, '0'));
                  } else if (filterType === 'year') {
                    setSelectedYear((Number(selectedYear) + 1).toString());
                  }
                }}
                disabled={filterType === 'custom'}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-600 border-t-transparent" />
            </div>
          ) : isError ? (
            <div className="px-6 py-10 text-sm text-red-700">
              Unable to load availability for the selected property.
            </div>
          ) : (
            <div className="overflow-x-auto px-3 pb-5 pt-4 md:px-4">
              <table className="min-w-full border-separate border-spacing-0 text-center text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[220px] border border-stone-300 bg-stone-100 px-3 py-3 text-left font-semibold">
                      Room type / occupancy
                    </th>
                    {summary.map((day) => (
                      <th key={day.date} className="min-w-[58px] border border-stone-300 bg-stone-100 px-2 py-2">
                        <div>{format(new Date(`${day.date}T00:00:00`), 'd')}</div>
                        <div className="text-[11px] font-normal text-stone-500">
                          {format(new Date(`${day.date}T00:00:00`), 'EEE')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roomTypes.map((roomType) => (
                    <tr key={roomType.room_type_id}>
                      <td className="sticky left-0 z-10 border border-stone-300 bg-white px-3 py-3 text-left align-middle">
                        <div className="font-semibold text-stone-900">{roomType.category}</div>
                        <div className="text-xs text-stone-500">{roomType.occupancy_max} pax</div>
                      </td>
                      {summary.map((day) => {
                        const cell = roomType.days[day.date];
                        const available = Number(cell?.available_units ?? 0);
                        return (
                          <td
                            key={`${roomType.room_type_id}-${day.date}`}
                            className={`border px-2 py-2 font-medium ${
                              available === 0
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : available <= 2
                                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                                  : 'border-stone-300 bg-white text-stone-800'
                            }`}
                          >
                            {available}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td className="sticky left-0 z-10 border border-stone-300 bg-stone-950 px-3 py-3 text-left font-semibold text-white">
                      Rooms Available
                    </td>
                    {summary.map((day) => (
                      <td key={`available-${day.date}`} className="border border-stone-300 bg-stone-950 px-2 py-2 font-semibold text-white">
                        {day.total_available}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky left-0 z-10 border border-stone-300 bg-stone-800 px-3 py-3 text-left font-semibold text-stone-100">
                      Rooms Booked
                    </td>
                    {summary.map((day) => (
                      <td key={`booked-${day.date}`} className="border border-stone-300 bg-stone-800 px-2 py-2 font-semibold text-stone-100">
                        {day.total_booked}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AvailabilityPage;
