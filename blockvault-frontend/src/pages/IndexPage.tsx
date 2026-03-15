import { Shield, Lock, FileCheck, ArrowRight, Wallet, CheckCircle2, FileSearch, Fingerprint, Link2, Cpu, Database, Server, Component, CodeSquare, GitBranch, TerminalSquare, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { MobileWalletModal } from "@/components/auth/MobileWalletModal";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const IndexPage = () => {
  const navigate = useNavigate();
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
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                  Secure Document Redaction & 
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-500 block mt-2">
                    Verification Platform
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-3xl mx-auto">
                  Detect sensitive data, apply secure redactions, generate verifiable zero-knowledge proofs, and anchor document integrity on the blockchain.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button size="lg" className="h-14 px-8 text-lg font-semibold gap-2 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-1 w-full sm:w-auto" onClick={() => navigate("/demo")}>
                    Try Demo
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-medium gap-2 border-border/50 bg-background/50 backdrop-blur-sm w-full sm:w-auto" onClick={handleQuickConnect} disabled={loading}>
                    <Wallet className="h-5 w-5" />
                    Connect Wallet
                  </Button>
                  <a href="https://github.com/chinmayk/BlockVault" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
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
          <section className="py-12 border-y border-border/40 bg-card/20 backdrop-blur-md relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
            <div className="container px-6 mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">The BlockVault Pipeline</h2>
              </div>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 max-w-5xl mx-auto">
                {workflowSteps.map((step, index) => (
                  <div key={step.label} className="flex flex-col items-center flex-1 relative group w-full md:w-auto">
                    <div className="w-16 h-16 rounded-2xl bg-card border border-border/50 flex items-center justify-center mb-4 shadow-xl shadow-black/5 group-hover:border-primary/50 group-hover:scale-110 transition-all duration-300 z-10 relative">
                      <step.icon className="h-8 w-8 text-primary/80 group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 text-center">{step.label}</h3>
                    <p className="text-xs text-muted-foreground text-center px-2">{step.desc}</p>
                    
                    {/* Connecting Line */}
                    {index < workflowSteps.length - 1 && (
                      <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-gradient-to-r from-border to-transparent -z-10">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-500 animate-pulse"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 4: HOW IT WORKS */}
          <section className="py-16">
            <div className="max-w-4xl mx-auto px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">How it works</h2>
                <p className="text-muted-foreground text-lg">Achieve total document security in under 10 seconds.</p>
              </div>
              
              <div className="space-y-6">
                <div className="flex gap-6 p-6 rounded-2xl bg-card/40 border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">1</div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Upload & Analyze</h3>
                    <p className="text-muted-foreground leading-relaxed">Simply upload your sensitive document. BlockVault's on-device AI instantly scans and detects Personally Identifiable Information (PII), SSNs, and financial data locally in your browser.</p>
                  </div>
                </div>
                <div className="flex gap-6 p-6 rounded-2xl bg-card/40 border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">2</div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Redact & Prove</h3>
                    <p className="text-muted-foreground leading-relaxed">Review the AI suggestions and apply redactions. The system automatically generates a Zero-Knowledge Proof (zk-SNARK), mathematically proving the original content remains intact without revealing the hidden text.</p>
                  </div>
                </div>
                <div className="flex gap-6 p-6 rounded-2xl bg-card/40 border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">3</div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Anchor & Share</h3>
                    <p className="text-muted-foreground leading-relaxed">The proof and encrypted document are anchored immutably to the Polygon blockchain. Share the verifiable, redacted document with third parties who can independently audit its authenticity.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: FEATURE HIGHLIGHTS */}
          <section className="py-12">
            <div className="px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">Enterprise-Grade Security</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                  Designed for modern compliance architectures and decentralized trust.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {features.map((feature) => (
                  <Card key={feature.title} className="p-8 hover:border-primary/40 transition-all hover:shadow-xl hover:-translate-y-1 bg-card/50 backdrop-blur-sm border-border/50">
                    <div className="flex flex-col items-start text-left">
                      <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary/20 to-indigo-500/20 flex items-center justify-center mb-6">
                        <feature.icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 6: SECURITY ARCHITECTURE */}
          <section className="py-16 bg-muted/30 rounded-3xl border border-border/50 mx-6">
            <div className="max-w-5xl mx-auto px-6">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold mb-4">Under The Hood</h2>
                <p className="text-muted-foreground text-lg">A defense-in-depth approach to document privacy.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <Lock className="w-8 h-8 text-blue-500" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">E2E Encryption</h4>
                  <p className="text-sm text-muted-foreground">AES-GCM encryption applied client-side before uploading. The server never sees your unencrypted data.</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                    <Cpu className="w-8 h-8 text-purple-500" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">Zero-Knowledge Proofs</h4>
                  <p className="text-sm text-muted-foreground">Circom/SnarkJS generates local proofs that redactions were applied properly without leaking the redacted text.</p>
                </div>
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Database className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">Blockchain Anchoring</h4>
                  <p className="text-sm text-muted-foreground">Keccak256 hashes of the file and proof are written to smart contracts, creating an immutable timeline.</p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 7: TECH STACK */}
          <section className="py-16 text-center">
            <div className="max-w-4xl mx-auto px-6">
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-8">Powered by Modern Technologies</p>
              <div className="flex flex-wrap justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-card"><CodeSquare className="w-5 h-5"/> React</div>
                <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-card"><TerminalSquare className="w-5 h-5"/> TypeScript</div>
                <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-card"><Server className="w-5 h-5"/> Python FastApi</div>
                <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-card"><Database className="w-5 h-5"/> IPFS</div>
                <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-card"><Component className="w-5 h-5"/> Circom (ZK)</div>
                <div className="flex items-center gap-2 px-4 py-2 border rounded-full bg-card"><GitBranch className="w-5 h-5"/> Solidity</div>
              </div>
            </div>
          </section>

          {/* SECTION 5 & 8: FINAL CTA & DEMO CALLOUT */}
          <section className="py-24 relative overflow-hidden rounded-[3rem] bg-gradient-to-b from-primary/5 to-primary/10 border border-primary/20 mx-6 shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
            <div className="relative px-6 z-10">
              <div className="max-w-3xl mx-auto text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 text-primary mb-8 shadow-inner shadow-primary/30 text-3xl">
                  🚀
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Ready to secure your documents?
                </h2>
                <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
                  Experience the full power of BlockVault instantly. Our interactive demo requires <strong className="text-foreground font-semibold">no wallet installation</strong> and zero commitments.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button
                    size="lg"
                    onClick={() => navigate("/demo")}
                    className="h-16 px-10 text-xl font-bold gap-3 shadow-xl shadow-primary/30 hover:-translate-y-1 transition-transform w-full sm:w-auto"
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
                     className="h-16 px-8 text-xl font-medium gap-3 bg-background/80 backdrop-blur-sm w-full sm:w-auto"
                   >
                     <Wallet className="h-6 w-6" />
                     {loading ? 'Connecting...' : 'Connect Wallet'}
                   </Button>
                  )}
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
