# Hotel Pramod CRM + CRS Frontend

A comprehensive React-based frontend application for Hotel Pramod's Sales CRM and Central Reservation System (CRS) with advanced analytics and sales team performance tracking.

## 🚀 Demo Accounts

The application includes three pre-configured demo accounts for testing different role permissions:

| Role | Email | Password | Access Level |
|------|-------|----------|--------------|
| **Super Admin** | admin@hotelpramod.com | admin123 | Full system access, all features |
| **Manager** | manager@hotelpramod.com | manager123 | Property management, bookings, reports |
| **Sales Team** | sales@hotelpramod.com | sales123 | CRM, leads, quotations, bookings |

**Quick Login**: Click on any demo account card on the login page to auto-fill credentials and sign in.

## ✨ Features

### 🎯 Analytics Dashboard
- **Real-time KPIs**: Revenue, bookings, occupancy, conversion rates
- **Interactive Charts**: Revenue trends, booking sources, pipeline analytics
- **Sales Team Performance**: Individual target tracking and achievement rates
- **Pipeline Health**: Win rate, deal cycle time, lead response metrics
- **Quick Actions**: Pending tasks, follow-ups, and priority items
- **Time Range Filters**: 7 days, 30 days, 90 days, 1 year views

### 🔐 Authentication
- JWT-based authentication
- Protected routes with automatic redirect
- Role-based access control
- Logout functionality

### Modules

#### Dashboard
- 6 key performance metrics with trend indicators
- Revenue & bookings trend analysis (Area + Line charts)
- Booking sources distribution (Pie chart)
- Revenue by room type (Horizontal bar chart)
- Sales team performance tracking with progress bars
- Lead conversion funnel visualization
- Pipeline health metrics
- Quick action cards for daily tasks

#### CRS (Central Reservation System)
- **Room Types**: Manage room categories, pricing, and amenities
- **Rooms**: Individual room management with status tracking
- **Availability**: Calendar-based room availability checker
- **Bookings**: Complete booking lifecycle (create, check-in, check-out)

#### CRM (Customer Relationship Management)
- **Leads**: Lead management with duplicate detection
- **Lead Details**: Action points, quotations, and contracts
- **Pipeline Tracking**: Visual sales pipeline

#### Banquet Management
- **Venues**: Banquet hall/venue management
- **Bookings**: Event booking management with status updates

#### Corporate & Agents
- **Corporate Accounts**: Manage B2B clients with credit limits
- **Travel Agents**: Partner management with commission tracking

#### Finance
- **Invoices**: Invoice generation and tracking
- **Payments**: Payment recording with multiple methods
- **Cancellations**: Refund and cancellation management

#### Reports
- **CRM Pipeline**: Lead funnel analytics
- **GST Summary**: Tax reports with breakdowns
- **Occupancy**: Room occupancy trends and statistics

## Tech Stack

- **React 18.3** - UI framework
- **Vite** - Build tool
- **React Router** - Navigation
- **TanStack React Query** - Data fetching and caching
- **Axios** - HTTP client
- **Tailwind CSS v4** - Modern utility-first styling
- **Recharts** - Data visualization
- **Radix UI** - Accessible components
- **Sonner** - Toast notifications
- **Lucide React** - Beautiful icons

## Setup & Installation

### Prerequisites
- Node.js 18+ 
- Backend API running on `http://localhost:4000` (or configured via env variable)

### Installation Steps

