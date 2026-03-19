import React, { useState, useEffect, useRef } from 'react';
import './VaultTable.css';

export interface StoredFile {
  id: number;
  name: string;
  ext: string;
  size: number;
  date?: string;
  time?: string;
  uploader?: string;
  status: 'stored' | 'pending';
  vis: 'public' | 'private' | 'encrypted';
  permConfig?: {
    type: 'public' | 'allowlist' | 'timelock' | 'purchasable';
  };
  network?: string;
  txHash?: string;
  cid?: string;
  previewUrl?: string;
}

interface ShelbyVaultTableProps {
  files: StoredFile[];
  checkedIds: Set<number>;
  onCheckedIdsChange: (ids: Set<number>) => void;
  onPreview?: (id: number) => void;
  onOpenExplorer?: (id: number) => void;
  onCopyLink?: (id: number) => void;
  onDownload?: (id: number) => void;
  onDelete?: (id: number) => void;
  onManagePermission?: (id: number, config: any) => void;
  onPermissionChange?: (id: number, config: any) => void;
  isLoading?: boolean;
  error?: string | null;
  walletConnected?: boolean;
  onConnectWallet?: () => void;
}

const PAGE_SIZE = 10;

/** Truncate a long filename for mobile display */
const truncateName = (name: string, maxLen = 24) =>
  name.length > maxLen ? name.slice(0, maxLen) + '…' : name;

/** A single swipeable mobile card row */
const SwipeRow: React.FC<{
  file: StoredFile;
  checked: boolean;
  onToggle: () => void;
  extColor: (ext: string) => string;
  fmtSize: (b: number) => string;
  onPreview?: () => void;
  onOpenExplorer?: () => void;
  onCopyLink?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
}> = ({ file, checked, onToggle, extColor, fmtSize, onPreview, onOpenExplorer, onCopyLink, onDownload, onDelete }) => {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  const currentOffset = useRef(0);
  const ACTION_W = 200;

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentOffset.current = open ? -ACTION_W : 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const newOffset = Math.max(-ACTION_W, Math.min(0, currentOffset.current + dx));
    setOffset(newOffset);
  };

  const handleTouchEnd = () => {
    if (!open && offset < -ACTION_W / 3) {
      setOffset(-ACTION_W);
      setOpen(true);
    } else if (open && offset > -ACTION_W * 0.66) {
      setOffset(0);
      setOpen(false);
    } else {
      setOffset(open ? -ACTION_W : 0);
    }
  };

  const closePanel = () => { setOffset(0); setOpen(false); };

  const act = (fn?: () => void) => { closePanel(); fn?.(); };

  return (
    <div className="swipe-row-wrapper">
      <div
        className={`swipe-row-content${checked ? ' swipe-row-selected' : ''}`}
        style={{ transform: `translateX(${offset}px)`, transition: 'transform 0.2s ease' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onToggle}
      >
        <div className="swipe-row-check">
          <input type="checkbox" checked={checked} onClick={(e) => e.stopPropagation()} onChange={onToggle} />
        </div>
        <div className="swipe-row-info">
          <div className="swipe-row-top">
            <span className="ext-icon" style={{ background: extColor(file.ext) }}>{file.ext.slice(0, 2)}</span>
            <span className="swipe-row-name" title={file.name}>{truncateName(file.name, 22)}</span>
          </div>
          <div className="swipe-row-meta">
            {fmtSize(file.size)}
            {file.status === 'stored'
              ? <span className="badge-stored"> · STORED</span>
              : <span className="badge-pending"> · PENDING</span>}
          </div>
        </div>
        <div className="swipe-row-hint">{'◀'}</div>
      </div>

      <div className="swipe-actions" style={{ width: ACTION_W }}>
        <button className="swipe-btn swipe-btn-preview" onTouchEnd={(e) => { e.stopPropagation(); act(onPreview); }} onClick={(e) => { e.stopPropagation(); act(onPreview); }}>👁<span>Preview</span></button>
        <button className="swipe-btn swipe-btn-link" onTouchEnd={(e) => { e.stopPropagation(); act(onOpenExplorer); }} onClick={(e) => { e.stopPropagation(); act(onOpenExplorer); }}>🔗<span>Explorer</span></button>
        <button className="swipe-btn swipe-btn-copy" onTouchEnd={(e) => { e.stopPropagation(); act(onCopyLink); }} onClick={(e) => { e.stopPropagation(); act(onCopyLink); }}>📋<span>Copy</span></button>
        <button className="swipe-btn swipe-btn-download" onTouchEnd={(e) => { e.stopPropagation(); act(onDownload); }} onClick={(e) => { e.stopPropagation(); act(onDownload); }}>⬇<span>Download</span></button>
        <button className="swipe-btn swipe-btn-delete" onTouchEnd={(e) => { e.stopPropagation(); act(onDelete); }} onClick={(e) => { e.stopPropagation(); act(onDelete); }}>🗑<span>Delete</span></button>
      </div>
    </div>
  );
};

