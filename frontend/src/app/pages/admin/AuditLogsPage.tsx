import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Search, History, User, Activity, Database } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: number;
  user_name: string;
  entity: string;
  entity_id: string;
  action: string;
  before_json: any;
  after_json: any;
  created_at: string;
}

const AuditLogsPage: React.FC = () => {
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', entityFilter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (entityFilter !== 'all') params.entity = entityFilter;
      const response = await apiClient.get<{ logs: AuditLog[] }>('/api/admin/audit-logs', { params });
      return response.data;
    },
  });

  const filteredLogs = data?.logs.filter(log => 
    log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.entity_id?.toString().includes(searchTerm) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const entities = ['all', 'property', 'user', 'lead', 'booking', 'quotation', 'contract'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-950 flex items-center gap-2">
            <History className="h-8 w-8 text-indigo-600" /> Audit Logs
          </h1>
          <p className="text-stone-500 mt-1">Track every change and action across the entire system.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input 
              placeholder="Search logs..." 
              className="pl-9 w-[250px] rounded-full border-stone-200"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[150px] rounded-full border-stone-200">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map(e => (
                <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="rounded-[24px] border-stone-200/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-stone-50/50">
              <TableRow>
                <TableHead className="w-[200px]">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>ID</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-stone-50/50 transition-colors">
                  <TableCell className="text-stone-500 text-sm">
                    {format(new Date(log.created_at), 'dd MMM yyyy, HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                        {log.user_name?.charAt(0) || 'U'}
                      </div>
                      <span className="font-medium text-stone-950">{log.user_name || 'System'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize bg-stone-100/50 text-stone-600 border-stone-200">
                      {log.entity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={`capitalize ${
                        log.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                        log.action === 'delete' ? 'bg-rose-100 text-rose-700' :
                        'bg-blue-100 text-blue-700'
                      } border-0 shadow-none`}
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-stone-400">
                    {log.entity_id}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full">
                      View Changes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-stone-400">
                    No logs found matching your criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogsPage;