1. **Clone or extract the project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── client.ts              # Axios instance with interceptors
│   ├── auth/
│   │   └── AuthContext.tsx        # Authentication context & hooks
│   ├── components/
│   │   ├── ui/                    # Reusable UI components
│   │   └── figma/                 # Figma-specific components
│   ├── layout/
│   │   ├── AppLayout.tsx          # Main layout wrapper
│   │   ├── Sidebar.tsx            # Navigation sidebar
│   │   └── TopBar.tsx             # Top bar with property selector
│   ├── pages/
│   │   ├── auth/                  # Authentication pages
│   │   ├── dashboard/             # Dashboard page
│   │   ├── properties/            # Properties management
│   │   ├── crs/                   # CRS module pages
│   │   ├── crm/                   # CRM module pages
│   │   ├── banquet/               # Banquet module pages
│   │   ├── corporate/             # Corporate module pages
│   │   ├── finance/               # Finance module pages
│   │   └── reports/               # Reports pages
│   ├── routes/
│   │   ├── index.tsx              # Route definitions
│   │   └── ProtectedRoute.tsx    # Route protection HOC
│   └── App.tsx                    # Root component
└── styles/                        # Global styles
```

## API Integration

### Authentication
All API calls automatically include the JWT token from localStorage via Axios interceptors.

### Error Handling
- 401 responses automatically redirect to login
- Network errors show toast notifications
- Loading states for all async operations

### API Endpoints Used

**Auth**
- `POST /api/auth/login` - User login

**Properties**
- `GET /api/properties` - List properties
- `PATCH /api/properties/:id` - Update property

**CRS**
- `GET/POST /api/crs/room-types` - Room types
- `GET/POST /api/crs/rooms` - Rooms
- `GET /api/crs/availability` - Room availability
- `GET/POST /api/crs/bookings` - Bookings
- `POST /api/crs/bookings/:id/check-in` - Check-in
- `POST /api/crs/bookings/:id/check-out` - Check-out

**CRM**
- `GET/POST /api/crm/leads` - Leads
- `POST /api/crm/leads/check-duplicate` - Duplicate check
- `GET /api/crm/leads/:id` - Lead details
- `POST /api/crm/leads/:id/action-points` - Action points
- `POST /api/crm/quotations` - Quotations

**Banquet**
- `GET/POST /api/banquet/venues` - Venues
- `GET/POST /api/banquet/banquet-bookings` - Bookings

**Corporate**
- `GET/POST /api/corporate/corporate-accounts` - Corporate accounts
- `GET/POST /api/corporate/travel-agents` - Travel agents

**Finance**
- `GET/POST /api/finance/invoices` - Invoices
- `GET/POST /api/finance/payments` - Payments
- `GET/POST /api/finance/cancellations` - Cancellations
- `PATCH /api/finance/cancellations/:id/approve` - Approve cancellation

**Reports**
- `GET /api/reports/dashboard` - Dashboard data
- `GET /api/reports/crm/pipeline` - CRM pipeline
- `GET /api/reports/finance/gst-summary` - GST summary
- `GET /api/reports/reservations/occupancy` - Occupancy report

## Usage

### Login
1. Navigate to the application
2. Enter credentials (email and password)
3. System validates and stores JWT token
4. Redirects to dashboard

### Property Selection
- Select property from top bar dropdown
- Most pages require property selection
- Selection persists across page navigation

### Creating Records
- Each module has a "Create" or "Add" button
- Forms include client-side validation
- Success/error notifications appear after submission
- Lists refresh automatically after creation

### Role-Based Access
- Navigation menu adapts based on user role
- super_admin sees all menu items
- Other roles see filtered navigation

## Development

### Adding New Pages
1. Create page component in `src/app/pages/[module]/`
2. Add route in `src/app/routes/index.tsx`
3. Add navigation item in `src/app/layout/Sidebar.tsx`

### API Calls
Use TanStack Query hooks:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['key'],
  queryFn: async () => {
    const response = await apiClient.get('/endpoint');
    return response.data;
  },
});
```

### Mutations
```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await apiClient.post('/endpoint', data);
    return response.data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['key'] });
    toast.success('Success message');
  },
});
```

## Common Issues

### CORS Errors
Ensure backend allows requests from the frontend origin.

### 401 Unauthorized
- Check if backend is running
- Verify JWT token is valid
- Check API endpoint URLs

### Property Not Selected
Many pages require property selection from the top bar dropdown.

## License

Proprietary - Hotel Pramod

## Support

For technical support, contact the development team.