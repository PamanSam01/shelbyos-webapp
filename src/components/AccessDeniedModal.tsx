import React from 'react';
import Modal from './Modal';

interface AccessDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
}

const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  isOpen,
  onClose,
  message,
  onConfirm,
  confirmText = 'OK',
}) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Access Restricted" 
      icon="🔒" 
      width="340px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '13px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
          {message}
        </p>
        <div className="modal-actions">
          <button className="btn95" onClick={onConfirm || onClose}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AccessDeniedModal;
