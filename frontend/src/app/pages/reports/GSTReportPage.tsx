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

const GSTReportPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const [fromDate, setFromDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gstReport', fromDate, toDate, selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get('/api/reports/finance/gst-summary', {
        params: { from_date: fromDate, to_date: toDate, property_id: selectedPropertyId },
      });
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GST Summary Report</h1>
        <p className="text-gray-500 mt-1">Tax summary for the selected period</p>
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
                <p className="text-sm text-gray-600 mb-2">Total Sales</p>
                <p className="text-3xl font-bold text-blue-600">₹{(data?.total_sales || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Total GST Collected</p>
                <p className="text-3xl font-bold text-green-600">₹{(data?.total_gst || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-gray-600 mb-2">Number of Invoices</p>
                <p className="text-3xl font-bold text-purple-600">{data?.invoice_count || 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>GST Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tax Rate</TableHead>
                    <TableHead>Taxable Amount</TableHead>
                    <TableHead>CGST</TableHead>
                    <TableHead>SGST</TableHead>
                    <TableHead>Total Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.breakdown?.map((item: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.rate}%</TableCell>
                      <TableCell>₹{item.taxable_amount}</TableCell>
                      <TableCell>₹{item.cgst}</TableCell>
                      <TableCell>₹{item.sgst}</TableCell>
                      <TableCell className="font-medium">₹{item.total_tax}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default GSTReportPage;
