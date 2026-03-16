import React from 'react';
import './StatusBar.css';

interface StatusBarProps {
  fileCount: number;
  totalSize: string;
  walletStatus: string;
  networkStatus: string;
  rpcStatus: 'loading' | 'ok' | 'error';
}

const StatusBar: React.FC<StatusBarProps> = ({
  fileCount,
  totalSize,
  walletStatus,
  networkStatus,
  rpcStatus,
}) => {
  const getRpcColor = () => {
    switch (rpcStatus) {
      case 'ok': return '#00ff00';
      case 'error': return '#ff0000';
      default: return '#ffaa00';
    }
  };

  return (
    <div className="statusbar">
      <span>Files: {fileCount}</span>
      <span>Size: {totalSize}</span>
      <span>Wallet: {walletStatus}</span>
      <span>
        Network: <span style={{ color: '#00ff00' }}>●</span> {networkStatus}
      </span>
      <span>
        RPC: <span style={{ color: getRpcColor() }}>●</span>
      </span>
      <span className="statusbar-credits">
        Built on <a href="https://x.com/shelbyserves" target="_blank" rel="noopener noreferrer">Shelby</a> | Created by <a href="https://x.com/0xdhyzal" target="_blank" rel="noopener noreferrer">0xSam</a>
      </span>
    </div>
  );
};

export default StatusBar;
