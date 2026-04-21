import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { formatRoleLabel } from '../lib/roles';
import { useProperty } from '../context/PropertyContext';
import { LogOut, Bell } from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const { properties, selectedPropertyId, setSelectedPropertyId } = useProperty();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left side - Property Selector */}
        <div className="flex items-center gap-4">
          <Select
            value={selectedPropertyId?.toString() || ''}
            onValueChange={(value) => setSelectedPropertyId(Number(value))}
          >
            <SelectTrigger className="w-[280px] border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <SelectValue placeholder="Select Property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span>{property.name}</span>
                    <span className="text-xs text-gray-500">({property.code})</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Right side - User Actions */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-600">{formatRoleLabel(user?.role)}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-semibold shadow-lg">
              {user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-2 text-gray-600 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;