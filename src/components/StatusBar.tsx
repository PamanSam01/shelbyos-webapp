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
      <div className="statusbar-item" title="Stored Files">
        <span className="icon">🗂️</span>
        <span className="label">Files</span>
        <span className="value">{fileCount}</span>
      </div>
      <div className="statusbar-item" title="Total Vault Size">
        <span className="icon">💾</span>
        <span className="label">Size</span>
        <span className="value">{totalSize}</span>
      </div>
      <div className="statusbar-item" title="Wallet Connection">
        <span className="icon">💼</span>
        <span className="label">Wallet</span>
        <span className="value">{walletStatus}</span>
      </div>
      <div className="statusbar-item" title="Active Network">
        <span className="icon">🌐</span>
        <span className="label">Network</span>
        <span className="value">{networkStatus}</span>
      </div>
      <div className="statusbar-item rpc-item" title="RPC Endpoint Status">
        <span className="icon">🔌</span>
        <span className="label">RPC</span>
        <div className="rpc-indicator">
          <div className="rpc-dot" style={{ backgroundColor: getRpcColor() }} />
          <span className="value" style={{ color: getRpcColor(), textTransform: 'capitalize' }}>
            {rpcStatus}
          </span>
        </div>
      </div>
      <div className="statusbar-credits">
        Built on <a href="https://x.com/shelbyserves" target="_blank" rel="noopener noreferrer">Shelby</a> | Created by <a href="https://x.com/MrSamweb3" target="_blank" rel="noopener noreferrer">0xPamanSam</a>
      </div>
    </div>
  );
};

export default StatusBar;
