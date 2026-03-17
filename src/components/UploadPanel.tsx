import React, { useState, useRef } from 'react';
import './UploadPanel.css';

interface UploadPanelProps {
  onFilesSelected?: (files: FileList) => void;
  onUpload?: () => void;
  walletConnected?: boolean;
  isUploading?: boolean;
  uploadProgress?: number;
  queuedFiles?: File[];
}

const UploadPanel: React.FC<UploadPanelProps> = ({
  onFilesSelected,
  onUpload,
  walletConnected = false,
  isUploading = false,
  uploadProgress = 0,
  queuedFiles = [],
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

        {queuedFiles.length > 0 && (
          <div className="queue-list">
            {queuedFiles.map((file, i) => (
              <div key={i} className="queue-item">
                <span className="qname">{file.name}</span>
                <span className="qsize">{fmtSize(file.size)}</span>
              </div>
            ))}
          </div>
        )}

        {(isUploading || uploadProgress > 0) && (
          <div className="progress95-wrap" style={{ display: 'block' }}>
            <div 
              className="progress95-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
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
            cursor: 'not-allowed', 
            fontSize: '12px', 
            opacity: 0.6 
          }}>
            <input type="checkbox" disabled style={{ cursor: 'not-allowed', width: '13px', height: '13px' }} />
            🔒 Encrypt file before upload
            <span className="coming-soon-badge">COMING SOON</span>
          </label>
          <span className="tiptext" style={{ whiteSpace: 'normal', maxWidth: '240px', textAlign: 'left' }}>
            Client-side encryption will be available in a future update.
          </span>
        </span>

        <div style={{ display: 'flex', gap: '5px' }}>
          <button 
            className="btn95 primary" 
            style={{ flex: 2 }} 
            onClick={onUpload}
            disabled={!walletConnected || queuedFiles.length === 0 || isUploading}
          >
            {isUploading ? 'UPLOADING...' : 'UPLOAD TO SHELBY'}
          </button>
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
