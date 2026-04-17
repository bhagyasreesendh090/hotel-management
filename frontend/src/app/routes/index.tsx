import { createBrowserRouter } from 'react-router';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../layout/AppLayout';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import PropertiesPage from '../pages/properties/PropertiesPage';

// CRS Pages
import RoomTypesPage from '../pages/crs/RoomTypesPage';
import RoomsPage from '../pages/crs/RoomsPage';
import AvailabilityPage from '../pages/crs/AvailabilityPage';
import BookingsPage from '../pages/crs/BookingsPage';

// CRM Pages
import LeadsPage from '../pages/crm/LeadsPage';
import LeadDetailsPage from '../pages/crm/LeadDetailsPage';

// Banquet Pages
import VenuesPage from '../pages/banquet/VenuesPage';
import BanquetBookingsPage from '../pages/banquet/BanquetBookingsPage';

// Corporate Pages
import CorporateAccountsPage from '../pages/corporate/CorporateAccountsPage';
import TravelAgentsPage from '../pages/corporate/TravelAgentsPage';

// Finance Pages
import InvoicesPage from '../pages/finance/InvoicesPage';
import PaymentsPage from '../pages/finance/PaymentsPage';
import CancellationsPage from '../pages/finance/CancellationsPage';

// Reports Pages
import PipelineReportPage from '../pages/reports/PipelineReportPage';
import GSTReportPage from '../pages/reports/GSTReportPage';
import OccupancyReportPage from '../pages/reports/OccupancyReportPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
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
        path: 'crs/rooms',
        element: <RoomsPage />,
      },
      {
        path: 'crs/availability',
        element: <AvailabilityPage />,
      },
      {
        path: 'crs/bookings',
        element: <BookingsPage />,
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
      // Finance Routes
      {
        path: 'finance/invoices',
        element: <InvoicesPage />,
      },
      {
        path: 'finance/payments',
        element: <PaymentsPage />,
      },
      {
        path: 'finance/cancellations',
        element: <CancellationsPage />,
      },
      // Reports Routes
      {
        path: 'reports/pipeline',
        element: <PipelineReportPage />,
      },
      {
        path: 'reports/gst',
        element: <GSTReportPage />,
      },
      {
        path: 'reports/occupancy',
        element: <OccupancyReportPage />,
      },
    ],
  },
]);
