import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk"
import { formatTokenBalance } from './utils/file'
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
import FundModal from './components/FundModal'
import FileDetailModal from './components/FileDetailModal'
import UploadDetailModal from './components/UploadDetailModal'
import type { UploadQueueItem } from './components/UploadDetailModal'
import FilePreviewModal from './components/FilePreviewModal'
import AccessDeniedModal from './components/AccessDeniedModal'
import { NETWORKS } from './config/networks'
import './themes.css'
import Intro from './components/Intro'
import UploadTerminal from './components/UploadTerminal'
import DashboardOverview from './components/DashboardOverview'

const API_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
if (!API_KEY) {
  console.error("ShelbyNet API key missing. Check .env configuration.");
}


function App() {
  const { connect, disconnect, account, connected, network, signAndSubmitTransaction } = useWallet()

  // Theme & Network
  const [theme, setTheme] = useState('theme-xp')
  const [activeNetKey, setActiveNetKey] = useState<keyof typeof NETWORKS>('testnet')
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  
  // Wallet State
  const [manualWalletId, setManualWalletId] = useState<string | null>(null);
  const [martianAddress, setMartianAddress] = useState<string>('');
  const walletConnected = connected || manualWalletId !== null;
  const rawAddress = account?.address?.toString()
    || (manualWalletId === 'Martian' ? martianAddress || (window as any).martian?.selectedAccount?.address || '' : '');
  // Pad the address to 64 characters to support Google Keyless accounts without leading zeros
  const walletAddress = rawAddress ? '0x' + (rawAddress.startsWith('0x') ? rawAddress.slice(2) : rawAddress).padStart(64, '0').toLowerCase() : '';
  
  // Mock balances
  const [aptBalance, setAptBalance] = useState('0.00')
  const [shelbyBalance, setShelbyBalance] = useState('0.00')
  
  // UI Controls (Modals)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false)
  const [isFundModalOpen, setIsFundModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isUploadDetailModalOpen, setIsUploadDetailModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [isAccessDeniedOpen, setIsAccessDeniedOpen] = useState(false)
  const [returnToUpload, setReturnToUpload] = useState(false)
  
  // Data State
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null)
  const [editingPermIndex, setEditingPermIndex] = useState<number | null>(null)
  const [editingFileId, setEditingFileId] = useState<number | null>(null)
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('')
  const [accessDeniedAction, setAccessDeniedAction] = useState<{ label: string, fn: () => void } | null>(null)
  const [rpcStatus, setRpcStatus] = useState<'loading' | 'ok' | 'error'>('loading')
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

  console.log("activeNetKey:", activeNetKey);
  const ACTIVE_NET = NETWORKS[activeNetKey] || NETWORKS.testnet;

  // Data State - Fixed: Initialized as empty, removed dummy data
  const [files, setFiles] = useState<StoredFile[]>([])

  // Helper: Fetch true vault history from the blockchain state using Shelby SDK
  const fetchVaultHistory = useCallback(async () => {
    if (!walletAddress || !ACTIVE_NET) {
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const { ShelbyClient } = await import('@shelby-protocol/sdk/browser') as any;
      const { Network } = await import('@aptos-labs/ts-sdk');
      const rawShelbyNetKey = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
      const rawTestnetKey = import.meta.env.VITE_SHELBY_API_KEY_TESTNET;
      
      const getRandomKey = (str?: string) => {
        if (!str) return undefined;
        const keys = str.split(',').map(k => k.trim()).filter(Boolean);
        return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : undefined;
      };

      const SHELBYNET_KEY = getRandomKey(rawShelbyNetKey);
      const TESTNET_KEY   = getRandomKey(rawTestnetKey);
      
      const isOnShelbyNet = activeNetKey === "shelbynet";

      const apiKeyToUse = isOnShelbyNet ? SHELBYNET_KEY : (TESTNET_KEY || SHELBYNET_KEY);
      
      const shelbyClient = new ShelbyClient({
        network: isOnShelbyNet ? Network.SHELBYNET : Network.TESTNET,
        apiKey: apiKeyToUse,
        aptos: { fullnode: ACTIVE_NET.aptosRpc },
        rpc: { baseUrl: ACTIVE_NET.shelbyRpc },
        indexer: { baseUrl: ACTIVE_NET.shelbyIndexer },
      } as any);

      // Fetch the verified on-chain state of blobs for this account
      const accountBlobs = await shelbyClient.coordination.getAccountBlobs({
        account: walletAddress,
      });

      // Filter out deleted blobs just in case the SDK indexer didn't
      const activeBlobs = accountBlobs.filter((b: any) => !b.isDeleted);
      console.log(`[Vault] Shelby SDK retrieved ${activeBlobs.length} true on-chain blobs for ${walletAddress}`);

      const history: StoredFile[] = activeBlobs.map((blob: any) => {
        const d = new Date(blob.creationMicros / 1000);
        const name = blob.blobNameSuffix || 'Vault Asset';
        const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';
        
        return {
          id: blob.creationMicros || Date.now() + Math.random(), // Unique ID
          name,
          ext,
          size: blob.size || 0,
          date: d.toISOString().split('T')[0],
          time: d.toTimeString().slice(0, 5),
          uploader: blob.owner || walletAddress,
          status: 'stored' as const,
          vis: 'public' as any,
          permConfig: { type: 'public' as const, allowlist: [], timelock: '', price: '' },
          network: ACTIVE_NET.label,
          cid: name,
          txHash: '', // SDK doesn't return txHash directly in BlobMetadata
        };
      });

      // Restore saved permission labels from localStorage
      const historyWithPerms = history.map(f => {
        const storageKey = `shelbyos_perm_${walletAddress.toLowerCase()}/${f.name}`;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const savedConfig = JSON.parse(saved);
            return {
              ...f,
              permConfig: savedConfig,
              vis: savedConfig.type === 'public' ? 'public' : savedConfig.type === 'allowlist' ? 'private' : 'encrypted' as any,
            };
          } catch { /* ignore parse errors */ }
        }
        return f;
      });

      setFiles(historyWithPerms);
    } catch (err: any) {
      console.warn('[Vault] Error fetching true vault state:', err?.message);
      setHistoryError(err?.message || 'Failed to sync history from blockchain state');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [walletAddress, ACTIVE_NET, activeNetKey]);

  // Fetch history when wallet connects
  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchVaultHistory();
    }
  }, [walletConnected, walletAddress, fetchVaultHistory]);

  // Real-time polling: re-fetch vault every 60 seconds while wallet is connected
  useEffect(() => {
    if (!walletConnected || !walletAddress) return;
    const pollInterval = setInterval(() => {
      fetchVaultHistory();
    }, 60_000);
    return () => clearInterval(pollInterval);
  }, [walletConnected, walletAddress, fetchVaultHistory]);

  // Initialize Aptos SDK client
  const aptos = useMemo(() => {
    try {
      const config = new AptosConfig({
        network: ACTIVE_NET.network,
        fullnode: ACTIVE_NET.aptosRpc,
      });
      return new Aptos(config);
    } catch (err) {
      console.error("Aptos SDK Initialization Error:", err);
      // Fallback: Default to Testnet to prevent blank screen
      return new Aptos(new AptosConfig({ network: "testnet" as any }));
    }
  }, [ACTIVE_NET]);

  // Defensive Guard: prevent blank screen if network config is missing or wallet not connected
  if (!ACTIVE_NET) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Tahoma', background: '#ece9d8', border: '3px solid #003c74', margin: '50px' }}>
        <h2 style={{ color: '#cc0000' }}>⚠️ Network Configuration Error</h2>
        <p>Could not initialize Shelby network configuration.</p>
        <button className="btn95" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  // Handle case where session is not fully ready
  if (!walletConnected && !isWalletModalOpen && files.length === 0) {
     // Initial state is okay, but if something crashes we want a fallback
  }

  // Handlers
  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true })
  }

  // Helper for authenticated RPC calls
  const rpcFetch = useCallback(async (url: string) => {
    // Detect Shelby RPC requests
    if (url.includes("shelby.xyz")) {
      return fetch(url, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        }
      });
    }
    // Normal fetch for Aptos RPC or other endpoints
    return fetch(url);
  }, []);

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
  }, [ACTIVE_NET?.aptosRpc, rpcFetch, network?.name, activeNetKey, walletConnected]);

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
      console.warn("Balance fetch error:", error?.message || error);
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
          const addr: string = response?.address || response?.account?.address
            || localStorage.getItem('shelbyos_martian_address') || '';
          if (addr) {
            setManualWalletId('Martian');
            setMartianAddress(addr);
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
        const addr: string = response?.address || response?.account?.address || '';
        if (addr) {
          setManualWalletId('Martian');
          setMartianAddress(addr);
          localStorage.setItem('shelbyos_martian_connected', 'true');
          localStorage.setItem('shelbyos_martian_address', addr);
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
            console.warn('COOP warning (non-fatal):', msg);
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
      console.error('handleWalletSelect unexpected error:', err);
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
        setMartianAddress('');
        localStorage.removeItem('shelbyos_martian_connected');
        localStorage.removeItem('shelbyos_martian_address');
      } else {
        await disconnect();
      }
      setFiles([]);
      showToast('Wallet disconnected', 'info');
    } catch (err: any) {
      showToast(`Failed to disconnect: ${err.message}`, 'error');
    }
  }

  // ── Unified signing helper (Petra, Google Keyless, Martian) ────────────────
  // Martian uses its own native API; all other wallets use the adapter's hook.
  const signAndSubmit = async (payload: any): Promise<string> => {
    if (manualWalletId === 'Martian') {
      const martian = (window as any).martian;
      if (!martian) throw new Error('Martian wallet not found');
      const txResult = await martian.generateSignAndSubmitTransaction(walletAddress, payload);
      // Martian returns the hash directly as a string
      const txHash = typeof txResult === 'string' ? txResult : txResult?.hash || txResult?.result?.hash;
      if (!txHash) throw new Error('Martian: transaction hash not returned');
      return txHash;
    } else {
      if (!signAndSubmitTransaction) throw new Error('Wallet adapter not connected');
      const txResult = await signAndSubmitTransaction({ data: payload });
      const txHash = (txResult as any)?.hash || (txResult as any)?.result?.hash;
      if (!txHash) throw new Error('Transaction hash not found');
      return txHash;
    }
  };

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

  const handleUploadAll = async () => {
    // Prevent concurrent calls
    if (isUploading) return;
    if (uploadQueue.length === 0) return;
    
    if (!walletConnected || !walletAddress) {
      showToast('⚠ Connect a wallet first', 'error');
      setIsUploadDetailModalOpen(false);
      setIsWalletModalOpen(true);
      return;
    }

    const readyItems = uploadQueue.filter(q => q.status === 'ready');
    if (!readyItems.length) return;

    setIsUploading(true);
    setOverallProgress(0);
    setShowTerminal(true);
    setUploadLogs([]);
    addLog('INIT', `Initiating batch upload sequence for ${readyItems.length} file(s)...`);
    const total = readyItems.length;

    try {
      const { 
        createDefaultErasureCodingProvider, 
        generateCommitments, 
        ShelbyBlobClient, 
        expectedTotalChunksets,
        ShelbyClient
      } = await import('@shelby-protocol/sdk/browser') as any;
      const { Network } = await import('@aptos-labs/ts-sdk');
      const provider = await createDefaultErasureCodingProvider();

      // Step 1: Generate commitments
      showToast("Generating erasure coding for all files...", "info");
      addLog('PROC', `Generating commitments for ${total} file(s)...`);
      
      const blobsPayloadInfo = [];
      const fileCommitments = []; // To store for RPC
      
      for (const item of readyItems) {
        item.status = 'uploading';
        setStatusLine(`Preparing ${item.file.name}...`);
        setUploadQueue([...uploadQueue]);
        
        const data = new Uint8Array(await item.file.arrayBuffer());
        const commitments = await generateCommitments(provider, data);
        
        blobsPayloadInfo.push({
          blobName: item.file.name,
          blobSize: commitments.raw_data_size,
          blobMerkleRoot: commitments.blob_merkle_root,
          numChunksets: expectedTotalChunksets(commitments.raw_data_size)
        });
        
        fileCommitments.push({ item, data });
      }

      // Step 2: Batch register on-chain
      showToast("Waiting for wallet approval...", "info");
      addLog('AUTH', `Awaiting single wallet signature for ${total} file(s)...`);
      
      const payload = ShelbyBlobClient.createBatchRegisterBlobsPayload({
        account: walletAddress,
        expirationMicros: (Date.now() + 1000 * 60 * 60 * 24 * 30) * 1000,
        blobs: blobsPayloadInfo,
        encoding: 0
      });

      const txHash = await signAndSubmit(payload);

      showToast("Confirming on-chain registration...", "info");
      addLog('TRAN', `TX submitted. Confirming hash: ${txHash.slice(0, 10)}...`);
      await aptos.waitForTransaction({ transactionHash: txHash });
      console.log("Blobs registered on-chain:", txHash);
      
      // Step 3: Stream to RPC sequentially
      const rawShelbyNetKey = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
      const rawTestnetKey = import.meta.env.VITE_SHELBY_API_KEY_TESTNET;
      
      const getRandomKey = (str?: string) => {
        if (!str) return undefined;
        const keys = str.split(',').map(k => k.trim()).filter(Boolean);
        return keys.length > 0 ? keys[Math.floor(Math.random() * keys.length)] : undefined;
      };

      const SHELBYNET_KEY = getRandomKey(rawShelbyNetKey);
      const TESTNET_KEY   = getRandomKey(rawTestnetKey);
      
      const isOnShelbyNet = activeNetKey === "shelbynet";
      
      if (isOnShelbyNet && !SHELBYNET_KEY) throw new Error("Missing ShelbyNet API key");
      
      const apiKeyToUse = isOnShelbyNet ? SHELBYNET_KEY : (TESTNET_KEY || SHELBYNET_KEY);
      
      const shelbyClient = new ShelbyClient({
        network: isOnShelbyNet ? Network.SHELBYNET : Network.TESTNET,
        apiKey: apiKeyToUse,
        aptos: { fullnode: ACTIVE_NET.aptosRpc },
        rpc: { baseUrl: ACTIVE_NET.shelbyRpc },
        indexer: { baseUrl: ACTIVE_NET.shelbyIndexer },
      } as any);

      let done = 0;
      for (const { item, data } of fileCommitments) {
        // Mandatory pause before each file to let RPC breathe
        if (done > 0) await new Promise(r => setTimeout(r, 1000));

        setStatusLine(`Uploading ${done + 1} / ${total}: ${item.file.name}`);
        addLog('SYNC', `Streaming ${item.file.name} to Decentralized Vault Nodes...`);
        
        let success = false;
        let attempts = 0;
        let lastErr: any = null;

        const MAX_ATTEMPTS = 5;
        while (attempts < MAX_ATTEMPTS && !success) {
          try {
            await shelbyClient.rpc.putBlob({
              account: walletAddress,
              blobName: item.file.name,
              blobData: data,
            });
            success = true;
          } catch (rpcErr: any) {
            attempts++;
            lastErr = rpcErr;
            const status = rpcErr?.status || 0;
            const isRateLimit = status === 429;
            
            if (attempts < MAX_ATTEMPTS) {
              const backoff = isRateLimit ? (attempts * 4000) : (attempts * 2000);
              addLog('WARN', `${item.file.name} failed (HTTP ${status}). Retrying in ${backoff/1000}s... (${attempts}/${MAX_ATTEMPTS})`);
              setStatusLine(`Retrying ${item.file.name}...`);
              await new Promise(r => setTimeout(r, backoff));
            }
          }
        }

        if (success) {
          addLog('DONE', `${item.file.name} successfully encrypted and stored.`);
          
          item.status = 'stored';
          done++;
          setOverallProgress(Math.round((done / total) * 100));
          
          const now = new Date();
          const filePerm = item.permConfig || defaultPerm;
          const newStoredFile: StoredFile = {
            id: Date.now() + Math.random(),
            name: item.file.name,
            ext: (item.file.name.split('.').pop() || 'BIN').toUpperCase().slice(0,4),
            size: item.file.size,
            cid: item.file.name,
            txHash: txHash,
            status: 'stored',
            vis: filePerm.type === 'public' ? 'public' : filePerm.type === 'allowlist' ? 'private' : 'encrypted',
            permConfig: { ...filePerm },
            previewUrl: URL.createObjectURL(item.file),
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().slice(0,5),
            uploader: walletAddress,
            network: ACTIVE_NET?.label || 'Unknown',
          };
          setFiles(prev => [newStoredFile, ...prev]);
        } else {
           item.status = 'error';
           showToast(`Upload failed for ${item.file.name}`, 'error');
           addLog('ERR ', `RPC Error for ${item.file.name} after 3 retries: ${lastErr?.message?.slice(0,80)}`);
        }

        setUploadQueue([...uploadQueue]);
        // Add a tiny delay between files to prevent RPC rate limiting
        await new Promise(r => setTimeout(r, 600));
      }
      
      // Refresh history
      setTimeout(() => fetchVaultHistory(), 1000);
      
      addLog('DONE', `Batch sequence completed. ${done}/${total} successful.`);
      setStatusLine(`✓ ${done} file${done !== 1 ? 's' : ''} uploaded to Shelby`);
      if (done > 0) showToast(`${done} file${done !== 1 ? 's' : ''} uploaded successfully ✓`, 'success');

    } catch (err: any) {
      console.error("Batch upload pipeline error:", err);
      const msg = err?.message || "upload_failed";
      if (msg.includes("rejected") || msg.includes("cancel") || msg.includes("User denied")) {
        showToast("Batch upload cancelled by user", "info");
        addLog('ERR ', `Transaction cancelled by user.`);
      } else {
        showToast(`Batch upload failed: ${msg.slice(0, 80)}`, "error");
        addLog('ERR ', `Exception: ${msg.slice(0, 50)}`);
      }
      
      // Mark remaining as ready
      for (const item of readyItems) {
        if (item.status === 'uploading') item.status = 'ready';
      }
      setUploadQueue([...uploadQueue]);
    }
    
    setIsUploading(false);
    setTimeout(() => {
      setUploadQueue([]);
      setIsUploadDetailModalOpen(false);
      setStatusLine('');
    }, 2500);
  }

  const handleClearVault = async () => {
    if (files.length === 0) {
      showToast('Vault is already empty', 'info');
      return;
    }
    
    if (!walletAddress || (!signAndSubmitTransaction && manualWalletId !== 'Martian')) {
      showToast('⚠ Connect a wallet to clear history on-chain', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete ALL ${files.length} files from the Shelby blockchain?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      showToast('Waiting for wallet approval to clear vault...', 'info');
      setShowTerminal(true);
      addLog('WIPE', `Requesting total vault wipe for ${files.length} files...`);
      const { ShelbyBlobClient } = await import('@shelby-protocol/sdk/browser') as any;
      
      const blobNames = files.map(f => f.name);
      
      const payload = ShelbyBlobClient.createDeleteMultipleBlobsPayload({
        blobNames
      });

      const txHash = await signAndSubmit(payload);
      

      showToast('Confirming mass deletion on-chain...', 'info');
      addLog('TRAN', `TX submitted. Confirming hash: ${txHash.slice(0, 10)}...`);
      await aptos.waitForTransaction({ transactionHash: txHash });

      setFiles([]);
      showToast('Vault history permanently cleared on-chain ✓', 'success');
      addLog('DONE', `Vault permanently cleared on-chain.`);
      
      // Give RPC a second to sync
      setTimeout(() => fetchVaultHistory(), 1500);

    } catch (err: any) {
      const msg = err?.message || 'failed';
      if (msg.includes('cancel') || msg.includes('rejected') || msg.includes('User denied')) {
        showToast('Clear vault cancelled', 'info');
      } else {
        showToast(`Failed to clear vault: ${msg.slice(0,80)}`, 'error');
      }
    }
  }



  // ── Download file from Shelby network ─────────────────────────────────────
  // Helper: try downloading with primary address, fallback to secondary
  const fetchBlobWithFallback = async (f: StoredFile, ownerAddr: string): Promise<Blob> => {
    const shelbyRpc = ACTIVE_NET.shelbyRpc;
    if (!shelbyRpc) throw new Error('Shelby RPC URL not configured.');

    const encodedName = encodeURIComponent(f.name).replace(/%2F/g, '/');
    const headers: Record<string, string> = {};
    const SHELBYNET_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
    if (activeNetKey === 'shelbynet' && SHELBYNET_KEY) headers['Authorization'] = `Bearer ${SHELBYNET_KEY}`;

    // Primary: use the exact address the file was uploaded under
    const primaryAddr = f.uploader || ownerAddr;
    const primaryUrl = `${shelbyRpc}/v1/blobs/${primaryAddr}/${encodedName}`;
    let res = await fetch(primaryUrl, { headers });

    if (!res.ok && primaryAddr !== ownerAddr) {
      // Fallback: try current wallet address
      const fallbackUrl = `${shelbyRpc}/v1/blobs/${ownerAddr}/${encodedName}`;
      res = await fetch(fallbackUrl, { headers });
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} — blob not found on RPC`);
    }
    return res.blob();
  };

  const handleDownloadFile = async (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f || !walletAddress) { showToast('Cannot download: wallet not connected', 'error'); return; }

    showToast(`⬇ Downloading ${f.name}…`, 'info');
    setShowTerminal(true);
    addLog('DWNL', `Downloading ${f.name} from RPC Nodes...`);
    try {
      const blob = await fetchBlobWithFallback(f, walletAddress);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = f.name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast(`✓ ${f.name} downloaded`, 'success');
      addLog('DONE', `${f.name} downloaded successfully.`);
    } catch (err: any) {
      console.error('[Vault] Download failed:', err);
      showToast(`Download failed: ${err?.message?.slice(0, 100) || 'unknown error'}`, 'error');
      addLog('ERR ', `Download failed: ${err?.message?.slice(0, 80)}`);
    }
  };

  // ── Download selected files ────────────────────────────────────────────────
  const handleDownloadSelected = async () => {
    const selectedFiles = files.filter(f => checkedIds.has(f.id));
    if (selectedFiles.length === 0 || !walletAddress) return;

    showToast(`⬇ Downloading ${selectedFiles.length} files...`, 'info');
    setShowTerminal(true);
    addLog('DWNL', `Initiating batch download for ${selectedFiles.length} files...`);
    let successCount = 0;
    
    for (const f of selectedFiles) {
      try {
        const blob = await fetchBlobWithFallback(f, walletAddress);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = f.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        
        successCount++;
        addLog('SYNC', `Streamed ${f.name} from network.`);
        // Delay to prevent browser download blast throttling
        await new Promise(r => setTimeout(r, 600));
      } catch (err: any) {
        console.error(`Failed to download ${f.name}`, err);
        addLog('ERR ', `${f.name}: ${err?.message?.slice(0, 60)}`);
      }
    }
    
    showToast(`✓ Downloaded ${successCount}/${selectedFiles.length} files`, 'success');
    addLog('DONE', `Batch download complete: ${successCount}/${selectedFiles.length}`);
    setCheckedIds(new Set());
  };

  // ── Delete selected files ──────────────────────────────────────────────────
  const handleDeleteSelected = async () => {
    const selectedFiles = files.filter(f => checkedIds.has(f.id));
    if (selectedFiles.length === 0 || !walletAddress) return;

    if (!window.confirm(`Are you sure you want to permanently delete ${selectedFiles.length} selected files from the Shelby blockchain?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      showToast('Waiting for wallet approval to delete files...', 'info');
      setShowTerminal(true);
      addLog('WIPE', `Requesting batch deletion for ${selectedFiles.length} files...`);
      const { ShelbyBlobClient } = await import('@shelby-protocol/sdk/browser') as any;
      const blobNames = selectedFiles.map(f => f.name);
      const payload = ShelbyBlobClient.createDeleteMultipleBlobsPayload({ blobNames });

      const txHash = await signAndSubmit(payload);

      showToast('Confirming batch deletion on-chain...', 'info');
      addLog('TRAN', `TX submitted. Confirming hash: ${txHash.slice(0, 10)}...`);
      await aptos.waitForTransaction({ transactionHash: txHash });

      showToast(`Successfully deleted ${selectedFiles.length} files ✓`, 'success');
      addLog('DONE', `Batch deletion confirmed on-chain.`);
      setCheckedIds(new Set());
      setTimeout(() => fetchVaultHistory(), 1500);
    } catch (err: any) {
      const msg = err?.message || 'failed';
      if (!msg.includes('cancel') && !msg.includes('rejected') && !msg.includes('User denied')) {
        showToast(`Failed to delete files: ${msg.slice(0,80)}`, 'error');
      } else {
        showToast('Batch delete cancelled', 'info');
      }
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
    if (!shelbyRpc || !walletAddress) return;

    const encodedName = encodeURIComponent(f.name).replace(/%2F/g, '/');
    const primaryAddr = f.uploader || walletAddress;
    const blobUrl = `${shelbyRpc}/v1/blobs/${primaryAddr}/${encodedName}`;

    const SHELBYNET_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
    const headers: Record<string, string> = {};
    if (activeNetKey === 'shelbynet' && SHELBYNET_KEY) {
      headers['Authorization'] = `Bearer ${SHELBYNET_KEY}`;
    }

    try {
      let res = await fetch(blobUrl, { headers });
      if (!res.ok && primaryAddr !== walletAddress) {
        // Fallback to current address
        const fallbackUrl = `${shelbyRpc}/v1/blobs/${walletAddress}/${encodedName}`;
        res = await fetch(fallbackUrl, { headers });
      }

      if (!res.ok) {
        console.warn(`[Vault] Preview fetch ${res.status} for ${f.name}`);
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
      console.warn('[Vault] Preview fetch error:', err?.message);
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
    if (!f || !walletAddress || (!signAndSubmitTransaction && manualWalletId !== 'Martian')) {
      showToast('Cannot delete: wallet not connected', 'error');
      return;
    }

    if (!window.confirm(`Delete "${f.name}" from the Shelby blockchain?\n\nThis will submit an on-chain transaction and cannot be undone.`)) return;

    showToast(`Waiting for wallet signature to delete "${f.name}"…`, 'info');
    try {
      setShowTerminal(true);
      addLog('WIPE', `Requesting permanent deletion for ${f.name}...`);
      const { ShelbyBlobClient } = await import('@shelby-protocol/sdk/browser') as any;
      const payload = ShelbyBlobClient.createDeleteBlobPayload({ blobName: f.name });
      const txHash = await signAndSubmit(payload);

      showToast(`Confirming deletion on-chain…`, 'info');
      addLog('TRAN', `TX submitted. Confirming hash: ${txHash.slice(0, 10)}...`);
      await aptos.waitForTransaction({ transactionHash: txHash });

      // Remove from local list after confirmed
      setFiles(prev => prev.filter(fi => fi.id !== id));
      showToast(`✓ "${f.name}" deleted from blockchain`, 'success');
      addLog('DONE', `${f.name} deleted successfully.`);
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
    const explorerBase = 'https://explorer.shelby.xyz/testnet/account';
    const url = `${explorerBase}/${walletAddress}/blobs?name=${encodeURIComponent(f.name)}`;
    window.open(url, '_blank', 'noopener');
  };

  // ── Copy explorer link ─────────────────────────────────────────────────────
  const handleCopyLink = (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f || !walletAddress) return;
    const explorerBase = 'https://explorer.shelby.xyz/testnet/account';
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
        <div className="window" style={{ width: '300px' }}>
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
        <div className="window" style={{ width: '300px' }}>
          <div className="titlebar"><span>System Message</span></div>
          <div className="window-body">
            <p>Initializing ShelbyOS...</p>
          </div>
        </div>
      </div>
    );
  }

  // Defensive render guard
  try {
    return (
      <>
        <Navbar 
          activeNetwork={activeNetKey}
          walletConnected={walletConnected} 
          onThemeChange={(newTheme) => {
            setTheme(newTheme);
            showToast(`Theme switched to ${newTheme.replace('theme-', '').toUpperCase()}`);
          }}
          onNetworkChange={(net) => {
            setActiveNetKey(net as any);
            showToast(`Switched to ${NETWORKS[net as keyof typeof NETWORKS]?.label || net}`);
          }}
          onConnectWallet={() => {
            if (walletConnected) {
              handleWalletDisconnect();
            } else {
              setIsWalletModalOpen(true);
            }
          }}
          onFundAccount={() => {
            if (!walletConnected) {
              showToast('Connect wallet first', 'error');
              setIsWalletModalOpen(true);
            } else {
              setIsFundModalOpen(true);
            }
          }}
        />
        <div className="layout">
          {walletConnected && <DashboardOverview files={files} />}
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
                setEditingFileId(id);
                setIsPermModalOpen(true);
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
            
            <div className="window animate-entry delay-3" style={{ marginTop: '10px' }}>
              <div className="titlebar">
                <span>🛠️ Actions</span>
              </div>
              <div className="window-body" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button 
                  className="btn95" 
                  style={{ width: '100%', fontSize: '12px' }}
                  onClick={() => {
                    setEditingPermIndex(null);
                    setIsPermModalOpen(true);
                  }}
                >
                  ⚙️ Permission Defaults
                </button>
                <button 
                  className="btn95" 
                  style={{ width: '100%', fontSize: '12px' }}
                  onClick={() => setIsConfirmClearOpen(true)}
                  disabled={(files?.length || 0) === 0}
                >
                  🗑️ Clear History
                </button>
                {checkedIds.size > 0 && (
                  <>
                    <hr style={{ margin: '2px 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-dark)' }} />
                    <button 
                      className="btn95" 
                      style={{ width: '100%', fontSize: '12px', fontWeight: 'bold' }}
                      onClick={handleDownloadSelected}
                    >
                      ⬇️ Download ({checkedIds.size})
                    </button>
                    <button 
                      className="btn95 del" 
                      style={{ width: '100%', fontSize: '12px', fontWeight: 'bold', color: 'var(--hot)' }}
                      onClick={handleDeleteSelected}
                    >
                      ❌ Delete ({checkedIds.size})
                    </button>
                  </>
                )}
                <button 
                  className="btn95" 
                  style={{ width: '100%', fontSize: '12px' }}
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

        <StatusBar 
          fileCount={files?.length || 0}
          totalSize={((files ?? []).reduce((a, b) => a + b.size, 0) / 1048576).toFixed(2) + ' MB'}
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

        <FundModal 
          isOpen={isFundModalOpen}
          onClose={() => setIsFundModalOpen(false)}
          address={walletAddress}
          aptBalance={aptBalance}
          shelbyBalance={shelbyBalance}
          onRefresh={handleRefreshBalances}
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
      </>
    )
  } catch (err) {
    console.error("React render failure", err);
    return (
      <div style={{ padding: 20, fontFamily: 'Tahoma', background: '#ece9d8', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="window" style={{ width: '300px' }}>
          <div className="titlebar"><span>Critical Error</span></div>
          <div className="window-body">
            <p>ShelbyOS failed to render. Reload the application.</p>
            <button className="btn95" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}

export default App
// submitTransaction removed: now using signAndSubmitTransaction directly for adapter wallets


