import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RoomType {
  name: string;
  total: number;
}

interface Property {
  id: number;
  name: string;
  location: string;
  roomTypes: RoomType[];
  bookings: Record<string, number>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PROPERTIES: Property[] = [
  {
    id: 1,
    name: 'PRAMOD LANDS END RESORT, A MEMBER OF RADISSON INDIVIDUALS',
    location: 'GOPALPUR',
    roomTypes: [
      { name: 'Superior room (2 Pax)', total: 57 },
      { name: 'Deluxe room (2 Pax)', total: 24 },
      { name: 'Family room (4 Pax)', total: 7 },
      { name: 'Premium room (2 pax)', total: 4 },
      { name: 'Premium Suite (4 pax)', total: 2 },
      { name: 'Royal Villa (2 pax)', total: 1 },
      { name: 'Grand Villa (4 pax)', total: 1 },
    ],
    bookings: {
      '0-1': 2,
      '1-6': 1,
      '0-8': 23, '1-8': 8,
      '0-10': 33, '1-10': 13, '2-10': 6,
    },
  },
  {
    id: 2,
    name: 'PRAMOD CONVENTION & BEACH RESORT',
    location: 'PURI',
    roomTypes: [
      { name: 'Queens Court', total: 16 },
      { name: 'Kings Court', total: 8 },
      { name: 'Family room', total: 3 },
      { name: 'Family Exe. Room', total: 3 },
    ],
    bookings: { '0-1': 2, '1-1': 1 },
  },
  {
    id: 3,
    name: 'PRAMOD CONVENTION & CLUB RESORT',
    location: 'CUTTACK',
    roomTypes: [
      { name: 'Queens Court', total: 16 },
      { name: 'Kings Court', total: 12 },
    ],
    bookings: {},
  },
];

const RoomAvailabilityCalendar: React.FC = () => {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(viewYear, viewMonth, i + 1);
    return {
      num: i + 1,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    };
  });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const getBooked = (property: Property, rtIdx: number, dayNum: number) =>
    property.bookings[`${rtIdx}-${dayNum}`] || 0;

  const renderPropertyTable = (property: Property) => (
    <div
      key={property.id}
      className="mb-8 rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm shadow-slate-200/50 overflow-hidden backdrop-blur-sm"
    >
      <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-950 text-white text-center py-3 px-4">
        <span className="font-semibold text-sm tracking-wide">
          {property.name}, {property.location}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-100 text-left px-3 py-2 font-semibold text-slate-700 border-b border-r border-slate-300 min-w-[185px]">
                Room type /<br />
                <span className="font-normal text-slate-500">occupancy per room</span>
              </th>
              {days.map((d) => {
                const isWeekend = d.label === 'Sat' || d.label === 'Sun';
                return (
                  <th
                    key={d.num}
                    className={`text-center px-1 py-1.5 border-b border-r border-slate-200 min-w-[34px] ${
                      isWeekend ? 'bg-indigo-50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-800 leading-none mb-0.5">{d.num}</div>
                    <div className={`font-normal leading-none ${isWeekend ? 'text-indigo-500' : 'text-slate-400'}`}>
                      {d.label}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {property.roomTypes.map((rt, rtIdx) => (
              <tr key={rtIdx} className="hover:bg-slate-50/80 transition-colors">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-b border-r border-slate-200 font-medium text-slate-800">
                  {rt.name}
                </td>
                {days.map((d) => {
                  const booked = getBooked(property, rtIdx, d.num);
                  const available = rt.total - booked;
                  const isFull = available === 0;
                  const isLow = !isFull && available <= Math.max(1, Math.ceil(rt.total * 0.2));
                  const isWeekend = d.label === 'Sat' || d.label === 'Sun';
                  return (
                    <td
                      key={d.num}
                      className={`text-center px-1 py-1.5 border-b border-r border-slate-200 font-medium ${
                        isFull
                          ? 'bg-red-100 text-red-700'
                          : isLow
                          ? 'bg-amber-50 text-amber-700'
                          : isWeekend
                          ? 'bg-indigo-50 text-slate-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {available}
                    </td>
                  );
                })}
              </tr>
            ))}

            <tr className="h-2 bg-slate-50">
              <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-300" />
              {days.map((d) => <td key={d.num} className="border-r border-slate-100" />)}
            </tr>

            <tr className="bg-slate-100 font-bold">
              <td className="sticky left-0 z-10 bg-slate-100 px-3 py-2 border-b border-r border-slate-300 text-slate-700">
                Rooms Available
              </td>
              {days.map((d) => {
                const available = property.roomTypes.reduce(
                  (sum, rt, rtIdx) => sum + (rt.total - getBooked(property, rtIdx, d.num)),
                  0
                );
                return (
                  <td key={d.num} className="text-center px-1 py-2 border-b border-r border-slate-200 text-slate-800">
                    {available}
                  </td>
                );
              })}
            </tr>

            <tr className="font-bold">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r border-slate-300 text-slate-700">
                Rooms Booked
              </td>
              {days.map((d) => {
                const booked = property.roomTypes.reduce(
                  (sum, _, rtIdx) => sum + getBooked(property, rtIdx, d.num),
                  0
                );
                return (
                  <td
                    key={d.num}
                    className={`text-center px-1 py-2 border-r border-slate-200 ${
                      booked > 0 ? 'text-purple-700' : 'text-slate-300'
                    }`}
                  >
                    {booked}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Room availability grid</h2>
          <p className="text-slate-500 text-sm">Scan every property at a glance — green-style numbers mean rooms left for that day.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-slate-800 min-w-[150px] text-center text-sm">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded bg-red-100 border border-red-200" />
          <span>Fully booked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded bg-amber-50 border border-amber-200" />
          <span>Low stock (≤20%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded bg-indigo-50 border border-indigo-200" />
          <span>Weekend</span>
        </div>
      </div>

      {PROPERTIES.map((p) => renderPropertyTable(p))}
    </section>
  );
};

export default RoomAvailabilityCalendar;
