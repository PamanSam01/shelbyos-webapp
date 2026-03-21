import React, { useState, useRef } from 'react';
import './UploadPanel.css';

interface UploadPanelProps {
  onFilesSelected?: (files: FileList) => void;
  onUpload?: () => void;
  walletConnected?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  queue?: any[]; // Array of UploadQueueItem
  statusLine?: string;
  encryptEnabled?: boolean;
  onEncryptChange?: (val: boolean) => void;
  isPreparing?: boolean;
  hasEncryptionKey?: boolean;
}

const UploadPanel: React.FC<UploadPanelProps> = ({
  onFilesSelected,
  onUpload,
  walletConnected = false,
  isUploading = false,
  uploadProgress = 0,
  queue = [],
  statusLine = '',
  encryptEnabled = false,
  onEncryptChange,
  isPreparing = false,
  hasEncryptionKey = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected?.(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected?.(e.target.files);
    }
  };

  const fmtSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  return (
    <div className="window animate-entry delay-2">
      <div className="titlebar">
        <span>💾 File Upload</span>
      </div>
      <div className="window-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        
        <div 
          className={`drop-zone ${isDragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            multiple 
            onChange={handleFileChange}
          />
          <div style={{ fontSize: '26px', marginBottom: '5px' }}>📁</div>
          <div style={{ fontSize: '13px', fontWeight: 700 }}>Drop files here</div>
          <div style={{ marginTop: '3px' }}>
            or <span style={{ color: 'var(--accent)', textDecoration: 'underline' }}>browse files</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--border-mid)', marginTop: '4px' }}>
            Max 100 MB · All formats
          </div>
        </div>

        {queue.length > 0 && (
          <div className="queue-list">
            {queue.map((item, i) => (
              <div key={i} className="queue-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span className="qname" title={item.file.name}>{item.file.name}</span>
                    <span style={{ fontSize: '9px', color: 'var(--border-mid)' }}>
                        {item.status === 'preparing' && '⌛ Preparing...'}
                        {item.status === 'ready' && '✓ Ready'}
                        {item.status === 'uploading' && '↑ Uploading...'}
                        {item.status === 'stored' && '✅ Done'}
                        {item.status === 'error' && '❌ Error'}
                    </span>
                </div>
                <span className="qsize">{fmtSize(item.file.size)}</span>
              </div>
            ))}
          </div>
        )}

        {(isUploading || uploadProgress > 0) && (
          <div className="progress95-wrap" style={{ display: 'block', marginBottom: '2px' }}>
            <div 
              className="progress95-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        {statusLine && (
          <div style={{ fontSize: '11px', color: 'var(--border-mid)', marginBottom: '5px', fontStyle: 'italic' }}>
            {statusLine}
          </div>
        )}

        <span className="tip" style={{ display: 'block' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '7px', 
            padding: '5px 6px', 
            border: '1px solid var(--border-mid)', 
            background: 'var(--panel)', 
            cursor: 'pointer', 
            fontSize: '12px'
          }}>
            <input 
              type="checkbox" 
              checked={encryptEnabled}
              onChange={(e) => onEncryptChange?.(e.target.checked)}
              style={{ cursor: 'pointer', width: '13px', height: '13px' }} 
            />
            🔒 Encrypt file before upload
          </label>
          <span className="tiptext" style={{ whiteSpace: 'normal', maxWidth: '240px', textAlign: 'left' }}>
            Protects your files with AES-GCM encryption before sending them to the network.
          </span>
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <button 
            className="btn95 primary" 
            style={{ width: '100%', padding: '10px' }} 
            onClick={onUpload}
            disabled={!walletConnected || queue.length === 0 || isUploading || isPreparing}
          >
            {isUploading ? 'UPLOADING...' : 
             isPreparing ? 'PREPARING...' :
             (encryptEnabled && !hasEncryptionKey) ? 'STEP 1: AUTHORIZE' :
             (encryptEnabled && hasEncryptionKey) ? 'STEP 2: UPLOAD NOW' :
             'UPLOAD TO SHELBY'}
          </button>
          
          {encryptEnabled && hasEncryptionKey && !isUploading && (
            <div style={{ fontSize: '10px', color: '#00aa00', textAlign: 'center', marginTop: '-2px' }}>
              ✓ Encryption Authorized
            </div>
          )}
        </div>

        {!walletConnected && (
          <div className="upload-warning">
            ⚠️ Connect wallet to upload
          </div>
        )}

      </div>
    </div>
  );
};

export default UploadPanel;
