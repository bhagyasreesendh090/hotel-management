import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useProperty } from '../../context/PropertyContext';
import apiClient from '../../api/client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

interface RoomType {
  id: number;
  property_id: number;
  category: string;
  floor_wing?: string | null;
  occupancy_max: number;
  base_rate_rbi: number;
  gst_rate_override?: number | null;
  amenities: string[];
}

interface RoomTypesResponse {
  room_types: RoomType[];
}

const RoomTypesPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRoomType, setNewRoomType] = useState({
    category: '',
    base_rate_rbi: '',
    occupancy_max: '',
    amenities: '',
  });

  const { data: roomTypes = [], isLoading } = useQuery<RoomType[]>({
    queryKey: ['roomTypes', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<RoomTypesResponse>('/api/crs/room-types', {
        params: { property_id: selectedPropertyId },
      });
      return Array.isArray(response.data?.room_types) ? response.data.room_types : [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/api/crs/room-types', {
        ...data,
        property_id: selectedPropertyId,
        base_rate_rbi: parseFloat(data.base_rate_rbi),
        occupancy_max: parseInt(data.occupancy_max),
        amenities: data.amenities.split(',').map((a: string) => a.trim()).filter(Boolean),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      toast.success('Room type created successfully');
      setIsCreateDialogOpen(false);
      setNewRoomType({ category: '', base_rate_rbi: '', occupancy_max: '', amenities: '' });
    },
    onError: () => {
      toast.error('Failed to create room type');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(newRoomType);
  };


  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Types</h1>
          <p className="text-gray-500 mt-1">Manage room categories and pricing</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Room Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Room Types</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Base Rate (RBI)</TableHead>
                <TableHead>Max Occupancy</TableHead>
                <TableHead>Amenities</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roomTypes.map((roomType) => (
                <TableRow key={roomType.id}>
                  <TableCell className="font-medium">{roomType.category}</TableCell>
                  <TableCell>₹{roomType.base_rate_rbi}</TableCell>
                  <TableCell>{roomType.occupancy_max}</TableCell>
                  <TableCell>{roomType.amenities?.join(', ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Room Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={newRoomType.category}
                onChange={(e) => setNewRoomType({ ...newRoomType, category: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="base_rate_rbi">Base Rate (RBI) (₹)</Label>
                <Input
                  id="base_rate_rbi"
                  type="number"
                  step="0.01"
                  value={newRoomType.base_rate_rbi}
                  onChange={(e) => setNewRoomType({ ...newRoomType, base_rate_rbi: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupancy_max">Max Occupancy</Label>
                <Input
                  id="occupancy_max"
                  type="number"
                  value={newRoomType.occupancy_max}
                  onChange={(e) => setNewRoomType({ ...newRoomType, occupancy_max: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amenities">Amenities (comma-separated)</Label>
              <Input
                id="amenities"
                value={newRoomType.amenities}
                onChange={(e) => setNewRoomType({ ...newRoomType, amenities: e.target.value })}
                placeholder="WiFi, AC, TV"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomTypesPage;
