import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network, type AptosSettings } from "@aptos-labs/ts-sdk"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ShelbyClientProvider, useUploadBlobs } from "@shelby-protocol/react"
import { ShelbyClient } from "@shelby-protocol/sdk/browser"

import { formatTokenBalance, formatFileSize } from './utils/file'
import { debugLog, debugWarn, debugError } from './utils/logger'
import Navbar from './components/Navbar'
import VaultTable from './components/VaultTable'
import type { StoredFile } from './components/VaultTable'
import UploadPanel from './components/UploadPanel'
import StatusBar from './components/StatusBar'
import Toast from './components/Toast'
import type { ToastType } from './components/Toast'
import WalletModal from './components/WalletModal'
import { PermissionModal } from './components/PermissionModal'
import type { PermissionConfig } from './components/PermissionModal'
import ConfirmModal from './components/ConfirmModal'
import FileDetailModal from './components/FileDetailModal'
import UploadDetailModal from './components/UploadDetailModal'
import type { UploadQueueItem } from './components/UploadDetailModal'
import FilePreviewModal from './components/FilePreviewModal'
import AccessDeniedModal from './components/AccessDeniedModal'
import { NETWORKS } from './config/networks'
import './themes.css'
import Intro from './components/Intro'
import UploadTerminal from './components/UploadTerminal'
import { fetchBlobsFromGraphQL, fetchRecentActivitiesFromGraphQL } from './services/shelbyService'

const queryClient = new QueryClient();

