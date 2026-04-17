import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { format } from 'date-fns';

interface AvailabilityRow {
  room_type_id: number;
  category: string;
  base_rate_rbi: number;
  occupancy_max: number;
  total_rooms: number;
  booked_units: number;
  blocked_units: number;
  available_units: number;
}

const AvailabilityPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

  const { data: availability = [], isLoading, refetch } = useQuery<AvailabilityRow[]>({
    queryKey: ['availability', selectedPropertyId, fromDate, toDate],
    queryFn: async () => {
      const response = await apiClient.get('/api/crs/availability', {
        params: {
          property_id: selectedPropertyId,
          from: fromDate,
          to: toDate,
        },
      });
      return Array.isArray(response.data?.availability) ? response.data.availability : [];
    },
    enabled: !!selectedPropertyId,
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Room Availability</h1>
        <p className="text-gray-500 mt-1">Check room availability across date ranges</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="from">From Date</Label>
              <Input
                id="from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To Date</Label>
              <Input
                id="to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={() => refetch()}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Availability by Room Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Total Rooms</TableHead>
                  <TableHead>Booked / Held</TableHead>
                  <TableHead>Blocked</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availability.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.total_rooms}</TableCell>
                    <TableCell className="text-blue-600 font-medium">{row.booked_units}</TableCell>
                    <TableCell className="text-amber-600 font-medium">{row.blocked_units}</TableCell>
                    <TableCell className="text-green-600 font-semibold">{row.available_units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AvailabilityPage;
