import React, { useEffect, useRef, useState } from 'react';
import logoGlow from '../assets/logo_glow.png';
import './Intro.css';

interface IntroProps {
  onComplete: () => void;
}

const steps = [
  { pct: 8,   tag: 'BOOT',  msg: 'ShelbyOS Web3 Kernel v1.2',               barDuration: 400  },
  { pct: 18,  tag: 'INIT',  msg: 'Connecting to Aptos Mainnet RPC...',      barDuration: 700  },
  { pct: 32,  tag: 'SYNC',  msg: 'Synchronizing ShelbyNet file index...',   barDuration: 850  },
  { pct: 45,  tag: 'AUTH',  msg: 'Initializing Wallet Adapter...',           barDuration: 600  },
  { pct: 58,  tag: 'OK',    msg: 'Aptos blockchain connection established.', barDuration: 550  },
  { pct: 70,  tag: 'SECR',  msg: 'Verifying Smart Contract permissions...', barDuration: 750  },
  { pct: 82,  tag: 'BLOC',  msg: 'Fetching on-chain transaction logs...',   barDuration: 800  },
  { pct: 92,  tag: 'LOAD',  msg: 'Loading Decentralized Vault UI...',       barDuration: 500  },
  { pct: 100, tag: 'READY', msg: 'ShelbyOS Web3 environment ready.',         barDuration: 900  },
];

