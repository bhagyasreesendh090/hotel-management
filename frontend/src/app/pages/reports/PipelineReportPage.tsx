import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type PipelineRow = { pipeline_stage: string; count: number };

const STAGE_LABEL: Record<string, string> = {
  inquiry: 'Inquiry',
  quotation_sent: 'Quotation sent',
  tentative_hold: 'Tentative hold',
  negotiation: 'Negotiation',
  confirmed: 'Confirmed',
  lost: 'Lost',
};

export default function PipelineReportPage() {
  const { selectedPropertyId } = useProperty();

  const { data, isLoading } = useQuery({
    queryKey: ['pipelineReport', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ pipeline: PipelineRow[] }>('/api/reports/crm/pipeline', {
        params: selectedPropertyId ? { property_id: selectedPropertyId } : {},
      });
      return response.data.pipeline ?? [];
    },
  });

  const chartData = useMemo(
    () =>
      (data ?? []).map((row) => ({
        stage: STAGE_LABEL[row.pipeline_stage] ?? row.pipeline_stage,
        count: row.count,
      })),
    [data]
  );

  const totals = useMemo(() => {
    const rows = data ?? [];
    const by = (stage: string) => rows.find((r) => r.pipeline_stage === stage)?.count ?? 0;
    const total = rows.reduce((s, r) => s + r.count, 0);
    const inPipeline = rows
      .filter((r) =>
        ['inquiry', 'quotation_sent', 'tentative_hold', 'negotiation'].includes(r.pipeline_stage)
      )
      .reduce((s, r) => s + r.count, 0);
    return {
      total,
      inPipeline,
      won: by('confirmed'),
      lost: by('lost'),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const stats = [
    { label: 'Total leads', value: totals.total, color: 'bg-blue-50 text-blue-600' },
    { label: 'In pipeline', value: totals.inPipeline, color: 'bg-purple-50 text-purple-600' },
    { label: 'Confirmed', value: totals.won, color: 'bg-green-50 text-green-600' },
    { label: 'Lost', value: totals.lost, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CRM Pipeline Report</h1>
        <p className="text-gray-500 mt-1">Counts by pipeline stage (from live CRM data)</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <p className="mb-2 text-sm text-gray-600">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads by pipeline stage</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-500">No pipeline data for this filter yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
