import { Shield, Lock, FileCheck, ArrowRight, Wallet, CheckCircle2, FileSearch, Fingerprint, Link2, Cpu, Database, Server, Component, CodeSquare, GitBranch, TerminalSquare, Github, Upload, X, File, AlertCircle, Eye, Scissors, FileText, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { MobileWalletModal } from "@/components/auth/MobileWalletModal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@/components/file/FileUpload";
import { ReviewPanel } from "@/components/redact/ReviewPanel";
import { FileDetailsPanel } from "@/components/file/FileDetailsPanel";
import { useTheme } from "@/contexts/ThemeContext";
import IndexPageLight from "./IndexPageLight";

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

const TypewriterHeadline = () => {
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

  // Create formatted HTML text based on currently typed characters
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
    
    return `${beforeHighlight}<span class="font-extrabold text-primary text-glow-subtle">${inHighlight}</span>${afterHighlight}`;
  };

  return (
    <div className="mb-10 w-full px-4 overflow-visible">
      <div className="flex flex-col items-center justify-center w-full text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.2] md:leading-[1.2]">
        
        {/* We use a CSS Grid where all cells overlap. 
            All phrases are rendered invisibly to guarantee the grid expands 
            to the exact max height/width required on ANY viewport, supporting multi-line wraps perfectly. 
            The actual typing text is placed on top. */}
        <div className="grid grid-cols-1 grid-rows-1 text-center max-w-4xl mx-auto w-full items-center">
          
          {/* 1. Stack all phrases invisibly for perfect viewport dimensions */}
          {typewriterPhrases.map((phraseObj, i) => {
            const t = phraseObj.text;
            const h = phraseObj.highlight;
            const hIdx = t.indexOf(h);
            const beforeH = t.substring(0, hIdx);
            const inH = t.substring(hIdx, hIdx + h.length);
            const afterH = t.substring(hIdx + h.length);
            const html = `${beforeH}<span class="font-extrabold text-primary">${inH}</span>${afterH}<span class="inline-block w-[0.5ch]"></span>`;

            return (
              <div 
                key={i}
                className="col-start-1 row-start-1 opacity-0 select-none pointer-events-none w-full"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          })}

          {/* 2. Render the live typing text */}
          <div className="col-start-1 row-start-1 w-full text-center z-10 text-foreground">
            <span className="inline">
              <span dangerouslySetInnerHTML={{ __html: getFormattedText() }} />
              <span className="animate-blink font-light text-primary -translate-y-[2px] ml-[2px]">|</span>
            </span>
          </div>
          
        </div>
      </div>
    </div>
  );
};

const IndexPage = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { isAuthenticated, isMobile, connectWallet, login, loading } = useAuth();
  const [showMobileWallet, setShowMobileWallet] = useState(false);

  // Redirect to files if already authenticated
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

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.view-fade-in').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const goToLogin = () => {
    navigate('/login');
  };

  const features = [
    {
      icon: Shield,
      title: "Verifiable Redactions",
      description: "Mathematically prove document integrity without revealing sensitive text.",
    },
    {
      icon: Link2,
      title: "Blockchain Integrity",
      description: "Immutable storage anchors ensuring documents cannot be secretly altered.",
    },
    {
      icon: FileCheck,
      title: "Enterprise Workflows",
      description: "Designed for scale with multi-party signatures and compliance auditing.",
    },
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
    metadata: {
      redaction_count: 12,
      compliance_profile: "SOC2 (Strict)"
    }
  };

  if (theme === 'light') {
    return <IndexPageLight />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex min-h-[calc(100vh-3rem)] flex-col px-6 pt-8 pb-16">
        
        {/* Header / Nav */}
        <div className="flex justify-between items-center mb-6 z-10 relative">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm shadow-sm opacity-90 hover:opacity-100 transition-opacity cursor-default">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
              <CheckCircle2 className="w-4 h-4 text-green-400 relative z-10" />
            </div>
            <span className="text-sm font-medium text-green-400">Mainnet Operational</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex-1 space-y-32">
          
          {/* SECTION 1: HERO */}
          <section className="relative overflow-visible pb-12 pt-20">
            <div className="absolute inset-0 top-[-20%] -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background"></div>
            <div className="px-6">
              <div className="max-w-4xl mx-auto text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-6 text-sm font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  BlockVault v2 is Live
                </div>

                <TypewriterHeadline />
                <p className="text-lg md:text-xl text-slate-600 dark:text-muted-foreground/80 mb-12 leading-relaxed max-w-2xl mx-auto font-medium">
                  Detect sensitive data, apply secure redactions, generate verifiable zero-knowledge proofs, and anchor document integrity on the blockchain.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Button size="lg" className="h-14 px-10 text-lg font-bold gap-2 shadow-[0_0_20px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.4)] transition-all hover:-translate-y-1 w-full sm:w-auto rounded-full" onClick={() => navigate("/demo")}>
                    Try Demo
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold gap-2 border-white/10 bg-white/5 backdrop-blur-md rounded-full hover:bg-white/10 transition-colors w-full sm:w-auto" onClick={handleQuickConnect} disabled={loading}>
                    <Wallet className="h-5 w-5" />
                    Connect Wallet
                  </Button>
                  <a href="https://github.com/chinmayyk/BlockVault" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                    <Button size="lg" variant="ghost" className="h-14 px-6 text-lg w-full">
                      <Github className="h-5 w-5 mr-2" />
                      GitHub
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: VISUAL DEMO WORKFLOW */}
          <section className="py-24 border-y border-white/5 bg-card/10 backdrop-blur-md relative overflow-hidden view-fade-in">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
            <div className="container px-6 mx-auto">
              <div className="text-center mb-16">
                <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-muted-foreground/60">The BlockVault Pipeline</h2>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 max-w-6xl mx-auto">
                {workflowSteps.map((step, index) => (
                  <div key={step.label} className="flex flex-col items-center flex-1 relative group w-full md:w-auto">
                    <div className="w-20 h-20 rounded-[2rem] bg-card border border-white/5 flex items-center justify-center mb-6 shadow-2xl group-hover:border-primary/30 group-hover:bg-white/[0.02] group-hover:scale-105 transition-all duration-500 z-10 relative">
                      <step.icon className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors duration-500" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2 text-center">{step.label}</h3>
                    <p className="text-sm text-muted-foreground/70 text-center px-4 leading-relaxed">{step.desc}</p>
                    
                    {/* Connecting Line */}
                    {index < workflowSteps.length - 1 && (
                      <div className="hidden md:block absolute top-10 left-[70%] w-[60%] h-[1px] bg-gradient-to-r from-white/10 to-transparent -z-10">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 4: HOW BLOCKVAULT PROTECTS YOUR DOCUMENTS */}
          <section className="py-32 view-fade-in relative z-10 w-full overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-24">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight">How BlockVault Protects Your Documents</h2>
              </div>
              
              <div className="flex flex-col gap-24 lg:gap-32 w-full">
                {[
                  {
                    step: "Step 1",
                    title: "Upload & Analyze",
                    description: "Upload any document and BlockVault automatically scans for sensitive information such as names, IDs, and financial data.",
                    mockup: (
                      <div className="flex items-center justify-center h-full w-full pointer-events-none select-none pb-8 sm:pb-0 overflow-hidden relative">
                        <div className="w-[120%] h-[120%] sm:w-full sm:h-full flex items-center justify-center scale-[0.6] sm:scale-[0.85] origin-center sm:origin-center bg-transparent">
                          <FileUpload inline={true} onClose={() => {}} />
                        </div>
                      </div>
                    )
                  },
                  {
                    step: "Step 2",
                    title: "Detect Sensitive Data",
                    description: "AI-powered detection highlights sensitive entities in your document that may require redaction.",
                    mockup: (
                      <div className="flex flex-col h-full w-full pointer-events-none select-none bg-background shadow-inner items-center justify-center overflow-hidden">
                        <div className="w-full h-full sm:scale-90 origin-top bg-card border border-border sm:rounded-2xl shadow-2xl mt-0 sm:mt-10 overflow-hidden">
                          <ReviewPanel 
                              entities={mockEntities as any} 
                              currentIndex={0} 
                              onAccept={() => {}} 
                              onSkip={() => {}} 
                              onPrevious={() => {}} 
                              onNext={() => {}} 
                              onEdit={() => {}} 
                              onFinish={() => {}} 
                          />
                        </div>
                      </div>
                    )
                  },
                  {
                    step: "Step 3",
                    title: "Redact & Prove",
                    description: "Apply secure redactions while generating a Zero-Knowledge Proof that verifies document integrity without exposing hidden text.",
                    mockup: (
                      <div className="flex flex-col items-center justify-center h-full w-full pointer-events-none select-none overflow-hidden">
                         <div className="w-full h-full scale-[0.80] sm:scale-95 origin-top sm:origin-top bg-card overflow-hidden">
                           <FileDetailsPanel file={{...mockFileData, proof_status: 'verified'}} onClose={() => {}} />
                         </div>
                      </div>
                    )
                  },
                  {
                    step: "Step 4",
                    title: "Anchor on Blockchain",
                    description: "The document hash and proof are anchored on blockchain, creating a permanent verifiable record of authenticity.",
                    mockup: (
                      <div className="flex items-center justify-center h-full w-full pointer-events-none select-none overflow-hidden pb-10 sm:pb-0">
                         <div className="w-full h-full scale-[0.80] sm:scale-95 origin-bottom sm:origin-center bg-card overflow-hidden flex flex-col justify-end">
                           <FileDetailsPanel file={mockFileData} onClose={() => {}} />
                         </div>
                      </div>
                    )
                  }
                ].map((item, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <div key={item.step} className={`flex flex-col md:flex-row gap-8 md:gap-16 items-center ${isEven ? '' : 'md:flex-row-reverse'} view-fade-in group`}>
                      <div className="flex-1 space-y-6 w-full max-w-xl mx-auto md:mx-0">
                        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold tracking-wide border border-primary/20 shadow-sm">
                          {item.step}
                        </div>
                        <h3 className="text-3xl md:text-4xl font-extrabold tracking-tight">{item.title}</h3>
                        <p className="text-xl text-muted-foreground leading-relaxed font-medium">{item.description}</p>
                      </div>
                      
                      <div className="flex-1 w-full max-w-xl mx-auto md:mx-0">
                        {/* Browser Frame */}
                        <div className="relative rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/10 bg-card shadow-2xl transition-all duration-700 group-hover:-translate-y-2 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] group-hover:border-white/20">
                          <div className="h-12 bg-white/5 border-b border-white/5 flex items-center px-5 gap-2 backdrop-blur-md">
                            <div className="flex gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-500/80 shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                              <div className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
                              <div className="w-3 h-3 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                            </div>
                          </div>
                          <div className="h-[250px] sm:h-[300px] md:h-[350px] bg-background relative overflow-hidden flex items-center justify-center">
                            {/* Subtle background grid pattern */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                            {item.mockup}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* SECTION 3: FEATURE HIGHLIGHTS */}
          <section className="py-24 view-fade-in">
            <div className="px-6">
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Enterprise-Grade Security</h2>
                <p className="text-muted-foreground/80 max-w-3xl mx-auto text-xl font-medium">
                  Designed for modern compliance architectures and decentralized trust.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
                {features.map((feature) => (
                  <Card key={feature.title} className="p-10 hover:border-white/20 transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:-translate-y-2 bg-gradient-to-b from-card to-card/50 border-white/5 rounded-[2rem]">
                    <div className="flex flex-col items-start text-left">
                      <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-8 border border-white/5 shadow-inner">
                        <feature.icon className="h-8 w-8 text-primary/80" />
                      </div>
                      <h3 className="text-2xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                      <p className="text-lg text-muted-foreground/70 leading-relaxed font-medium">{feature.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 6: SECURITY ARCHITECTURE */}
          <section className="py-32 view-fade-in">
            <div className="max-w-6xl mx-auto px-6 rounded-[3rem] bg-card/10 border border-white/5 py-24 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
              <div className="relative z-10">
                <div className="text-center mb-20">
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Security Architecture</h2>
                  <p className="text-muted-foreground/80 text-xl font-medium">A defense-in-depth approach to document privacy.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
                  <div className="text-center group">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-blue-500/10 flex items-center justify-center mb-8 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                      <Lock className="w-10 h-10 text-blue-500" />
                    </div>
                    <h4 className="text-2xl font-bold mb-4 tracking-tight">E2E Encryption</h4>
                    <p className="text-lg text-muted-foreground/70 leading-relaxed font-medium">
                      <strong className="text-foreground font-semibold">AES-GCM</strong> encryption applied client-side before uploading. The server never sees your unencrypted data.
                    </p>
                  </div>
                  <div className="text-center group">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-purple-500/10 flex items-center justify-center mb-8 border border-purple-500/20 group-hover:scale-110 transition-transform duration-500">
                      <Cpu className="w-10 h-10 text-purple-500" />
                    </div>
                    <h4 className="text-2xl font-bold mb-4 tracking-tight">Zero-Knowledge</h4>
                    <p className="text-lg text-muted-foreground/70 leading-relaxed font-medium">
                      <strong className="text-foreground font-semibold">zk-SNARKs</strong> generate local proofs that redactions were applied properly without leaking hidden text.
                    </p>
                  </div>
                  <div className="text-center group">
                    <div className="mx-auto w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-8 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                      <Database className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h4 className="text-2xl font-bold mb-4 tracking-tight">On-Chain Anchors</h4>
                    <p className="text-lg text-muted-foreground/70 leading-relaxed font-medium">
                      <strong className="text-foreground font-semibold">Keccak256</strong> hashes of the file and proof are written to smart contracts for an immutable timeline.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: TECH STACK */}
          <section className="py-24 text-center view-fade-in">
            <div className="max-w-4xl mx-auto px-6">
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground/40 mb-12">Powered by Modern Technologies</p>
              <div className="flex flex-wrap justify-center gap-4 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                {[
                  { icon: CodeSquare, label: "React" },
                  { icon: TerminalSquare, label: "TypeScript" },
                  { icon: Server, label: "FastAPI" },
                  { icon: Database, label: "IPFS" },
                  { icon: Component, label: "Circom" },
                  { icon: GitBranch, label: "Solidity" }
                ].map((tech) => (
                  <div key={tech.label} className="flex items-center gap-3 px-6 py-3 border border-white/5 rounded-full bg-white/[0.02] shadow-sm text-sm font-semibold">
                    <tech.icon className="w-4 h-4"/> {tech.label}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 5 & 8: FINAL CTA & DEMO CALLOUT */}
          <section className="py-32 view-fade-in">
            <div className="relative overflow-hidden rounded-[4rem] bg-gradient-to-b from-primary/5 to-primary/[0.08] border border-white/10 mx-6 shadow-3xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50"></div>
              <div className="relative px-6 py-24 z-10">
                <div className="max-w-4xl mx-auto text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-primary/10 text-primary mb-10 shadow-2xl border border-white/10 text-4xl">
                    ⚡
                  </div>
                  <h2 className="text-5xl md:text-7xl font-bold mb-10 tracking-tighter">
                    Ready to secure <br className="md:hidden" /> your documents?
                  </h2>
                  <p className="text-xl md:text-2xl text-muted-foreground/80 mb-14 leading-relaxed max-w-3xl mx-auto font-medium">
                    Experience the full power of BlockVault instantly. Our interactive demo requires <strong className="text-foreground font-semibold">no setup</strong> and zero commitments.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-6">
                    <Button
                      size="lg"
                      onClick={() => navigate("/demo")}
                      className="h-16 px-12 text-xl font-bold gap-3 shadow-[0_0_30px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.4)] hover:-translate-y-1 transition-all w-full sm:w-auto rounded-full"
                    >
                      Launch Demo Now
                      <ArrowRight className="h-6 w-6" />
                    </Button>
                    {!isAuthenticated && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleQuickConnect}
                        disabled={loading}
                        className="h-16 px-10 text-xl font-semibold gap-3 border-white/10 bg-white/5 backdrop-blur-md rounded-full hover:bg-white/10 transition-colors w-full sm:w-auto"
                      >
                        <Wallet className="h-6 w-6" />
                        {loading ? 'Connecting...' : 'Connect Wallet'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-20 flex flex-col items-center justify-center border-t border-border/50 pt-10">
          <a
            href="https://madewithloveinindia.org"
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-2 rounded-full border border-border/50 bg-card/40 px-5 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
          >
            <span className="uppercase tracking-[0.24em] text-[0.65rem] text-muted-foreground text-opacity-80">
              Made With
            </span>
            <span
              className="text-lg leading-none text-rose-500 transition-transform group-hover:scale-110 group-hover:text-rose-400"
              role="img"
              aria-label="Love"
            >
              ♥
            </span>
            <span className="text-sm font-semibold text-foreground opacity-80 group-hover:opacity-100">
              in India
            </span>
          </a>
          <p className="text-xs text-muted-foreground mt-4 opacity-60">BlockVault Platform © 2026. All rights reserved.</p>
        </div>
      </div>

      {/* Mobile Wallet Modal */}
      {showMobileWallet && (
        <MobileWalletModal
          onClose={() => setShowMobileWallet(false)}
        />
      )}
    </div>
  );
};

export default IndexPage;
