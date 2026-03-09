import { 
  Shield, 
  Lock, 
  FileText, 
  Link2, 
  Brain, 
  PenTool, 
  Users, 
  Eye, 
  Zap,
  Globe,
  CheckCircle,
  ArrowRight,
  FileCheck,
  Server,
  Wallet,
  Key,
  Database,
  GitBranch,
  FileSearch,
  Clock,
  Award,
  User,
  Building2,
  Upload,
  Download,
  Share2,
  Heart,
  Sparkles,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlowingSeparator } from "@/components/ui/glowing-separator";
import { useNavigate } from "react-router-dom";

export default function LearnMorePage() {
  const navigate = useNavigate();

  const coreFeatures = [
    {
      icon: Shield,
      title: "Zero-Knowledge Encryption Ecosystem",
      description: "Military-grade AES-256-GCM local encryption utilizing a unique key-wrapping architecture. Your data is secured with Passphrase, RSA, and Secure Recovery Keys.",
      benefits: [
        "Local AES-256-GCM File Key generation",
        "RSA-2048 for secure key exchange",
        "Ethereum Wallet & Passphrase wrapping",
        "Secure Key Recovery System"
      ]
    },
    {
      icon: Globe,
      title: "IPFS Decentralized Storage",
      description: "Your files are encrypted and stored across the IPFS network, ensuring high availability, redundancy, and censorship resistance.",
      benefits: [
        "Cryptographically secure storage",
        "Content-addressed IPFS CIDs",
        "Global peer-to-peer performance",
        "Permanent file availability"
      ]
    },
    {
      icon: Link2,
      title: "Blockchain Verification",
      description: "Every document signature and notarization is anchored on the blockchain, creating an immutable audit trail and verifiable chain of custody.",
      benefits: [
        "Tamper-proof records",
        "Cryptographic signature proofs",
        "Complete transparency",
        "Legal admissibility"
      ]
    }
  ];

  const legalFeatures = [
    {
      icon: FileText,
      title: "Document Notarization",
      description: "Notarize documents on the blockchain with cryptographic proof of existence and timestamp validation.",
      technical: "SHA-256 hashing + smart contract commitments",
      useCase: "Proof of authorship, timestamp verification, legal compliance"
    },
    {
      icon: Brain,
      title: "AI-Powered ZK Redaction",
      description: "Intelligently detect PII using precision AI models, and redact sensitive information while proving the transformation via zero-knowledge proofs.",
      technical: "PaddleOCR + Presidio NLP + Groth16 zk-SNARKs",
      useCase: "Privacy-preserving document sharing, automated PII redaction"
    },
    {
      icon: PenTool,
      title: "Cryptographic Signatures",
      description: "Digitally sign documents using Ethereum wallets and secure RSA keys, creating an undeniable mathematical tie to your identity.",
      technical: "EIP-712 / Personal Sign + AES-2048 asymmetric keys",
      useCase: "Contracts, agreements, approval workflows, verifiable mandates"
    },
    {
      icon: Key,
      title: "Secure Key Recovery",
      description: "Easily recover lost passwords using our unique 16-character recovery keys without exposing your master encryption to the server.",
      technical: "File Key Wrapping Architecture",
      useCase: "Account recovery, business continuity, emergency file access"
    }
  ];

  const securityFeatures = [
    {
      icon: Lock,
      title: "Multi-Layer Security",
      points: [
        "AES-256-GCM symmetric file encryption",
        "RSA-2048 key exchange + wrapping",
        "Ethereum wallet-based authentication",
        "JWT token management",
        "Secure Recovery Key derivation"
      ]
    },
    {
      icon: Users,
      title: "Decentralized Access Control",
      points: [
        "File-level cryptographic access provisioning",
        "No centralized permission bypass",
        "Wallet-secured identities",
        "Revocable RSA-enabled sharing",
        "Immutable sharing logs"
      ]
    },
    {
      icon: Database,
      title: "Secure File Sharing",
      points: [
        "Encrypted RSA key exchange",
        "Zero-knowledge recipient transmission",
        "Instant one-click revocation",
        "Verifiable signature tracking",
        "End-to-end payload protection"
      ]
    }
  ];

  const technicalSpecs = [
    {
      category: "Encryption",
      specs: [
        { label: "Symmetric Encryption", value: "AES-256-GCM" },
        { label: "Asymmetric Encryption", value: "RSA-2048" },
        { label: "Digital Signatures", value: "Ethereum ECDSA" },
        { label: "Hash Algorithm", value: "SHA-256" }
      ]
    },
    {
      category: "AI & Zero-Knowledge",
      specs: [
        { label: "PII NLP Engine", value: "Microsoft Presidio" },
        { label: "Layout OCR", value: "PaddleOCR" },
        { label: "Proof System", value: "zk-SNARKs (Groth16)" },
        { label: "Circuits", value: "snarkjs Redaction" }
      ]
    },
    {
      category: "Storage & Network",
      specs: [
        { label: "Decentralized Storage", value: "IPFS Network" },
        { label: "Content Addressing", value: "CIDv1" },
        { label: "Storage Architecture", value: "Immutable" },
        { label: "On-Chain Commitments", value: "EVM Smart Contracts" }
      ]
    }
  ];

  const workflows = [
    {
      title: "Secure Upload & Key Wrapping",
      steps: [
        { step: 1, action: "Select file from device" },
        { step: 2, action: "Generate random AES File Key" },
        { step: 3, action: "Encrypt file locally with AES-256-GCM" },
        { step: 4, action: "Wrap File Key with your Passphrase/RSA" },
        { step: 5, action: "Upload encrypted bytes to IPFS" },
        { step: 6, action: "Server yields 16-char Recovery Key" }
      ]
    },
    {
      title: "AI Redaction & ZK Verification",
      steps: [
        { step: 1, action: "Select document to redact" },
        { step: 2, action: "AI detects PII elements (Presidio/PaddleOCR)" },
        { step: 3, action: "Add manual redactions dynamically" },
        { step: 4, action: "Generate zk-SNARKs proofs of operation" },
        { step: 5, action: "Anchor ZK commitments on blockchain" },
        { step: 6, action: "Verify proofs transparently" }
      ]
    },
    {
      title: "Cryptographic Signatures",
      steps: [
        { step: 1, action: "Upload document and select signers" },
        { step: 2, action: "Share file keys securely via RSA" },
        { step: 3, action: "Signers review securely in browser" },
        { step: 4, action: "Confirm signature using Web3 Wallet" },
        { step: 5, action: "Hash & address stored in block-record" },
        { step: 6, action: "Track lifecycle and proof transparency" }
      ]
    }
  ];

  const useCases = [
    {
      title: "Law Firms",
      description: "Complete legal document management with client confidentiality and regulatory compliance",
      icon: Building2,
      features: ["Client files encryption", "Case management", "Document notarization", "Multi-party signatures"]
    },
    {
      title: "Corporate Legal Teams",
      description: "Enterprise document workflows with granular access control and audit trails",
      icon: Users,
      features: ["Contract management", "Compliance tracking", "Team collaboration", "Audit logging"]
    },
    {
      title: "Independent Attorneys",
      description: "Professional document storage and sharing with clients, secure and compliant",
      icon: User,
      features: ["Client portal", "Secure sharing", "Document verification", "Time tracking"]
    },
    {
      title: "Document Authenticity",
      description: "Prove document authenticity and maintain chain of custody for legal proceedings",
      icon: FileCheck,
      features: ["Blockchain timestamps", "Tamper detection", "Chain of custody", "Court admissibility"]
    }
  ];

  const faqs = [
    {
      q: "How secure is my data?",
      a: "Your files are encrypted locally with a unique AES-256-GCM File Key before leaving your device. We use a zero-knowledge key wrap architecture, meaning we never have access to your unencrypted data, Passphrase, or RSA private keys. Combined with IPFS decentralized storage, your data is protected at every layer."
    },
    {
      q: "What is AI-Powered ZK Redaction?",
      a: "BlockVault utilizes an advanced hybrid pipeline consisting of PaddleOCR for layout-aware text extraction and Microsoft Presidio for robust NLP-based PII detection. After redaction, Zero-Knowledge Proofs (zk-SNARKs) allow you to cryptographically prove that only the targeted redactions were made, maintaining document integrity while protecting privacy."
    },
    {
      q: "What happens if I forget my Passphrase?",
      a: "BlockVault features an innovative Secure Key Recovery system. During file upload and account setup, a 16-character Recovery Key is generated. This Recovery Key can seamlessly unwrap your underlying File Keys to regain access and reset your Passphrase without degrading the zero-knowledge guarantee of the original encryption."
    },
    {
      q: "Can I revoke access to shared files?",
      a: "Yes! File sharing operates securely via RSA asymmetric encryption. Because every share creates a cryptographic key arrangement, you retain total control over file access. You can revoke access at any time through our real-time interface."
    },
    {
      q: "What happens to my files if BlockVault shuts down?",
      a: "Your encrypted payloads are pinned on IPFS, a decentralized network that exists independently of BlockVault. Even if our indexing service goes offline, your files remain accessible via their Content Identifiers (CIDs) from any standard IPFS gateway. Because your primary execution environment is local, you can always decrypt data as long as you retain your key material."
    },
    {
      q: "Are the digital signatures legally admissible?",
      a: "BlockVault signatures generate indisputable, non-repudiable proof using Ethereum signatures (ECDSA/EIP-712). Rather than relying on easily-faked email proofs, our system provides an immutable cryptographic bind between a verified user's Web3 identity and the document hash, exceeding standard compliance measures for legal validity."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="border-b border-border">
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-4">Enterprise Document Security</Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              The Future of Secure Document Management
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              BlockVault combines cutting-edge cryptography, blockchain technology, and zero-knowledge proofs 
              to create the most secure and verifiable document management system for teams and individuals.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/")}>
                <Wallet className="h-4 w-4 mr-2" />
                Get Started
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}>
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Simple User Section */}
      <section className="py-16 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4" variant="outline">
                <Heart className="h-3 w-3 mr-1" />
                Simple & Secure
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                Privacy-First Document Storage
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                If you're tired of Big Tech companies scanning your files, selling your data, 
                or vulnerable to hacks - we've got you covered. BlockVault puts you in control.
              </p>
            </div>

            {/* Simple Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              <Card className="p-6 bg-card/50 backdrop-blur border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Upload className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Upload Anything</h3>
                    <p className="text-sm text-muted-foreground">
                      Photos, documents, videos - upload any file up to 100MB. It's encrypted 
                      automatically before leaving your device.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 backdrop-blur border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Share2 className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Share Securely</h3>
                    <p className="text-sm text-muted-foreground">
                      Share files with friends, family, or colleagues. Only people you 
                      authorize can access your files.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 backdrop-blur border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">True Privacy</h3>
                    <p className="text-sm text-muted-foreground">
                      We can't see your files. Google can't see your files. Nobody can 
                      scan or sell your data. It's encrypted end-to-end.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-6 bg-card/50 backdrop-blur border-primary/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                    <Download className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Always Accessible</h3>
                    <p className="text-sm text-muted-foreground">
                      Your files are stored on a decentralized network. No single company 
                      can shut down or lose your data.
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Comparison Section */}
            <Card className="p-8 bg-muted/50 border-primary/20">
              <h3 className="text-xl font-semibold mb-6 text-center">
                Think of it like Google Drive or Dropbox, but...
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <h4 className="font-semibold text-muted-foreground">Traditional Cloud Storage</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      Company can read your files
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      Data can be sold to advertisers
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      Vulnerable to data breaches
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      Company owns your data
                    </li>
                    <li className="flex items-start gap-2">
                      <X className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      Can lose access if service shuts down
                    </li>
                  </ul>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold">BlockVault</h4>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      End-to-end encrypted (we can't see it)
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Your data is never scanned or sold
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Protected by blockchain technology
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      You own and control your data
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      Permanent storage, no vendor lock-in
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Simple Use Cases */}
            <div className="mt-12 text-center">
              <h3 className="text-xl font-semibold mb-6">Perfect For Everyday Use</h3>
              <div className="flex flex-wrap justify-center gap-3">
                <Badge variant="outline" className="px-4 py-2">📸 Family Photos</Badge>
                <Badge variant="outline" className="px-4 py-2">📄 Personal Documents</Badge>
                <Badge variant="outline" className="px-4 py-2">🎥 Videos & Media</Badge>
                <Badge variant="outline" className="px-4 py-2">💼 Work Files</Badge>
                <Badge variant="outline" className="px-4 py-2">🏥 Medical Records</Badge>
                <Badge variant="outline" className="px-4 py-2">💰 Financial Documents</Badge>
                <Badge variant="outline" className="px-4 py-2">🎓 School Projects</Badge>
                <Badge variant="outline" className="px-4 py-2">🔐 Passwords & Keys</Badge>
              </div>
            </div>

            {/* Simple CTA */}
            <div className="mt-12 text-center">
              <p className="text-muted-foreground mb-6">
                No technical knowledge required. Just upload, share, and rest easy knowing your files are truly private.
              </p>
              <Button size="lg" onClick={() => navigate("/")} className="gap-2">
                <Wallet className="h-4 w-4" />
                Get Started for Free
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Core Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Three pillars of security that make BlockVault the most trusted platform for secure documents
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16">
            {coreFeatures.map((feature) => (
              <Card key={feature.title} className="p-6 hover:border-primary/50 transition-all">
                <div className="mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
                <div className="space-y-2">
                  {feature.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <GlowingSeparator />
        </div>
      </section>

      {/* Legal Features */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Advanced Workflows</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Purpose-built features for secure document workflows and compliance
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {legalFeatures.map((feature) => (
              <Card key={feature.title} className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {feature.description}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 pl-16">
                  <div className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="flex-shrink-0">Technical</Badge>
                    <span className="text-muted-foreground">{feature.technical}</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="flex-shrink-0">Use Case</Badge>
                    <span className="text-muted-foreground">{feature.useCase}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Security Architecture</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Multi-layered security protecting your most sensitive documents
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {securityFeatures.map((feature) => (
              <Card key={feature.title} className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                </div>
                <ul className="space-y-2">
                  {feature.points.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Technical Specifications</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built on proven, battle-tested cryptographic standards
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {technicalSpecs.map((spec) => (
              <Card key={spec.category} className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Server className="h-5 w-5 text-primary" />
                  {spec.category}
                </h3>
                <div className="space-y-3">
                  {spec.specs.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <Badge variant="outline" className="font-mono text-xs">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Workflows */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Step-by-step workflows for common operations
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {workflows.map((workflow) => (
              <Card key={workflow.title} className="p-6">
                <h3 className="text-lg font-semibold mb-6">{workflow.title}</h3>
                <div className="space-y-4">
                  {workflow.steps.map((step) => (
                    <div key={step.step} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 border-2 border-primary">
                        <span className="text-sm font-bold text-primary">{step.step}</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm">{step.action}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Who Uses BlockVault?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Trusted by teams and individuals across industries
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {useCases.map((useCase) => (
              <Card key={useCase.title} className="p-6 hover:border-primary/50 transition-all">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <useCase.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{useCase.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{useCase.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {useCase.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle className="h-3 w-3 text-success" />
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about BlockVault
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, idx) => (
              <Card key={idx} className="p-6">
                <h3 className="text-lg font-semibold mb-3 flex items-start gap-2">
                  <span className="text-primary">{idx + 1}.</span>
                  {faq.q}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                  {faq.a}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border py-16 bg-muted/50">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of users securing their documents with blockchain technology
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate("/")} className="gap-2">
                <Wallet className="h-4 w-4" />
                Connect Wallet
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/files")}>
                View Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Note */}
      <section className="border-t border-border py-8">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Enterprise-grade security</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>Decentralized infrastructure</span>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span>Blockchain verified</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

