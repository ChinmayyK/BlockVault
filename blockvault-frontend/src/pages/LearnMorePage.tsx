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
      title: "End-to-End Encryption",
      description: "Military-grade AES-256-GCM encryption ensures your files are encrypted before they leave your device. Only you hold the keys.",
      benefits: [
        "Files encrypted locally before upload",
        "Zero-knowledge architecture",
        "RSA-2048 for key exchange",
        "Quantum-resistant algorithms"
      ]
    },
    {
      icon: Globe,
      title: "IPFS Decentralized Storage",
      description: "Your files are stored across a global network of nodes, ensuring availability, redundancy, and censorship resistance.",
      benefits: [
        "No single point of failure",
        "Content-addressed storage",
        "Global CDN performance",
        "Permanent file availability"
      ]
    },
    {
      icon: Link2,
      title: "Blockchain Verification",
      description: "Every document action is recorded on the blockchain, creating an immutable audit trail and chain of custody.",
      benefits: [
        "Tamper-proof records",
        "Cryptographic verification",
        "Complete transparency",
        "Legal admissibility"
      ]
    }
  ];

  const legalFeatures = [
    {
      icon: FileText,
      title: "Document Notarization",
      description: "Notarize documents on the blockchain with cryptographic proof of existence and timestamp.",
      technical: "SHA-256 hashing + smart contract registration",
      useCase: "Proof of authorship, timestamp verification, legal compliance"
    },
    {
      icon: Eye,
      title: "ZKPT Redaction",
      description: "Zero-Knowledge Proof of Transformation - redact sensitive information while proving the transformation was valid.",
      technical: "zk-SNARKs circuits verify redaction integrity",
      useCase: "Privacy-preserving document sharing, GDPR compliance, client confidentiality"
    },
    {
      icon: PenTool,
      title: "E-Signature Workflows",
      description: "Multi-party digital signatures with smart contract escrow and automatic execution upon completion.",
      technical: "Ethereum smart contracts + cryptographic signatures",
      useCase: "Contracts, agreements, approval workflows, legal documents"
    },
    {
      icon: Brain,
      title: "ZKML AI Analysis",
      description: "Zero-Knowledge Machine Learning - analyze documents with AI while keeping data private using encrypted computation.",
      technical: "Homomorphic encryption + ML models",
      useCase: "Document classification, risk assessment, compliance checking"
    }
  ];

  const securityFeatures = [
    {
      icon: Lock,
      title: "Multi-Layer Security",
      points: [
        "AES-256-GCM symmetric encryption",
        "RSA-2048 asymmetric encryption",
        "Ethereum wallet-based authentication",
        "JWT token management",
        "Secure key derivation (PBKDF2)"
      ]
    },
    {
      icon: Users,
      title: "Role-Based Access Control (RBAC)",
      points: [
        "Granular permission system",
        "5 predefined roles (Attorney, Paralegal, Client, etc.)",
        "Custom role creation",
        "Firm-level access control",
        "Audit logging"
      ]
    },
    {
      icon: Database,
      title: "Secure File Sharing",
      points: [
        "Encrypted key exchange",
        "Time-limited access",
        "Revocable permissions",
        "Share tracking",
        "Access logs"
      ]
    }
  ];

  const technicalSpecs = [
    {
      category: "Encryption",
      specs: [
        { label: "Symmetric Encryption", value: "AES-256-GCM" },
        { label: "Asymmetric Encryption", value: "RSA-2048" },
        { label: "Key Derivation", value: "PBKDF2" },
        { label: "Hash Algorithm", value: "SHA-256" }
      ]
    },
    {
      category: "Blockchain",
      specs: [
        { label: "Network", value: "Ethereum (EVM compatible)" },
        { label: "Smart Contracts", value: "Solidity 0.8+" },
        { label: "Gas Optimization", value: "Optimized for low fees" },
        { label: "Standards", value: "ERC standards compliant" }
      ]
    },
    {
      category: "Storage",
      specs: [
        { label: "Decentralized Storage", value: "IPFS" },
        { label: "Content Addressing", value: "CID (Content Identifier)" },
        { label: "File Size Limit", value: "100 MB per file" },
        { label: "Storage Type", value: "Permanent, immutable" }
      ]
    },
    {
      category: "Zero-Knowledge Proofs",
      specs: [
        { label: "Proof System", value: "zk-SNARKs (Groth16)" },
        { label: "Circuit Library", value: "snarkjs" },
        { label: "Use Cases", value: "Redaction, Privacy, Verification" },
        { label: "Verification", value: "On-chain + Off-chain" }
      ]
    }
  ];

  const workflows = [
    {
      title: "File Upload Workflow",
      steps: [
        { step: 1, action: "Select file from device" },
        { step: 2, action: "Encrypt locally with passphrase" },
        { step: 3, action: "Generate file hash (SHA-256)" },
        { step: 4, action: "Upload encrypted file to IPFS" },
        { step: 5, action: "Record CID on blockchain" },
        { step: 6, action: "Store metadata in database" }
      ]
    },
    {
      title: "Document Notarization Workflow",
      steps: [
        { step: 1, action: "Select document to notarize" },
        { step: 2, action: "Compute document hash" },
        { step: 3, action: "Create zero-knowledge proof" },
        { step: 4, action: "Submit to smart contract" },
        { step: 5, action: "Blockchain confirmation" },
        { step: 6, action: "Receive notarization certificate" }
      ]
    },
    {
      title: "Signature Request Workflow",
      steps: [
        { step: 1, action: "Upload document for signature" },
        { step: 2, action: "Define signers and deadline" },
        { step: 3, action: "Create smart contract escrow" },
        { step: 4, action: "Notify signers" },
        { step: 5, action: "Collect digital signatures" },
        { step: 6, action: "Auto-execute upon completion" }
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
      a: "Your files are encrypted with AES-256-GCM before leaving your device. We use zero-knowledge architecture, meaning we never have access to your unencrypted data or encryption keys. Combined with blockchain verification and IPFS storage, your data is protected at every layer."
    },
    {
      q: "What is Zero-Knowledge Proof of Transformation (ZKPT)?",
      a: "ZKPT allows you to redact sensitive information from documents while cryptographically proving that only redactions were made - no other alterations. This maintains document integrity while protecting privacy, crucial for legal compliance and client confidentiality."
    },
    {
      q: "How does blockchain verification work?",
      a: "When you upload or notarize a document, we compute a cryptographic hash (SHA-256) of the file and record it on the Ethereum blockchain. This creates an immutable timestamp and proof of existence. Anyone can verify the document hasn't been tampered with by comparing hashes."
    },
    {
      q: "Can I revoke access to shared files?",
      a: "Yes! You have complete control over file sharing. You can revoke access at any time, set expiration dates, and track who has accessed your files. All access events are logged for your records."
    },
    {
      q: "What happens to my files if BlockVault shuts down?",
      a: "Your files are stored on IPFS, a decentralized network that exists independently of BlockVault. Even if our service shuts down, your files remain accessible via their Content Identifiers (CIDs) from any IPFS gateway. Your encryption keys are stored locally, ensuring you always maintain control."
    },
    {
      q: "Is this legally admissible in court?",
      a: "Blockchain-based evidence is increasingly recognized in courts worldwide. Our system provides cryptographic proof of document existence, timestamps, and chain of custody - all elements that enhance legal admissibility. However, specific admissibility depends on jurisdiction and case context."
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

