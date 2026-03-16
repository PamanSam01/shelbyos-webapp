import React from 'react';
import './Navbar.css';

import { NETWORKS } from '../config/networks';

interface NavbarProps {
  activeNetwork?: string;
  onNetworkChange?: (network: string) => void;
  onThemeChange?: (theme: string) => void;
  onFundAccount?: () => void;
  onConnectWallet?: () => void;
  walletConnected?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  activeNetwork,
  onNetworkChange,
  onThemeChange,
  onFundAccount,
  onConnectWallet,
  walletConnected = false,
}) => {
  return (
    <nav className="nav">
      <a href="https://shelby.xyz/" target="_blank" rel="noopener noreferrer" className="navLogoLink">
        <img src="/logo/shelby.jpg" className="navLogoImg" alt="ShelbyOS" />
        <span className="navTitle">ShelbyOS</span>
      </a>
      <span className="navSubtext">Decentralized Storage Desktop on Shelby Network</span>
      <span className="navSep">//</span>
      <a className="navLink" onClick={() => window.open('https://docs.shelby.xyz/tools/wallets/petra-setup#apt-faucet', '_blank')}>Faucet</a>
      <span className="navSep">//</span>
      <a className="navLink" onClick={() => window.open('https://explorer.shelby.xyz/shelbynet', '_blank')}>Explorer</a>
      <span className="navSep">//</span>
      <a className="navLink" onClick={() => window.open('https://docs.shelby.xyz/', '_blank')}>Docs</a>
      <div className="navRight">
        <label className="navControl">
          Network
          <select 
            className="select95" 
            id="networkSwitcher" 
            value={activeNetwork}
            onChange={(e) => onNetworkChange?.(e.target.value)}
          >
            {Object.entries(NETWORKS).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </label>
        <label className="navControl">
          Theme
          <select className="select95" id="themeSwitcher" onChange={(e) => onThemeChange?.(e.target.value)}>
            <option value="theme-xp">🪟 XP</option>
            <option value="theme-terminal">⬛ Terminal</option>
            <option value="theme-neon">🌐 Neon</option>
          </select>
        </label>
        <button className="btn95" onClick={onFundAccount}>Fund Account</button>
        <button className="btn95" onClick={onConnectWallet}>
          {walletConnected ? 'Disconnect' : 'Connect Wallet'}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
