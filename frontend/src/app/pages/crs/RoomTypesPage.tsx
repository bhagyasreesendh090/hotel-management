import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';

interface MealPlanOption {
  code: string;
  label: string;
  price: string;
  dish_details: string;
}

interface RoomType {
  id: number;
  property_id: number;
  property_name: string;
  category: string;
  floor_wing?: string | null;
  occupancy_max: number;
  base_rate_rbi: number;
  gst_rate_override?: number | null;
  extra_person_charge?: number | null;
  amenities: string[];
  total_rooms: number;
  add_on_options?: Array<{
    code?: string;
    label?: string;
    price?: number | string;
    dish_details?: string;
  }>;
}

interface RoomTypesResponse {
  room_types: RoomType[];
}

const emptyMealPlan = (): MealPlanOption => ({
  code: '',
  label: '',
  price: '',
  dish_details: '',
});

const emptyForm = {
  category: '',
  base_rate_rbi: '',
  occupancy_max: '',
  amenities: '',
  extra_person_charge: '',
  meal_plan_options: [emptyMealPlan()],
};

function normalizeMealPlans(plans: MealPlanOption[]) {
  return plans
    .filter((plan) => plan.code.trim() || plan.label.trim() || plan.price.trim() || plan.dish_details.trim())
    .map((plan) => ({
      code: plan.code.trim().toUpperCase(),
      label: plan.label.trim(),
      price: plan.price ? parseFloat(plan.price) : 0,
      dish_details: plan.dish_details.trim(),
    }));
}

function hydrateMealPlans(plans: RoomType['add_on_options']): MealPlanOption[] {
  if (!Array.isArray(plans) || plans.length === 0) return [emptyMealPlan()];
  return plans.map((plan) => ({
    code: String(plan.code ?? ''),
    label: String(plan.label ?? ''),
    price: String(plan.price ?? ''),
    dish_details: String(plan.dish_details ?? ''),
  }));
}

const RoomTypesPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [form, setForm] = useState(emptyForm);

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
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post('/api/crs/room-types', {
        property_id: selectedPropertyId,
        category: data.category,
        base_rate_rbi: parseFloat(data.base_rate_rbi),
        occupancy_max: parseInt(data.occupancy_max, 10),
        amenities: data.amenities.split(',').map((item) => item.trim()).filter(Boolean),
        extra_person_charge: data.extra_person_charge ? parseFloat(data.extra_person_charge) : 0,
        meal_plan_options: normalizeMealPlans(data.meal_plan_options),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      toast.success('Room type created successfully');
      setIsCreateDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to create room type'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form & { id: number }) => {
      const response = await apiClient.put(`/api/crs/room-types/${data.id}`, {
        category: data.category,
        base_rate_rbi: parseFloat(data.base_rate_rbi),
        occupancy_max: parseInt(data.occupancy_max, 10),
        amenities: data.amenities.split(',').map((item) => item.trim()).filter(Boolean),
        extra_person_charge: data.extra_person_charge ? parseFloat(data.extra_person_charge) : 0,
        meal_plan_options: normalizeMealPlans(data.meal_plan_options),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      toast.success('Room type updated successfully');
      setIsEditDialogOpen(false);
      setSelectedRoomType(null);
    },
    onError: () => toast.error('Failed to update room type'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/crs/room-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] });
      toast.success('Room type removed');
      setIsDeleteDialogOpen(false);
      setSelectedRoomType(null);
    },
    onError: () => toast.error('Failed to remove room type'),
  });

  const openEdit = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setForm({
      category: roomType.category,
      base_rate_rbi: String(roomType.base_rate_rbi),
      occupancy_max: String(roomType.occupancy_max),
      amenities: Array.isArray(roomType.amenities) ? roomType.amenities.join(', ') : '',
      extra_person_charge: roomType.extra_person_charge != null ? String(roomType.extra_person_charge) : '',
      meal_plan_options: hydrateMealPlans(roomType.add_on_options),
    });
    setIsEditDialogOpen(true);
  };

  const openDelete = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setIsDeleteDialogOpen(true);
  };

  const updateMealPlan = (index: number, field: keyof MealPlanOption, value: string) => {
    setForm((current) => ({
      ...current,
      meal_plan_options: current.meal_plan_options.map((plan, planIndex) =>
        planIndex === index ? { ...plan, [field]: value } : plan
      ),
    }));
  };

  const addMealPlan = () => {
    setForm((current) => ({
      ...current,
      meal_plan_options: [...current.meal_plan_options, emptyMealPlan()],
    }));
  };

  const removeMealPlan = (index: number) => {
    setForm((current) => ({
      ...current,
      meal_plan_options:
        current.meal_plan_options.length === 1
          ? [emptyMealPlan()]
          : current.meal_plan_options.filter((_, planIndex) => planIndex !== index),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const RoomTypeForm = ({
    onSubmit,
    isPending,
    submitLabel,
  }: {
    onSubmit: (event: React.FormEvent) => void;
    isPending: boolean;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="rt_category">Category *</Label>
        <Input
          id="rt_category"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rt_base_rate">Base Rate (RBI) ₹ *</Label>
          <Input
            id="rt_base_rate"
            type="number"
            step="0.01"
            min="0"
            value={form.base_rate_rbi}
            onChange={(event) => setForm({ ...form, base_rate_rbi: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rt_occupancy">Max Occupancy *</Label>
          <Input
            id="rt_occupancy"
            type="number"
            min="1"
            value={form.occupancy_max}
            onChange={(event) => setForm({ ...form, occupancy_max: event.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rt_extra_charge">Extra Person Charge ₹</Label>
        <Input
          id="rt_extra_charge"
          type="number"
          step="0.01"
          min="0"
          value={form.extra_person_charge}
          onChange={(event) => setForm({ ...form, extra_person_charge: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rt_amenities">Amenities (comma-separated)</Label>
        <Input
          id="rt_amenities"
          value={form.amenities}
          onChange={(event) => setForm({ ...form, amenities: event.target.value })}
          placeholder="WiFi, AC, TV"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label>Meal Plans</Label>
            <p className="text-sm text-gray-500">Add custom meal plans with price and dish details for this room type.</p>
          </div>
          <Button type="button" variant="outline" onClick={addMealPlan}>
            <Plus className="mr-2 h-4 w-4" />
            Add Plan
          </Button>
        </div>

        <div className="space-y-3">
          {form.meal_plan_options.map((plan, index) => (
            <div key={index} className="rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Plan Code</Label>
                  <Input
                    value={plan.code}
                    onChange={(event) => updateMealPlan(index, 'code', event.target.value)}
                    placeholder="CP"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plan Name</Label>
                  <Input
                    value={plan.label}
                    onChange={(event) => updateMealPlan(index, 'label', event.target.value)}
                    placeholder="Continental Plan"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price ₹</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={plan.price}
                    onChange={(event) => updateMealPlan(index, 'price', event.target.value)}
                    placeholder="1200"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label>Dish Details</Label>
                <Textarea
                  value={plan.dish_details}
                  onChange={(event) => updateMealPlan(index, 'dish_details', event.target.value)}
                  placeholder="Breakfast buffet, tea/coffee, south Indian platter..."
                  rows={3}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button type="button" variant="ghost" onClick={() => removeMealPlan(index)}>
                  Remove Plan
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Types</h1>
          <p className="mt-1 text-gray-500">Manage room categories, branch inventory, and meal plans</p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyForm);
            setIsCreateDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Room Type
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Room Types ({roomTypes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {roomTypes.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No room types found. Add one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Rooms In Branch</TableHead>
                  <TableHead>Base Rate (RBI)</TableHead>
                  <TableHead>Max Occupancy</TableHead>
                  <TableHead>Meal Plans</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomTypes.map((roomType) => (
                  <TableRow key={roomType.id}>
                    <TableCell className="font-medium">{roomType.category}</TableCell>
                    <TableCell>{roomType.property_name}</TableCell>
                    <TableCell>{Number(roomType.total_rooms ?? 0)}</TableCell>
                    <TableCell>₹{Number(roomType.base_rate_rbi).toLocaleString('en-IN')}</TableCell>
                    <TableCell>{roomType.occupancy_max}</TableCell>
                    <TableCell className="max-w-sm">
                      {Array.isArray(roomType.add_on_options) && roomType.add_on_options.length > 0 ? (
                        <div className="space-y-2">
                          {roomType.add_on_options.slice(0, 2).map((plan, index) => (
                            <div key={index} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                              <div className="font-medium">
                                {String(plan.code ?? 'PLAN')} - {String(plan.label ?? 'Custom plan')}
                              </div>
                              <div className="text-gray-600">₹{Number(plan.price ?? 0).toLocaleString('en-IN')}</div>
                            </div>
                          ))}
                          {roomType.add_on_options.length > 2 ? (
                            <div className="text-xs text-gray-500">+{roomType.add_on_options.length - 2} more plans</div>
                          ) : null}
                        </div>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(roomType)} title="Edit">
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDelete(roomType)} title="Delete">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Room Type</DialogTitle>
          </DialogHeader>
          <RoomTypeForm
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate(form);
            }}
            isPending={createMutation.isPending}
            submitLabel="Create"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Room Type</DialogTitle>
          </DialogHeader>
          <RoomTypeForm
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedRoomType) {
                updateMutation.mutate({ ...form, id: selectedRoomType.id });
              }
            }}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remove Room Type
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove the room type <span className="font-semibold">{selectedRoomType?.category}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedRoomType && deleteMutation.mutate(selectedRoomType.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoomTypesPage;
