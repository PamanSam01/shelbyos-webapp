import React, { useState, useEffect } from 'react';
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
  blobId?: string; // On-chain unique identifier
  blobNameSuffix: string; // Blob path without owner prefix
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
const MOBILE_PAGE_SIZE = 5;

/** Smart truncate long filenames for mobile display (preserves extension) */
const truncateName = (name: string, maxLen = 22) => {
  if (name.length <= maxLen) return name;
  
  const lastDotPos = name.lastIndexOf('.');
  if (lastDotPos === -1 || lastDotPos === 0 || lastDotPos === name.length - 1) {
    // No valid extension, fallback to standard truncation
    return name.slice(0, maxLen - 3) + '...';
  }
  
  const ext = name.slice(lastDotPos);
  const baseName = name.slice(0, lastDotPos);
  
  // How much space do we have for the base name?
  const availableBaseLen = maxLen - ext.length - 3; // 3 for '...'
  
  if (availableBaseLen <= 0) {
    // Extremely long extension, just do standard truncation
    return name.slice(0, maxLen - 3) + '...';
  }
  
  // Keep start and end of base name
  const keepStart = Math.ceil(availableBaseLen / 2);
  const keepEnd = Math.floor(availableBaseLen / 2);
  
  return (
    <>
      <span className="file-base">{baseName.slice(0, keepStart)}...{baseName.slice(-keepEnd)}</span>
      <span className="file-ext">{ext}</span>
    </>
  );
};

