import { AlertCircle } from "lucide-react";
import { LegalModalFrame } from "@/components/legal/modals/LegalModalFrame";
import { RedactionGroup } from "@/types/redactor";

interface ConsistencyPromptModalProps {
  group: RedactionGroup;
  onRedactAll: () => void;
  onReviewMatches: () => void;
  onIgnore: () => void;
}

export function ConsistencyPromptModal({ group, onRedactAll, onReviewMatches, onIgnore }: ConsistencyPromptModalProps) {
  const remainingCount = group.count - 1; // Assuming 1 was just approved

  return (
    <LegalModalFrame
      icon={<AlertCircle className="h-5 w-5 text-indigo-400" />}
      title="Repeated Term Detected"
      subtitle="Ensure consistent redaction across the document."
      onClose={onIgnore}
      widthClassName="max-w-md"
      className="border-indigo-500/20 bg-[rgba(15,23,42,0.95)] shadow-[0_28px_90px_rgba(2,6,23,0.8)] ring-1 ring-indigo-500/20"
      contentClassName="space-y-6"
      overlayClassName="bg-black/80 backdrop-blur-[2px]"
      headerAccent="violet"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onIgnore}
            className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Ignore
          </button>
          <button
            onClick={onReviewMatches}
            className="px-4 py-2 text-sm rounded-lg border border-indigo-500/30 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
          >
            Review Matches
          </button>
          <button
            onClick={onRedactAll}
            className="px-4 py-2 text-sm rounded-lg font-medium bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-[0_0_15px_rgba(79,70,229,0.4)]"
          >
            Redact All ({group.count})
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-300 leading-relaxed">
          You just approved redaction for the term:
        </p>
        <div className="p-3 bg-black/40 border border-slate-700/50 rounded-lg">
          <p className="font-mono text-indigo-300 text-center font-medium line-clamp-2">
            "{group.term}"
          </p>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          We found <strong className="text-white">{remainingCount} more occurrence{remainingCount !== 1 ? 's' : ''}</strong> of this term. Would you like to redact all of them automatically, or review them one by one?
        </p>
      </div>
    </LegalModalFrame>
  );
}