function ShelbyOS({ activeNetKey, setActiveNetKey, theme, setTheme }: {
  activeNetKey: keyof typeof NETWORKS,
  setActiveNetKey: (key: keyof typeof NETWORKS) => void,
  theme: string,
  setTheme: (t: string) => void
}) {
  const { connect, disconnect, account, connected, signAndSubmitTransaction } = useWallet()
  
  // Wallet State
  const [manualWalletId, setManualWalletId] = useState<string | null>(null);
  const walletConnected = connected || manualWalletId !== null;
  const walletAddress = account?.address?.toString() || (manualWalletId === 'Martian' ? (window as any).martian?.selectedAccount?.address : "");
  
  // Mock balances
  const [aptBalance, setAptBalance] = useState('0.00')
  const [shelbyBalance, setShelbyBalance] = useState('0.00')
  
  // UI Controls (Modals)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isUploadDetailModalOpen, setIsUploadDetailModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false)
  const [returnToUpload, setReturnToUpload] = useState(false)
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  
  // Data State
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null)
  const [editingPermIndex, setEditingPermIndex] = useState<number | null>(null)
  const [editingFileId, setEditingFileId] = useState<number | null>(null)
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('')
  const [accessDeniedAction, setAccessDeniedAction] = useState<{ label: string, fn: () => void } | null>(null)
  const [rpcStatus, setRpcStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);

  const [uploadLogs, setUploadLogs] = useState<{tag: string, msg: string}[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const addLog = useCallback((tag: string, msg: string) => {
    setUploadLogs(prev => [...prev, { tag, msg }]);
  }, []);
  
  const [defaultPerm, setDefaultPerm] = useState<PermissionConfig>({
    type: 'public',
    allowlist: [],
    timelock: '',
    price: '',
  })
  
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)
  const [statusLine, setStatusLine] = useState('')
  
  const [toast, setToast] = useState({ message: '', type: 'info' as ToastType, isVisible: false })

  const ACTIVE_NET = NETWORKS[activeNetKey] || NETWORKS.testnet;

  // Aptos SDK client
  const aptos = useMemo(() => {
    try {
      const config = new AptosConfig({
        network: ACTIVE_NET.network,
        fullnode: ACTIVE_NET.aptosRpc,
      });
      return new Aptos(config);
    } catch (err) {
      debugError("Aptos SDK Initialization Error:", err);
      return new Aptos(new AptosConfig({ network: Network.TESTNET }));
    }
  }, [ACTIVE_NET]);

  // SDK Hooks
  const uploadBlobsMutation = useUploadBlobs({
    onSuccess: () => {
      addLog('DONE', 'Upload batch completed and confirmed on-chain!');
      showToast('Files uploaded successfully ✓', 'success');
      setIsUploading(false);
      setUploadQueue([]);
      setOverallProgress(100);
      setStatusLine('✓ Upload complete');
      setTimeout(() => {
        setIsUploadDetailModalOpen(false);
        setStatusLine('');
        fetchVaultHistory();
      }, 2000);
    },
    onError: (err: any) => {
      const msg = err.message || 'Upload failed';
      if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')) {
        debugLog('Upload cancelled by user');
      } else {
        debugError('Upload Error:', err);
        addLog('ERR ', msg);
        showToast(msg, 'error');
      }
      setIsUploading(false);
      setStatusLine('⚠ Upload failed');
    }
  });


  // Helper: Fetch vault history from Aptos REST API (no auth needed, pagination supported)
  const fetchVaultHistory = useCallback(async () => {
    if (!walletConnected || !walletAddress) return;
    
    setIsHistoryLoading(true);
    setHistoryError(null);
    debugLog("activeNetKey:", activeNetKey);

    try {
      const indexerUrl = ACTIVE_NET.shelbyIndexer;
      const apiKey = activeNetKey === 'testnet' ? import.meta.env.VITE_SHELBY_API_KEY_TESTNET : import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
      
      if (!indexerUrl || !apiKey) return;

      const data = await fetchBlobsFromGraphQL(indexerUrl, apiKey, walletAddress);
      debugLog("GRAPHQL BLOBS DEBUG:", JSON.stringify(data, null, 2));
      
      const blobs = data?.data?.blobs || [];
      if (blobs) {
        const mappedFiles: StoredFile[] = blobs.map((item: any, idx: number) => {
          // Parse blob_name to get clean filename (handle potential path prefixes)
          const rawName = item.blob_name || "";
          const cleanName = rawName.split("/").pop() || `Blob ${idx + 1}`;
          
          const dotIndex = cleanName.lastIndexOf('.');
          const ext = dotIndex !== -1 ? cleanName.slice(dotIndex + 1).toUpperCase() : "TXT";
          
          return {
            id: idx + 1, // Use loop index for UI consistency as "id" is not in schema
            name: cleanName,
            ext: ext,
            size: item.size || 0,
            date: item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown',
            status: 'stored',
            vis: 'public',
            uploader: item.owner || 'anonymous',
            blobId: rawName // Use raw blob_name as the internal identifier
          };
        });
        setFiles(mappedFiles);
      }
    } catch (err: any) {
      debugError("[Vault] History fetch error:", err);
      setHistoryError(err.message || "Failed to load history");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [walletConnected, walletAddress, activeNetKey, ACTIVE_NET.shelbyIndexer]);

  const fetchActivities = useCallback(async () => {
    if (!walletConnected || !walletAddress) return;
    debugLog("activeNetKey:", activeNetKey);

    try {
      const indexerUrl = ACTIVE_NET.shelbyIndexer;
      const apiKey = activeNetKey === 'testnet' ? import.meta.env.VITE_SHELBY_API_KEY_TESTNET : import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
      
      if (!indexerUrl || !apiKey) return;

      const data = await fetchRecentActivitiesFromGraphQL(indexerUrl, apiKey, 5);
      debugLog("GRAPHQL ACTIVITIES DEBUG:", JSON.stringify(data, null, 2));
      
      const blobs = data?.data?.blobs;
      if (blobs) {
        blobs.forEach((item: any, idx: number) => {
          const date = item.created_at ? new Date(item.created_at).toLocaleTimeString() : 'Unknown';
          const name = item.blob_name || `BLOB_${idx}`;
          addLog('EVNT', `${date} | STORED: ${name.slice(0, 16)}...`);
        });
      }
    } catch (err: any) {
      debugWarn("[Vault] Activities indexer error:", err.message);
    }
  }, [walletConnected, walletAddress, activeNetKey, ACTIVE_NET.shelbyIndexer]);

  useEffect(() => {
    if (walletConnected) {
      fetchVaultHistory();
      fetchActivities();
    }
  }, [walletConnected, fetchVaultHistory, fetchActivities]);

  useEffect(() => {
    if (!walletConnected || !walletAddress) return;
    const pollInterval = setInterval(() => {
      fetchVaultHistory();
    }, 60_000);
    return () => clearInterval(pollInterval);
  }, [walletConnected, walletAddress, fetchVaultHistory]);

  // Handlers
  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true })
  }

  // Helper for authenticated RPC calls
  const rpcFetch = useCallback(async (url: string) => {
    // Detect Shelby RPC requests
    if (url.includes("shelby.xyz")) {
      // Authentication removed project-wide for public access

      return fetch(url, {
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Normal fetch for Aptos RPC or other endpoints
    return fetch(url);
  }, [activeNetKey]);

  const checkRpcHealth = useCallback(async () => {
    const rpc = ACTIVE_NET?.aptosRpc;
    if (!rpc) return;

    try {
      // Step 2: Fix RPC Health Check by pinging standard Aptos health point without Auth headers
      const res = await fetch(`${rpc}/-/healthy`).catch(() => null);
      setRpcStatus(res && res.ok ? "ok" : "error");
    } catch {
      setRpcStatus("error");
    }
  }, [ACTIVE_NET?.aptosRpc]);

  const fetchBalances = useCallback(async () => {
    if (!walletConnected || !walletAddress || !ACTIVE_NET) return;

    try {
      // Use rpcFetch so Authorization header is injected for ShelbyNet automatically
      const url = `${ACTIVE_NET.aptosRpc}/accounts/${walletAddress}/resources`;
      const res = await rpcFetch(url).catch(() => null);

      if (!res || !res.ok) {
        setAptBalance("0");
        setShelbyBalance("0");
        return;
      }

      const resources: any[] = await res.json();

      // Detect APT balance
      const aptStore = resources.find(
        (r: any) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );
      if (aptStore?.data?.coin?.value) {
        const apt = Number(aptStore.data.coin.value) / 1e8;
        setAptBalance(formatTokenBalance(apt));
      } else {
        setAptBalance("0");
      }

      // Detect ShelbyUSD balance — searches for any CoinStore with "shelby" in the type
      const shelbyStore = resources.find(
        (r: any) =>
          r.type.includes("CoinStore") &&
          r.type.toLowerCase().includes("shelby")
      );
      if (shelbyStore?.data?.coin?.value) {
        const susd = Number(shelbyStore.data.coin.value) / 1e6;
        setShelbyBalance(formatTokenBalance(susd, 2));
      } else {
        setShelbyBalance("0");
      }

    } catch (error: any) {
      debugWarn("Balance fetch error:", error?.message || error);
      // Fallback cleanly — no blank screens
      setAptBalance("0");
      setShelbyBalance("0");
    }
  }, [walletConnected, walletAddress, ACTIVE_NET, rpcFetch]);

  // Side Effects
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Auto-connect Martian on page load
  useEffect(() => {
    let attempts = 0;
    let interval: ReturnType<typeof setInterval>;

    const autoConnectMartian = async () => {
      if (localStorage.getItem('shelbyos_martian_connected') === 'true') {
        if ((window as any).martian) {
          clearInterval(interval);
          try {
            const response = await (window as any).martian.connect();
            if (response?.address || response?.account?.address) {
              setManualWalletId('Martian');
            }
          } catch (err) {
            localStorage.removeItem('shelbyos_martian_connected');
          }
        } else {
          attempts++;
          if (attempts > 10) clearInterval(interval); // give up after 5 seconds
        }
      } else {
         clearInterval(interval);
      }
    };
    
    interval = setInterval(autoConnectMartian, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchBalances();
    }
  }, [walletAddress, activeNetKey]);

  useEffect(() => {
    checkRpcHealth();
  }, [activeNetKey, walletConnected, checkRpcHealth]);

  const handleWalletSelect = async (walletName: string) => {
    // Prevent double-click
    if (isConnecting) return;
    setIsConnecting(true);
    setIsWalletModalOpen(false);

    try {
      showToast(`Connecting to ${walletName}…`, 'info');

      if (walletName === 'Martian') {
        if (!(window as any).martian) {
          window.open('https://martianwallet.xyz', '_blank');
          showToast('Martian not detected. Opening install page…', 'error');
          return;
        }
        const response = await (window as any).martian.connect();
        if (response?.address || response?.account?.address) {
          setManualWalletId('Martian');
          localStorage.setItem('shelbyos_martian_connected', 'true');
          showToast('Martian connected ✓', 'success');
        } else {
          showToast('Martian: no address returned', 'error');
        }
      } else {
        // Petra, Google (Keyless), etc. — standard adapter
        setManualWalletId(null);
        try {
          await connect(walletName as any);
          showToast(`${walletName} connected ✓`, 'success');
        } catch (connErr: any) {
          const msg: string = connErr?.message || String(connErr);
          // COOP / cross-origin popup errors are non-fatal for Google Keyless
          const isCoop = msg.includes('Cross-Origin') || msg.includes('window.closed') || msg.includes('COOP');
          if (isCoop) {
            // Popup may still succeed asynchronously — just warn, don't crash
            debugWarn('COOP warning (non-fatal):', msg);
            showToast('Waiting for Google sign-in… (popup may be blocked)', 'info');
          } else if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')) {
            showToast('Connection cancelled', 'info');
          } else {
            showToast(`Connection failed: ${msg.slice(0, 60)}`, 'error');
          }
        }
      }
    } catch (err: any) {
      // Top-level safety net — prevent any blank screen
      debugError('handleWalletSelect unexpected error:', err);
      showToast('Wallet connection error. Please try again.', 'error');
    } finally {
      setIsConnecting(false);
    }
  }

  const handleWalletDisconnect = async () => {
    try {
      if (manualWalletId === 'Martian') {
        await (window as any).martian?.disconnect();
        setManualWalletId(null);
        localStorage.removeItem('shelbyos_martian_connected');
      } else {
        await disconnect();
      }
      setFiles([]);
      showToast('Wallet disconnected', 'info');
    } catch (err: any) {
      showToast(`Failed to disconnect: ${err.message}`, 'error');
    }
  }

  const handleApplyPermissions = (config: PermissionConfig) => {
    if (editingFileId !== null) {
      // Modifying an existing file in the vault — persist to localStorage
      setFiles(prev => prev.map(f => {
        if (f.id === editingFileId) {
          // Persist permission label under {walletAddress}/{blobName}
          if (walletAddress && f.name) {
            const storageKey = `shelbyos_perm_${walletAddress}/${f.name}`;
            localStorage.setItem(storageKey, JSON.stringify(config));
          }
          return {
            ...f,
            permConfig: config,
            vis: config.type === 'public' ? 'public' : config.type === 'allowlist' ? 'private' : 'encrypted'
          };
        }
        return f;
      }));
      showToast('Permissions updated ✓ (saved locally)', 'success');
      setEditingFileId(null);
    } else if (editingPermIndex !== null && uploadQueue[editingPermIndex]) {
      const newQueue = [...uploadQueue];
      newQueue[editingPermIndex] = {
        ...newQueue[editingPermIndex],
        permConfig: config,
        permission: config.type,
        permOverridden: true
      };
      setUploadQueue(newQueue);
      showToast('Permissions applied to file ✓', 'success');
    } else {
      setDefaultPerm(config);
      const newQueue = uploadQueue.map(item => {
        if (!item.permOverridden) {
          return { ...item, permission: config.type, permConfig: config };
        }
        return item;
      });
      setUploadQueue(newQueue);
      showToast('Default permissions updated ✓', 'success');
    }
    setIsPermModalOpen(false);
    setEditingPermIndex(null);
    setEditingFileId(null);
    if (returnToUpload) {
      setIsUploadDetailModalOpen(true);
      setReturnToUpload(false);
    }
  }

  const handleFilesSelected = (newFiles: FileList) => {
    const items: UploadQueueItem[] = Array.from(newFiles).map(file => ({
      file,
      permission: defaultPerm.type,
      permConfig: defaultPerm,
      permOverridden: false,
      status: 'ready'
    }));
    setUploadQueue(prev => [...prev, ...items]);
    if (!isUploadDetailModalOpen) {
      setIsUploadDetailModalOpen(true);
    }
  }

  const handleUploadAll = useCallback(async () => {
    if (isUploading || !uploadQueue.length) return;
    if (!walletConnected || !walletAddress) {
      showToast('Connect wallet to continue', 'error');
      return;
    }
    
    setIsUploadDetailModalOpen(true);
    setIsUploading(true);
    setOverallProgress(10);
    setStatusLine('Preparing files...');
    setUploadLogs([]);
    addLog('INIT', 'Starting batch upload...');

    try {
      addLog('PROC', 'Preparing batch data and encoding...');
      const blobDatas = await Promise.all(uploadQueue.map(async item => ({
          blobName: item.file.name,
          blobData: new Uint8Array(await item.file.arrayBuffer())
      })));

      setStatusLine('Waiting for wallet approval...');
      
      const signer = (window as any).martian?.selectedAccount ? {
        account: { address: (window as any).martian.selectedAccount.address },
        signAndSubmitTransaction: (window as any).martian.signAndSubmitTransaction
      } : {
        account: account,
        signAndSubmitTransaction: signAndSubmitTransaction
      };

      uploadBlobsMutation.mutate({
        signer: signer as any,
        blobs: blobDatas,
        expirationMicros: (Date.now() + 86400000 * 30) * 1000 // 30 days
      });

    } catch (err: any) {
      debugError("Batch upload sequence failed:", err);
      const msg = err.message || "Sequence failed";
      showToast(msg, 'error');
      addLog('ERR ', msg);
      setIsUploading(false);
      setStatusLine('⚠ Failed');
    }
  }, [walletConnected, walletAddress, uploadQueue, account, signAndSubmitTransaction, uploadBlobsMutation, addLog]);

  const handleClearVault = () => {
    setFiles([])
    showToast('Vault history cleared', 'info')
  }



  // ── Download file from Shelby network ─────────────────────────────────────
  const handleDownloadFile = async (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f || !walletAddress) { showToast('Cannot download: wallet not connected', 'error'); return; }

    showToast(`⬇ Downloading ${f.name}…`, 'info');
    try {
      const shelbyRpc = ACTIVE_NET.shelbyRpc;
      if (!shelbyRpc) throw new Error("Shelby RPC URL not configured.");

      // Strip redundant owner address prefix if present in blob name
      let cleanName = f.name;
      const ownerPrefix = `@${walletAddress}/`;
      const ownerPrefixLower = `@${walletAddress.toLowerCase()}/`;
      if (cleanName.startsWith(ownerPrefix)) cleanName = cleanName.slice(ownerPrefix.length);
      else if (cleanName.startsWith(ownerPrefixLower)) cleanName = cleanName.slice(ownerPrefixLower.length);

      const encodedName = encodeURIComponent(cleanName).replace(/%2F/g, '/');
      const blobUrl = `${shelbyRpc}/v1/blobs/${walletAddress}/${encodedName}`;
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      const res = await fetch(blobUrl, { headers });
      if (!res.ok) {
        throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast(`✓ ${f.name} downloaded`, 'success');
    } catch (err: any) {
      debugError('[Vault] Download failed:', err);
      showToast(`Download failed: ${err?.message?.slice(0, 80) || 'unknown error'}`, 'error');
    }
  };

  // ── Preview file from Shelby network or cached ObjectURL ──────────────────
  const handlePreviewFromNetwork = async (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f) return;

    // Permission gate
    const perm = (f.permConfig && f.permConfig.type) || f.vis || 'public';
    if (perm === 'allowlist') {
      const list = (f.permConfig as any)?.allowlist || [];
      if (list.length > 0 && !list.includes(walletAddress)) {
        setAccessDeniedMsg(`Access restricted. Your wallet is not on the allowlist.`);
        setAccessDeniedAction(null); setIsAccessDeniedOpen(true); return;
      }
    }
    if (perm === 'timelock') {
      const unlock = new Date((f.permConfig as any)?.timelock || 0);
      if (Date.now() < unlock.getTime()) {
        setAccessDeniedMsg(`File unlocks on ${unlock.toLocaleDateString()}.`);
        setAccessDeniedAction(null); setIsAccessDeniedOpen(true); return;
      }
    }
    if (perm === 'purchasable') {
      const price = (f.permConfig as any)?.price || '?';
      setAccessDeniedMsg(`This file requires payment: ${price} sUSD`);
      setAccessDeniedAction({ label: 'Simulate Pay & Preview', fn: () => { setIsAccessDeniedOpen(false); _openPreviewModal(f); } });
      setIsAccessDeniedOpen(true); return;
    }

    // Already have a cached ObjectURL from this session → open immediately
    if (f.previewUrl) { _openPreviewModal(f); return; }

    // Determine the correct image/video type first — only fetch for visual types
    const IMAGE_EXTS = ['PNG','JPG','JPEG','GIF','SVG','WEBP','BMP','ICO'];
    const VIDEO_EXTS = ['MP4','WEBM','OGG','MOV'];
    const extUp = f.ext.toUpperCase();
    const isVisual = IMAGE_EXTS.includes(extUp) || VIDEO_EXTS.includes(extUp);

    // Open modal immediately; show loading state while we fetch
    _openPreviewModal(f);

    if (!isVisual) return; // For non-visual files just show metadata

    // Fetch the blob directly from the Shelby RPC REST API
    // URL format (from SDK source): {baseUrl}/v1/blobs/{account}/{blobName}
    const shelbyRpc = ACTIVE_NET.shelbyRpc;
    const addr = walletAddress;
    if (!shelbyRpc || !addr) return;

    // Strip redundant owner address prefix if present in blob name
    let cleanName = f.name;
    const ownerPrefix = `@${addr}/`;
    const ownerPrefixLower = `@${addr.toLowerCase()}/`;
    if (cleanName.startsWith(ownerPrefix)) cleanName = cleanName.slice(ownerPrefix.length);
    else if (cleanName.startsWith(ownerPrefixLower)) cleanName = cleanName.slice(ownerPrefixLower.length);

    const encodedName = encodeURIComponent(cleanName).replace(/%2F/g, '/');
    const blobUrl = `${shelbyRpc}/v1/blobs/${addr}/${encodedName}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    try {
      const res = await fetch(blobUrl, { headers });
      if (!res.ok) {
        debugWarn(`[Vault] Preview fetch ${res.status} for ${f.name}`);
        return; // Modal already open, will just show "no preview" fallback
      }
      const arrayBuf = await res.arrayBuffer();
      const mimeType = res.headers.get('content-type') || `image/${extUp.toLowerCase()}`;
      const objectUrl = URL.createObjectURL(new Blob([arrayBuf], { type: mimeType }));

      // Cache and update the already-open modal by updating previewUrl on the file
      setFiles(prev => prev.map(fi => fi.id === id ? { ...fi, previewUrl: objectUrl } : fi));
      // Re-open to pass the new previewUrl
      _openPreviewModal({ ...f, previewUrl: objectUrl });
    } catch (err: any) {
      debugWarn('[Vault] Preview fetch error:', err?.message);
      // Modal already open without previewUrl — graceful fallback already handled
    }
  };


  const _openPreviewModal = (f: StoredFile) => {
    setSelectedFile(f);
    setIsPreviewModalOpen(true);
  };

  // ── Delete blob on-chain ───────────────────────────────────────────────────
  const handleDeleteFile = async (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f || !walletAddress || !signAndSubmitTransaction) {
      showToast('Cannot delete: wallet not connected', 'error');
      return;
    }

    if (!window.confirm(`Delete "${f.name}" from the Shelby blockchain?\n\nThis will submit an on-chain transaction and cannot be undone.`)) return;

    showToast(`Waiting for wallet signature to delete "${f.name}"…`, 'info');
    try {
      // Strip redundant owner address prefix if present in blob name (required for SDK delete)
      let cleanName = f.name;
      const ownerPrefix = `@${walletAddress}/`;
      const ownerPrefixLower = `@${walletAddress.toLowerCase()}/`;
      if (cleanName.startsWith(ownerPrefix)) cleanName = cleanName.slice(ownerPrefix.length);
      else if (cleanName.startsWith(ownerPrefixLower)) cleanName = cleanName.slice(ownerPrefixLower.length);

      const { ShelbyBlobClient } = await import('@shelby-protocol/sdk/browser') as any;
      const payload = ShelbyBlobClient.createDeleteBlobPayload({ 
        deployer: ACTIVE_NET.contract as any,
        blobName: cleanName 
      });
      const txResult = await signAndSubmitTransaction({ data: payload });
      const txHash = (txResult as any)?.hash || (txResult as any)?.result?.hash;
      if (!txHash) throw new Error('No tx hash returned after delete');

      showToast(`Confirming deletion on-chain…`, 'info');
      await aptos.waitForTransaction({ transactionHash: txHash });

      // Re-fetch everything to ensure synced state
      await fetchVaultHistory();
      await fetchActivities();
      showToast(`✓ "${f.name}" deleted from blockchain`, 'success');
    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')) {
        showToast('Delete cancelled', 'info');
      } else {
        showToast(`Delete failed: ${msg.slice(0, 80)}`, 'error');
      }
    }
  };

  // ── Open in Explorer ───────────────────────────────────────────────────────
  const handleOpenExplorer = (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f || !walletAddress) return;
    const isShelbyNet = activeNetKey === "shelbynet";
    const explorerBase = isShelbyNet 
      ? 'https://explorer.shelby.xyz/shelbynet/account' 
      : 'https://explorer.shelby.xyz/testnet/account';
    const url = `${explorerBase}/${walletAddress}/blobs?name=${encodeURIComponent(f.name)}`;
    window.open(url, '_blank', 'noopener');
  };

  // ── Copy explorer link ─────────────────────────────────────────────────────
  const handleCopyLink = (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f || !walletAddress) return;
    const isShelbyNet = activeNetKey === "shelbynet";
    const explorerBase = isShelbyNet 
      ? 'https://explorer.shelby.xyz/shelbynet/account' 
      : 'https://explorer.shelby.xyz/testnet/account';
    const url = `${explorerBase}/${walletAddress}/blobs?name=${encodeURIComponent(f.name)}`;
    navigator.clipboard.writeText(url).then(() => showToast('Explorer link copied ✓', 'success'));
  };

  const handleRefreshBalances = async () => {
    if (!ACTIVE_NET?.aptosRpc) return;
    await fetchBalances();
    showToast("Balances refreshed ✓", "success");
  }

  // 🛡️ Global UI Safety Guards
  if (showIntro) {
    return <Intro onComplete={() => setShowIntro(false)} />;
  }

  if (!ACTIVE_NET) {
    return (
      <div style={{ padding: 20, fontFamily: 'Tahoma', background: '#ece9d8', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="window" style={{ width: 'min(300px, 90vw)' }}>
          <div className="titlebar"><span>System Message</span></div>
          <div className="window-body">
            <p>Network initialization error. Please check your configuration.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!Array.isArray(files)) {
    return (
      <div style={{ padding: 20, fontFamily: 'Tahoma', background: '#ece9d8', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="window" style={{ width: 'min(300px, 90vw)' }}>
          <div className="titlebar"><span>System Message</span></div>
          <div className="window-body">
            <p>Initializing ShelbyOS...</p>
          </div>
        </div>
      </div>
    );
  }

  // Defensive render guard
  return (
      <div className="app-container">
        <Navbar 
          activeNetwork={activeNetKey}
          onNetworkChange={(net) => {
            setActiveNetKey(net as any);
            showToast(`Switched to ${NETWORKS[net as keyof typeof NETWORKS]?.label || net}`);
          }}
          onThemeChange={(newTheme) => {
            setTheme(newTheme);
            showToast(`Theme switched to ${newTheme.replace('theme-', '').toUpperCase()}`);
          }}
          walletConnected={walletConnected}
          address={walletAddress}
          aptBalance={aptBalance}
          shelbyBalance={shelbyBalance}
          onRefresh={handleRefreshBalances}
          onConnectWallet={() => {
            if (walletConnected) {
              handleWalletDisconnect();
            } else {
              setIsWalletModalOpen(true);
            }
          }}
        />
        <main className="layout-wrapper">
          <div className="layout">
          <VaultTable
            files={files}
            checkedIds={checkedIds}
            onCheckedIdsChange={setCheckedIds}
            isLoading={isHistoryLoading}
            error={historyError}
            walletConnected={walletConnected}
            onConnectWallet={() => setIsWalletModalOpen(true)}
            onPreview={handlePreviewFromNetwork}
            onDownload={handleDownloadFile}
            onOpenExplorer={handleOpenExplorer}
            onCopyLink={handleCopyLink}
            onDelete={handleDeleteFile}
            onManagePermission={(id) => {
              const file = files.find(f => f.id === id);
              if (file) {
                setSelectedFile(file);
                setIsPermModalOpen(true);
              }
            }}
            onPermissionChange={(id, newConfig) => {
              // Update local state so UI reflects change immediately
              setFiles(prev => prev.map(f => f.id === id ? { ...f, permConfig: newConfig, vis: newConfig.type } : f));
              
              // Persist to localStorage
              const file = files.find(f => f.id === id);
              if (file && walletAddress) {
                const storageKey = `shelby_perm_${walletAddress}_${file.name}`;
                localStorage.setItem(storageKey, JSON.stringify(newConfig));
              }
            }}
          />
          <div className="right-col">
            <UploadPanel 
              walletConnected={walletConnected}
              queuedFiles={uploadQueue.map(i => i.file)}
              isUploading={isUploading}
              uploadProgress={overallProgress}
              onFilesSelected={handleFilesSelected}
              onUpload={() => setIsUploadDetailModalOpen(true)}
            />
            
            <div className="window animate-entry delay-3 action-panel-mobile" style={{ marginTop: '10px' }}>
              <div className="titlebar">
                <span>🛠️ Actions</span>
              </div>
              <div className="window-body" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button 
                  className="btn95 action-mobile-btn" 
                  style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                  onClick={() => {
                    setEditingPermIndex(null);
                    setIsPermModalOpen(true);
                  }}
                >
                  ⚙️ Permission Defaults
                </button>
                <button 
                  className="btn95 action-mobile-btn" 
                  style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                  onClick={() => setIsConfirmClearOpen(true)}
                  disabled={(files?.length || 0) === 0}
                >
                  🗑️ Clear History
                </button>
                <button 
                  className="btn95 action-mobile-btn" 
                  style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                  onClick={async () => {
                    await fetchVaultHistory();
                    showToast('Vault history refreshed ✓', 'success');
                  }}
                >
                  🔄 Refresh Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <StatusBar 
        fileCount={files?.length || 0}
        totalSize={formatFileSize((files ?? []).reduce((a, b) => a + Number(b.size || 0), 0))}
        walletStatus={walletConnected ? (String(walletAddress).slice(0, 6) + '...' + String(walletAddress).slice(-4)) : 'Not Connected'}
        networkStatus={ACTIVE_NET?.label || 'Unknown'}
        rpcStatus={rpcStatus}
      />

        <WalletModal 
          isOpen={isWalletModalOpen}
          onClose={() => !isConnecting && setIsWalletModalOpen(false)}
          onSelectWallet={handleWalletSelect}
          isConnecting={isConnecting}
        />

        <PermissionModal 
          isOpen={isPermModalOpen}
          onClose={() => {
            setIsPermModalOpen(false);
            setEditingPermIndex(null);
            setEditingFileId(null);
            if (returnToUpload) {
              setIsUploadDetailModalOpen(true);
              setReturnToUpload(false);
            }
          }}
          onApply={handleApplyPermissions}
          initialConfig={
            (editingFileId !== null) 
              ? files.find(f => f.id === editingFileId)?.permConfig 
              : (editingPermIndex !== null && uploadQueue[editingPermIndex]) 
                ? uploadQueue[editingPermIndex].permConfig 
                : defaultPerm
          }
        />

        <UploadDetailModal 
          isOpen={isUploadDetailModalOpen}
          onClose={() => setIsUploadDetailModalOpen(false)}
          queue={uploadQueue}
          defaultPerm={defaultPerm.type}
          onManageDefaultPerm={() => {
            setEditingPermIndex(null);
            setIsUploadDetailModalOpen(false);
            setReturnToUpload(true);
            setIsPermModalOpen(true);
          }}
          onManageFilePerm={(index) => {
            setEditingPermIndex(index);
            setIsUploadDetailModalOpen(false);
            setReturnToUpload(true);
            setIsPermModalOpen(true);
          }}
          onRemoveItem={(index) => setUploadQueue(prev => prev.filter((_, i) => i !== index))}
          onClearAll={() => setUploadQueue([])}
          onAddFiles={handleFilesSelected}
          onUploadAll={handleUploadAll}
          isUploading={isUploading}
          overallProgress={overallProgress}
          statusLine={statusLine}
        />

        <ConfirmModal 
          isOpen={isConfirmClearOpen}
          onClose={() => setIsConfirmClearOpen(false)}
          onConfirm={handleClearVault}
          message="Clear all upload history from ShelbyVault?"
          subMessage="This cannot be undone."
          confirmText="Clear All"
        />

        <FileDetailModal 
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="File Details"
          cid={selectedFile?.cid || ''}
          link={selectedFile?.cid ? `https://explorer.shelby.xyz/blob/${selectedFile.cid}` : ''}
          dateLabel={selectedFile ? `Uploaded on ${selectedFile.date} at ${selectedFile.time}` : ''}
          onCopyCid={() => showToast('CID copied', 'success')}
          onCopyLink={() => showToast('Link copied', 'success')}
        />

        <FilePreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          file={selectedFile}
          shelbyRpcUrl={ACTIVE_NET.shelbyRpc}
          ownerAddress={walletAddress}
          onDownload={() => selectedFile && handleDownloadFile(selectedFile.id)}
        />

        <AccessDeniedModal 
          isOpen={isAccessDeniedOpen}
          onClose={() => setIsAccessDeniedOpen(false)}
          message={accessDeniedMsg}
          confirmText={accessDeniedAction?.label}
          onConfirm={accessDeniedAction?.fn}
        />

        <UploadTerminal 
          isVisible={showTerminal} 
          logs={uploadLogs} 
          onClose={() => setShowTerminal(false)} 
        />

        <Toast 
          message={toast.message} 
          type={toast.type} 
          isVisible={toast.isVisible} 
          onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
        />
      </div>
    );
}

