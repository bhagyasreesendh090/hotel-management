import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const OccupancyReportPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const [fromDate, setFromDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['occupancyReport', selectedPropertyId, fromDate, toDate],
    queryFn: async () => {
      const response = await apiClient.get('/api/reports/reservations/occupancy', {
        params: {
          property_id: selectedPropertyId,
          from: fromDate,
          to: toDate,
        },
      });
      return response.data;
    },
    enabled: !!selectedPropertyId,
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Occupancy Report</h1>
        <p className="text-gray-500 mt-1">Room occupancy trends and statistics</p>
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
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Average Occupancy</p>
                <p className="text-3xl font-bold text-blue-600">
                  {((data?.average_occupancy || 0) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Total Room Nights</p>
                <p className="text-3xl font-bold text-green-600">{data?.total_room_nights || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Revenue Generated</p>
                <p className="text-3xl font-bold text-purple-600">
                  ₹{(data?.revenue || 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Daily Occupancy Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={data?.daily_occupancy || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="occupancy_rate" stroke="#3b82f6" strokeWidth={2} name="Occupancy %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Occupancy by Room Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.by_room_type?.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{item.room_type}</p>
                      <p className="text-sm text-gray-500">
                        {item.occupied_rooms} / {item.total_rooms} rooms
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">
                        {((item.occupancy_rate || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default OccupancyReportPage;
