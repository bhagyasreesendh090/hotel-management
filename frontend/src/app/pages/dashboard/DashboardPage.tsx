import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { isSalesAgentDashboardRole } from '../../lib/roles';
import ExecutiveDashboardPage from './ExecutiveDashboardPage';
import AgentDashboardPage from './AgentDashboardPage';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  if (isSalesAgentDashboardRole(user?.role)) {
    return <AgentDashboardPage />;
  }
  return <ExecutiveDashboardPage />;
};

export default DashboardPage;
