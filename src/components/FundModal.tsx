import React, { useState } from 'react';
import './FundModal.css';

interface FundModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  aptBalance: string;
  shelbyBalance: string;
  onRefresh: () => Promise<void>;
}

const FundModal: React.FC<FundModalProps> = ({
  isOpen,
  onClose,
  address,
  aptBalance,
  shelbyBalance,
  onRefresh,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    alert('Address copied to clipboard');
  };

  if (!isOpen) return null;

  return (
    <div className="modern-fund-overlay" onClick={onClose}>
      <div 
        className="modern-fund-modal" 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modern-fund-header">
          <h3>Fund Account</h3>
          <button className="modern-fund-close" onClick={onClose}>✕</button>
        </div>

        <div className="modern-fund-body">
          {address && (
            <div className="modern-fund-address" onClick={copyAddress} title="Click to copy address">
              <span className="address-label">Address</span>
              <div className="address-value">{address}</div>
            </div>
          )}

          <div className="modern-fund-balance">
            <div className="balance-header">APT BALANCE</div>
            <div className="balance-row">
              <span className="balance-badge apt-badge">APT</span>
              <span className="balance-amount">{aptBalance}</span>
            </div>
          </div>

          <div className="modern-fund-balance">
            <div className="balance-header">ShelbyUSD BALANCE</div>
            <div className="balance-row">
              <span className="balance-badge susd-badge">sUSD</span>
              <span className="balance-amount">{shelbyBalance}</span>
            </div>
          </div>
        </div>

        <div className="modern-fund-actions">
          <button className="modern-fund-btn secondary" onClick={copyAddress}>Copy</button>
          <button className="modern-fund-btn secondary" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? '⏳' : 'Refresh'}
          </button>
          <button className="modern-fund-btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default FundModal;
