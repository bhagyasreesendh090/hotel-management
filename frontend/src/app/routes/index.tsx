import { createBrowserRouter, Navigate } from 'react-router';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layout/AppLayout';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import PropertiesPage from '../pages/properties/PropertiesPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';

// CRS Pages
import RoomTypesPage from '../pages/crs/RoomTypesPage';
import AvailabilityPage from '../pages/crs/AvailabilityPage';
import BookingsPage from '../pages/crs/BookingsPage';
import MealPlansPage from '../pages/crs/MealPlansPage';

// CRM Pages
import LeadsPage from '../pages/crm/LeadsPage';
import LeadDetailsPage from '../pages/crm/LeadDetailsPage';
import QuotationsPage from '../pages/crm/QuotationsPage';
import QuoteBuilderPage from '../pages/crm/QuoteBuilderPage';
import PublicQuoteView from '../pages/crm/PublicQuoteView';
import ContractsPage from '../pages/crm/ContractsPage';
import ContractBuilderPage from '../pages/crm/ContractBuilderPage';
import PublicContractView from '../pages/crm/PublicContractView';
import StatusTrackerPage from '../pages/crm/StatusTrackerPage';
import InterestTrackerPage from '../pages/crm/InterestTrackerPage';
// Banquet Pages
import VenuesPage from '../pages/banquet/VenuesPage';
import BanquetBookingsPage from '../pages/banquet/BanquetBookingsPage';

// Corporate Pages
import CorporateAccountsPage from '../pages/corporate/CorporateAccountsPage';
import TravelAgentsPage from '../pages/corporate/TravelAgentsPage';


import PublicBookingPage from '../pages/public/PublicBookingPage';
import AppErrorPage from '../pages/errors/AppErrorPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/public/book',
    element: <PublicBookingPage />,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/public/book/:propertyRef',
    element: <PublicBookingPage />,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/public/quote/:token',
    element: <PublicQuoteView />,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/public/contract/:token',
    element: <PublicContractView />,
    errorElement: <AppErrorPage />,
  },
  {
    path: '/',
    errorElement: <AppErrorPage />,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'properties',
        element: <PropertiesPage />,
      },
      // CRS Routes
      {
        path: 'crs/room-types',
        element: <RoomTypesPage />,
      },
      {
        path: 'crs/availability',
        element: <AvailabilityPage />,
      },
      {
        path: 'crs/bookings',
        element: <BookingsPage />,
      },
      {
        path: 'crs/meal-plans',
        element: <MealPlansPage />,
      },
      // CRM Routes
      {
        path: 'crm/leads',
        element: <LeadsPage />,
      },
      {
        path: 'crm/leads/:id',
        element: <LeadDetailsPage />,
      },
      {
        path: 'crm/quotes/new',
        element: <QuoteBuilderPage />,
      },
      {
        path: 'crm/quotes/:id/edit',
        element: <QuoteBuilderPage />,
      },
      {
        path: 'crm/quotations',
        element: <QuotationsPage />,
      },
      {
        path: 'crm/contracts',
        element: <ContractsPage />,
      },
      {
        path: 'crm/contracts/new',
        element: <ContractBuilderPage />,
      },
      {
        path: 'crm/contracts/:id/edit',
        element: <ContractBuilderPage />,
      },
      {
        path: 'crm/tracker',
        element: <StatusTrackerPage />,
      },
      {
        path: 'crm/interest',
        element: <InterestTrackerPage />,
      },
      // Banquet Routes
      {
        path: 'banquet/venues',
        element: <VenuesPage />,
      },
      {
        path: 'banquet/bookings',
        element: <BanquetBookingsPage />,
      },
      // Corporate Routes
      {
        path: 'corporate/accounts',
        element: <CorporateAccountsPage />,
      },
      {
        path: 'corporate/travel-agents',
        element: <TravelAgentsPage />,
      },
      // Admin Routes
      {
        path: 'admin/users',
        element: <UserManagementPage />,
      },
      {
        path: 'admin/logs',
        element: <AuditLogsPage />,
      },

      {
        path: '*',
        element: <Navigate to="/public/book" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/public/book" replace />,
    errorElement: <AppErrorPage />,
  },
]);
