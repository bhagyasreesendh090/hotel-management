import React from 'react';
import { Outlet } from 'react-router';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useProperty } from '../context/PropertyContext';

const AppLayout: React.FC = () => {
  const { selectedPropertyId } = useProperty();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ selectedPropertyId }} />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;