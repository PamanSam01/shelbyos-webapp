import React, { createContext, useContext, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { NETWORKS } from '../config/networks';
import type { NetworkConfig } from '../config/networks';

interface NetworkContextType {
  activeNetKey: keyof typeof NETWORKS;
  ACTIVE_NET: NetworkConfig;
  setActiveNetKey: (key: keyof typeof NETWORKS) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeNetKey, setActiveNetKey] = useState<keyof typeof NETWORKS>('testnet');

  const ACTIVE_NET = useMemo(() => 
    NETWORKS[activeNetKey] || NETWORKS.testnet, 
  [activeNetKey]);

  return (
    <NetworkContext.Provider value={{ activeNetKey, ACTIVE_NET, setActiveNetKey }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
