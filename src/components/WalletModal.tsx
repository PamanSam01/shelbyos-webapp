import React, { useState, useEffect } from 'react';
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
  isConnecting?: boolean;
}

const WALLETS: WalletProvider[] = [
  { 
    id: 'google',   
    label: 'Google Account',   
    logo: '/wallets/google.jpg', 
    adapterName: 'Continue with Google',
  },
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

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onSelectWallet, isConnecting = false }) => {
  const [installedWallets, setInstalledWallets] = useState<Record<string, boolean>>({
    google: true, // Google (Keyless) is web-based and always available
    petra: false,
    martian: false,
  });

  useEffect(() => {
    if (isOpen) {
      try {
        setInstalledWallets({
          google: true,
          petra: !!Object.keys(window).find(k => k.toLowerCase() === 'aptos' || k.toLowerCase() === 'petra'),
          martian: !!(window as any).martian,
        });
      } catch {
        // Safety: keep defaults
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modern-wallet-overlay" onClick={onClose}>
      <div 
        className="modern-wallet-modal" 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modern-wallet-header">
          <h3>Connect Wallet</h3>
          <button className="modern-wallet-close" onClick={onClose} disabled={isConnecting}>✕</button>
        </div>

        {isConnecting && (
          <div className="modern-wallet-connecting">
            ⏳ Connecting… please check your popup.
          </div>
        )}

        <div className="modern-wallet-list">
          {WALLETS.map(w => {
            const isInstalled = installedWallets[w.id];
            return (
              <div key={w.id} className="modern-wallet-item">
                <div className="modern-wallet-info">
                  <img src={w.logo} alt={w.label} className="modern-wallet-logo" />
                  <span className="modern-wallet-name">{w.label}</span>
                </div>
                <button 
                  className="modern-wallet-connect-btn"
                  onClick={() => !isConnecting && onSelectWallet(w.adapterName)}
                  disabled={!isInstalled || isConnecting}
                >
                  {isConnecting ? '...' : (isInstalled ? 'Connect' : 'Install')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
