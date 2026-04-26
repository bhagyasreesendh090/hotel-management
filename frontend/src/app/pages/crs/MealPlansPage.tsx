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
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, AlertTriangle, Coffee } from 'lucide-react';

interface MealPlan {
  id: number;
  name: string;
  code: string;
  description: string | null;
  per_person_rate: string;
  included_meals: string[];
  items: string[];
}

const ALL_MEALS = ['Breakfast', 'Lunch', 'High Tea', 'Dinner', 'Midnight Snack'];

const emptyForm = {
  name: '',
  code: '',
  description: '',
  per_person_rate: '',
  included_meals: [] as string[],
  items: '' // Comma separated for easy input natively
};

const MealPlansPage: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: mealPlans = [], isLoading } = useQuery({
    queryKey: ['mealPlans', selectedPropertyId],
    queryFn: async () => {
      const response = await apiClient.get<{ meal_plans: MealPlan[] }>('/api/meal-plans', {
        params: { property_id: selectedPropertyId },
      });
      return response.data.meal_plans ?? [];
    },
    enabled: !!selectedPropertyId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const response = await apiClient.post('/api/meal-plans', {
        property_id: selectedPropertyId,
        name: data.name,
        code: data.code,
        description: data.description || null,
        per_person_rate: data.per_person_rate,
        included_meals: data.included_meals,
        items: data.items.split(',').map(i => i.trim()).filter(Boolean),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast.success('Meal plan created successfully');
      setIsCreateOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('Failed to create meal plan'),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form & { id: number }) => {
      const response = await apiClient.put(`/api/meal-plans/${data.id}`, {
        name: data.name,
        code: data.code,
        description: data.description || null,
        per_person_rate: data.per_person_rate,
        included_meals: data.included_meals,
        items: data.items.split(',').map(i => i.trim()).filter(Boolean),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast.success('Meal plan updated successfully');
      setIsEditOpen(false);
      setSelectedPlan(null);
    },
    onError: () => toast.error('Failed to update meal plan'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/meal-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlans'] });
      toast.success('Meal plan removed');
      setIsDeleteOpen(false);
      setSelectedPlan(null);
    },
    onError: () => toast.error('Failed to remove meal plan'),
  });

  const openEdit = (plan: MealPlan) => {
    setSelectedPlan(plan);
    setForm({
      name: plan.name,
      code: plan.code,
      description: plan.description ?? '',
      per_person_rate: String(plan.per_person_rate),
      included_meals: plan.included_meals || [],
      items: (plan.items || []).join(', '),
    });
    setIsEditOpen(true);
  };

  const openDelete = (plan: MealPlan) => {
    setSelectedPlan(plan);
    setIsDeleteOpen(true);
  };

  const toggleMeal = (meal: string) => {
    setForm(prev => {
      if (prev.included_meals.includes(meal)) {
        return { ...prev, included_meals: prev.included_meals.filter(m => m !== meal) };
      }
      return { ...prev, included_meals: [...prev.included_meals, meal] };
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  const MealPlanForm = ({ onSubmit, isPending, submitLabel }: { onSubmit: (e: React.FormEvent) => void; isPending: boolean; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="plan_name">Plan Name *</Label>
          <Input id="plan_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Continental Breakfast" />
        </div>
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <Label htmlFor="plan_code">Short Code (Optional)</Label>
          <Input id="plan_code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. CB (Auto-generated if empty)" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="per_person_rate">Price Rate (Range or Flat ₹)</Label>
        <Input id="per_person_rate" type="text" value={form.per_person_rate} onChange={(e) => setForm({ ...form, per_person_rate: e.target.value })} placeholder="e.g. 200 - 300" />
      </div>

      <div className="space-y-2">
        <Label>Included Meals</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border rounded-md">
          {ALL_MEALS.map((meal) => (
            <div key={meal} className="flex items-center space-x-2">
              <Checkbox id={`meal-${meal}`} checked={form.included_meals.includes(meal)} onCheckedChange={() => toggleMeal(meal)} />
              <label htmlFor={`meal-${meal}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {meal}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan_items">Items Included (Comma separated)</Label>
        <Textarea id="plan_items" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} placeholder="e.g. Toast, Butter, Tea, Coffee, Juice" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan_description">Description / Notes</Label>
        <Textarea id="plan_description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Any special instructions or details..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setIsEditOpen(false); }}>Cancel</Button>
        <Button type="submit" disabled={isPending}>{isPending ? 'Saving...' : submitLabel}</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Plans</h1>
          <p className="text-gray-500 mt-1">Manage food and beverage packages for the property</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setIsCreateOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Meal Plan
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Meal Plans ({mealPlans.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {mealPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 py-16">
              <Coffee className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-center text-slate-600 font-medium">No meal plans defined yet.</p>
              <p className="text-sm text-slate-500 mt-1">Create predefined food packages to use in bookings.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate (₹)</TableHead>
                  <TableHead>Included</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mealPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-semibold text-slate-700">{plan.code}</TableCell>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>₹{plan.per_person_rate || '—'}</TableCell>
                    <TableCell>
                      {plan.included_meals && plan.included_meals.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {plan.included_meals.map(m => (
                            <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">{m}</span>
                          ))}
                        </div>
                      ) : <span className="text-slate-400 text-sm">—</span>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-slate-600">
                      {plan.items && plan.items.length > 0 ? plan.items.join(', ') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(plan)} title="Edit">
                          <Pencil className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openDelete(plan)} title="Delete">
                          <Trash2 className="w-4 h-4 text-red-500" />
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Meal Plan</DialogTitle></DialogHeader>
          <MealPlanForm
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            isPending={createMutation.isPending}
            submitLabel="Create Package"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Meal Plan</DialogTitle></DialogHeader>
          <MealPlanForm
            onSubmit={(e) => { e.preventDefault(); if (selectedPlan) updateMutation.mutate({ ...form, id: selectedPlan.id }); }}
            isPending={updateMutation.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Remove Meal Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <span className="font-semibold">{selectedPlan?.name}</span> ({selectedPlan?.code})? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => selectedPlan && deleteMutation.mutate(selectedPlan.id)}
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

export default MealPlansPage;
