import React from 'react';
import Modal from './Modal';

interface FileDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  cid: string;
  link: string;
  dateLabel?: string;
  onCopyCid: () => void;
  onCopyLink: () => void;
}

const FileDetailModal: React.FC<FileDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  cid,
  link,
  dateLabel,
  onCopyCid,
  onCopyLink,
}) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title} 
      icon="🔗"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="modal-label">Content ID (CID)</div>
        <div className="info-box">{cid || '—'}</div>
        
        <div className="modal-label">Shareable Link</div>
        <div className="info-box">
          {link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {link}
            </a>
          ) : '—'}
        </div>
        
        {dateLabel && (
          <div className="modal-label" style={{ color: 'var(--border-mid)', fontWeight: 400, fontSize: '12px' }}>
            {dateLabel}
          </div>
        )}
        
        <div className="modal-actions">
          <button className="btn95" onClick={onCopyCid}>Copy CID</button>
          <button className="btn95" onClick={onCopyLink}>Copy Link</button>
          <button className="btn95" onClick={onClose}>OK</button>
        </div>
      </div>
    </Modal>
  );
};

export default FileDetailModal;