const VaultTable: React.FC<ShelbyVaultTableProps> = ({
  files,
  checkedIds: propsCheckedIds,
  onCheckedIdsChange,
  onPreview,
  onOpenExplorer,
  onCopyLink,
  onDownload,
  onDelete,
  onManagePermission,
  isLoading,
  error,
  walletConnected,
  onConnectWallet,
}) => {
  const [searchQuery, setSearchInput] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [internalCheckedIds, setInternalCheckedIds] = useState<Set<number>>(new Set());
  
  const checkedIds = propsCheckedIds || internalCheckedIds;
  const setCheckedIds = (ids: Set<number>) => {
    if (onCheckedIdsChange) onCheckedIdsChange(ids);
    else setInternalCheckedIds(ids);
  };

  const [currentPage, setCurrentPage] = useState(1);

  const fmtSize = (b: number) => {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  };

  const shortenAddr = (addr: string) => {
    if (!addr || addr === 'anonymous') return addr;
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const extColor = (ext: string) => {
    const colors: Record<string, string> = {
      'PDF': '#cc3333', 'PNG': '#3366cc', 'JPG': '#3366cc', 'JPEG': '#3366cc',
      'MP4': '#663399', 'MOV': '#663399', 'GIF': '#cc33cc', 'JSON': '#339933',
      'SVG': '#cc6600', 'TXT': '#555555', 'ZIP': '#996600', 'JS': '#ccaa00',
      'TS': '#3366bb', 'PY': '#336699', 'HTML': '#cc5500', 'DOCX': '#2255aa',
      'WEBP': '#3366cc',
    };
    return colors[ext.toUpperCase()] || '#5a5acd';
  };

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (!filterStatus || f.status === filterStatus)
  );

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageFiles = filteredFiles.slice(pageStart, pageStart + PAGE_SIZE);

  const toggleCheck = (id: number) => {
    const newChecked = new Set(checkedIds);
    if (newChecked.has(id)) newChecked.delete(id);
    else newChecked.add(id);
    setCheckedIds(newChecked);
  };

  const emptyState = !walletConnected ? (
    <div className="empty-vault">
      <span className="empty-icon">🔌</span>
      <strong>Wallet not connected</strong><br/>
      Connect your wallet to view your upload history.<br/><br/>
      <button className="btn95" onClick={onConnectWallet}>Connect Wallet</button>
    </div>
  ) : isLoading ? (
    <div className="empty-vault">
      <span className="empty-icon rotating">⏳</span>
      <strong>Syncing with Shelby blockchain...</strong><br/>
      Fetching your upload history.
    </div>
  ) : error ? (
    <div className="empty-vault">
      <span className="empty-icon">⚠️</span>
      <strong style={{ color: 'var(--hot)' }}>RPC Error</strong><br/>
      {error}
    </div>
  ) : files.length === 0 ? (
    <div className="empty-vault">
      <span className="empty-icon">🗄️</span>
      <strong>Vault is empty</strong><br/>
      Upload a file to start your history.
    </div>
  ) : filteredFiles.length === 0 ? (
    <div className="empty-vault">
      <span className="empty-icon">🔍</span>
      No files match your search.
    </div>
  ) : null;


  return (
    <div className="window animate-entry delay-1" id="vaultWindow">
      <div className="titlebar">
        <span>📂 ShelbyVault — Upload History</span>
        <span id="statLabel" style={{ fontWeight: 400, fontSize: '12px' }}>
          {files.length > 0 && `${files.length} file${files.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div className="window-body">
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <input className="input95" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchInput(e.target.value)} style={{ flex: 1 }} />
          <select className="select95" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All</option>
            <option value="stored">Stored</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        {/* ─── MOBILE SWIPE CARD LIST (shown only on mobile via CSS) ─── */}
        <div className="mobile-vault-list">
          {emptyState}
          {!emptyState && pageFiles.map(s => (
            <SwipeRow
              key={s.id}
              file={s}
              checked={checkedIds.has(s.id)}
              onToggle={() => toggleCheck(s.id)}
              extColor={extColor}
              fmtSize={fmtSize}
              onPreview={() => onPreview?.(s.id)}
              onOpenExplorer={() => onOpenExplorer?.(s.id)}
              onCopyLink={() => onCopyLink?.(s.id)}
              onDownload={() => onDownload?.(s.id)}
              onDelete={() => onDelete?.(s.id)}
            />
          ))}
        </div>

        {/* ─── DESKTOP TABLE (hidden on mobile via CSS) ─── */}
        <div className="table-wrap desktop-vault-table">
          {emptyState || (
            <table>
              <thead>
                <tr>
                  <th style={{ width: '18px' }}></th>
                  <th style={{ width: '99%' }}>File</th>
                  <th>Size</th>
                  <th>Date</th>
                  <th>Uploader</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageFiles.map(s => {
                  const permType = (s.permConfig && s.permConfig.type) || (s.vis === 'public' ? 'public' : s.vis === 'private' ? 'allowlist' : 'purchasable');
                  const permMeta: Record<string, [string, string, string]> = {
                    public: ['🌐', 'Public', 'perm-public'],
                    allowlist: ['📋', 'Allowlist', 'perm-allowlist'],
                    timelock: ['⏰', 'Time Lock', 'perm-timelock'],
                    purchasable: ['💰', 'Purchasable', 'perm-purchasable'],
                  };
                  const [pIcon, pLabel, pClass] = permMeta[permType] || permMeta.public;
                  return (
                    <tr key={s.id} className={checkedIds.has(s.id) ? 'selected' : ''} onClick={() => toggleCheck(s.id)}>
                      <td><input type="checkbox" checked={checkedIds.has(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(s.id)} /></td>
                      <td>
                        <span className="ext-icon" style={{ background: extColor(s.ext) }}>{s.ext.slice(0, 2)}</span>
                        {s.name}
                        {s.vis === 'public' && s.status === 'stored' && <span className="hot-badge">HOT</span>}
                        <span className={`perm-pill interactive ${pClass}`} title={`Change permissions`} onClick={(e) => { e.stopPropagation(); onManagePermission?.(s.id, null); }}>{pIcon} {pLabel}</span>
                        {s.network && <span style={{ fontSize: '8px', padding: '1px 4px', background: 'var(--panel)', border: '1px solid var(--border-mid)', marginLeft: '3px', whiteSpace: 'nowrap' }}>{s.network}</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--border-mid)' }}>{fmtSize(s.size)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--border-mid)', fontSize: '12px' }}>{s.date || ''} {s.time || ''}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--border-mid)', fontSize: '10px', fontFamily: 'var(--mono)' }} title={s.uploader || ''}>{shortenAddr(s.uploader || '')}</td>
                      <td><span className={s.status === 'stored' ? 'badge-stored' : 'badge-pending'}>{s.status.toUpperCase()}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="tip"><button className="icon-btn95" onClick={(e) => { e.stopPropagation(); onPreview?.(s.id); }}>👁</button><span className="tiptext">Preview file</span></span>
                        <span className="tip"><button className="icon-btn95" onClick={(e) => { e.stopPropagation(); onOpenExplorer?.(s.id); }}>🔗</button><span className="tiptext">Open in Shelby Explorer</span></span>
                        <span className="tip"><button className="icon-btn95" onClick={(e) => { e.stopPropagation(); onCopyLink?.(s.id); }}>📋</button><span className="tiptext">Copy explorer link</span></span>
                        <span className="tip"><button className="icon-btn95" onClick={(e) => { e.stopPropagation(); onDownload?.(s.id); }}>⬇</button><span className="tiptext">Download file</span></span>
                        <span className="tip"><button className="icon-btn95" onClick={(e) => { e.stopPropagation(); onManagePermission?.(s.id, null); }}>🔒</button><span className="tiptext">Manage Permissions</span></span>
                        <span className="tip"><button className="icon-btn95 del" onClick={(e) => { e.stopPropagation(); onDelete?.(s.id); }}>DEL</button><span className="tiptext">Delete from vault</span></span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination bar */}
        {filteredFiles.length > PAGE_SIZE && (
          <div className="pagination-bar">
            <button className="page-btn95" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} title="Previous page">◀</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
              <button key={pg} className={`page-btn95${safePage === pg ? ' page-active' : ''}`} onClick={() => setCurrentPage(pg)} title={`Page ${pg}`}>{pg}</button>
            ))}
            <button className="page-btn95" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} title="Next page">▶</button>
            <span className="page-info">{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length} files</span>
          </div>
        )}

        {filteredFiles.length <= PAGE_SIZE && (
          <div style={{ marginTop: '5px', textAlign: 'right' }}>
            <span style={{ fontSize: '12px', color: 'var(--border-mid)' }}>
              {filteredFiles.length > 0 && `${filteredFiles.length} file${filteredFiles.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultTable;
