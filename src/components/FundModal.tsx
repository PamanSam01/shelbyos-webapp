import React, { useState } from 'react';
import Modal from './Modal';

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

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Fund Account" 
      icon="💰" 
      width="360px"
    >
      <div className="modal-body" style={{ padding: 0 }}>
        {/* Wallet address row */}
        {address && (
          <div 
            onClick={copyAddress}
            title="Click to copy address"
            style={{
              fontSize: '10px',
              color: 'var(--border-mid)',
              fontFamily: 'var(--mono)',
              wordBreak: 'break-all',
              padding: '4px 6px',
              border: '1px solid var(--border-mid)',
              background: 'var(--input-bg)',
              cursor: 'pointer',
              marginBottom: '8px'
            }}
          >
            {address}
          </div>
        )}

        {/* APT Balance */}
        <div style={{ border: '1px solid var(--border-mid)', padding: '8px 10px', background: 'var(--panel)', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--border-mid)', marginBottom: '6px' }}>APT BALANCE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#cc3333', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px', flexShrink: 0 }}>APT</div>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--mono)', flex: 1 }}>{aptBalance}</span>
          </div>
        </div>

        {/* ShelbyUSD Balance */}
        <div style={{ border: '1px solid var(--border-mid)', padding: '8px 10px', background: 'var(--panel)', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--border-mid)', marginBottom: '6px' }}>ShelbyUSD BALANCE</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ background: '#5a5acd', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px', flexShrink: 0 }}>sUSD</div>
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--mono)', flex: 1 }}>{shelbyBalance}</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', gap: '5px' }}>
          <button className="btn95" style={{ fontSize: '12px' }} onClick={copyAddress}>📋 Copy Addr</button>
          <button className="btn95" style={{ fontSize: '12px' }} onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? '⏳' : '🔄 Refresh'}
          </button>
          <button className="btn95" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default FundModal;
