import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Globe, Zap, ArrowRight, CheckCircle, Smartphone, Wallet, Mail } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { MobileWalletModal } from './MobileWalletModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlowingDivider } from '@/components/ui/GlowingDivider';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isMobile, connectWallet, login, loginWithPassword, signup, loading, error, isConnected, user } = useAuth();
  const [showMobileWallet, setShowMobileWallet] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);
  const [authTab, setAuthTab] = useState<'wallet' | 'email'>('wallet');
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const features = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "Your files are encrypted before leaving your device"
    },
    {
      icon: Lock,
      title: "Web3 Security",
      description: "Blockchain-based authentication and access control"
    },
    {
      icon: Globe,
      title: "IPFS Storage",
      description: "Decentralized storage across the global network"
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Quick upload and download with optimized performance"
    }
  ];

  // Auto-rotate features
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [features.length]);

  const handleEmailAuth = async () => {
    if (isSignup) {
      if (password !== confirmPassword) {
        setFormError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setFormError('Password must be at least 8 characters');
        return;
      }
      setFormError(null);
      try {
        await signup(email, password, user?.address);
      } catch (err) {
        // Error already handled in signup function
      }
    } else {
      try {
        setFormError(null);
        await loginWithPassword(email, password);
      } catch (err) {
        // Error already handled in loginWithPassword function
      }
    }
  };

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto flex min-h-[calc(100vh-3rem)] flex-col px-6 pt-8">
        <div className="flex flex-1 flex-col gap-12 lg:flex-row lg:items-center">
          {/* Left Side - Hero Content */}
          <div className="text-center lg:text-left flex-1 space-y-8">
            <div className="mb-8">
              <div className="inline-flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <Shield className="w-7 h-7" />
                </div>
                <h1 className="text-3xl font-bold">BlockVault</h1>
              </div>
              
              <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Secure Your
                <span className="text-muted-foreground block">
                  Digital Files
                </span>
              </h2>
              
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                The most secure way to store, share, and manage your files with 
                blockchain technology and end-to-end encryption.
              </p>
            </div>

            {/* Features Carousel */}
            <div className="mb-8">
              <div className="rounded-2xl border border-borderAccent/25 bg-card-muted/60 p-6 backdrop-blur">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                    {React.createElement(features[currentFeature].icon, { className: "w-6 h-6" })}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      {features[currentFeature].title}
                    </h3>
                    <p className="text-muted-foreground">
                      {features[currentFeature].description}
                    </p>
                  </div>
                </div>
                
                {/* Feature Indicators */}
                <div className="flex space-x-2">
                  {features.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentFeature(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === currentFeature 
                          ? 'bg-primary w-8' 
                          : 'bg-muted hover:bg-muted-foreground/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold">256-bit</div>
                <div className="text-sm text-muted-foreground">Encryption</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">∞</div>
                <div className="text-sm text-muted-foreground">Storage</div>
              </div>
            </div>
          </div>

          <GlowingDivider className="hidden lg:block mx-10 self-stretch" />
          <GlowingDivider orientation="horizontal" className="lg:hidden my-4" />

          {/* Right Side - Login Card */}
          <div className="flex justify-center lg:justify-end flex-1">
            <Card className="w-full max-w-md p-8 border border-borderAccent/40 bg-card-muted/90 text-card-muted-foreground backdrop-blur shadow-[0_35px_70px_-25px_rgba(56,189,248,0.45)]">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {isSignup ? 'Create Account' : 'Welcome Back'}
                </h3>
                <p className="text-muted-foreground">
                  {isSignup ? 'Sign up to get started' : 'Choose your login method'}
                </p>
              </div>

              {/* Auth Method Tabs */}
              <div className="flex gap-2 mb-6 bg-muted/30 rounded-lg p-1">
                <button
                  onClick={() => setAuthTab('wallet')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authTab === 'wallet'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Wallet className="w-4 h-4" />
                    <span>Wallet</span>
                  </div>
                </button>
                <button
                  onClick={() => setAuthTab('email')}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    authTab === 'email'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </div>
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm">{error}</p>
                </div>
              )}
              {formError && (
                <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm">{formError}</p>
                </div>
              )}

              {/* Wallet Login */}
              {authTab === 'wallet' && (
                <div className="space-y-4">
                  {!isConnected ? (
                    !isMobile ? (
                      <Button
                        onClick={connectWallet}
                        disabled={loading}
                        className="w-full py-3 px-6 gap-2"
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span>Connecting...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Wallet className="w-5 h-5" />
                            <span>Connect Wallet</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setShowMobileWallet(true)}
                        disabled={loading}
                        className="w-full py-3 px-6 gap-2"
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span>Connecting...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Smartphone className="w-5 h-5" />
                            <span>Connect Mobile Wallet</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        )}
                      </Button>
                    )
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center space-x-3 rounded-xl px-6 py-3 border border-border bg-muted/30 backdrop-blur">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="font-mono text-sm">
                          {user?.address?.slice(0, 6)}...{user?.address?.slice(-4)}
                        </span>
                      </div>
                      <Button
                        onClick={login}
                        disabled={loading}
                        className="w-full py-3 px-6 gap-2"
                      >
                        {loading ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span>Signing Message...</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Shield className="w-5 h-5" />
                            <span>Complete Login</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Email/Password Login */}
              {authTab === 'email' && (
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="mt-1 bg-slate-900/50 border-slate-700 text-white"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 bg-muted/30 border-border text-foreground"
                        disabled={loading}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isSignup && email && password) {
                            handleEmailAuth();
                          } else if (e.key === 'Enter' && isSignup && email && password && confirmPassword) {
                            handleEmailAuth();
                          }
                        }}
                      />
                    </div>
                    {isSignup && (
                      <div>
                        <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Confirm Password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="mt-1 bg-slate-900/50 border-slate-700 text-white"
                          disabled={loading}
                        />
                      </div>
                    )}
                    <Button
                      onClick={handleEmailAuth}
                      disabled={loading || !email || !password || (isSignup && password !== confirmPassword)}
                      className="w-full py-3 px-6 gap-2"
                    >
                      {loading ? (
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span>{isSignup ? 'Creating Account...' : 'Logging in...'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Mail className="w-5 h-5" />
                          <span>{isSignup ? 'Sign Up' : 'Login'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                    <button
                      onClick={() => {
                        setIsSignup(!isSignup);
                        setError(null);
                        setPassword('');
                        setConfirmPassword('');
                      }}
                      className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isSignup ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                    </button>
                  </div>
                </div>
              )}
              {/* Features List */}
              <div className="mt-6 space-y-3">
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>End-to-end encryption</span>
                </div>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Web3 authentication</span>
                </div>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Decentralized storage</span>
                </div>
                <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Secure file sharing</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  Powered by blockchain technology • No data collection • Privacy first
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Wallet Modal */}
      {showMobileWallet && (
        <MobileWalletModal onClose={() => setShowMobileWallet(false)} />
      )}

      {/* Footer */}
      <div className="mt-auto border-t border-border bg-muted/30">
        <div className="container mx-auto px-6 py-4 text-center text-xs text-muted-foreground">
          Made with <span className="text-rose-500">❤️</span> in India 🇮🇳
        </div>
      </div>
    </div>
  );
};
