import React, { useEffect, useRef, useState } from 'react';
import './UploadTerminal.css';

interface LogEntry {
  tag: string;
  msg: string;
}

interface UploadTerminalProps {
  logs: LogEntry[];
  isVisible: boolean;
  onClose: () => void;
}

const UploadTerminal: React.FC<UploadTerminalProps> = ({ logs, isVisible, onClose }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isVisible]);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  // Use refs to track the baseline coordinates when a drag starts, avoiding dependency loop jumping
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  // Reset position whenever the terminal is toggled visible
  useEffect(() => {
    if (isVisible) setPosition({ x: 0, y: 0 });
  }, [isVisible]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { x: position.x, y: position.y };
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`upload-terminal ${isDragging ? 'dragging' : ''}`}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      <div 
        className="ut-header" 
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <span>ShelbyOS / Vault Uplink</span>
        <button className="ut-close" onClick={onClose} title="Hide Terminal">×</button>
      </div>
      <div className="ut-body" ref={scrollRef}>
        {logs.map((log, i) => (
          <div key={i} className={`ut-log ${log.tag.trim().toLowerCase()}`}>
            <span className="ut-tag">[{log.tag}]</span>
            <span className="ut-msg">{log.msg}</span>
          </div>
        ))}
        {logs.length > 0 && !['DONE', 'ERR '].includes(logs[logs.length - 1].tag) && (
          <span className="ut-cursor">▋</span>
        )}
      </div>
    </div>
  );
};

export default UploadTerminal;
