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

type SummaryRow = {
  property_id: number;
  month: string;
  sub_total: string;
  cgst: string;
  sgst: string;
  gst_total: string;
  total_amount: string;
};

export default function GSTReportPage() {
  const { selectedPropertyId } = useProperty();
  const [fromDate, setFromDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: summary = [], isLoading, refetch } = useQuery({
    queryKey: ['gstReport', fromDate, toDate, selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ summary: SummaryRow[] }>('/api/reports/finance/gst-summary', {
        params: {
          from: fromDate,
          to: toDate,
          ...(selectedPropertyId ? { property_id: selectedPropertyId } : {}),
        },
      });
      return response.data.summary ?? [];
    },
  });

  const totals = useMemo(() => {
    let sub = 0;
    let gst = 0;
    let inv = 0;
    for (const row of summary) {
      sub += Number(row.sub_total) || 0;
      gst += Number(row.gst_total) || 0;
      inv += 1;
    }
    return { sub, gst, inv };
  }, [summary]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GST Summary Report</h1>
        <p className="text-gray-500 mt-1">Invoice GST totals grouped by month (matches API response)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select date range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="from">From date</Label>
              <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To date</Label>
              <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <Button type="button" onClick={() => refetch()}>
              Generate report
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <p className="mb-2 text-sm text-gray-600">Taxable (sub-total)</p>
                <p className="text-3xl font-bold text-blue-600">₹{totals.sub.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="mb-2 text-sm text-gray-600">Total GST</p>
                <p className="text-3xl font-bold text-green-600">₹{totals.gst.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="mb-2 text-sm text-gray-600">Summary rows</p>
                <p className="text-3xl font-bold text-purple-600">{totals.inv}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>By property & month</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Sub-total</TableHead>
                    <TableHead>CGST</TableHead>
                    <TableHead>SGST</TableHead>
                    <TableHead>GST total</TableHead>
                    <TableHead>Invoice total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500">
                        No invoices in this date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    summary.map((row, index) => (
                      <TableRow key={`${row.property_id}-${row.month}-${index}`}>
                        <TableCell>{row.property_id}</TableCell>
                        <TableCell>{row.month?.slice?.(0, 10) ?? row.month}</TableCell>
                        <TableCell>₹{Number(row.sub_total).toLocaleString('en-IN')}</TableCell>
                        <TableCell>₹{Number(row.cgst).toLocaleString('en-IN')}</TableCell>
                        <TableCell>₹{Number(row.sgst).toLocaleString('en-IN')}</TableCell>
                        <TableCell>₹{Number(row.gst_total).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="font-medium">
                          ₹{Number(row.total_amount).toLocaleString('en-IN')}
                        </TableCell>
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
