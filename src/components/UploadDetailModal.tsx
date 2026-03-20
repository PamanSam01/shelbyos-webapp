import React, { useRef } from 'react';
import Modal from './Modal';
import './UploadDetailModal.css';

export interface UploadQueueItem {
  file: File
  permission: string
  permConfig: any
  permOverridden: boolean
  status: 'ready' | 'uploading' | 'stored'
}

interface UploadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  queue: UploadQueueItem[];
  defaultPerm: string;
  onManageDefaultPerm: () => void;
  onManageFilePerm: (index: number) => void;
  onRemoveItem: (index: number) => void;
  onClearAll: () => void;
  onAddFiles: (files: FileList) => void;
  onUploadAll: () => void;
  isUploading: boolean;
  overallProgress: number;
  statusLine: string;
}

const UploadDetailModal: React.FC<UploadDetailModalProps> = ({
  isOpen,
  onClose,
  queue,
  defaultPerm,
  onManageDefaultPerm,
  onManageFilePerm,
  onRemoveItem,
  onClearAll,
  onAddFiles,
  onUploadAll,
  isUploading,
  overallProgress,
  statusLine,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fmtSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  const getExtColor = (name: string) => {
    const ext = name.split('.').pop()?.toUpperCase() || '';
    const colors: Record<string, string> = {
      'PDF': '#cc3333', 'PNG': '#3366cc', 'JPG': '#3366cc', 'JPEG': '#3366cc',
      'MP4': '#663399', 'MOV': '#663399', 'GIF': '#cc33cc', 'JSON': '#339933',
      'SVG': '#cc6600', 'TXT': '#555555', 'ZIP': '#996600', 'JS': '#ccaa00',
      'TS': '#3366bb', 'PY': '#336699', 'HTML': '#cc5500', 'DOCX': '#2255aa',
    };
    return colors[ext] || '#5a5acd';
  };

  const getPermIcon = (type: string) => {
    switch (type) {
      case 'public': return '🌐';
      case 'allowlist': return '📋';
      case 'timelock': return '⏰';
      case 'purchasable': return '💰';
      default: return '🔒';
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="File Details" 
      icon="📄" 
    >
      <div className="upload-panel-body">
        {/* File queue list */}
        <div className="up-file-list">
          {queue.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--border-mid)', fontSize: '12px' }}>
              Queue is empty.
            </div>
          ) : (
            queue.map((item, i) => (
              <div key={i} className="up-file-row">
                <span 
                  className="uf-ext" 
                  style={{ background: getExtColor(item.file.name) }}
                >
                  {item.file.name.split('.').pop()?.slice(0, 2).toUpperCase()}
                </span>
                <span className="uf-name" title={item.file.name}>{item.file.name}</span>
                <span className="uf-size">{fmtSize(item.file.size)}</span>
                <button 
                  className="uf-perm" 
                  onClick={() => onManageFilePerm(i)}
                  disabled={isUploading || item.status !== 'ready'}
                  title={item.permOverridden ? '★ Custom permission' : 'Default permission'}
                >
                  {getPermIcon(item.permConfig?.type || item.permission)}
                  {item.permOverridden && (
                    <span style={{ fontSize: '8px', verticalAlign: 'super', marginLeft: '1px', color: 'var(--accent)' }}>●</span>
                  )}
                </button>
                {item.status === 'uploading' && <span className="uf-status uploading">↑ Uploading</span>}
                {item.status === 'stored' && <span className="uf-status stored">✓ Done</span>}
                {item.status === 'ready' && !isUploading && (
                  <button 
                    className="icon-btn95 del" 
                    onClick={() => onRemoveItem(i)}
                    style={{ padding: '1px 5px', fontSize: '10px' }}
                  >✕</button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Default permissions row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border-mid)', padding: '5px 8px', background: 'var(--panel)' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--border-mid)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>
              Default Permission
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700 }}>
              {getPermIcon(defaultPerm)} {defaultPerm.charAt(0).toUpperCase() + defaultPerm.slice(1)}
            </div>
          </div>
          <button 
            className="btn95" 
            onClick={onManageDefaultPerm} 
            style={{ fontSize: '12px' }}
            disabled={isUploading}
          >
            Manage ▶
          </button>
        </div>

        {/* Overall progress bar */}
        {(isUploading || overallProgress > 0) && (
          <div className="up-progress-wrap" style={{ display: 'block' }}>
            <div 
              className="up-progress-bar" 
              style={{ width: `${Math.min(Math.max(overallProgress, 0), 100)}%` }}
            ></div>
          </div>
        )}

        {/* Overall status line */}
        <div style={{ fontSize: '12px', color: 'var(--border-mid)', minHeight: '15px' }}>
          {statusLine}
        </div>

        {/* Actions */}
        <input 
          type="file" 
          ref={fileInputRef} 
          multiple 
          style={{ display: 'none' }} 
          onChange={(e) => e.target.files && onAddFiles(e.target.files)}
        />
        <div className="up-actions">
          <button 
            className="btn95" 
            onClick={onClearAll} 
            disabled={isUploading || queue.length === 0}
          >
            🗑 Clear All
          </button>
          <button 
            className="btn95" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            + Add Files
          </button>
          <button className="btn95" onClick={onClose}>Close</button>
          <button 
            className="btn95 primary" 
            onClick={onUploadAll} 
            disabled={isUploading || queue.length === 0}
          >
            UPLOAD ALL
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default UploadDetailModal;
