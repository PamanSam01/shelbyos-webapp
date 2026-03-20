import React from 'react';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  width?: string;
}

const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  icon, 
  children, 
  width 
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-bg" onClick={onClose}>
      <div 
        className="modal-win" 
        style={width ? { width } : {}} 
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="titlebar">
          <span>
            {icon && <span className="modal-icon">{icon}</span>}
            {title}
          </span>
          <button className="close-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
