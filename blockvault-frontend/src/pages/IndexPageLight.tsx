import { Shield, Lock, FileCheck, ArrowRight, Wallet, CheckCircle2, FileSearch, Fingerprint, Link2, Cpu, Database, Server, Component, CodeSquare, GitBranch, TerminalSquare, Github } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { MobileWalletModal } from "@/components/auth/MobileWalletModal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FileUpload } from "@/components/file/FileUpload";
import { ReviewPanel } from "@/components/redact/ReviewPanel";
import { FileDetailsPanel } from "@/components/file/FileDetailsPanel";
import '../design-system-light.css';

const typewriterPhrases = [
  { text: "Detect Sensitive Data Automatically", highlight: "Sensitive Data" },
  { text: "Apply Verifiable Document Redactions", highlight: "Verifiable Document Redactions" },
  { text: "Generate Zero-Knowledge Proofs", highlight: "Zero-Knowledge Proofs" },
  { text: "Verify Document Integrity Instantly", highlight: "Integrity Instantly" },
  { text: "Create Tamper-Proof Document Records", highlight: "Tamper-Proof" },
];

const TYPING_SPEED = 60;
const DELETING_SPEED = 40;
const PAUSE_DURATION = 1500;

const TypewriterHeadlineLight = () => {
  const [text, setText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhraseObj = typewriterPhrases[phraseIndex];
    const currentPhrase = currentPhraseObj.text;
    let timer: NodeJS.Timeout;

    if (isDeleting) {
      if (text === "") {
        setIsDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % typewriterPhrases.length);
      } else {
        timer = setTimeout(() => {
          setText(currentPhrase.substring(0, text.length - 1));
        }, DELETING_SPEED);
      }
    } else {
      if (text === currentPhrase) {
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, PAUSE_DURATION);
      } else {
        timer = setTimeout(() => {
          setText(currentPhrase.substring(0, text.length + 1));
        }, TYPING_SPEED);
      }
    }

    return () => clearTimeout(timer);
  }, [text, isDeleting, phraseIndex]);

  const getFormattedText = () => {
    const currentPhraseObj = typewriterPhrases[phraseIndex];
    const highlight = currentPhraseObj.highlight;
    
    const highlightIdx = currentPhraseObj.text.indexOf(highlight);
    
    if (highlightIdx === -1 || text.length <= highlightIdx) {
      return text;
    }
    
    const beforeHighlight = text.substring(0, highlightIdx);
    const inHighlight = text.substring(highlightIdx, Math.min(highlightIdx + highlight.length, text.length));
    const afterHighlight = text.length > highlightIdx + highlight.length 
      ? text.substring(highlightIdx + highlight.length) 
      : "";
    
    return `${beforeHighlight}<span style="color: var(--ui-color-brand); font-weight: 800;">${inHighlight}</span>${afterHighlight}`;
  };

  return (
    <div style={{ marginBottom: 'var(--ui-space-6)', width: '100%', overflow: 'visible' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, minmax(0, 1fr))', gridTemplateRows: 'repeat(1, minmax(0, 1fr))', textAlign: 'center', maxWidth: '800px', margin: '0 auto', width: '100%', alignItems: 'center' }}>
          
          {/* Invisible sizing templates */}
          {typewriterPhrases.map((phraseObj, i) => {
            const t = phraseObj.text;
            const h = phraseObj.highlight;
            const hIdx = t.indexOf(h);
            const beforeH = t.substring(0, hIdx);
            const inH = t.substring(hIdx, hIdx + h.length);
            const afterH = t.substring(hIdx + h.length);
            const html = `${beforeH}<span style="font-weight: 800; color: var(--ui-color-brand);">${inH}</span>${afterH}<span style="display: inline-block; width: 0.5ch;"></span>`;

            return (
              <h1 
                key={i}
                style={{ gridColumnStart: 1, gridRowStart: 1, opacity: 0, userSelect: 'none', pointerEvents: 'none', width: '100%' }}
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: html }}
                className="ui-text-3xl"
              />
            );
          })}

          <div style={{ gridColumnStart: 1, gridRowStart: 1, width: '100%', textAlign: 'center', zIndex: 10 }}>
            <h1 className="ui-text-3xl">
              <span dangerouslySetInnerHTML={{ __html: getFormattedText() }} />
              <span className="ui-animate-in" style={{ color: 'var(--ui-color-brand)', marginLeft: '2px', animation: 'blink 800ms step-end infinite' }}>|</span>
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function IndexPageLight() {
  const navigate = useNavigate();
  const { isAuthenticated, isMobile, connectWallet, loading } = useAuth();
  const [showMobileWallet, setShowMobileWallet] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/files');
    }
  }, [isAuthenticated, navigate]);

  const handleConnect = async () => {
    if (isMobile) {
      setShowMobileWallet(true);
    } else {
      await connectWallet();
    }
  };

  const handleQuickConnect = async () => {
    await handleConnect();
    navigate("/login");
  };

  const features = [
    { icon: Shield, title: "Verifiable Redactions", description: "Mathematically prove document integrity without revealing sensitive text." },
    { icon: Link2, title: "Blockchain Integrity", description: "Immutable storage anchors ensuring documents cannot be secretly altered." },
    { icon: FileCheck, title: "Enterprise Workflows", description: "Designed for scale with multi-party signatures and compliance auditing." },
  ];

  const workflowSteps = [
    { icon: FileSearch, label: "Detect", desc: "AI scans for sensitive PII" },
    { icon: Lock, label: "Redact", desc: "Data is securely masked" },
    { icon: Fingerprint, label: "ZK Proof", desc: "Integrity mathematically verified" },
    { icon: Link2, label: "Anchor", desc: "Stored immutably on-chain" },
  ];

  const mockEntities = [
    { text: "John Doe", entity_type: "PERSON", page: 1, score: 0.98, approved: true, id: "1" },
    { text: "Globex Corporation", entity_type: "ORG", page: 1, score: 0.95, approved: false, id: "2" }
  ];

  const mockFileData = {
    id: "demo_doc_1",
    name: "Confidential_Q3_Earnings.pdf",
    size: 2450000,
    upload_date: new Date().toISOString(),
    encrypted: true,
    redaction_status: "completed",
    proof_status: "verified",
    tx_hash: "0x71f8b9...920d3e",
    ipfs_cid: "QmYwAPJ...c1Gj5z",
    metadata: { redaction_count: 12, compliance_profile: "SOC2 (Strict)" }
  };

  return (
    <div className="theme-atelier-light-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', padding: 'var(--ui-space-6)', display: 'flex', flexDirection: 'column', flex: 1 }}>
        
        {/* Header */}
        <header className="u-flex-between ui-page-header" style={{ marginBottom: 'var(--ui-space-8)' }}>
          <div className="ui-badge ui-badge--success">
            <CheckCircle2 size={14} style={{ marginRight: '4px' }} />
            Mainnet Operational
          </div>
          <ThemeToggle />
        </header>

        {/* SECTION 1: HERO */}
        <section className="u-full-width" style={{ textAlign: 'center', marginBottom: '120px' }}>
          <div className="ui-badge ui-badge--brand" style={{ marginBottom: 'var(--ui-space-5)' }}>BlockVault v2 is Live</div>
          <TypewriterHeadlineLight />
          <p className="ui-page-copy" style={{ margin: '0 auto', marginBottom: 'var(--ui-space-7)' }}>
            Detect sensitive data, apply secure redactions, generate verifiable zero-knowledge proofs, and anchor document integrity on the blockchain.
          </p>
          <div className="ui-page-actions" style={{ justifyContent: 'center' }}>
            <button className="ui-btn ui-btn--primary" onClick={() => navigate("/demo")}>
              Try Demo <ArrowRight size={18} />
            </button>
            <button className="ui-btn ui-btn--secondary" onClick={handleQuickConnect} disabled={loading}>
              <Wallet size={18} />
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </button>
            <a href="https://github.com/chinmayyk/BlockVault" target="_blank" rel="noopener noreferrer">
              <button className="ui-btn ui-btn--ghost">
                <Github size={18} /> GitHub
              </button>
            </a>
          </div>
        </section>

        {/* SECTION 2: WORKFLOW */}
        <section style={{ marginBottom: '120px' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ui-space-7)' }}>
            <span className="ui-eyebrow">The BlockVault Pipeline</span>
          </div>
          <div className="ui-showcase-grid">
            {workflowSteps.map(step => (
              <div key={step.label} className="ui-card ui-card--stat ui-card--interactive" style={{ alignItems: 'center', textAlign: 'center', minHeight: 'auto', padding: 'var(--ui-space-6)' }}>
                <step.icon size={36} color="var(--ui-color-brand)" style={{ marginBottom: 'var(--ui-space-4)' }} />
                <h3 className="ui-card__title" style={{ marginTop: 0 }}>{step.label}</h3>
                <p className="ui-card__copy" style={{ fontSize: 'var(--ui-text-sm)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: FEATURES */}
        <section style={{ marginBottom: '120px' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ui-space-7)' }}>
            <h2 style={{ marginBottom: 'var(--ui-space-4)' }}>Enterprise-Grade Security</h2>
            <p className="ui-page-copy" style={{ margin: '0 auto' }}>Designed for modern compliance architectures and decentralized trust.</p>
          </div>
          <div className="u-grid-3">
            {features.map(feature => (
              <div key={feature.title} className="ui-card ui-card--interactive" style={{ padding: 'var(--ui-space-6)' }}>
                <feature.icon size={28} color="var(--ui-color-brand)" style={{ marginBottom: 'var(--ui-space-4)' }} />
                <h3 className="ui-card__title">{feature.title}</h3>
                <p className="ui-card__copy">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: SHOWCASES */}
        <section style={{ marginBottom: '120px' }}>
          <div style={{ textAlign: 'center', marginBottom: 'var(--ui-space-8)' }}>
            <h2>How BlockVault Protects Your Documents</h2>
          </div>
          
          <div className="u-stack-lg" style={{ gap: '120px' }}>
            {[
              {
                step: "Phase 1", title: "Upload & Analyze", desc: "Upload any document and BlockVault automatically scans for sensitive information such as names, IDs, and financial data.",
                mockup: <FileUpload inline={true} onClose={() => {}} />
              },
              {
                step: "Phase 2", title: "Detect Sensitive Data", desc: "AI-powered detection highlights sensitive entities in your document that may require redaction.",
                mockup: <ReviewPanel entities={mockEntities as any} currentIndex={0} onAccept={() => {}} onSkip={() => {}} onPrevious={() => {}} onNext={() => {}} onEdit={() => {}} onFinish={() => {}} />
              },
              {
                step: "Phase 3", title: "Redact & Prove", desc: "Apply secure redactions while generating a Zero-Knowledge Proof that verifies document integrity without exposing hidden text.",
                mockup: <FileDetailsPanel file={{...mockFileData, proof_status: 'verified'}} onClose={() => {}} />
              }
            ].map((item, index) => (
              <div key={item.step} className="u-grid-2" style={{ alignItems: 'center' }}>
                <div style={{ order: index % 2 === 0 ? 1 : 2 }}>
                  <span className="ui-badge ui-badge--info" style={{ marginBottom: 'var(--ui-space-4)' }}>{item.step}</span>
                  <h2>{item.title}</h2>
                  <p className="ui-page-copy" style={{ marginTop: 'var(--ui-space-4)' }}>{item.desc}</p>
                </div>
                <div className="ui-card" style={{ order: index % 2 === 0 ? 2 : 1, padding: 0, overflow: 'hidden', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ui-color-surface-2)' }}>
                   <div style={{ transform: 'scale(0.85)', width: '100%', height: '100%' }}>
                     {item.mockup}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: ARCHITECTURE */}
        <section style={{ marginBottom: '120px' }}>
           <div className="ui-card" style={{ padding: 'var(--ui-space-8)' }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--ui-space-7)' }}>
                <h2>Security Architecture</h2>
                <p className="ui-page-copy" style={{ margin: '0 auto', marginTop: 'var(--ui-space-2)' }}>A defense-in-depth approach to document privacy.</p>
              </div>
              <div className="u-grid-3">
                 <div style={{ textAlign: 'center' }}>
                    <Lock size={32} color="var(--ui-color-info)" style={{ margin: '0 auto', marginBottom: 'var(--ui-space-4)' }} />
                    <h3 className="ui-card__title">E2E Encryption</h3>
                    <p className="ui-card__copy" style={{ margin: '0 auto', marginTop: 'var(--ui-space-2)' }}>AES-GCM encryption applied client-side.</p>
                 </div>
                 <div style={{ textAlign: 'center' }}>
                    <Cpu size={32} color="var(--ui-color-brand)" style={{ margin: '0 auto', marginBottom: 'var(--ui-space-4)' }} />
                    <h3 className="ui-card__title">Zero-Knowledge</h3>
                    <p className="ui-card__copy" style={{ margin: '0 auto', marginTop: 'var(--ui-space-2)' }}>zk-SNARKs generate local proofs flawlessly.</p>
                 </div>
                 <div style={{ textAlign: 'center' }}>
                    <Database size={32} color="var(--ui-color-success)" style={{ margin: '0 auto', marginBottom: 'var(--ui-space-4)' }} />
                    <h3 className="ui-card__title">On-Chain Anchors</h3>
                    <p className="ui-card__copy" style={{ margin: '0 auto', marginTop: 'var(--ui-space-2)' }}>Immutable timeline via smart contracts.</p>
                 </div>
              </div>
           </div>
        </section>
        
        {/* FOOTER */}
        <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: 'var(--ui-space-8)' }}>
          <a href="https://madewithloveinindia.org" target="_blank" rel="noreferrer noopener" className="ui-badge" style={{ padding: 'var(--ui-space-3) var(--ui-space-5)', borderRadius: '99px', background: 'transparent' }}>
             <span className="ui-eyebrow" style={{ marginRight: 'var(--ui-space-2)' }}>Made With</span> 
             <span style={{ color: '#eb4526', fontSize: 'var(--ui-text-lg)', margin: '0 var(--ui-space-1)' }}>♥</span>
             <span style={{ fontWeight: 800, fontSize: 'var(--ui-text-sm)', color: 'var(--ui-color-text)' }}>in India</span>
          </a>
        </div>
      </div>
      
      {showMobileWallet && <MobileWalletModal onClose={() => setShowMobileWallet(false)} />}
    </div>
  );
}
