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
  const [size, setSize] = useState({ width: 380, height: 260 });
  const [isDragging, setIsDragging] = useState(false);
  const [resizeDir, setResizeDir] = useState<string | null>(null);
  
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (isVisible) {
      setPosition({ x: 0, y: 0 });
      setSize({ width: 380, height: 260 });
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isDragging && !resizeDir) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPosition({
          x: posStart.current.x + dx,
          y: posStart.current.y + dy
        });
      } else if (resizeDir) {
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        
        let newWidth = sizeStart.current.width;
        let newHeight = sizeStart.current.height;
        let newX = posStart.current.x;
        let newY = posStart.current.y;

        if (resizeDir.includes('e')) newWidth = Math.max(320, sizeStart.current.width + dx);
        if (resizeDir.includes('s')) newHeight = Math.max(200, sizeStart.current.height + dy);
        
        if (resizeDir.includes('w')) {
          const possibleWidth = sizeStart.current.width - dx;
          if (possibleWidth >= 320) {
            newWidth = possibleWidth;
            newX = posStart.current.x + dx;
          }
        }
        
        if (resizeDir.includes('n')) {
          const possibleHeight = sizeStart.current.height - dy;
          if (possibleHeight >= 200) {
            newHeight = possibleHeight;
            newY = posStart.current.y + dy;
          }
        }

        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      setResizeDir(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, resizeDir]);

  const handleDragMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { x: position.x, y: position.y };
  };

  const handleResizeMouseDown = (dir: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResizeDir(dir);
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { x: position.x, y: position.y };
    sizeStart.current = { width: size.width, height: size.height };
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`upload-terminal ${isDragging ? 'dragging' : ''} ${resizeDir ? 'resizing' : ''}`}
      style={{ 
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: `${size.width}px`,
        height: `${size.height}px`
      }}
    >
      {/* Resize Handles */}
      <div className="resizer n" onMouseDown={(e) => handleResizeMouseDown('n', e)} />
      <div className="resizer s" onMouseDown={(e) => handleResizeMouseDown('s', e)} />
      <div className="resizer e" onMouseDown={(e) => handleResizeMouseDown('e', e)} />
      <div className="resizer w" onMouseDown={(e) => handleResizeMouseDown('w', e)} />
      <div className="resizer nw" onMouseDown={(e) => handleResizeMouseDown('nw', e)} />
      <div className="resizer ne" onMouseDown={(e) => handleResizeMouseDown('ne', e)} />
      <div className="resizer sw" onMouseDown={(e) => handleResizeMouseDown('sw', e)} />
      <div className="resizer se" onMouseDown={(e) => handleResizeMouseDown('se', e)} />

      <div 
        className="ut-header" 
        onMouseDown={handleDragMouseDown}
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
