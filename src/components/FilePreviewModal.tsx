import React from 'react';
import Modal from './Modal';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    name: string;
    size: number;
    ext: string;
    date?: string;
    time?: string;
    permConfig?: { type: string };
    previewUrl?: string;
    cid?: string;
  } | null;
  onDownload?: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onDownload,
}) => {
  if (!file) return null;

  const fmtSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  };

  const getPermLabel = (type: string = 'public') => {
    const labels: Record<string, string> = {
      public: '🌐 Public',
      allowlist: '📋 Allowlist',
      timelock: '⏰ Time Lock',
      purchasable: '💰 Purchasable'
    };
    return labels[type] || '🌐 Public';
  };

  const isImage = ['PNG', 'JPG', 'JPEG', 'GIF', 'SVG', 'WEBP'].includes(file.ext.toUpperCase());

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={file.name} 
      icon="👁" 
      width="560px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        {/* Metadata Bar */}
        <div className="preview-meta" style={{ 
          width: '100%', 
          background: 'var(--panel)', 
          borderTop: '2px solid var(--border-dark)',
          borderLeft: '2px solid var(--border-dark)',
          borderRight: '2px solid var(--border-light)',
          borderBottom: '2px solid var(--border-light)',
          padding: '4px 8px',
          fontSize: '11px',
          color: 'var(--border-mid)',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span><strong>Size:</strong> {fmtSize(file.size)}</span>
          <span><strong>Type:</strong> {file.ext || '—'}</span>
          <span><strong>Permission:</strong> {getPermLabel(file.permConfig?.type)}</span>
          {file.date && <span><strong>Uploaded:</strong> {file.date} {file.time || ''}</span>}
        </div>

        {/* Content Area */}
        <div style={{ width: '100%', textAlign: 'center', minHeight: '48px', marginTop: '4px' }}>
          {file.previewUrl && isImage ? (
            <img 
              src={file.previewUrl} 
              alt={file.name} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '55vh', 
                borderTop: '2px solid var(--border-dark)',
                borderLeft: '2px solid var(--border-dark)',
                borderRight: '2px solid var(--border-light)',
                borderBottom: '2px solid var(--border-light)',
                display: 'block',
                margin: '0 auto'
              }}
            />
          ) : (
            <div style={{ padding: '16px', fontSize: '12px', color: 'var(--border-mid)', textAlign: 'center' }}>
              📄 Preview not available for this session.<br/>
              <span style={{ fontSize: '12px' }}>CID: {file.cid || '—'}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modal-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
          {file.previewUrl && isImage && (
            <button className="btn95" onClick={onDownload}>⬇ Download</button>
          )}
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn95" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FilePreviewModal;
