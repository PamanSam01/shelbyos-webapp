import { useState, useEffect, useCallback, useMemo } from 'react'
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig } from "@aptos-labs/ts-sdk"
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
import './App.css'
import './themes.css'

const API_KEY = import.meta.env.VITE_SHELBY_API_KEY || "";

function isShelbyNet(rpcUrl?: string) {
  if (!rpcUrl) return false;
  return rpcUrl.includes("shelby.xyz");
}

function App() {
  const { connect, disconnect, account, connected, signAndSubmitTransaction, network } = useWallet()

  // Theme & Network
  const [theme, setTheme] = useState('theme-xp')
  const [activeNetKey, setActiveNetKey] = useState<keyof typeof NETWORKS>('testnet')
  
  // Wallet State (Unified for Adapter and Manual)
  const walletConnected = connected
  const walletAddress = account?.address?.toString() ?? ""
  const [manualWalletId, setManualWalletId] = useState<string | null>(null)
  
  // Mock balances
  const [aptBalance, setAptBalance] = useState('0.00')
  const [shelbyBalance, setShelbyBalance] = useState('0.00')
  
  // UI Controls (Modals)
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)
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
  const [accessDeniedMsg, setAccessDeniedMsg] = useState('')
  const [accessDeniedAction, setAccessDeniedAction] = useState<{ label: string, fn: () => void } | null>(null)
  const [rpcStatus, setRpcStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  
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

  const ACTIVE_NET = NETWORKS[activeNetKey] || NETWORKS.shelbynet;

  // Data State - Fixed: Initialized as empty, removed dummy data
  const [files, setFiles] = useState<StoredFile[]>([])

  // Helper: Fetch history from Shelby storage API
  const fetchVaultHistory = useCallback(async () => {
    if (!walletAddress) return;

    const CURRENT_API_KEY = activeNetKey === "shelbynet"
      ? import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET
      : import.meta.env.VITE_SHELBY_API_KEY_TESTNET;

    try {
      const res = await fetch(
        `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${walletAddress}`,
        {
          headers: {
            Authorization: `Bearer ${CURRENT_API_KEY}`
          }
        }
      );

      if (!res.ok) return;

      const blobs = await res.json();

      const history = blobs.map((blob: any) => ({
        id: blob.id,
        name: blob.blobName,
        ext: blob.blobName.split(".").pop()?.toUpperCase() || "BIN",
        size: blob.size,
        date: new Date(blob.createdAt).toISOString().split("T")[0],
        time: new Date(blob.createdAt).toTimeString().slice(0, 5),
        uploader: walletAddress,
        status: "stored",
        vis: "public",
        network: ACTIVE_NET.label,
        cid: blob.blobId,
        txHash: blob.txHash
      }));

      setFiles(history);
    } catch (err) {
      console.error("Failed to fetch Shelby vault history:", err);
    }
  }, [walletAddress, ACTIVE_NET.label]);

  // Fetch history when wallet connects
  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchVaultHistory();
    }
  }, [walletConnected, walletAddress, fetchVaultHistory]);

  // Helper: Fetch current ledger timestamp from Aptos RPC
  const getLedgerTimeSecs = useCallback(async () => {
    try {
      // 🛡️ Ensure we hit the base RPC to get ledger info
      const res = await fetch(ACTIVE_NET.aptosRpc);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`RPC error: ${text}`);
      }
      const data = await res.json();
      // ledger_timestamp is in microseconds
      if (!data.ledger_timestamp) throw new Error("ledger_timestamp missing in RPC response");
      
      const ledgerSecs = Math.floor(Number(data.ledger_timestamp) / 1000000);
      console.log("Verified Ledger Secs from RPC:", ledgerSecs);
      return ledgerSecs;
    } catch (err) {
      console.error("Critical: Failed to sync with blockchain time:", err);
      showToast("Blockchain time sync failed. Check your connection.", "error");
      throw err;
    }
  }, [ACTIVE_NET.aptosRpc]);

  // Helper: Calculate SHA-256 commitment of the file
  const getCommitment = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(hashBuffer));
    } catch (err) {
      console.error("Commitment generation failed:", err);
      throw new Error("commitment_generation_failed");
    }
  }, []);

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

  function formatTokenBalance(value: number, decimals = 4) {
    if (!value || value === 0) return "0"
    return Number(value)
      .toFixed(decimals)
      .replace(/\.?0+$/, "")
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

    // Step 1: Fix Wallet Network Detection using network.name
    const walletNetwork = network?.name || "";
    const isWalletShelbyNet = walletNetwork.toLowerCase().includes("shelby");
    
    const isMismatch = (activeNetKey === "shelbynet" && !isWalletShelbyNet) || 
                       (activeNetKey === "testnet" && isWalletShelbyNet);

    if (walletConnected && isMismatch) {
      setRpcStatus("error");
      return;
    }

    try {
      // Step 2: Fix RPC Health Check by pinging a valid endpoint
      const res = await rpcFetch(`${rpc}/accounts/0x1`).catch(() => null);
      setRpcStatus(res && res.ok ? "ok" : "error");
    } catch {
      setRpcStatus("error");
    }
  }, [ACTIVE_NET?.aptosRpc, rpcFetch, network?.name, activeNetKey, walletConnected]);

  const fetchBalances = useCallback(async () => {
    // Step 3: Add RPC Guards
    if (!walletConnected || !walletAddress || !ACTIVE_NET) return;

    const walletNetwork = network?.name || "";
    const isWalletShelbyNet = walletNetwork.toLowerCase().includes("shelby");

    const isMismatch = (activeNetKey === "shelbynet" && !isWalletShelbyNet) || 
                       (activeNetKey === "testnet" && isWalletShelbyNet);
    
    if (isMismatch) {
      console.warn("Network mismatch between wallet and UI. Skipping RPC call.");
      return;
    }

    try {
      const res = await rpcFetch(
        `${ACTIVE_NET.aptosRpc}/accounts/${walletAddress}/resources`
      );

      // Step 5: Prevent Blank White Screen - check response.ok
      if (!res.ok) {
        if (res.status === 404) {
          setAptBalance("0");
          setShelbyBalance("0");
        }
        return;
      }

      const resources = await res.json();

      if (!Array.isArray(resources)) {
        setAptBalance("0");
        setShelbyBalance("0");
        return;
      }

      // Detect APT balance using exact type matching
      const aptStore = resources.find(
        (r: any) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      if (!aptStore) {
        setAptBalance("0");
        
        // Step 3: Optional fallback query to confirm account existence
        try {
          const accRes = await rpcFetch(`${ACTIVE_NET.aptosRpc}/accounts/${walletAddress}`);
          if (accRes.ok) {
            const accData = await accRes.json();
            if (accData?.sequence_number) {
              console.log("Account confirmed on-chain but no CoinStore resource found yet.");
            }
          }
        } catch (err) {
          console.error("Fallback account query failed:", err);
        }

        setShelbyBalance("0");
        return;
      }

      if (aptStore.data?.coin?.value) {
        const apt = Number(aptStore.data.coin.value) / 1e8;
        setAptBalance(formatTokenBalance(apt));
      } else {
        setAptBalance("0");
      }

      const shelbyStore = resources.find(
        (r: any) =>
          r.type?.includes("CoinStore") &&
          r.type?.toLowerCase().includes("shelby")
      );

      if (shelbyStore?.data?.coin?.value) {
        const susd = Number(shelbyStore.data.coin.value) / 1e6;
        setShelbyBalance(formatTokenBalance(susd, 2));
      } else {
        setShelbyBalance("0");
      }

    } catch (error) {
      console.error("ShelbyOS balance detection error:", error);
    }
  }, [walletConnected, walletAddress, network?.name, activeNetKey, ACTIVE_NET, rpcFetch]);

  // Side Effects
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      fetchBalances();
    }
  }, [walletAddress, activeNetKey]);

  useEffect(() => {
    checkRpcHealth();
  }, [activeNetKey, walletConnected, checkRpcHealth]);

  const handleWalletSelect = async (walletName: string) => {
    try {
      setIsWalletModalOpen(false);
      
      if (walletName === 'Martian') {
        if (!(window as any).martian) {
          window.open('https://martianwallet.xyz', '_blank');
          showToast('Martian not detected. Opening install page…', 'error');
          return;
        }
        showToast('Connecting to Martian...', 'info');
        const resp = await (window as any).martian.connect();
        const address = resp?.address?.toString() || resp?.account?.address?.toString();
        if (address) {
          setManualWalletId('Martian');
          showToast('Martian connected ✓', 'success');
        }
      } else if (walletName === 'Pontem') {
        setManualWalletId(null);
        await connect("Pontem" as any);
        showToast("Pontem connected ✓", "success");
      } else {
        // Use adapter for others (e.g. Petra)
        setManualWalletId(null);
        await connect(walletName as any);
        showToast(`${walletName} connected ✓`, "success");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message?.includes('rejected') ? 'Connection cancelled' : "Wallet connection failed", "error");
    }
  }

  const handleWalletDisconnect = async () => {
    try {
      if (manualWalletId === 'Martian') {
        await (window as any).martian.disconnect();
        setManualWalletId(null);
      } else {
        await disconnect();
      }
      showToast('Wallet disconnected', 'info');
    } catch (err: any) {
      showToast(`Failed to disconnect: ${err.message}`, 'error');
    }
  }

  const handleApplyPermissions = (config: PermissionConfig) => {
    if (editingPermIndex !== null && uploadQueue[editingPermIndex]) {
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
    const STORAGE_API = "https://api.shelbynet.shelby.xyz";
    const API_KEY = activeNetKey === "shelbynet"
      ? import.meta.env.VITE_SHELBY_API_KEY_SHELBYNET
      : import.meta.env.VITE_SHELBY_API_KEY_TESTNET;

    // 🛡️ API Key Guard
    if (!API_KEY) {
      console.warn("Shelby API key missing");
      showToast("Storage API key not configured", "error");
      return { success: false, error: "Missing API key" };
    }

    // 🛡️ Contract Configuration Guard
    if (!ACTIVE_NET?.contract) {
      console.error("Shelby contract missing");
      showToast("Storage contract configuration missing", "error");
      return { success: false, error: "contract_missing" };
    }

    try {
      // 🛡️ Context Guard: Ensure session is valid
      if (!walletConnected || !walletAddress || !ACTIVE_NET) {
        console.warn("Wallet or Network context missing.");
        return { success: false, error: "wallet_not_initialized" };
      }

      // 1️⃣ Sync with Blockchain Ledger Time
      const ledgerSecs = await getLedgerTimeSecs();
      const expirationSecs = ledgerSecs + 300; // 5 min TTL
      const creationTimeUs = (ledgerSecs * 1000000).toString();

      // 2️⃣ Generate SHA-256 Commitment and Chunksets
      const commitment = await getCommitment(file);
      const chunksets = Math.ceil(file.size / (4 * 1024 * 1024));

      // 3️⃣ Build Transaction Data
      const txData = {
        function: `${ACTIVE_NET.contract}::blob_metadata::register_blob`,
        typeArguments: [],
        functionArguments: [
          file.name,                                     // 1. name (String)
          creationTimeUs,                                // 2. creation_time_us (u64)
          commitment,                                    // 3. commitment (vector<u8>)
          chunksets,                                     // 4. chunksets (u32)
          file.size.toString(),                         // 5. size (u64)
          0,                                            // 6. tier (u8)
          0                                             // 7. encoding (u8)
        ]
      };

      console.log("Ledger:", ledgerSecs);
      console.log("Expiration:", expirationSecs);
      console.log("TTL:", expirationSecs - ledgerSecs);
      console.log("Commitment length:", commitment.length);
      console.log("Chunksets:", chunksets);
      console.log("Payload:", txData);

      let txResp: any;

      // 4️⃣ Build Raw Transaction using Aptos SDK
      // This ensures expirationTimestampSecs is embedded in the signed bytes
      try {
        console.log("Building raw transaction via SDK...");
        
        const builtTx = await aptos.transaction.build.simple({
          sender: walletAddress as any,
          data: {
            function: txData.function,
            typeArguments: txData.typeArguments,
            functionArguments: txData.functionArguments
          },
          options: {
            expirationTimestampSecs: expirationSecs
          }
        });

        console.log("Transaction built successfully:", builtTx);

        // 5️⃣ Trigger wallet approval with built transaction
        console.log("Triggering wallet approval flow...");

        // Handle manual Martian/Pontem vs standard adapter
        if (manualWalletId === 'Martian' && (window as any).martian) {
          txResp = await (window as any).martian.signAndSubmitTransaction({
            type: 'entry_function_payload',
            function: txData.function,
            type_arguments: txData.typeArguments,
            arguments: txData.functionArguments,
            expirationTimestampSecs: expirationSecs
          });
        } else if (manualWalletId === 'Pontem') {
          const provider = (window as any).pontem || (window as any).aptos;
          if (provider) {
            txResp = await provider.signAndSubmitTransaction({
              type: 'entry_function_payload',
              function: txData.function,
              type_arguments: txData.typeArguments,
              arguments: txData.functionArguments
            }, {
              expirationTimestampSecs: expirationSecs
            });
          }
        } else {
          // Official Adapter Call (Petra)
          // Fix: Use the official 'data' payload format. Do NOT pass built transaction objects.
          txResp = await signAndSubmitTransaction({
            data: {
              function: txData.function as `${string}::${string}::${string}`,
              typeArguments: [],
              functionArguments: txData.functionArguments
            },
            options: {
              expirationTimestampSecs: expirationSecs
            }
          });
        }

        if (!txResp) throw new Error("transaction_cancelled");
        console.log("Wallet Transaction Result:", txResp);

      } catch (err: any) {
        console.error("Wallet transaction failed:", err);
        const errorMsg = err?.message?.toLowerCase() || "";
        if (errorMsg.includes("rejected") || errorMsg.includes("user rejected") || errorMsg.includes("cancelled")) {
          showToast("Transaction rejected by wallet", "error");
          return { success: false, error: "wallet_rejected" };
        }
        showToast("Transaction simulation failed", "error");
        return { success: false, error: err.message || "transaction_failed" };
      }

      const txHash = txResp?.hash || txResp?.result?.hash || txResp;
      if (!txHash) throw new Error("Transaction hash not found");

      // 6️⃣ Wait for transaction confirmation
      console.log("Waiting for L1 registration confirmation...");
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const res = await fetch(`${ACTIVE_NET.aptosRpc}/transactions/by_hash/${txHash}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success || data.vm_status === 'Executed successfully') {
              confirmed = true;
              console.log("Blob registered on L1 ✓");
              break;
            }
          }
        } catch (fetchErr) {
          console.warn("Retrying Aptos RPC lookup...", fetchErr);
        }
      }

      if (!confirmed) throw new Error("Transaction confirmation timeout");

      // 7️⃣ Initialize Shelby Multipart Upload
      console.log("Initializing multipart upload...");
      const PART_SIZE = 5242880; // 5MB
      
      const initRes = await fetch(`${STORAGE_API}/shelby/v1/multipart-uploads`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawAccount: account,
          rawBlobName: file.name,
          rawPartSize: PART_SIZE
        })
      });

      if (!initRes.ok) {
        const text = await initRes.text();
        throw new Error(`Initialization failed: ${text}`);
      }

      const { uploadId, presignedUrls } = await initRes.json();

      // 8️⃣ Upload File Chunks
      console.log("Uploading file parts...");
      for (let i = 0; i < presignedUrls.length; i++) {
        const start = i * PART_SIZE;
        const end = Math.min(start + PART_SIZE, file.size);
        const chunk = file.slice(start, end);

        const partRes = await fetch(presignedUrls[i], {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: await chunk.arrayBuffer()
        });

        if (!partRes.ok) {
          const text = await partRes.text();
          throw new Error(`Part ${i} upload failed: ${text}`);
        }
      }

      // 9️⃣ Complete Multipart Upload
      console.log("Completing multipart upload...");
      const completeRes = await fetch(`${STORAGE_API}/shelby/v1/multipart-uploads/${uploadId}/complete`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rawAccount: account,
          rawBlobName: file.name
        })
      });

      if (!completeRes.ok) {
        const text = await completeRes.text();
        throw new Error(`Completion failed: ${text}`);
      }

      const { blobId } = await completeRes.json();
      console.log("Blob upload success ✓");

      return { success: true, blobId, txHash };

    } catch (err: any) {
      console.error("Shelby upload pipeline error:", err);
      showToast("Upload failed. Please retry.", "error");

      return {
        success: false,
        error: err?.message || "upload_failed"
      };
    }
  }

  const handleUploadAll = async () => {
    if (uploadQueue.length === 0 || isUploading) return;
    
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
        await fetchVaultHistory();
      } else {
        item.status = 'ready';
        showToast(`Upload failed: ${item.file.name}`, 'error');
      }
      setUploadQueue([...uploadQueue]);
    }

    setIsUploading(false);
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
            onCopyLink={handleShowDetails}
            onPreview={handlePreviewFile}
            onDelete={(id) => setFiles(prev => prev.filter(f => f.id !== id))}
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
            
            <div className="window" style={{ marginTop: '10px' }}>
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
          onClose={() => setIsWalletModalOpen(false)}
          onSelectWallet={handleWalletSelect}
        />

        <PermissionModal 
          isOpen={isPermModalOpen}
          onClose={() => {
            setIsPermModalOpen(false);
            setEditingPermIndex(null);
            if (returnToUpload) {
              setIsUploadDetailModalOpen(true);
              setReturnToUpload(false);
            }
          }}
          onApply={handleApplyPermissions}
          initialConfig={(editingPermIndex !== null && uploadQueue[editingPermIndex]) ? uploadQueue[editingPermIndex].permConfig : defaultPerm}
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
