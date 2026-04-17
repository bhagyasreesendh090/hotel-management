import { RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { PropertyProvider } from './context/PropertyContext';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PropertyProvider>
          <RouterProvider router={router} />
          <Toaster />
        </PropertyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
