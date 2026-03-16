import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import './WalletModal.css';

export interface WalletProvider {
  id: string;
  label: string;
  logo: string;
  adapterName: string;
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWallet: (walletName: string) => void;
}

const WALLETS: WalletProvider[] = [
  { 
    id: 'petra',   
    label: 'Petra Wallet',   
    logo: '/wallets/petra.jpg', 
    adapterName: 'Petra',
  },
  { 
    id: 'martian', 
    label: 'Martian Wallet', 
    logo: '/wallets/martian.jpg',
    adapterName: 'Martian',
  },
];

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onSelectWallet }) => {
  const [installedWallets, setInstalledWallets] = useState<Record<string, boolean>>({
    petra: false,
    martian: false,
  });

  useEffect(() => {
    if (isOpen) {
      setInstalledWallets({
        petra: !!(window as any).aptos,
        martian: !!(window as any).martian,
      });
    }
  }, [isOpen]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ShelbyOS Wallet" 
      icon="🔑" 
      width="340px"
    >
      <div style={{ fontSize: '12px', color: 'var(--border-mid)', marginBottom: '4px' }}>
        Select an Aptos-compatible wallet to connect.
      </div>
      
      <div className="wallet-list">
        {WALLETS.map(w => {
          const isInstalled = installedWallets[w.id];
          return (
            <button 
              key={w.id} 
              className="btn95 wallet-btn"
              onClick={() => onSelectWallet(w.adapterName)}
              disabled={!isInstalled}
            >
              <img src={w.logo} alt={w.label} className="wallet-logo" />
              <span style={{ flex: 1 }}>{w.label}</span>
              <span className={`wallet-status-badge ${isInstalled ? 'status-connect' : 'status-missing'}`}>
                {isInstalled ? 'Connect' : 'Not installed'}
              </span>
            </button>
          );
        })}
      </div>

      <div className="modal-actions">
        <button className="btn95" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
};

export default WalletModal;