// Provider Wrapper
export default function App() {
  const [activeNetKey, setActiveNetKey] = useState<keyof typeof NETWORKS>('testnet')
  const [theme, setTheme] = useState('theme-xp')
  const ACTIVE_NET = NETWORKS[activeNetKey] || NETWORKS.testnet;

  const shelbyClient = useMemo(() => {
    const apiKey = activeNetKey === 'testnet' 
      ? import.meta.env.VITE_SHELBY_API_KEY_TESTNET 
      : import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;

    const settings: AptosSettings = { 
      network: ACTIVE_NET.network, 
      fullnode: ACTIVE_NET.aptosRpc 
    };

    return new ShelbyClient({ 
      network: ACTIVE_NET.network as any, 
      aptos: settings,
      indexer: { 
        baseUrl: ACTIVE_NET.shelbyIndexer,
        apiKey
      },
      rpc: { apiKey }
    });
  }, [ACTIVE_NET, activeNetKey]);

  return (
    <QueryClientProvider client={queryClient}>
      <ShelbyClientProvider client={shelbyClient}>
        <ShelbyOS 
          activeNetKey={activeNetKey} 
          setActiveNetKey={setActiveNetKey}
          theme={theme}
          setTheme={setTheme}
        />
      </ShelbyClientProvider>
    </QueryClientProvider>
  )
}

