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
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  
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

  // No changes needed here, keeping existing logs if any

  const ACTIVE_NET = NETWORKS[activeNetKey] || NETWORKS.testnet;

  // Data State - Fixed: Initialized as empty, removed dummy data
  const [files, setFiles] = useState<StoredFile[]>([])

  // Helper: Fetch vault history from Aptos REST API (no auth needed, pagination supported)
  const fetchVaultHistory = useCallback(async () => {
    if (!walletAddress || !ACTIVE_NET) {
      return;
    }

    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      // Normalize wallet address to full 64-char padded hex
      let addr = walletAddress.toLowerCase();
      const rawHex = addr.startsWith('0x') ? addr.slice(2) : addr;
      addr = '0x' + rawHex.padStart(64, '0');

      // 1. Try GraphQL Indexer First (Source of Truth, naturally skips deleted/expired/unwritten files)
      try {
        const indexerUrl = ACTIVE_NET.shelbyIndexer;
        let apiKey = '';
        if (ACTIVE_NET.label === 'Testnet') apiKey = import.meta.env.VITE_SHELBY_API_KEY_TESTNET || '';
        if (ACTIVE_NET.label === 'ShelbyNet') apiKey = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET || '';

        console.log(`[Vault] Fetching from Indexer: ${ACTIVE_NET.label}`);
        console.log(`[Vault] activeNetKey: ${activeNetKey}`);
        console.log(`[Vault] Indexer URL: ${indexerUrl ? 'OK' : 'MISSING'}`);
        console.log(`[Vault] API Key present: ${apiKey ? 'YES' : 'NO'}`);

        if (!indexerUrl || !apiKey) {
          const missingMsg = !indexerUrl ? "Indexer URL" : "API Key";
          throw new Error(`Missing ${missingMsg} (401). Please check Vercel Env Variables (VITE_SHELBY_API_KEY_${ACTIVE_NET.label.toUpperCase()})`);
        }

        const currentMicros = String(Date.now() * 1000);
        const query = `
          query getBlobs($where: blobs_bool_exp) {
            blobs(where: $where) {
              blob_name
              size
              created_at
              expires_at
              is_deleted
              is_written
            }
          }
        `;
        const variables = {
          where: {
            owner: { _eq: addr },
            is_deleted: { _eq: "0" },
            expires_at: { _gte: currentMicros }
          }
        };

        const res = await fetch(indexerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({ query, variables })
        });

        if (!res.ok) {
          const text = await res.text();
          console.error(`[Vault] GraphQL Indexer HTTP Error: ${res.status} ${text}`);
          throw new Error(`GraphQL Indexer HTTP Error: ${res.status} ${text}`);
        }

        const json = await res.json();
        if (json.errors) {
          console.error(`[Vault] GraphQL Indexer Query Error: ${json.errors[0]?.message}`);
          throw new Error(`GraphQL Indexer Query Error: ${json.errors[0]?.message || 'Unknown GraphQL error'}`);
        }

        const rawBlobs: any[] = json.data?.blobs || [];
        const accountBlobs = rawBlobs.filter((b: any) =>
          Number(b.is_written) === 1 && Number(b.is_deleted) === 0
        );

        if (Array.isArray(accountBlobs)) {
          console.log(`[Vault] Found ${accountBlobs.length} active blobs via GraphQL Indexer`);

          const history: StoredFile[] = accountBlobs.map((blob: any) => {
            const blobName: string = blob.blob_name || 'Unknown';
            const tsMicro = parseInt(blob.created_at) || 0;
            const d = tsMicro > 0 ? new Date(tsMicro / 1000) : new Date();
            const ext = blobName.split('.').pop()?.toUpperCase().slice(0, 4) ?? 'BIN';
            return {
              id: tsMicro || Math.random(),
              name: blobName,
              ext,
              size: parseInt(blob.size) || 0,
              date: d.toISOString().split('T')[0],
              time: d.toTimeString().slice(0, 5),
              uploader: addr,
              status: 'stored' as const,
              vis: 'public' as any,
              permConfig: { type: 'public' as const, allowlist: [], timelock: '', price: '' },
              network: ACTIVE_NET.label,
              cid: blobName,
              txHash: '',
            };
          });

          // Sort newest first
          history.sort((a, b) => b.id - a.id);
          
          const historyWithPerms = history.map(f => {
            const storageKey = `shelbyos_perm_${addr}/${f.name}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              try {
                const savedConfig = JSON.parse(saved);
                return { ...f, permConfig: savedConfig, vis: savedConfig.type === 'public' ? 'public' : savedConfig.type === 'allowlist' ? 'private' : 'encrypted' as any };
              } catch { /* ignore */ }
            }
            return f;
          });

          setFiles(historyWithPerms);
          return; // Exit early!
        }
      } catch (gqlErr: any) {
        console.warn('[Vault] GraphQL Indexer failed:', gqlErr);
        // We drop the REST API fallback to prevent "Ghost Files" entirely.
        // The REST fallback couldn't reliably track is_written or complex indexer states.
        // If the indexer fails (e.g. 401 Unauthorized due to missing Vercel API Key),
        // we show an empty vault safely to match the Explorer's "0 blobs found".
        setFiles([]);
        if (gqlErr.message?.includes('401') || gqlErr.message?.includes('Unauthorized')) {
          setHistoryError('Please configure your VITE_SHELBY_API_KEY_TESTNET in Vercel to sync history.');
        }
      }

    } catch (err: any) {
      console.warn('[Vault] Error fetching vault history:', err?.message);
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
      
      const SHELBYNET_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
      const headers: Record<string, string> = {};
      if (activeNetKey === 'shelbynet' && SHELBYNET_KEY) {
        headers['Authorization'] = `Bearer ${SHELBYNET_KEY}`;
      }

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
      console.error('[Vault] Download failed:', err);
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
    const SHELBYNET_KEY = import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET;
    const headers: Record<string, string> = {};
    if (activeNetKey === 'shelbynet' && SHELBYNET_KEY) {
      headers['Authorization'] = `Bearer ${SHELBYNET_KEY}`;
    }

    try {
      const res = await fetch(blobUrl, { headers });
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
    if (!f || !walletAddress || !signAndSubmitTransaction) {
      showToast('Cannot delete: wallet not connected', 'error');
      return;
    }

    if (!window.confirm(`Delete "${f.name}" from the Shelby blockchain?\n\nThis will submit an on-chain transaction and cannot be undone.`)) return;

    showToast(`Waiting for wallet signature to delete "${f.name}"…`, 'info');
    try {
      const { ShelbyBlobClient } = await import('@shelby-protocol/sdk/browser') as any;
      const payload = ShelbyBlobClient.createDeleteBlobPayload({ blobName: f.name });
      const txResult = await signAndSubmitTransaction({ data: payload });
      const txHash = (txResult as any)?.hash || (txResult as any)?.result?.hash;
      if (!txHash) throw new Error('No tx hash returned after delete');

      showToast(`Confirming deletion on-chain…`, 'info');
      await aptos.waitForTransaction({ transactionHash: txHash });

      // Remove from local list after confirmed
      setFiles(prev => prev.filter(fi => fi.id !== id));
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

