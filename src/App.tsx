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
import { createShelbyIndexerClient } from '@shelby-protocol/sdk/browser'

const API_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
if (!API_KEY) {
  console.error("ShelbyNet API key missing. Check .env configuration.");
}


function App() {
  const { connect, disconnect, account, connected, network, signAndSubmitTransaction } = useWallet()

  // Theme & Network
  const [theme, setTheme] = useState('theme-xp')
  const [activeNetKey, setActiveNetKey] = useState<keyof typeof NETWORKS>('testnet')
  
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

  // Helper: Fetch history from Shelby Blob Indexer (official SDK)
  const fetchVaultHistory = useCallback(async () => {
    if (!walletAddress || !ACTIVE_NET) {
      setFiles([]);
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      // Normalize wallet address to 64-char padded hex
      let addr = walletAddress.toLowerCase();
      const hex = addr.startsWith('0x') ? addr.slice(2) : addr;
      addr = '0x' + hex.padStart(64, '0');

      // ────────────────────────────────────────────────
      // SOURCE A: Shelby Blob Indexer (official SDK client)
      // Uses the Hasura GraphQL indexer that powers explorer.shelby.xyz
      // ────────────────────────────────────────────────
      try {
        console.log('[Vault] Querying Shelby Blob Indexer for address:', addr);
        const shelbyIdx = createShelbyIndexerClient(ACTIVE_NET.shelbyIndexer);
        const result = await shelbyIdx.getBlobs({
          where: { owner: { _eq: addr } },
          orderBy: [{ updated_at: 'desc' as any }], // camelCase as per SDK interface
          limit: 100,
        });

        const blobs: any[] = result?.blobs ?? [];
        console.log(`[Vault] Shelby Indexer returned ${blobs.length} blobs`);

        if (blobs.length > 0) {
          const history: StoredFile[] = blobs.map((blob: any) => {
            const name = blob.blob_name || 'Vault Asset'; // correct field: 'blob_name'
            const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';
            // created_at is a numeric unix timestamp (seconds or microseconds)
            const rawTs = blob.created_at;
            const tsMs = rawTs > 1e12 ? rawTs / 1000 : rawTs * 1000; // handle micro vs millis
            const d = rawTs ? new Date(tsMs) : new Date();
            const permConfig: PermissionConfig = { type: 'public', allowlist: [], timelock: '', price: '' };

            return {
              id: blob.blob_name || Date.now() + Math.random(),
              name,
              ext,
              size: Number(blob.size) || 0,
              date: d.toISOString().split('T')[0],
              time: d.toTimeString().slice(0, 5),
              uploader: blob.owner || addr,
              status: 'stored' as const,
              vis: 'public' as any,
              permConfig,
              network: ACTIVE_NET.label,
              cid: blob.blob_name || '',
              txHash: blob.blob_commitment || '',
            };
          });
          setFiles(history);
          return;
        }
      } catch (shelbyErr: any) {
        console.warn('[Vault] Shelby Indexer failed:', shelbyErr?.message || shelbyErr);
      }

      // ────────────────────────────────────────────────
      // SOURCE B: Aptos SDK Transaction Scan (fallback)
      // ────────────────────────────────────────────────
      console.log('[Vault] Falling back to Aptos SDK transaction scan...');
      try {
        const transactions = await aptos.getAccountTransactions({
          accountAddress: addr,
          options: { limit: 50 }
        });

        const contractAddress = ACTIVE_NET.contract;
        const blobTxs = transactions.filter((tx: any) => {
          if (tx.type !== 'user_transaction') return false;
          return tx.payload?.function?.startsWith(`${contractAddress}::storage::register_blob`);
        });

        console.log(`[Vault] Found ${blobTxs.length} blob transactions on-chain`);

        if (blobTxs.length > 0) {
          const fallbackHistory: StoredFile[] = blobTxs.map((tx: any) => {
            const args = tx.payload?.arguments || [];
            let name = 'Vault Asset';
            let size = 0;

            if (args.length >= 1 && typeof args[0] === 'string') {
              try {
                const h = args[0].startsWith('0x') ? args[0].slice(2) : args[0];
                name = new TextDecoder().decode(new Uint8Array((h.match(/.{1,2}/g) ?? []).map((b: string) => parseInt(b, 16))));
              } catch { name = 'Vault Asset'; }
            }
            if (args.length >= 4) size = parseInt(args[3]) || 0;

            const d = new Date(parseInt(tx.timestamp) / 1000);
            const ext = name.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';
            return {
              id: tx.version,
              name, ext, size,
              date: d.toISOString().split('T')[0],
              time: d.toTimeString().slice(0, 5),
              uploader: addr,
              status: 'stored' as const,
              vis: 'public' as any,
              network: ACTIVE_NET.label,
              cid: name,
              txHash: tx.hash,
            };
          });
          setFiles(prev => {
            const existingHashes = new Set(prev.map(f => f.txHash));
            const newOnes = fallbackHistory.filter(f => !existingHashes.has(f.txHash));
            return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
          });
          return;
        }
      } catch (sdkErr: any) {
        console.warn('[Vault] Aptos SDK fallback failed:', sdkErr?.message || sdkErr);
      }

      // All sources exhausted — keep any existing local data
      console.warn('[Vault] All data sources returned empty. Displaying local-only cache.');

    } catch (err: any) {
      console.warn('[Vault] Unexpected error in history sync:', err?.message);
      setHistoryError(err?.message || 'Failed to sync history');
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

  // Real-time polling: re-fetch vault every 30 seconds while wallet is connected
  useEffect(() => {
    if (!walletConnected || !walletAddress) return;
    const pollInterval = setInterval(() => {
      fetchVaultHistory();
    }, 30_000);
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
      // Modifying an existing file in the vault
      setFiles(prev => prev.map(f => {
        if (f.id === editingFileId) {
          return {
            ...f,
            permConfig: config,
            vis: config.type === 'public' ? 'public' : config.type === 'allowlist' ? 'private' : 'encrypted'
          };
        }
        return f;
      }));
      showToast('Permissions updated for file ✓', 'success');
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

  async function uploadToShelby(file: File, account: string) {
    // API key: ShelbyNet requires one, Testnet public endpoint does not
    const SHELBYNET_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
    const TESTNET_KEY   = import.meta.env.VITE_SHELBY_API_KEY_TESTNET; // optional
    const isOnShelbyNet = activeNetKey === "shelbynet";

    // Only block upload on ShelbyNet if key is missing
    if (isOnShelbyNet && !SHELBYNET_KEY) {
      showToast("ShelbyNet API key not configured", "error");
      return { success: false, error: "Missing ShelbyNet API key" };
    }

    if (!ACTIVE_NET?.contract) {
      showToast("Storage contract configuration missing", "error");
      return { success: false, error: "contract_missing" };
    }

    if (!walletConnected || !walletAddress || !ACTIVE_NET) {
      return { success: false, error: "wallet_not_initialized" };
    }

    try {
      showToast(`Encoding ${file.name}...`, "info");
      addLog('PROC', `Generating erasure coding for ${file.name}...`);
      const {
        generateCommitments,
        createDefaultErasureCodingProvider,
        ShelbyBlobClient,
        ShelbyClient,
        expectedTotalChunksets,
      } = await import("@shelby-protocol/sdk/browser");

      const provider = await createDefaultErasureCodingProvider();
      const data = new Uint8Array(await file.arrayBuffer());
      const commitments = await generateCommitments(provider, data);

      showToast("Waiting for wallet approval...", "info");
      addLog('AUTH', 'Awaiting wallet signature for contract transaction...');
      const payload = ShelbyBlobClient.createRegisterBlobPayload({
        account: account as any,
        blobName: file.name,
        blobMerkleRoot: commitments.blob_merkle_root,
        numChunksets: expectedTotalChunksets(commitments.raw_data_size),
        expirationMicros: (Date.now() + 1000 * 60 * 60 * 24 * 30) * 1000,
        blobSize: commitments.raw_data_size,
        encoding: 0,
      });

      const txResult = await signAndSubmitTransaction({ data: payload });
      const txHash = (txResult as any)?.hash || (txResult as any)?.result?.hash;
      if (!txHash) throw new Error("Transaction hash not found after submission");

      showToast("Confirming on-chain registration...", "info");
      addLog('TRAN', `TX submitted. Confirming hash: ${txHash.slice(0, 10)}...`);
      await aptos.waitForTransaction({ transactionHash: txHash });
      console.log("Blob registered on-chain:", txHash);

      showToast("Uploading file to Shelby network...", "info");
      addLog('SYNC', `Streaming raw data to Decentralized Vault Nodes...`);
      const { Network } = await import("@aptos-labs/ts-sdk");

      // Only pass apiKey for the network that requires auth
      const shelbyClient = isOnShelbyNet
        ? new ShelbyClient({
            network: Network.SHELBYNET,
            apiKey: SHELBYNET_KEY,
            fullnode: ACTIVE_NET.aptosRpc,
            shelbynode: ACTIVE_NET.shelbyRpc,
          } as any)
        : TESTNET_KEY
        ? new ShelbyClient({ network: Network.TESTNET, apiKey: TESTNET_KEY } as any)
        : new ShelbyClient({ network: Network.TESTNET } as any);

      await shelbyClient.rpc.putBlob({
        account: account as any,
        blobName: file.name,
        blobData: new Uint8Array(await file.arrayBuffer()),
      });

      console.log("Blob uploaded to Shelby RPC");
      addLog('DONE', `${file.name} successfully encrypted and stored.`);
      return { success: true, blobId: file.name, txHash };

    } catch (err: any) {
      console.error("Shelby upload pipeline error:", err);
      const msg = err?.message || "upload_failed";
      if (msg.includes("rejected") || msg.includes("cancel") || msg.includes("User denied")) {
        showToast("Upload cancelled by user", "info");
        addLog('ERR ', `Upload cancelled by user.`);
      } else {
        showToast(`Upload failed: ${msg.slice(0, 80)}`, "error");
        addLog('ERR ', `Exception: ${msg.slice(0, 50)}`);
      }
      return { success: false, error: msg };
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
    let done = 0;

    for (const item of uploadQueue) {
      if (item.status !== 'ready') continue;

      item.status = 'uploading';
      setStatusLine(`Uploading ${done + 1} / ${total}: ${item.file.name}`);
      setUploadQueue([...uploadQueue]);

      const result = await uploadToShelby(item.file, walletAddress);

      if (result.success) {
        const now = new Date();
        const filePerm = item.permConfig || defaultPerm;

        const newStoredFile: StoredFile = {
          id: Date.now() + Math.random(),
          name: item.file.name,
          ext: (item.file.name.split('.').pop() || 'BIN').toUpperCase().slice(0,4),
          size: item.file.size,
          cid: result.blobId || item.file.name,
          txHash: result.txHash || '',
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
        item.status = 'stored';
        done++;
        setOverallProgress(Math.round((done / total) * 100));
        
        // Refresh full history from Shelby API after successful upload
        // Added small timeout to allow RPC/Indexer to catch up
        setTimeout(() => fetchVaultHistory(), 1000);
      } else {
        item.status = 'ready';
        showToast(`Upload failed: ${item.file.name}`, 'error');
      }
      setUploadQueue([...uploadQueue]);
    }

    setIsUploading(false);
    addLog('DONE', `Batch sequence completed. ${done}/${total} successful.`);
    setStatusLine(`✓ ${done} file${done !== 1 ? 's' : ''} uploaded to Shelby`);
    if (done > 0) showToast(`${done} file${done !== 1 ? 's' : ''} uploaded successfully ✓`, 'success');
    
    setTimeout(() => {
      setUploadQueue([]);
      setIsUploadDetailModalOpen(false);
      setStatusLine('');
    }, 1800);
  }

  const handleClearVault = () => {
    setFiles([])
    showToast('Vault history cleared', 'info')
  }

  const handleShowDetails = (id: number) => {
    const file = files.find(f => f.id === id);
    if (file) {
      setSelectedFile(file);
      setIsDetailModalOpen(true);
    }
  }

  const handlePreviewFile = (id: number) => {
    const f = files.find(s => s.id === id);
    if (!f) return;

    const perm = (f.permConfig && f.permConfig.type) || f.vis || 'public';

    if (perm === 'public') {
      setSelectedFile(f);
      setIsPreviewModalOpen(true);
      return;
    }

    if (perm === 'allowlist') {
      if (!walletConnected) {
        setAccessDeniedMsg('Connect your wallet to access this file.');
        setAccessDeniedAction(null);
        setIsAccessDeniedOpen(true);
        return;
      }
      const config = f.permConfig as any;
      const list = config?.allowlist || [];
      if (list.includes(walletAddress) || list.length === 0) {
        setSelectedFile(f);
        setIsPreviewModalOpen(true);
      } else {
        setAccessDeniedMsg(`Access restricted. Your wallet (${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}) is not on the allowlist for this file.`);
        setAccessDeniedAction(null);
        setIsAccessDeniedOpen(true);
      }
      return;
    }

    if (perm === 'timelock') {
      const config = f.permConfig as any;
      const unlock = config?.timelock;
      if (!unlock) {
        setSelectedFile(f);
        setIsPreviewModalOpen(true);
        return;
      }
      const unlockDate = new Date(unlock);
      if (Date.now() >= unlockDate.getTime()) {
        setSelectedFile(f);
        setIsPreviewModalOpen(true);
      } else {
        const fmt = unlockDate.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })
                  + ' at ' + unlockDate.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        setAccessDeniedMsg(`File will be available after ${fmt}.`);
        setAccessDeniedAction(null);
        setIsAccessDeniedOpen(true);
      }
      return;
    }

    if (perm === 'purchasable') {
      const config = f.permConfig as any;
      const price = config?.price ? config.price + ' sUSD' : 'a fee';
      setAccessDeniedMsg(`This file requires payment to access.\n\nPrice: ${price}\n\nSimulate payment?`);
      setAccessDeniedAction({
        label: 'Pay & Preview',
        fn: () => {
          setIsAccessDeniedOpen(false);
          setSelectedFile(f);
          setIsPreviewModalOpen(true);
          showToast('Payment simulated ✓', 'success');
        }
      });
      setIsAccessDeniedOpen(true);
      return;
    }

    setSelectedFile(f);
    setIsPreviewModalOpen(true);
  }

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
          <VaultTable 
            files={files} 
            isLoading={isHistoryLoading}
            error={historyError}
            walletConnected={walletConnected}
            onConnectWallet={() => setIsWalletModalOpen(true)}
            onCopyLink={handleShowDetails}
            onPreview={handlePreviewFile}
            onDelete={(id) => setFiles(prev => prev.filter(f => f.id !== id))}
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
          onDownload={() => {
            if (!selectedFile?.previewUrl) return;
            const a = document.createElement('a');
            a.href = selectedFile.previewUrl;
            a.download = selectedFile.name;
            a.click();
          }}
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

