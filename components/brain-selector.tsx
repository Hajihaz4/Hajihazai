"use client";

import { Sparkles, Zap } from "lucide-react";

export type BrainOption = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
};

export type BrainMode = "manual" | "smart";

export default function BrainSelector({
  brains,
  selectedBrainId,
  brainMode,
  onSelectBrain,
  onToggleMode,
}: {
  brains: BrainOption[];
  selectedBrainId: string | null;
  brainMode: BrainMode;
  onSelectBrain: (id: string | null) => void;
  onToggleMode: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
      {/* Smart mode toggle */}
      <button
        type="button"
        onClick={onToggleMode}
        title={brainMode === "smart" ? "Smart mode: auto-routes to best brain" : "Manual mode: choose brain yourself"}
        className={`flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors ${
          brainMode === "smart"
            ? "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400"
            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
        }`}
      >
        {brainMode === "smart" ? (
          <Sparkles className="size-3" />
        ) : (
          <Zap className="size-3" />
        )}
        {brainMode === "smart" ? "Smart" : "Manual"}
      </button>

      <span className="h-4 w-px bg-border" />

      {/* Brain pills */}
      {brains.map((b) => {
        const isSelected = selectedBrainId === b.id;
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => onSelectBrain(isSelected && brainMode === "manual" ? null : b.id)}
            title={b.name}
            disabled={brainMode === "smart"}
            className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              isSelected && brainMode === "manual"
                ? "border-current/30 text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            }`}
            style={
              isSelected && brainMode === "manual"
                ? { backgroundColor: b.color + "18", borderColor: b.color + "50", color: b.color }
                : undefined
            }
          >
            <span>{b.icon}</span>
            <span className="hidden sm:inline">{b.name}</span>
          </button>
        );
      })}
    </div>
  );
}
