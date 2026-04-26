import React from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { hasFullAppAccess } from '../lib/roles';
import {
  LayoutDashboard,
  Building2,
  Bed,
  Users,
  Briefcase,
  Building,
  FileText,
  Calendar,
  Hotel,
  Coffee,
  ChevronRight,
} from 'lucide-react';


interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const Sidebar: React.FC = () => {
  const { user } = useAuth();

  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      to: '/properties',
      label: 'Properties',
      icon: <Building2 className="w-5 h-5" />,
      roles: ['super_admin', 'admin', 'manager', 'gm', 'sales_agent'],
    },
  ];

  const crsItems: NavItem[] = [
    {
      to: '/crs/room-types',
      label: 'Room Types',
      icon: <Bed className="w-5 h-5" />,
    },
    {
      to: '/crs/availability',
      label: 'Availability',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      to: '/crs/bookings',
      label: 'Bookings',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      to: '/crs/meal-plans',
      label: 'Meal Plans',
      icon: <Coffee className="w-5 h-5" />,
    },
  ];

  const crmItems: NavItem[] = [
    {
      to: '/crm/leads',
      label: 'Leads',
      icon: <Users className="w-5 h-5" />,
    },
    {
      to: '/crm/quotations',
      label: 'Quotations',
      icon: <FileText className="w-5 h-5" />,
    },
    {
      to: '/crm/contracts',
      label: 'Contracts',
      icon: <Briefcase className="w-5 h-5" />,
    },
  ];

  const banquetItems: NavItem[] = [
    {
      to: '/banquet/venues',
      label: 'Venues',
      icon: <Building className="w-5 h-5" />,
    },
    {
      to: '/banquet/bookings',
      label: 'Bookings',
      icon: <Calendar className="w-5 h-5" />,
    },
  ];


  const corporateItems: NavItem[] = [
    {
      to: '/corporate/accounts',
      label: 'Corporate Accounts',
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      to: '/corporate/travel-agents',
      label: 'Travel Agents',
      icon: <Users className="w-5 h-5" />,
    },
  ];


  const canAccessItem = (item: NavItem) => {
    if (!item.roles || hasFullAppAccess(user?.role)) return true;
    return item.roles.includes(user?.role || '');
  };

  const renderNavSection = (title: string, items: NavItem[]) => {
    const visibleItems = items.filter(canAccessItem);
    if (visibleItems.length === 0) return null;

    return (
      <div className="mb-6">
        <h3 className="px-4 mb-3 text-xs font-bold text-slate-600 uppercase tracking-widest">
          {title}
        </h3>
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${ 
                  isActive
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </div>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className={`w-4 h-4 transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-300 overflow-y-auto">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
            <Hotel className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight">
              Hotel Pramod
            </h1>
            <p className="text-xs text-slate-500 font-bold">CRM + CRS</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="py-6">
        {/* Main Navigation */}
        <div className="mb-6 px-2">
          {navItems.filter(canAccessItem).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group mb-1 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-lg'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </div>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className={`w-4 h-4 transition-all ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="space-y-1">
          {renderNavSection('CRS', crsItems)}
          {renderNavSection('CRM', crmItems)}
          {renderNavSection('Banquet', banquetItems)}
          {renderNavSection('Corporate', corporateItems)}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;