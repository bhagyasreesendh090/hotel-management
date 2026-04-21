import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useAuth } from '../auth/AuthContext';

export interface Property {
  id: number;
  name: string;
  code: string;
}

interface PropertiesResponse {
  properties: Property[];
}

interface PropertyContextType {
  properties: Property[];
  selectedProperty: Property | null;
  selectedPropertyId: number | null;
  setSelectedPropertyId: (id: number) => void;
  isLoading: boolean;
  error: any;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading: authLoading } = useAuth();
  const [selectedPropertyId, setSelectedPropertyIdState] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedPropertyId');
    return saved ? parseInt(saved, 10) : null;
  });

  const canFetchProperties = Boolean(token) && !authLoading;

  const { data: properties = [], isLoading, error } = useQuery<Property[]>({
    queryKey: ['properties'],
    enabled: canFetchProperties,
    queryFn: async () => {
      const response = await apiClient.get<PropertiesResponse>('/api/properties');
      const propertyList = Array.isArray(response.data?.properties) ? response.data.properties : [];
      return propertyList;
    },
  });

  // Ensure selected property exists (fixes stale localStorage IDs so pages can load)
  useEffect(() => {
    if (isLoading || properties.length === 0) return;
    const valid =
      selectedPropertyId != null && properties.some((p) => p.id === selectedPropertyId);
    if (!valid) {
      const first = properties[0].id;
      setSelectedPropertyIdState(first);
      localStorage.setItem('selectedPropertyId', String(first));
    }
  }, [isLoading, properties, selectedPropertyId]);

  const setSelectedPropertyId = (id: number) => {
    setSelectedPropertyIdState(id);
    localStorage.setItem('selectedPropertyId', id.toString());
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId) || null;

  return (
    <PropertyContext.Provider 
      value={{ 
        properties, 
        selectedProperty, 
        selectedPropertyId, 
        setSelectedPropertyId, 
        isLoading, 
        error 
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
};

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (context === undefined) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};
