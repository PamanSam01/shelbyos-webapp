import React from 'react';
import './Navbar.css';

import { NETWORKS } from '../config/networks';

interface NavbarProps {
  activeNetwork?: string;
  onNetworkChange?: (network: string) => void;
  onThemeChange?: (theme: string) => void;

  onConnectWallet?: () => void;
  walletConnected?: boolean;
  address?: string;
  aptBalance?: string;
  shelbyBalance?: string;
  onRefresh?: () => Promise<void>;
}

const Navbar: React.FC<NavbarProps> = ({
  activeNetwork,
  onNetworkChange,
  onThemeChange,

  onConnectWallet,
  walletConnected = false,
  address = '',
  aptBalance = '0.00',
  shelbyBalance = '0.00',
  onRefresh,
}) => {
  const [isFundOpen, setIsFundOpen] = React.useState(false);
  return (
    <nav className="nav">
      <div className="nav-top">
        <a href="https://shelby.xyz/" target="_blank" rel="noopener noreferrer" className="navLogoLink">
          <img src="/logo/shelby.jpg" className="navLogoImg" alt="ShelbyOS" />
          <span className="navTitle">ShelbyOS</span>
        </a>
        <span className="navSubtext">Decentralized Storage Desktop on Shelby Network</span>
        <div className="navLinks">
          <a className="navLink" onClick={() => window.open('https://docs.shelby.xyz/tools/wallets/petra-setup#apt-faucet', '_blank')}>Faucet</a>
          <span className="navSep">//</span>
          <a className="navLink" onClick={() => window.open('https://explorer.shelby.xyz/shelbynet', '_blank')}>Explorer</a>
          <span className="navSep">//</span>
          <a className="navLink" onClick={() => window.open('https://docs.shelby.xyz/', '_blank')}>Docs</a>
        </div>
      </div>
      <div className="header-controls">
        <label className="navControl network-control">
          <span className="control-label">Network</span>
          <select 
            className="select95 network-select" 
            id="networkSwitcher" 
            value={activeNetwork}
            onChange={(e) => onNetworkChange?.(e.target.value)}
          >
            {Object.entries(NETWORKS).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </label>
        <label className="navControl theme-control">
          <span className="control-label">Theme</span>
          <select className="select95 theme-select" id="themeSwitcher" onChange={(e) => onThemeChange?.(e.target.value)}>
            <option value="theme-xp">🪟 XP</option>
            <option value="theme-terminal">⬛ Terminal</option>
            <option value="theme-neon">🌐 Neon</option>
          </select>
        </label>
        <div className="fund-dropdown">
          <button className="btn95" onClick={() => setIsFundOpen(!isFundOpen)}>
            Fund Account {isFundOpen ? '▲' : '▼'}
          </button>
          
          {isFundOpen && (
            <div className="fund-dropdown-panel animate-slide-down">
              {address && (
                <div 
                  className="modern-fund-address" 
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    alert('Address copied to clipboard');
                  }} 
                  title="Click to copy address"
                >
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

              <div className="modern-fund-actions">
                <button 
                  className="modern-fund-btn secondary" 
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    alert('Address copied to clipboard');
                  }}
                >Copy</button>
                <button 
                  className="modern-fund-btn secondary" 
                  onClick={async () => {
                    if (onRefresh) await onRefresh();
                  }}
                >
                  Refresh
                </button>
                <button className="modern-fund-btn primary" onClick={() => setIsFundOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
        
        <button className="btn95" onClick={onConnectWallet}>
          {walletConnected ? 'Disconnect' : 'Connect Wallet'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
