import { Shield, Lock, FileCheck, ArrowRight, Wallet, CheckCircle2 } from "lucide-react";
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
  const { isAuthenticated, isMobile, connectWallet, login, loading, user, isConnected } = useAuth();
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

  const handleLogin = async () => {
    await login();
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
      title: "Blockchain Security",
      description: "Immutable document storage with cryptographic verification",
    },
    {
      icon: Lock,
      title: "Zero-Knowledge Proofs",
      description: "Redact sensitive data while maintaining document integrity",
    },
    {
      icon: FileCheck,
      title: "Advanced Workflows",
      description: "Multi-party signatures, notarization, and chain of custody",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto flex min-h-[calc(100vh-3rem)] flex-col px-6 pt-8">
        <div className="flex justify-between items-center mb-6">
          {/* System Status Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
              <CheckCircle2 className="w-4 h-4 text-green-400 relative z-10" />
            </div>
            <span className="text-sm font-medium text-green-400">All Systems Operational</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex-1 space-y-24">
          {/* Hero Section */}
          <section className="relative overflow-hidden border-b border-border">
            <div className="px-6 py-24">
              <div className="max-w-3xl mx-auto text-center">
                <h1 className="text-5xl font-bold tracking-tight mb-6">
                  Enterprise Document Management
                  <br />
                  <span className="text-muted-foreground">Built on Blockchain</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  Secure, verifiable, and compliant document management for teams and individuals.
                  Leverage blockchain technology and zero-knowledge proofs for unmatched security and privacy.
                </p>
                <div className="flex items-center justify-center gap-4">
                  {isAuthenticated ? (
                    <Button size="lg" onClick={() => navigate("/files")} className="gap-2">
                      Go to Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        onClick={goToLogin}
                        className="gap-2"
                        disabled={loading}
                      >
                        <Shield className="h-4 w-4" />
                        {loading ? 'Loading...' : 'Sign In / Sign Up'}
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleQuickConnect}
                        disabled={loading}
                      >
                        <Wallet className="h-4 w-4" />
                        {loading ? 'Connecting...' : 'Quick Wallet Connect'}
                      </Button>
                      <Button size="lg" variant="ghost" onClick={() => navigate("/learn-more")}>
                        Learn More
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-8">
            <div className="px-6">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">
                  Why BlockVault?
                </h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Advanced cryptographic features designed for modern document workflows
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 px-6 md:grid-cols-3 md:px-12 lg:px-16">
                {features.map((feature) => (
                  <Card key={feature.title} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="flex flex-col items-center text-center">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="border-t border-border py-16">
            <div className="px-6">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-3xl font-bold mb-4">
                  Ready to secure your documents?
                </h2>
                <p className="text-muted-foreground mb-8">
                  Join teams and individuals worldwide using BlockVault for secure document management
                </p>
                {isAuthenticated ? (
                  <Button
                    size="lg"
                    onClick={() => navigate("/files")}
                    className="gap-2"
                  >
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    onClick={goToLogin}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {loading ? 'Loading...' : 'Access Login'}
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer Badge */}
        <div className="mt-auto flex justify-center pb-10">
          <a
            href="https://madewithloveinindia.org"
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-5 py-2.5 text-sm font-medium text-muted-foreground shadow-lg shadow-black/10 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:text-foreground hover:shadow-primary/20 dark:bg-slate-900/80 dark:text-slate-200"
          >
            <span className="uppercase tracking-[0.24em] text-[0.65rem] text-muted-foreground">
              Made With
            </span>
            <span
              className="text-lg leading-none text-rose-500 transition-transform group-hover:scale-110 group-hover:text-rose-400"
              role="img"
              aria-label="Love"
            >
              ♥
            </span>
            <span className="text-sm font-semibold text-foreground">
              in India
            </span>
          </a>
        </div>
      </div>

      {/* Mobile Wallet Modal */}
      {showMobileWallet && (
        <MobileWalletModal
          onClose={() => setShowMobileWallet(false)}
          onConnect={login}
        />
      )}
    </div>
  );
};

export default IndexPage;