/** A single tap-to-expand mobile row with action buttons below */
const ExpandableRow: React.FC<{
  file: StoredFile;
  checked: boolean;
  onToggle: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  extColor: (ext: string) => string;
  fmtSize: (b: number) => string;
  onPreview?: () => void;
  onOpenExplorer?: () => void;
  onCopyLink?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
}> = ({ file, checked, onToggle, expanded, onToggleExpand, extColor, fmtSize, onPreview, onOpenExplorer, onCopyLink, onDownload, onDelete }) => {
  const handleRowClick = () => {
    onToggleExpand();
  };

  const act = (fn?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
    fn?.();
  };

  return (
    <div className={`exp-row-wrapper${expanded ? ' exp-row-open' : ''}`}>
      {/* Main clickable row */}
      <div className="exp-row-main file-row" onClick={handleRowClick}>
        <div className="exp-row-check" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          <input type="checkbox" checked={checked} onChange={onToggle} readOnly />
        </div>
        <div className="exp-row-info">
          <div className="exp-row-top">
            <span className="ext-icon" style={{ background: extColor(file.ext) }}>{file.ext.slice(0, 2)}</span>
            <div className="exp-row-name" title={file?.name || ""}>
              {truncateName(file?.name || "Unknown", 26)}
            </div>
          </div>
          <div className="exp-row-meta">
            {fmtSize(file.size)}
            {file.status === 'stored'
              ? <span className="badge badge-public">✓ STORED</span>
              : <span className="badge badge-testnet">⏳ PENDING</span>}
          </div>
        </div>
        <div className="exp-row-chevron">{expanded ? '▲' : '▼'}</div>
      </div>

      {/* Expandable action panel */}
      {expanded && (
        <div className="inline-action-row">
          <button className="clean-action-btn action-icon" title="Preview"  onClick={act(onPreview)}>👁</button>
          <button className="clean-action-btn action-icon" title="Explorer" onClick={act(onOpenExplorer)}>🔗</button>
          <button className="clean-action-btn action-icon" title="Copy"     onClick={act(onCopyLink)}>📋</button>
          <button className="clean-action-btn action-icon" title="Download" onClick={act(onDownload)}>⬇</button>
          <button className="clean-action-btn action-icon" title="Delete"   onClick={act(onDelete)}>🗑</button>
        </div>
      )}
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
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  
  const checkedIds = propsCheckedIds || internalCheckedIds;
  const setCheckedIds = (ids: Set<number>) => {
    if (onCheckedIdsChange) onCheckedIdsChange(ids);
    else setInternalCheckedIds(ids);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [mobilePage, setMobilePage] = useState(1);

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

  const filteredFiles = files.filter(f => {
    const name = f?.name || "";
    const status = f?.status || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase()) &&
           (!filterStatus || status === filterStatus);
  });

  useEffect(() => { setCurrentPage(1); setMobilePage(1); }, [searchQuery, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageFiles = filteredFiles.slice(pageStart, pageStart + PAGE_SIZE);

  // Mobile pagination (5 per page)
  const mobileTotalPages = Math.max(1, Math.ceil(filteredFiles.length / MOBILE_PAGE_SIZE));
  const safeMobilePage = Math.min(mobilePage, mobileTotalPages);
  const mobilePageStart = (safeMobilePage - 1) * MOBILE_PAGE_SIZE;
  const mobilePageFiles = filteredFiles.slice(mobilePageStart, mobilePageStart + MOBILE_PAGE_SIZE);

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

        {/* ─── MOBILE EXPANDABLE CARD LIST (shown only on mobile via CSS, 5 per page) ─── */}
        <div className="mobile-vault-list mobile-layout">
          {emptyState}
          {!emptyState && mobilePageFiles.map(s => (
            <ExpandableRow
              key={s.id}
              file={s}
              checked={checkedIds.has(s.id)}
              onToggle={() => toggleCheck(s.id)}
              expanded={expandedRowId === s.id}
              onToggleExpand={() => setExpandedRowId(expandedRowId === s.id ? null : s.id)}
              extColor={extColor}
              fmtSize={fmtSize}
              onPreview={() => onPreview?.(s.id)}
              onOpenExplorer={() => onOpenExplorer?.(s.id)}
              onCopyLink={() => onCopyLink?.(s.id)}
              onDownload={() => onDownload?.(s.id)}
              onDelete={() => onDelete?.(s.id)}
            />
          ))}

          {/* Mobile pagination bar */}
          {!emptyState && mobileTotalPages > 1 && (
            <div className="mobile-pagination">
              <button
                className="mobile-page-btn"
                onClick={() => setMobilePage(p => Math.max(1, p - 1))}
                disabled={safeMobilePage === 1}
              >◀ Prev</button>
              <span className="mobile-page-info">
                Page {safeMobilePage} / {mobileTotalPages}
                <span className="mobile-page-count"> · {filteredFiles.length} files</span>
              </span>
              <button
                className="mobile-page-btn"
                onClick={() => setMobilePage(p => Math.min(mobileTotalPages, p + 1))}
                disabled={safeMobilePage === mobileTotalPages}
              >Next ▶</button>
            </div>
          )}

          {/* File count when only 1 page */}
          {!emptyState && mobileTotalPages === 1 && (
            <div className="mobile-page-single">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* ─── DESKTOP TABLE (hidden on mobile via CSS) ─── */}
        <div className="table-wrap desktop-vault-table desktop-layout">
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
                  const permMeta: Record<string, [string, string]> = {
                    public: ['🌐', 'Public'],
                    allowlist: ['📋', 'Allowlist'],
                    timelock: ['⏰', 'Time Lock'],
                    purchasable: ['💰', 'Purchasable'],
                  };
                  const [pIcon, pLabel] = permMeta[permType] || permMeta.public;
                  return (
                    <tr key={s.id} className={`file-row ${checkedIds.has(s.id) ? 'selected' : ''}`} onClick={() => toggleCheck(s.id)}>
                      <td><input type="checkbox" checked={checkedIds.has(s.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(s.id)} /></td>
                      <td>
                        <span className="ext-icon" style={{ background: extColor(s?.ext || "TXT") }}>{(s?.ext || "TX").slice(0, 2)}</span>
                        {s?.name || "Unknown"}
                        {s.vis === 'public' && s.status === 'stored' && <span className="badge badge-hot" style={{ marginLeft: '8px' }}>🔥 HOT</span>}
                        <span className={`badge badge-public interactive`} style={{ marginLeft: '6px', cursor: 'pointer' }} title={`Change permissions`} onClick={(e) => { e.stopPropagation(); onManagePermission?.(s.id, null); }}>{pIcon} {pLabel}</span>
                        {s.network && <span className="badge badge-testnet" style={{ marginLeft: '6px' }}>{s.network}</span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--border-mid)' }}>{fmtSize(s.size)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--border-mid)', fontSize: '12px' }}>{s.date || ''} {s.time || ''}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--border-mid)', fontSize: '10px', fontFamily: 'var(--mono)' }} title={s?.uploader || ''}>{shortenAddr(s?.uploader || '')}</td>
                      <td><span className={s?.status === 'stored' ? 'badge badge-public' : 'badge badge-testnet'}>{(s?.status || "pending").toUpperCase()}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="tip"><button className="icon-btn95 action-icon" onClick={(e) => { e.stopPropagation(); onPreview?.(s.id); }}>👁</button><span className="tiptext">Preview file</span></span>
                        <span className="tip"><button className="icon-btn95 action-icon" onClick={(e) => { e.stopPropagation(); onOpenExplorer?.(s.id); }}>🔗</button><span className="tiptext">Open in Shelby Explorer</span></span>
                        <span className="tip"><button className="icon-btn95 action-icon" onClick={(e) => { e.stopPropagation(); onCopyLink?.(s.id); }}>📋</button><span className="tiptext">Copy explorer link</span></span>
                        <span className="tip"><button className="icon-btn95 action-icon" onClick={(e) => { e.stopPropagation(); onDownload?.(s.id); }}>⬇</button><span className="tiptext">Download file</span></span>
                        <span className="tip"><button className="icon-btn95 action-icon" onClick={(e) => { e.stopPropagation(); onManagePermission?.(s.id, null); }}>🔒</button><span className="tiptext">Manage Permissions</span></span>
                        <span className="tip"><button className="icon-btn95 action-icon del" onClick={(e) => { e.stopPropagation(); onDelete?.(s.id); }}>DEL</button><span className="tiptext">Delete from vault</span></span>
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
          <div className="pagination-bar desktop-layout">
            <button className="page-btn95" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1} title="Previous page">◀</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
              <button key={pg} className={`page-btn95${safePage === pg ? ' page-active' : ''}`} onClick={() => setCurrentPage(pg)} title={`Page ${pg}`}>{pg}</button>
            ))}
            <button className="page-btn95" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} title="Next page">▶</button>
            <span className="page-info">{pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredFiles.length)} of {filteredFiles.length} files</span>
          </div>
        )}

        {filteredFiles.length <= PAGE_SIZE && (
          <div className="desktop-layout" style={{ marginTop: '5px', textAlign: 'right' }}>
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
