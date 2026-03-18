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
    uploader?: string;
  } | null;
  onDownload?: () => void;
  /** Shelby RPC base URL e.g. "https://api.testnet.shelby.xyz/shelby" */
  shelbyRpcUrl?: string;
  /** Owner wallet address for building the blob URL */
  ownerAddress?: string;
}

const IMAGE_EXTS = ['PNG', 'JPG', 'JPEG', 'GIF', 'SVG', 'WEBP', 'BMP', 'ICO'];
const VIDEO_EXTS = ['MP4', 'WEBM', 'OGG', 'MOV'];
const TEXT_EXTS  = ['TXT', 'MD', 'CSV', 'JSON', 'JS', 'TS', 'PY', 'HTML', 'XML'];

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onDownload,
  shelbyRpcUrl,
  ownerAddress,
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
      purchasable: '💰 Purchasable',
    };
    return labels[type] || '🌐 Public';
  };

  const extUp = file.ext.toUpperCase();
  const isImage = IMAGE_EXTS.includes(extUp);
  const isVideo = VIDEO_EXTS.includes(extUp);
  const isText  = TEXT_EXTS.includes(extUp);

  // Build a direct Shelby RPC URL for the blob — works for public blobs without auth
  // Pattern: {shelbyRpc}/v1/blobs/{ownerAddr}/{blobName}
  const addr = ownerAddress || file.uploader || '';
  const directBlobUrl = shelbyRpcUrl && addr && file.name
    ? `${shelbyRpcUrl}/v1/blobs/${addr}/${encodeURIComponent(file.name)}`
    : undefined;

  // Determine which URL to use for rendering — prefer already-fetched ObjectURL
  const displayUrl = file.previewUrl || directBlobUrl;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.name}
      icon="👁"
      width="600px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
        {/* Metadata Bar */}
        <div style={{
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
          flexWrap: 'wrap',
        }}>
          <span><strong>Size:</strong> {fmtSize(file.size)}</span>
          <span><strong>Type:</strong> {file.ext || '—'}</span>
          <span><strong>Permission:</strong> {getPermLabel(file.permConfig?.type)}</span>
          {file.date && <span><strong>Uploaded:</strong> {file.date} {file.time || ''}</span>}
        </div>

        {/* Content Area */}
        <div style={{ width: '100%', textAlign: 'center', minHeight: '80px', marginTop: '4px' }}>
          {isImage && displayUrl ? (
            <img
              src={displayUrl}
              alt={file.name}
              onError={(e) => {
                // If direct URL fails, hide image and show fallback
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) {
                  const msg = document.createElement('div');
                  msg.style.cssText = 'padding:16px;font-size:12px;color:var(--border-mid);';
                  msg.innerHTML = '🖼 Preview could not be loaded from the Shelby network.<br/><small>The file may still be indexed; try downloading instead.</small>';
                  parent.appendChild(msg);
                }
              }}
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                borderTop: '2px solid var(--border-dark)',
                borderLeft: '2px solid var(--border-dark)',
                borderRight: '2px solid var(--border-light)',
                borderBottom: '2px solid var(--border-light)',
                display: 'block',
                margin: '0 auto',
              }}
            />
          ) : isVideo && displayUrl ? (
            <video
              src={displayUrl}
              controls
              style={{ maxWidth: '100%', maxHeight: '60vh', display: 'block', margin: '0 auto' }}
            />
          ) : isText && displayUrl ? (
            <iframe
              src={displayUrl}
              title={file.name}
              style={{ width: '100%', height: '300px', border: '2px solid var(--border-dark)' }}
            />
          ) : (
            <div style={{ padding: '24px 16px', fontSize: '12px', color: 'var(--border-mid)', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
              <strong>{file.name}</strong><br/>
              <span style={{ fontSize: '11px' }}>Preview not available for {extUp} files.</span><br/>
              {file.cid && <span style={{ fontSize: '10px', marginTop: '4px', display: 'block', fontFamily: 'monospace' }}>CID: {file.cid}</span>}
              <div style={{ marginTop: '8px' }}>
                <button className="btn95" onClick={onDownload}>⬇ Download File</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modal-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
          <button className="btn95" onClick={onDownload}>⬇ Download</button>
          <button className="btn95" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};

export default FilePreviewModal;
