import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { format } from 'date-fns';

type OccupancyRow = { property_id: number; room_type_id: number; booked_lines: number };

export default function OccupancyReportPage() {
  const { selectedPropertyId } = useProperty();
  const [fromDate, setFromDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: occupancy = [], isLoading, refetch } = useQuery({
    queryKey: ['occupancyReport', selectedPropertyId, fromDate, toDate],
    queryFn: async () => {
      const response = await apiClient.get<{ occupancy: OccupancyRow[] }>(
        '/api/reports/reservations/occupancy',
        {
          params: {
            property_id: selectedPropertyId,
            from: fromDate,
            to: toDate,
          },
        }
      );
      return response.data.occupancy ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const { data: roomTypes = [] } = useQuery({
    queryKey: ['roomTypes', selectedPropertyId],
    queryFn: async () => {
      const r = await apiClient.get<{ room_types: { id: number; category: string }[] }>(
        '/api/crs/room-types',
        { params: { property_id: selectedPropertyId } }
      );
      return r.data.room_types ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const typeName = useMemo(() => {
    const m = new Map<number, string>();
    for (const rt of roomTypes) m.set(rt.id, rt.category);
    return (id: number) => m.get(id) ?? `Room type #${id}`;
  }, [roomTypes]);

  const totalBooked = useMemo(
    () => occupancy.reduce((s, r) => s + (r.booked_lines || 0), 0),
    [occupancy]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Occupancy report</h1>
        <p className="text-gray-500 mt-1">Active booking lines overlapping the date range</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button type="button" onClick={() => refetch()}>
              Run report
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <p className="mb-2 text-sm text-gray-600">Booked room lines (in range)</p>
                <p className="text-3xl font-bold text-blue-600">{totalBooked}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="mb-2 text-sm text-gray-600">Room types with stays</p>
                <p className="text-3xl font-bold text-green-600">{occupancy.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By room type</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room type</TableHead>
                    <TableHead className="text-right">Booked lines</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {occupancy.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-gray-500">
                        No overlapping stays for these dates.
                      </TableCell>
                    </TableRow>
                  ) : (
                    occupancy.map((row) => (
                      <TableRow key={`${row.property_id}-${row.room_type_id}`}>
                        <TableCell className="font-medium">{typeName(row.room_type_id)}</TableCell>
                        <TableCell className="text-right">{row.booked_lines}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
