import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle2, Zap, Shield, Crown, Building2, Check, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { saasService } from '@/api/services/saas.service';
import type { BillingPlan } from '@/types/saas';
import { cn } from '@/lib/utils';

export default function BillingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>('');
  const [usage, setUsage] = useState<{ documentsThisMonth: number }>({ documentsThisMonth: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      try {
        const [allPlans, current] = await Promise.all([
          saasService.getBillingPlans(),
          saasService.getCurrentPlan(),
        ]);

        if (mounted) {
          setPlans(allPlans);
          setCurrentPlanId(current.plan.id);
          setUsage(current.usage);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const activePlan = plans.find(p => p.id === currentPlanId) || plans[0];
  const isUnlimited = activePlan.limits.documentsPerMonth === Infinity;
  const usagePercentage = isUnlimited ? 0 : (usage.documentsThisMonth / activePlan.limits.documentsPerMonth) * 100;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-8 space-y-10 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-primary" />
          Billing & Plans
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Manage your subscription and monitor plan limits.
        </p>
      </div>

      {/* Current Plan Overview */}
      <Card className="p-0 overflow-hidden border-border/60 shadow-md">
        <div className="bg-muted/10 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Current Plan</span>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase border border-primary/20">Active</span>
            </div>
            <h2 className="text-4xl font-extrabold text-foreground">{activePlan.name} Plan</h2>
            <p className="text-muted-foreground mt-2">{activePlan.description}</p>
          </div>
          
          <div className="bg-background rounded-xl p-5 border shadow-sm min-w-[300px]">
            <div className="flex justify-between items-end mb-3">
              <span className="text-sm font-semibold">Monthly Document Limit</span>
              <span className="text-sm">
                <span className="font-bold">{usage.documentsThisMonth}</span>
                <span className="text-muted-foreground"> / {isUnlimited ? '∞' : activePlan.limits.documentsPerMonth}</span>
              </span>
            </div>
            <Progress value={isUnlimited ? 0 : usagePercentage} className="h-2.5 bg-muted" />
            <p className="text-xs text-muted-foreground mt-3 text-right">
              Resets on Apr 1, 2026
            </p>
          </div>
        </div>
      </Card>

      {/* Upgrade Grid */}
      <div>
        <div className="mb-6">
          <h3 className="text-2xl font-bold">Available Plans</h3>
          <p className="text-muted-foreground mt-1">Upgrade or downgrade your organization's workspace at any time.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isPro = plan.id === 'pro';
            
            return (
              <Card 
                key={plan.id}
                className={cn(
                  "relative flex flex-col p-6 sm:p-8 transition-all duration-300",
                  isCurrent ? "border-primary/50 bg-primary/5 shadow-md" : "hover:border-primary/30 border-border/60",
                  isPro && !isCurrent ? "shadow-lg scale-[1.02] border-primary/30" : ""
                )}
              >
                {plan.isPopular && !isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-md z-10">
                    Most Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-4 right-4 text-primary bg-primary/10 p-1.5 rounded-full">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <div className="mt-4 flex items-baseline text-4xl font-extrabold">
                    ${plan.priceMonthly}
                    <span className="ml-1 text-base font-medium text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed h-10">
                    {plan.description}
                  </p>
                </div>

                <div className="flex-1 space-y-4 mb-8">
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground mb-4">Features included</p>
                  
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        <span className="font-semibold">{plan.limits.storageBytes === Infinity ? 'Unlimited' : `${plan.limits.storageBytes / (1024*1024*1024)} GB`}</span> storage
                      </span>
                    </li>
                    <li className="flex gap-3 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-foreground">
                        <span className="font-semibold">{plan.limits.documentsPerMonth === Infinity ? 'Unlimited' : plan.limits.documentsPerMonth}</span> documents/mo
                      </span>
                    </li>
                    
                    <div className="w-full h-px bg-border/50 my-2" />
                    
                    {plan.limits.features.map((feature, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button 
                  variant={isCurrent ? "outline" : (isPro ? "default" : "secondary")}
                  className={cn("w-full gap-2 font-semibold", isPro && !isCurrent ? "shadow-md hover:shadow-lg" : "")}
                  disabled={isCurrent}
                >
                  {isCurrent ? 'Current Plan' : 'Upgrade Plan'}
                  {!isCurrent && <ArrowRight className="w-4 h-4" />}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}
