import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import './PermissionModal.css';

export type PermissionType = 'public' | 'allowlist' | 'timelock' | 'purchasable';

export interface PermissionConfig {
  type: PermissionType;
  allowlist: string[];
  timelock: string;
  price: string;
}

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: PermissionConfig) => void;
  initialConfig?: PermissionConfig;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialConfig,
}) => {
  const [config, setConfig] = useState<PermissionConfig>(
    initialConfig || {
      type: 'public',
      allowlist: [],
      timelock: '',
      price: '',
    }
  );

  const [allowlistInput, setAllowlistInput] = useState('');

  // Sync state when modal opens with new initialConfig
  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig(initialConfig);
    }
  }, [isOpen, initialConfig]);

  const handleAddAllowlist = () => {
    const val = allowlistInput.trim();
    if (!val) return;
    if (config.allowlist.includes(val)) {
      alert('Address already added');
      return;
    }
    setConfig(prev => ({
      ...prev,
      allowlist: [...prev.allowlist, val],
    }));
    setAllowlistInput('');
  };

  const handleRemoveAllowlist = (index: number) => {
    setConfig(prev => ({
      ...prev,
      allowlist: prev.allowlist.filter((_, i) => i !== index),
    }));
  };

  const handleApply = () => {
    if (config.type === 'allowlist' && config.allowlist.length === 0) {
      alert('Add at least one wallet address');
      return;
    }
    if (config.type === 'timelock' && !config.timelock) {
      alert('Please select a date and time');
      return;
    }
    if (config.type === 'purchasable' && (!config.price || parseFloat(config.price) <= 0)) {
      alert('Please enter a valid price');
      return;
    }
    onApply(config);
    onClose();
  };

  const getTimelockPreview = () => {
    if (!config.timelock) return '';
    const d = new Date(config.timelock);
    return `Unlocks: ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="ShelbyOS Permissions" 
      icon="🔒"
      width="400px"
    >
      <div className="perm-modal-body">
        {/* Type selector */}
        <div>
          <div className="perm-config-label">Select permission type</div>
          <div className="perm-config-sub">Only one type can be active at a time.</div>
          <div className="perm-type-grid">
            <div 
              className={`perm-type-card ${config.type === 'public' ? 'selected' : ''}`}
              onClick={() => setConfig(prev => ({ ...prev, type: 'public' }))}
            >
              <span className="perm-type-icon">🌐</span>
              <span className="perm-type-name">Public</span>
              <span className="perm-type-desc">No restrictions</span>
            </div>

            <div 
              className={`perm-type-card ${config.type === 'allowlist' ? 'selected' : ''}`}
              onClick={() => setConfig(prev => ({ ...prev, type: 'allowlist' }))}
            >
              <span className="perm-type-icon">📋</span>
              <span className="perm-type-name">Allowlist</span>
              <span className="perm-type-desc">Wallet addresses only</span>
            </div>

            <div 
              className={`perm-type-card ${config.type === 'timelock' ? 'selected' : ''}`}
              onClick={() => setConfig(prev => ({ ...prev, type: 'timelock' }))}
            >
              <span className="perm-type-icon">⏰</span>
              <span className="perm-type-name">Time Lock</span>
              <span className="perm-type-desc">Available after date</span>
            </div>

            <div 
              className={`perm-type-card ${config.type === 'purchasable' ? 'selected' : ''}`}
              onClick={() => setConfig(prev => ({ ...prev, type: 'purchasable' }))}
            >
              <span className="perm-type-icon">💰</span>
              <span className="perm-type-name">Purchasable</span>
              <span className="perm-type-desc">Set price in sUSD</span>
            </div>
          </div>
        </div>

        {/* Configuration Panels */}
        {config.type === 'public' && (
          <div className="perm-config-panel">
            <div className="perm-config-label">🌐 Public Access</div>
            <div style={{ fontSize: '12px', color: 'var(--border-mid)' }}>
              Anyone can access this file. No restrictions applied.
            </div>
          </div>
        )}

        {config.type === 'allowlist' && (
          <div className="perm-config-panel">
            <div className="perm-config-label">📋 Wallet Allowlist</div>
            <div className="perm-config-sub">Only the addresses below can access this file.</div>
            <div className="allowlist-add-row">
              <input 
                className="allowlist-input" 
                placeholder="0x... wallet address" 
                value={allowlistInput}
                onChange={(e) => setAllowlistInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAllowlist()}
              />    
              <button className="btn95" onClick={handleAddAllowlist}>+ Add</button>
            </div>
            <div className="allowlist-entries">
              {config.allowlist.length === 0 ? (
                <div className="allowlist-empty">No addresses added yet.</div>
              ) : (
                config.allowlist.map((addr, i) => (
                  <div key={i} className="allowlist-entry">
                    <span title={addr}>{addr}</span>
                    <button 
                      className="icon-btn95 del" 
                      onClick={() => handleRemoveAllowlist(i)}
                      style={{ padding: '1px 5px', fontSize: '10px' }}
                    >✕</button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {config.type === 'timelock' && (
          <div className="perm-config-panel">
            <div className="perm-config-label">⏰ Time Lock</div>
            <div className="perm-config-sub">File becomes accessible after the selected date and time.</div>
            <input 
              className="timelock-input" 
              type="datetime-local" 
              value={config.timelock}
              onChange={(e) => setConfig(prev => ({ ...prev, timelock: e.target.value }))}
            />
            <div style={{ fontSize: '10px', color: 'var(--border-mid)' }}>
              {getTimelockPreview()}
            </div>
          </div>
        )}

        {config.type === 'purchasable' && (
          <div className="perm-config-panel">
            <div className="perm-config-label">💰 Purchasable</div>
            <div className="perm-config-sub">Users must pay in ShelbyUSD to access this file.</div>
            <div className="price-input-wrap">
              <span className="price-currency">sUSD</span>
              <input 
                className="price-input" 
                type="number" 
                min="0" 
                step="0.01" 
                placeholder="0.00"
                value={config.price}
                onChange={(e) => setConfig(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--border-mid)' }}>
              Enter the price users must pay to unlock this file.
            </div>
          </div>
        )}

        <div className="perm-modal-actions">
          <button className="btn95" onClick={onClose}>Cancel</button>
          <button className="btn95 primary" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </Modal>
  );
};
