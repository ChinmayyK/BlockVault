import { RiskReport } from "@/types/redactor";
import { AlertTriangle, ShieldCheck, Download, ArrowRight, ShieldAlert } from "lucide-react";

interface RiskScanPanelProps {
    report: RiskReport;
    onStartRedaction: () => void;
}

export function RiskScanPanel({ report, onStartRedaction }: RiskScanPanelProps) {
    const isCritical = report.risk_level === "Critical" || report.risk_level === "High";
    const isMedium = report.risk_level === "Medium";
    const isLow = report.risk_level === "Low";

    const getTheme = () => {
        if (report.risk_level === "Critical") return "from-rose-500/10 to-transparent border-rose-500/30 text-rose-500 ring-rose-500/50 bg-rose-500/20";
        if (report.risk_level === "High") return "from-orange-500/10 to-transparent border-orange-500/30 text-orange-500 ring-orange-500/50 bg-orange-500/20";
        if (report.risk_level === "Medium") return "from-amber-500/10 to-transparent border-amber-500/30 text-amber-500 ring-amber-500/50 bg-amber-500/20";
        return "from-emerald-500/10 to-transparent border-emerald-500/30 text-emerald-500 ring-emerald-500/50 bg-emerald-500/20";
    };

    const handleDownloadReport = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
        const anchor = document.createElement("a");
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", `security_risk_report_${new Date().getTime()}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    };

    const themeStr = getTheme();
    const [gradient, , border, textColor, ring, badgeBg] = themeStr.split(" ");
    
    // Group entities by category
    const CATEGORY_MAP: Record<string, string> = {
        AADHAAR: 'Government ID',
        PAN: 'Government ID',
        US_SSN: 'Government ID',
        US_PASSPORT: 'Government ID',
        UK_NHS: 'Government ID',
        CREDIT_CARD: 'Financial',
        IBAN_CODE: 'Financial',
        CRYPTO: 'Financial',
        EMAIL_ADDRESS: 'Personal (PII)',
        PHONE_NUMBER: 'Personal (PII)',
        PERSON: 'Personal (PII)',
        LOCATION: 'Personal (PII)',
        DATE_TIME: 'Personal (PII)',
        URL: 'Technical',
        IP_ADDRESS: 'Technical',
    };
    
    const groupedEntities = Object.entries(report.entities).reduce((acc, [type, count]) => {
        const category = CATEGORY_MAP[type] || 'Other Identifiers';
        if (!acc[category]) acc[category] = [];
        acc[category].push({ type, count });
        return acc;
    }, {} as Record<string, Array<{ type: string; count: number }>>);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-950/50 backdrop-blur-sm">
            <div className={`w-full max-w-2xl bg-slate-900 border rounded-xl overflow-hidden shadow-2xl ${border}`}>
                {/* Header Section */}
                <div className={`p-8 border-b ${border} bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-8 opacity-20">
                        {report.risk_level === "Critical" || report.risk_level === "High" ? <ShieldAlert className={`w-32 h-32 ${textColor}`} /> : <ShieldCheck className={`w-32 h-32 ${textColor}`} />}
                    </div>
                    
                    <div className="relative z-10">
                        <h2 className="text-3xl font-light text-slate-100 tracking-tight mb-2">
                            Document Security Scan
                        </h2>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-400">Overall Risk Level:</span>
                            <span className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-full ${badgeBg} ${textColor} ring-1 inset-0 ${ring}`}>
                                {report.risk_level}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-8 space-y-8">
                    {/* Insights */}
                    {report.insights.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Security Insights</h3>
                            <div className="space-y-2">
                                {report.insights.map((insight, idx) => (
                                    <div key={idx} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                        <AlertTriangle className={`w-5 h-5 mt-0.5 ${textColor}`} />
                                        <p className="text-sm text-slate-300 leading-relaxed">{insight}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Entities Breakdown */}
                    <div>
                         <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Sensitive Data Detected</h3>
                         {Object.keys(report.entities).length > 0 ? (
                             <div className="space-y-4">
                                 {Object.entries(groupedEntities).map(([category, items]) => (
                                     <div key={category} className="space-y-2">
                                         <h4 className="text-xs font-medium text-slate-500 uppercase tracking-widest">{category}</h4>
                                         <div className="grid grid-cols-2 gap-3">
                                             {items.map(({ type, count }) => (
                                                 <div key={type} className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg border border-slate-800">
                                                     <span className="text-sm font-medium text-slate-300">{type.replace(/_/g, " ")}</span>
                                                     <span className={`text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-100`}>{count}</span>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <p className="text-sm text-slate-500 italic">No sensitive structured categories detected.</p>
                         )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                        <button
                            onClick={handleDownloadReport}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download Security Report
                        </button>
                        
                        <button
                            onClick={onStartRedaction}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)]"
                        >
                            Start Redaction
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
