import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { type AptosSettings } from "@aptos-labs/ts-sdk"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ShelbyClientProvider, useUploadBlobs, useDeleteBlobs } from "@shelby-protocol/react"
import { ShelbyClient } from "@shelby-protocol/sdk/browser"

import { formatTokenBalance, formatFileSize } from './utils/file'
import { encryptFileWithSignature } from './utils/crypto'
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

import FileDetailModal from './components/FileDetailModal'
import FilePreviewModal from './components/FilePreviewModal'
import AccessDeniedModal from './components/AccessDeniedModal'
import { NETWORKS } from './config/networks'
import './themes.css'
import Intro from './components/Intro'
import UploadTerminal from './components/UploadTerminal'
import { fetchBlobsFromGraphQL, fetchRecentActivitiesFromGraphQL } from './services/shelbyService'

export interface UploadQueueItem {
  file: File;
  blobData?: Uint8Array;
  permission: string;
  permConfig: any;
  permOverridden: boolean;
  status: 'ready' | 'preparing' | 'uploading' | 'stored' | 'error';
}

const queryClient = new QueryClient();

function ShelbyOS({ activeNetKey, setActiveNetKey, theme, setTheme }: {
  activeNetKey: keyof typeof NETWORKS,
  setActiveNetKey: (key: keyof typeof NETWORKS) => void,
  theme: string,
  setTheme: (t: string) => void
}) {
  const { connect, disconnect, account, connected, signAndSubmitTransaction, signMessage } = useWallet()
  
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

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false)
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
  const [encryptEnabled, setEncryptEnabled] = useState(false)
  const [encryptionSignature, setEncryptionSignature] = useState<any>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  
  const [toast, setToast] = useState({ message: '', type: 'info' as ToastType, isVisible: false })

  const ACTIVE_NET = NETWORKS[activeNetKey] || NETWORKS.testnet;



  // Aptos SDK client (removed from state if unused, or kept for health checks)
  // ...


  // SDK Hooks
  const uploadBlobsMutation = useUploadBlobs({
    onSuccess: (result: any) => {
      // Capture and store blob_ids locally per file so delete works without indexer delay
      if (Array.isArray(result) && walletAddress) {
        result.forEach((item: any) => {
          if (item.blobId && item.blobName) {
            const storageKey = `shelby_id_${walletAddress}_${item.blobName}`;
            localStorage.setItem(storageKey, item.blobId);
            debugLog(`[Vault] Stored local ID for ${item.blobName}: ${item.blobId}`);
          }
        });
      }

      addLog('DONE', 'Upload batch completed and confirmed on-chain!');
      showToast('Files uploaded successfully ✓', 'success');
      setIsUploading(false);
      setUploadQueue([]);
      setOverallProgress(100);
      setStatusLine('✓ Upload complete');
      setTimeout(() => {
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

  const deleteBlobsMutation = useDeleteBlobs({
    onSuccess: () => {
      showToast('File deleted successfully ✓', 'success');
      fetchVaultHistory();
      fetchActivities();
    },
    onError: (err: any) => {
      const msg = err.message || 'Delete failed';
      if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')) {
        showToast('Delete cancelled', 'info');
      } else {
        debugError('Delete Error:', err);
        showToast(msg, 'error');
      }
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
            uploadedAt: item.created_at,
            status: 'stored',
            vis: 'public',
            uploader: item.owner || 'anonymous',
            // Strip @owner/ prefix for SDK deletion operations (required for exact match)
            blobNameSuffix: (item.blob_name || "").replace(/^@[^/]+\//, ""),
            // Try to retrieve blobId from local storage (uploaded via this browser)
            blobId: localStorage.getItem(`shelby_id_${walletAddress}_${item.blob_name}`) || undefined 
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
      } else if (walletName === 'Petra') {
        // Special check for Petra (handling delay on small screens)
        let aptosWindow = (window as any).aptos;
        if (!aptosWindow) {
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 200));
            aptosWindow = (window as any).aptos;
            if (aptosWindow) break;
          }
        }

        if (!aptosWindow) {
          showToast('Petra wallet not detected. Please install or wait.', 'error');
          return;
        }

        setManualWalletId(null);
        try {
          await connect(walletName as any);
          
          // Delay lebih panjang (800ms) untuk memberi waktu Petra memproses popup
          await new Promise(resolve => setTimeout(resolve, 800));

          // Retry mengecek account?.address dari adapter selama ~2.5 detik
          let hasAddress = !!account?.address;
          if (!hasAddress) {
            for (let i = 0; i < 5; i++) {
              await new Promise(resolve => setTimeout(resolve, 500));
              if (account?.address) {
                hasAddress = true;
                break;
              }
            }
          }

          if (!hasAddress) {
            // JANGAN disconnect, JANGAN tampilkan error
            // Asumsikan popup masih terbuka dan menunggu user approve
            showToast('Waiting for Petra wallet confirmation...', 'info');
            return;
          }

          showToast(`${walletName} connected ✓`, 'success');
        } catch (connErr: any) {
          const msg: string = connErr?.message || String(connErr);
          if (msg.includes('rejected') || msg.includes('cancel') || msg.includes('User denied')) {
            showToast('Connection cancelled', 'info');
          } else {
            showToast(`Connection failed: ${msg.slice(0, 60)}`, 'error');
          }
        }
      } else {
        // Google (Keyless), dll — standard adapter
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
  }

  const handleFilesSelected = (newFiles: FileList) => {
    setUploadLogs([]);
    addLog('INIT', `Selected ${newFiles.length} file(s) for upload.`);
    
    const items: UploadQueueItem[] = Array.from(newFiles).map(file => ({
      file,
      permission: defaultPerm.type,
      permConfig: defaultPerm,
      permOverridden: false,
      status: 'ready'
    }));
    setUploadQueue(prev => [...prev, ...items]);
    addLog('DONE', 'Files added to queue.');
  }

  const handleUploadAll = useCallback(async () => {
    if (isUploading || isPreparing || !uploadQueue.length) {
      if (!uploadQueue.length) showToast('No files to upload', 'info');
      return;
    }
    if (!walletConnected || !walletAddress) {
      showToast('Connect wallet to continue', 'error');
      return;
    }

    // STEP 1: If encryption enabled but NO signature yet, just sign and stop
    if (encryptEnabled && !encryptionSignature) {
      setIsPreparing(true);
      setStatusLine('🔒 Authorizing encryption...');
      addLog('AUTH', 'Requesting signature for encryption key...');
      try {
        const message = "Authorize ShelbyOS to encrypt your files. This signature will be used to derive your local encryption key.";
        const nonce = Date.now().toString();
        
        let sig: any = null;
        if (signMessage) {
          const response = await signMessage({ message, nonce });
          if (typeof response === 'object' && response !== null && 'signature' in response) {
            sig = response.signature;
          } else {
            throw new Error("Wallet did not return a valid signature object.");
          }
        } else if ((window as any).martian) {
          const result = await (window as any).martian.signMessage({ message, nonce });
          sig = result.signature || result;
        } else {
          throw new Error("signMessage not supported by this wallet");
        }
        
        if (!sig) throw new Error("Failed to obtain signature.");
        setEncryptionSignature(sig);
        addLog('DONE', 'Signature secured. Click UPLOAD again to proceed.');
        setStatusLine('✓ Encryption authorized. Ready to upload.');
        showToast('Encryption authorized ✓ Click UPLOAD again', 'info');
        return;
      } catch (err: any) {
        debugError("Encryption signature failed:", err);
        showToast(`Encryption signature failed: ${err.message}`, 'error');
        setStatusLine('⚠ Signature failed');
        return;
      } finally {
        setIsPreparing(false);
      }
    }

    // STEP 2: If we have signature or encryption is disabled, proceed with upload
    setIsUploading(true);
    setOverallProgress(15);
    setStatusLine('🔒 Encrypting & Preparing files...');
    setUploadLogs([]);
    addLog('INIT', 'Starting storage upload sequence...');

    try {
      // Perform encryption/buffering for all files in the queue
      const blobDatas = await Promise.all(uploadQueue.map(async (item, idx) => {
        try {
          // Update status to 'preparing' locally in UI
          setUploadQueue(prev => prev.map(qItem => qItem.file === item.file ? { ...qItem, status: 'preparing' } : qItem));
          
          let currentFile = item.file;
          if (encryptEnabled && encryptionSignature) {
            currentFile = await encryptFileWithSignature(currentFile, encryptionSignature);
            addLog('LOCK', `Encrypted: ${item.file.name} -> ${currentFile.name}`);
          }
          
          const buffer = new Uint8Array(await currentFile.arrayBuffer());
          setOverallProgress(20 + Math.floor(((idx + 1) / uploadQueue.length) * 40));
          
          // Mark as ready (internally)
          setUploadQueue(prev => prev.map(qItem => qItem.file === item.file ? { ...qItem, status: 'ready' } : qItem));
          
          return {
            blobName: currentFile.name,
            blobData: buffer
          };
        } catch (err: any) {
          setUploadQueue(prev => prev.map(qItem => qItem.file === item.file ? { ...qItem, status: 'error' } : qItem));
          throw err;
        }
      }));

      setStatusLine('Waiting for wallet approval...');
      setOverallProgress(70);
      
      const signer = (window as any).martian?.selectedAccount ? {
        account: (window as any).martian.selectedAccount,
        signAndSubmitTransaction: (window as any).martian.signAndSubmitTransaction
      } : {
        account: account,
        signAndSubmitTransaction: signAndSubmitTransaction
      };

      addLog('PROC', `Pushing ${blobDatas.length} blobs to Shelby Storage...`);

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
      setStatusLine('⚠ Upload failed');
    }
  }, [isUploading, isPreparing, uploadQueue, walletConnected, walletAddress, encryptEnabled, encryptionSignature, signMessage, account, signAndSubmitTransaction, uploadBlobsMutation, addLog]);





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
      if (!f.blobNameSuffix) {
        showToast('Cannot delete: blob identifier missing', 'error');
        return;
      }

      const signer = (window as any).martian?.selectedAccount ? {
        account: { address: (window as any).martian.selectedAccount.address },
        signAndSubmitTransaction: (window as any).martian.signAndSubmitTransaction
      } : {
        account: account,
        signAndSubmitTransaction: signAndSubmitTransaction
      };

      deleteBlobsMutation.mutate({
        signer: signer as any,
        blobNames: [f.blobNameSuffix] // Pass the exact suffix (without @owner prefix)
      });
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
    return <Intro 
      onComplete={() => setShowIntro(false)} 
      walletConnected={walletConnected}
      activeNetName={ACTIVE_NET.label}
      rpcUrl={ACTIVE_NET.aptosRpc}
      fetchVaultHistory={fetchVaultHistory} 
    />;
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
          <div className="sidebar-col">
            <UploadPanel 
              walletConnected={walletConnected}
              isUploading={isUploading}
              uploadProgress={overallProgress}
              onFilesSelected={handleFilesSelected}
              onUpload={handleUploadAll}
              queue={uploadQueue}
              statusLine={statusLine}
              encryptEnabled={encryptEnabled}
              onEncryptChange={(val) => {
                setEncryptEnabled(val);
                setEncryptionSignature(null); // Reset signature if toggle changes
              }}
              isPreparing={isPreparing}
              hasEncryptionKey={!!encryptionSignature}
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

