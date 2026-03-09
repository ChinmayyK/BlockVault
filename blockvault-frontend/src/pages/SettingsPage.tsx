import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Shield, Bell, CreditCard, Wallet, LogOut, Globe, Lock, Smartphone, Key, RefreshCw, Edit, Mail, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRBACOptional } from "@/contexts/RBACContext";
import toast from "react-hot-toast";
import type { UserProfile } from "@/types/userProfile";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { RSAManager } from "@/components/shared/RSAManager";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function SettingsPage() {
  const { user } = useAuth();
  const rbac = useRBACOptional();
  const profile = rbac?.userProfile;
  const [copied, setCopied] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState({
    product: true,
    blockchain: true,
    legal: true,
    security: true,
  });
  const [autoSave, setAutoSave] = useState(true);
  const [preferredLocale, setPreferredLocale] = useState("en-US");
  const [billingEmail, setBillingEmail] = useState(profile?.firmName ? `${profile.firmName.toLowerCase().replace(/\s+/g, "")}@billing.blockvault.ai` : "billing@blockvault.ai");
  const [secondFactorEnabled, setSecondFactorEnabled] = useState(false);
  const [walletWatch, setWalletWatch] = useState(true);
  const [statementDelivery, setStatementDelivery] = useState<"monthly" | "quarterly">("monthly");
  const [showRSAManager, setShowRSAManager] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  const persistPreferences = (updates: Partial<UserProfile["preferences"]>) => {
    if (!rbac?.updateUserProfile) return;
    const current = profile?.preferences ?? {};
    const next: UserProfile["preferences"] = {
      ...current,
      ...updates,
    };

    if (updates.notificationChannels !== undefined || current.notificationChannels !== undefined) {
      next.notificationChannels = {
        ...(current.notificationChannels ?? {}),
        ...(updates.notificationChannels ?? {}),
      };
    }

    rbac.updateUserProfile({ preferences: next });
  };

  useEffect(() => {
    const pref = profile?.preferences;
    if (!pref) return;

    if (pref.notificationChannels) {
      setNotificationPrefs({
        product: pref.notificationChannels.product ?? true,
        blockchain: pref.notificationChannels.blockchain ?? true,
        legal: pref.notificationChannels.legal ?? true,
        security: pref.notificationChannels.security ?? true,
      });
    }

    if (pref.autoSave !== undefined) {
      setAutoSave(pref.autoSave);
    }
    if (pref.locale) {
      setPreferredLocale(pref.locale);
    }
    if (pref.billingEmail) {
      setBillingEmail(pref.billingEmail);
    }
    if (pref.secondFactorEnabled !== undefined) {
      setSecondFactorEnabled(pref.secondFactorEnabled);
    }
    if (pref.walletWatch !== undefined) {
      setWalletWatch(pref.walletWatch);
    }
    if (pref.statementDelivery) {
      setStatementDelivery(pref.statementDelivery);
    }
  }, [profile?.preferences]);

  const handleNotificationToggle = (key: keyof typeof notificationPrefs, value: boolean) => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, [key]: value };
      persistPreferences({ notificationChannels: next });
      return next;
    });
  };

  const handleSecondFactorChange = (value: boolean) => {
    setSecondFactorEnabled(value);
    persistPreferences({ secondFactorEnabled: value });
  };

  const handleWalletWatchChange = (value: boolean) => {
    setWalletWatch(value);
    persistPreferences({ walletWatch: value });
  };

  const handleAutoSaveToggle = (value: boolean) => {
    setAutoSave(value);
    persistPreferences({ autoSave: value });
  };

  const handleStatementDeliveryChange = (value: "monthly" | "quarterly") => {
    setStatementDelivery(value);
    persistPreferences({ statementDelivery: value });
  };

  const handleLocaleUpdate = () => {
    persistPreferences({ locale: preferredLocale });
    toast.success("Locale updated");
  };

  const handleBillingEmailUpdate = () => {
    if (!billingEmail) {
      toast.error("Billing email cannot be empty");
      return;
    }
    persistPreferences({ billingEmail });
    toast.success("Billing contact updated");
  };

  const handleCopy = async () => {
    if (user?.address) {
      await navigator.clipboard.writeText(user.address);
      setCopied(true);
      toast.success("Wallet address copied");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleResetSessions = () => {
    toast.loading("Resetting all active sessions and clearing cache...");
    setTimeout(() => {
      localStorage.clear();
      window.location.reload();
    }, 1500);
  };

  const handleExportBilling = () => {
    toast.loading("Gathering invoice history...", { duration: 1500 });
    
    setTimeout(() => {
      // Create mock CSV content
      const csvContent = [
        ["Invoice ID", "Date", "Amount", "Status", "Description"],
        ["INV-2024-001", "2024-01-01", "$499.00", "Paid", "Enterprise Shield - Monthly"],
        ["INV-2024-002", "2024-02-01", "$499.00", "Paid", "Enterprise Shield - Monthly"],
        ["INV-2024-003", "2024-03-01", "$499.00", "Paid", "Enterprise Shield - Monthly"],
        ["INV-2024-004", "2024-03-05", "$12.40", "Paid", "Excess Storage Fees"],
      ].map(e => e.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `blockvault_billing_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Billing data exported successfully");
    }, 1500);
  };

  const handleCancelSubscription = () => {
    setShowCancelConfirm(false);
    toast.loading("Processing cancellation request...");
    
    setTimeout(() => {
      setIsCancelled(true);
      toast.success("Subscription cancellation pending. Your access remains until 03 Nov 2025.");
    }, 2000);
  };

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <p className="text-muted-foreground">Loading settings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="h-10 w-10 text-primary" />
      <div>
              <h1 className="text-3xl font-semibold text-foreground">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Fine-tune your BlockVault experience without leaving our secure aesthetic.
              </p>
            </div>
          </div>
          <ThemeToggle />
      </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Account</CardTitle>
              <Badge variant="outline" className="border-border text-foreground">
                Active
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground">{profile?.firmName ?? "Independent Counsel"}</p>
              <p className="text-xs text-muted-foreground mt-1">Wallet-linked identity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Security</CardTitle>
              <Shield className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground">{secondFactorEnabled ? "MFA enabled" : "Wallet-secured"}</p>
              <p className="text-xs text-muted-foreground mt-1">Zero-knowledge login with MetaMask</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Billing</CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
        </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground">Plan: Enterprise Shield</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isCancelled ? "Access ends: 03 Nov 2025" : "Renewal: 03 Nov 2025"}
              </p>
            </CardContent>
          </Card>
        </div>
      </header>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="w-full justify-start gap-2 bg-card/70 p-1">
          <TabsTrigger value="profile" className="gap-2 text-muted-foreground data-[state=active]:bg-card/80 data-[state=active]:text-foreground">
            <Edit className="h-4 w-4" />
            Account & Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 text-muted-foreground data-[state=active]:bg-card/80 data-[state=active]:text-foreground">
            <Lock className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 text-muted-foreground data-[state=active]:bg-card/80 data-[state=active]:text-foreground">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2 text-muted-foreground data-[state=active]:bg-card/80 data-[state=active]:text-foreground">
            <CreditCard className="h-4 w-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Wallet className="h-5 w-5 text-primary" />
                Wallet & Identity
              </CardTitle>
              <CardDescription>Everything tied to your MetaMask session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Wallet Address</p>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
                    <p className="font-mono text-sm text-foreground break-all">{user.address ?? "Not connected"}</p>
                    <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0 border-border text-foreground">
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Role</p>
                  <div className="rounded-lg border border-border bg-card/60 p-3">
                    <p className="text-sm font-semibold text-foreground">{profile?.role ?? "Owner"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Role determines legal workflow capabilities.</p>
                  </div>
                </div>
              </div>

              <Separator className="separator-glow h-[2px]" />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Professional Identity</p>
                  <div className="rounded-lg border border-border bg-card/60 p-3">
                    <p className="text-sm text-foreground">Firm: {profile?.firmName ?? "Independent"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Onboarded: {profile?.onboardedAt ? new Date(profile.onboardedAt).toLocaleDateString() : "Pending"}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Locale</p>
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
                    <Globe className="h-4 w-4 text-primary" />
                    <input
                      value={preferredLocale}
                      onChange={(event) => setPreferredLocale(event.target.value)}
                      className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border text-foreground"
                      onClick={handleLocaleUpdate}
                    >
                      Update
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">We use locale to format dates, currency, and legal notices.</p>
                </div>
          </div>
        </CardContent>
      </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Session Controls</CardTitle>
              <CardDescription>Manage active session and authentication cache.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Reset trusted devices</p>
                  <p className="text-xs text-muted-foreground">Invalidate cached signatures across your devices.</p>
                </div>
                <Button variant="outline" className="border-border text-foreground" onClick={handleResetSessions}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset Sessions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Authentication Factors</CardTitle>
              <CardDescription>Layered protection over your wallet login.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SettingToggle
                label="Require biometric approval on mobile"
                description="Prompt FaceID/TouchID whenever a new session begins."
                icon={Smartphone}
                enabled={secondFactorEnabled}
                onToggle={handleSecondFactorChange}
              />
              <SettingToggle
                label="Wallet activity watchlist"
                description="Alert me if my wallet signs transactions outside BlockVault."
                icon={Shield}
                enabled={walletWatch}
                onToggle={handleWalletWatchChange}
              />
              <SettingToggle
                label="Auto-lock dashboard after 15 minutes"
                description="Require wallet re-authentication when idle."
                icon={Lock}
                enabled={true}
                onToggle={() => toast.success("Auto-lock enforced by policy.")}
                readOnly
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Recovery & Exports</CardTitle>
              <CardDescription>Secure backups for encryption artifacts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Backup RSA keys</p>
                  <p className="text-xs text-muted-foreground">Ensure you never lose access to shared files.</p>
                </div>
                <Button variant="outline" className="border-border text-foreground">
                  <Key className="mr-2 h-4 w-4" />
                  Export Keys
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">RSA Key Management</CardTitle>
              <CardDescription>
                Generate and register your RSA keys for secure file sharing. Your private key stays on this device;
                only your public key is registered with the backend.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-xl">
                <p className="text-sm text-muted-foreground">
                  Required to share encrypted files and participate in signature workflows. You can regenerate keys
                  at any time; recipients will need your latest registered public key.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-border text-foreground hover:border-accent-blue/50"
                onClick={() => setShowRSAManager(true)}
              >
                <Key className="mr-2 h-4 w-4" />
                Manage RSA Keys
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Notification Channels</CardTitle>
              <CardDescription>Select how BlockVault keeps you informed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SettingToggle
                label="Product updates & releases"
                description="Announcements about new zero-knowledge features."
                icon={Bell}
                enabled={notificationPrefs.product}
                onToggle={(value) => handleNotificationToggle("product", value)}
              />
              <SettingToggle
                label="Blockchain anchor confirmations"
                description="Get alerted whenever documents anchor on-chain."
                icon={Shield}
                enabled={notificationPrefs.blockchain}
                onToggle={(value) => handleNotificationToggle("blockchain", value)}
              />
              <SettingToggle
                label="Legal workflow reminders"
                description="Deadlines, signature requests, and court filings."
                icon={Mail}
                enabled={notificationPrefs.legal}
                onToggle={(value) => handleNotificationToggle("legal", value)}
              />
              <SettingToggle
                label="Security incidents & anomalies"
                description="Immediate alerts for wallet irregularities."
                icon={Lock}
                enabled={notificationPrefs.security}
                onToggle={(value) => handleNotificationToggle("security", value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Automation</CardTitle>
              <CardDescription>Personalize quality-of-life automations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingToggle
                label="Auto-save drafts every 30 seconds"
                description="Encrypted drafts stored locally before anchoring."
                icon={RefreshCw}
                enabled={autoSave}
                onToggle={handleAutoSaveToggle}
              />
              <div className="rounded-lg border border-border bg-card/60 p-4">
                <p className="text-sm font-semibold text-foreground">Digest Delivery</p>
                <p className="text-xs text-muted-foreground mb-3">Choose how often BlockVault emails you a compliance digest.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant={statementDelivery === "monthly" ? "default" : "outline"}
                    onClick={() => handleStatementDeliveryChange("monthly")}
                  >
                    Monthly
                  </Button>
                  <Button
                    variant={statementDelivery === "quarterly" ? "default" : "outline"}
                    onClick={() => handleStatementDeliveryChange("quarterly")}
                  >
                    Quarterly
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
        <CardHeader>
              <CardTitle className="text-foreground">Subscription & Usage</CardTitle>
              <CardDescription>Real-time insight into your BlockVault plan.</CardDescription>
        </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <BillingStat label="Plan" value={isCancelled ? "Enterprise (Ending)" : "Enterprise Shield"} accent={isCancelled ? "purple" : "emerald"} />
                <BillingStat label="Seats" value="25 of 50" accent="emerald" />
                <BillingStat label="Storage" value="2.4 TB / 5 TB" accent="emerald" />
              </div>
              <Separator className="separator-glow h-[2px]" />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Billing contact</p>
                  <p className="text-xs text-muted-foreground">
                    Statements and invoices are sent to the address below.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    value={billingEmail}
                    onChange={(event) => setBillingEmail(event.target.value)}
                    className="w-64 bg-card/70 text-sm text-foreground"
                  />
                  <Button
                    variant="outline"
                    className="border-border text-foreground"
                    onClick={handleBillingEmailUpdate}
                  >
                    Update
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Export billing history</p>
                  <p className="text-xs text-muted-foreground">
                    Receive an encrypted ledger of invoices, payments, and usage trends.
                  </p>
                </div>
                <Button variant="outline" className="border-border text-foreground" onClick={handleExportBilling}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Securely
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Cancel subscription</p>
                  <p className="text-xs text-muted-foreground">
                    Downgrade or cancel your plan. Files remain encrypted, but blockchain anchoring stops.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={isCancelled}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {isCancelled ? "Cancellation Pending" : "Request Cancellation"}
                </Button>
              </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
      {showRSAManager && <RSAManager onClose={() => setShowRSAManager(false)} />}
      
      <ConfirmModal
        isOpen={showCancelConfirm}
        onCancel={() => setShowCancelConfirm(false)}
        onConfirm={handleCancelSubscription}
        title="Cancel Subscription?"
        message="Are you sure you want to cancel your Enterprise Shield subscription? Your files will remain encrypted, but blockchain anchoring and automated compliance features will be suspended at the end of your billing cycle."
        confirmText="Confirm Cancellation"
        cancelText="Keep My Plan"
        isDanger={true}
      />
    </div>
  );
}

interface SettingToggleProps {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  readOnly?: boolean;
}

function SettingToggle({ label, description, icon: Icon, enabled, onToggle, readOnly }: SettingToggleProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card/60 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-full border border-border bg-card/80 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{description}</p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={(value) => {
          if (readOnly) return;
          onToggle(value);
        }}
        className="data-[state=checked]:bg-[hsl(var(--accent-blue))]"
        disabled={readOnly}
      />
    </div>
  );
}

interface BillingStatProps {
  label: string;
  value: string;
  accent?: "emerald" | "blue" | "purple";
}

function BillingStat({ label, value, accent = "emerald" }: BillingStatProps) {
  const accentMap = {
    emerald: "border border-border bg-card/70 text-foreground shadow-[0_0_18px_hsl(var(--accent-blue)_/_0.15)]",
    blue: "border border-border bg-card/70 text-foreground shadow-[0_0_18px_hsl(var(--accent-blue)_/_0.2)]",
    purple: "border border-border bg-card/70 text-foreground shadow-[0_0_18px_hsl(var(--accent-blue)_/_0.2)]",
  } as const;

  return (
    <div className={`rounded-lg ${accentMap[accent]} p-4`}> 
      <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}
