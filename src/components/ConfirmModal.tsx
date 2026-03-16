import React from 'react';
import Modal from './Modal';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  subMessage?: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  subMessage,
  confirmText = 'OK',
  cancelText = 'Cancel',
}) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={title} 
      icon="⚠️" 
      width="320px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p style={{ fontSize: '13px', margin: 0 }}>{message}</p>
        {subMessage && (
          <p style={{ fontSize: '12px', color: 'var(--border-mid)', margin: 0 }}>{subMessage}</p>
        )}
        <div className="modal-actions">
          <button className="btn95" onClick={onClose}>{cancelText}</button>
          <button className="btn95 primary" onClick={() => { onConfirm(); onClose(); }}>
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