const Intro: React.FC<IntroProps> = ({ onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const termLogRef = useRef<HTMLDivElement>(null);
  const barFillRef = useRef<HTMLDivElement>(null);
  const barPctRef = useRef<HTMLDivElement>(null);
  const barTrackRef = useRef<HTMLDivElement>(null);
  const bootWrapperRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const exitBlackRef = useRef<HTMLDivElement>(null);
  const scanFlashRef = useRef<HTMLDivElement>(null);

  const [logs, setLogs] = useState<{tag: string, msg: string, time: string, typed: string}[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [bootReady, setBootReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [statusText, setStatusText] = useState('Initializing Web3 Kernel...');
  const [statusVisibleRows, setStatusVisibleRows] = useState<string[]>([]);
  const [statusValues, setStatusValues] = useState<Record<string, string>>({
    nodes: '—',
    rpc: '—',
    proto: '—',
    chain: '—',
    enc: '—'
  });

  const mouseRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (bootWrapperRef.current && !isExiting) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const rotX = -(dy / cy) * 4; // Max 4 deg tilt
        const rotY = (dx / cx) * 4;
        bootWrapperRef.current.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02, 1.02, 1.02)`;
      }
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, [isExiting]);

  const handleSkip = () => {
    if (bootReady || isExiting) return;
    setBootReady(true);
    setCurrentStep(steps.length - 1);
    setStatusText('Sequence Skipped. Ready.');
    if (barFillRef.current) barFillRef.current.style.width = '100%';
    if (barPctRef.current) barPctRef.current.textContent = '100%';
    showDiagnostics();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [bootReady, isExiting]);

  // --- Network Canvas Logic ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W: number, H: number;
    // Base density on window size, but calculate dynamically in resize()
    let NODE_COUNT = 52; 
    const CONNECT_DIST = 180;
    const NODE_SPEED = 0.22;

    const NODE_COLORS = [
      { r: 62, g: 196, b: 255 },
      { r: 46, g: 119, b: 208 },
      { r: 110, g: 196, b: 255 },
      { r: 85, g: 239, b: 196 },
    ];

    let nodes: any[] = [];
    let packets: any[] = [];
    let lastPacketSpawn = 0;
    let startTime: number | null = null;

    const buildNodes = () => {
      nodes = Array.from({ length: NODE_COUNT }, () => {
        const c = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)];
        const isBg = Math.random() > 0.4; // 60% are background/distant nodes
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          // Parallax depth: Foreground (1) moves faster and is larger. Background (0.3) moves slower.
          z: isBg ? 0.2 + Math.random() * 0.3 : 0.8 + Math.random() * 0.5,
          vx: (Math.random() - 0.5) * 2 * NODE_SPEED,
          vy: (Math.random() - 0.5) * 2 * NODE_SPEED,
          r: isBg ? 0.8 + Math.random() : 2.5 + Math.random() * 2,
          col: c,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.005 + Math.random() * 0.015,
          active: false,
          activateAt: 400 + Math.random() * 4600,
        };
      });
      packets = [];
    };

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      // Recalculate node count based on area (denser than before)
      NODE_COUNT = Math.floor((W * H) / 10000);
      buildNodes();
    };

    const draw = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      ctx.clearRect(0, 0, W, H);

      nodes.forEach(n => { if (!n.active && elapsed > n.activateAt) n.active = true; });

      nodes.forEach(n => {
        if (!n.active) return;
        // Move according to depth (parallax)
        n.x += n.vx * n.z; 
        n.y += n.vy * n.z;
        if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
        n.phase += n.pulseSpeed;
      });

      const activeNodes = nodes.filter(n => n.active);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < activeNodes.length; i++) {
        for (let j = i + 1; j < activeNodes.length; j++) {
          const a = activeNodes[i], b = activeNodes[j];
          // Only connect nodes somewhat on the same depth plane for clearer visual hierarchy
          if (Math.abs(a.z - b.z) > 0.4) continue;
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > CONNECT_DIST) continue;
          
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          // Opacity scaled by distance AND depth of nodes
          const depthAvg = (a.z + b.z) / 2;
          ctx.strokeStyle = `rgba(62,196,255,${(1 - dist / CONNECT_DIST) * 0.25 * depthAvg})`;
          ctx.stroke();
        }
      }

      if (ts - lastPacketSpawn > 820 && activeNodes.length > 4) {
        lastPacketSpawn = ts;
        const a = activeNodes[Math.floor(Math.random() * activeNodes.length)];
        const b = activeNodes[Math.floor(Math.random() * activeNodes.length)];
        if (a !== b && Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2) < CONNECT_DIST) {
          packets.push({ a, b, t: 0, speed: 0.008 + Math.random() * 0.008 });
        }
      }

      packets = packets.filter(p => p.t <= 1);
      packets.forEach(p => {
        p.t += p.speed;
        const x = p.a.x + (p.b.x - p.a.x) * p.t;
        const y = p.a.y + (p.b.y - p.a.y) * p.t;
        const fade = Math.sin(p.t * Math.PI);
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,230,255,${0.9 * fade})`;
        ctx.fill();
      });

      // Interactive mouse connections
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      activeNodes.forEach(n => {
        const dx = n.x - mx;
        const dy = n.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(85,239,196,${(1 - dist / 180) * 0.35})`;
          ctx.stroke();
          
          if (dist < 100) {
            n.x += dx * 0.015;
            n.y += dy * 0.015;
          }
        }
      });


      activeNodes.forEach(n => {
        const pulse = 0.4 + 0.6 * Math.sin(n.phase);
        const { r, g, b } = n.col;
        
        // Draw glow for foreground nodes
        if (n.z > 0.6) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r},${g},${b},${0.15 * pulse * n.z})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        // Distant nodes are dimmer
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.5 + 0.5 * pulse) * n.z})`;
        ctx.fill();
      });

      requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    const animId = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // --- Audio Engine ---
  const playSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const master = audioCtx.createGain();
      master.gain.setValueAtTime(0, audioCtx.currentTime);
      master.gain.linearRampToValueAtTime(0.55, audioCtx.currentTime + 0.04);
      master.connect(audioCtx.destination);
      const now = audioCtx.currentTime;

      const env = (g: GainNode, peak: number, atk: number, hold: number, rel: number) => {
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + atk);
        g.gain.setValueAtTime(peak, now + atk + hold);
        g.gain.exponentialRampToValueAtTime(0.0001, now + atk + hold + rel);
      };

      // Sub
      const sub = audioCtx.createOscillator();
      const subG = audioCtx.createGain();
      sub.frequency.setValueAtTime(60, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 0.18);
      env(subG, 0.5, 0.005, 0.04, 0.20);
      sub.connect(subG); subG.connect(master);
      sub.start(now); sub.stop(now + 0.45);

      // Tonal
      [220, 330, 275].forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        env(g, 0.2, 0.1, 0.3, 0.7);
        osc.connect(g); g.connect(master);
        osc.start(now + i * 0.05); osc.stop(now + 1.5);
      });
    } catch(e) {}
  };

  // --- Boot Sequence Logic ---
  useEffect(() => {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    
    // Add new log entry
    setLogs(prev => [...prev, { tag: step.tag, msg: step.msg, time: timestamp, typed: '' }]);

    let typeIdx = 0;
    const typeTimer = setInterval(() => {
      setLogs(prev => {
        const last = [...prev];
        const current = last[last.length - 1];
        if (typeIdx < step.msg.length) {
          current.typed += step.msg[typeIdx++];
          return last;
        } else {
          clearInterval(typeTimer);
          // Typing done, start bar animation
          setTimeout(() => startBarAnim(step), 120);
          return last;
        }
      });
    }, 28);

    const startBarAnim = (step: any) => {
      const startTime = performance.now();
      const initialPct = currentStep === 0 ? 0 : steps[currentStep-1].pct;
      
      const barTick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / step.barDuration, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        const val = initialPct + (step.pct - initialPct) * ease;
        
        if (barFillRef.current) barFillRef.current.style.width = val + '%';
        if (barPctRef.current) barPctRef.current.textContent = Math.round(val) + '%';
        if (barTrackRef.current) barTrackRef.current.style.setProperty('--bar-edge', val + '%');

        if (t < 1) {
          requestAnimationFrame(barTick);
        } else {
          if (step.pct === 100) {
            playSound();
            setBootReady(true);
            setStatusText('Web3 Environment Ready. Welcome back.');
            showDiagnostics();
          } else {
            setTimeout(() => setCurrentStep(prev => prev + 1), 420);
          }
        }
      };
      requestAnimationFrame(barTick);
    };

    return () => clearInterval(typeTimer);
  }, [currentStep]);

  const showDiagnostics = () => {
    const rows = ['sr-net', 'sr-nodes', 'sr-rpc', 'sr-proto', 'sr-chain', 'sr-enc'];
    rows.forEach((r, i) => {
      setTimeout(() => setStatusVisibleRows(prev => [...prev, r]), i * 180);
    });

    setTimeout(() => setStatusValues(prev => ({...prev, nodes: 'Aptos Mainnet'})), 500);
    setTimeout(() => setStatusValues(prev => ({...prev, rpc: '42 ms'})), 800);
    setTimeout(() => setStatusValues(prev => ({...prev, proto: 'ShelbyNet v2.0'})), 1100);
    setTimeout(() => setStatusValues(prev => ({...prev, chain: 'CONNECTED'})), 1400);
    setTimeout(() => setStatusValues(prev => ({...prev, enc: 'Ed25519 / AES'})), 1700);
  };

  const handleEnter = () => {
    setIsExiting(true);
    const rect = enterBtn?.current?.getBoundingClientRect();
    if (!rect) return;

    // Transition stages
    setTimeout(() => {
      if (overlayRef.current) overlayRef.current.style.opacity = '1';
    }, 200);

    setTimeout(() => {
      if (exitBlackRef.current) {
        exitBlackRef.current.style.opacity = '1';
      }
    }, 820);

    setTimeout(() => onComplete(), 1100);
  };

  const enterBtn = useRef<HTMLButtonElement>(null);

  return (
    <div className="intro-container" onDoubleClick={handleSkip}>
      <canvas id="networkCanvas" ref={canvasRef} className={isExiting ? 'exiting' : ''}></canvas>
      <div className="intro-grain"></div>
      <div id="transitionOverlay" ref={overlayRef}></div>
      <div id="exitBlack" ref={exitBlackRef}></div>
      <div id="enterRipple" ref={rippleRef}></div>
      <div id="scanFlash" ref={scanFlashRef}></div>

      <div className={`boot-wrapper ${isExiting ? 'exiting' : ''}`} ref={bootWrapperRef}>
        <div className="logo-panel">
          <img
            className="shelby-logo"
            src={logoGlow}
            alt="Shelby OS Logo"
            draggable="false"
          />
          <div className="os-title">Shelby OS</div>
          <div className="os-subtitle">The Decentralized Web3 Operating System</div>
        </div>

        <div className={`progress-panel intro-panel ${currentStep > 0 ? 'boot-visible' : ''}`}>
          <div className="progress-label">System Initialization</div>
          <div className="xp-bar-track" ref={barTrackRef}>
            <div className="xp-bar-fill" ref={barFillRef}>
              <div className="bar-shimmer"></div>
            </div>
          </div>
          <div className="bar-pct" ref={barPctRef}>0%</div>
        </div>

        <div className={`terminal-panel intro-panel ${currentStep > 1 ? 'boot-visible' : ''}`}>
          <div className="terminal-titlebar">SHELBY OS — WEB3 BOOT LOG v1.2</div>
          <div className="terminal-body" ref={termLogRef}>
            {logs.map((log, i) => (
              <div key={i} className="log-line">
                <span className="log-time">{log.time}</span>
                <span className={`log-tag ${log.tag.toLowerCase()}`}>[{log.tag}]</span>
                <span className="log-msg">{log.typed}</span>
              </div>
            ))}
            <span className="intro-cursor"></span>
          </div>
        </div>

        <div className={`status-panel intro-panel ${currentStep > 2 ? 'boot-visible' : ''}`} id="statusPanel">
          <div className="status-header">On-Chain Diagnostics</div>
          <div className="status-grid">
            <div className={`status-row ${statusVisibleRows.includes('sr-net') ? 'visible' : ''}`} id="sr-net">
              <span className="status-key">ShelbyNet Status</span>
              <span className="status-val green" id="sv-net">
                <span className="pulse-dot"></span>ONLINE
              </span>
            </div>
            <div className={`status-row ${statusVisibleRows.includes('sr-nodes') ? 'visible' : ''}`} id="sr-nodes">
              <span className="status-key">Active Network</span>
              <span className="status-val cyan">{statusValues.nodes}</span>
            </div>
            <div className={`status-row ${statusVisibleRows.includes('sr-rpc') ? 'visible' : ''}`} id="sr-rpc">
              <span className="status-key">RPC Latency</span>
              <span className={`status-val yellow ${statusValues.rpc === '—' ? 'resolving' : ''}`}>{statusValues.rpc}</span>
            </div>
            <div className={`status-row ${statusVisibleRows.includes('sr-proto') ? 'visible' : ''}`} id="sr-proto">
              <span className="status-key">Protocol Version</span>
              <span className="status-val mint">{statusValues.proto}</span>
            </div>
            <div className={`status-row ${statusVisibleRows.includes('sr-chain') ? 'visible' : ''}`} id="sr-chain">
              <span className="status-key">Chain Sync</span>
              <span className="status-val cyan">{statusValues.chain}</span>
            </div>
            <div className={`status-row ${statusVisibleRows.includes('sr-enc') ? 'visible' : ''}`} id="sr-enc">
              <span className="status-key">Encryption</span>
              <span className="status-val mint">{statusValues.enc}</span>
            </div>
          </div>
        </div>

        <div className={`enter-panel intro-panel ${bootReady ? 'boot-visible' : ''}`}>
          <div className="status-text">{statusText}</div>
          {bootReady && (
            <div className="enter-btn-wrapper">
              <button className="enter-btn" ref={enterBtn} onClick={handleEnter}>
                <div className="enter-btn-inner">
                  <span>Enter Shelby OS</span>
                  <span className="btn-arrow">→</span>
                </div>
              </button>
              <div className="creator-credit">
                Created by: <a href="https://x.com/MrSamweb3" target="_blank" rel="noopener noreferrer">0xPamanSam</a>
              </div>
            </div>
          )}
        </div>
      </div>

      {!bootReady && (
        <div className="skip-hint" onClick={handleSkip}>
          Press ESC or Double Click to Skip
        </div>
      )}

      <div className="intro-copyright">Copyright © 2026 Shelby Systems Corp. All rights reserved.</div>
      <div className="xp-taskbar"></div>
    </div>
  );
};

export default Intro;
