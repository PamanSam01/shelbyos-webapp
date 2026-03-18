import React from 'react';
import './DashboardOverview.css';
import type { StoredFile } from './VaultTable';

interface DashboardOverviewProps {
  files: StoredFile[];
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({ files }) => {
  const totalFiles = files.length;
  const totalSizeBytes = files.reduce((acc, file) => acc + (file.size || 0), 0);
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="dashboard-overview">
      <div className="stat-card">
        <div className="stat-icon" style={{ background: '#3b82f6' }}>📄</div>
        <div className="stat-content">
          <div className="stat-value">{totalFiles}</div>
          <div className="stat-label">Total Files On-Chain</div>
        </div>
      </div>
      
      <div className="stat-card">
        <div className="stat-icon" style={{ background: '#10b981' }}>💾</div>
        <div className="stat-content">
          <div className="stat-value">{formatSize(totalSizeBytes)}</div>
          <div className="stat-label">Decentralized Storage Used</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon" style={{ background: '#8b5cf6' }}>⚡</div>
        <div className="stat-content">
          <div className="stat-value">Live</div>
          <div className="stat-label">GraphQL Sync Status</div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
