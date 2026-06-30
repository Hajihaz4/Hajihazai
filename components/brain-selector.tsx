"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Zap, ChevronDown, Check } from "lucide-react";

export type BrainOption = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
};

export type BrainMode = "manual" | "smart";

/**
 * Collapsed brain picker. Shows a single trigger ([✨ Smart ▾] or the selected
 * brain in manual mode); clicking opens a dropdown with Smart/Manual + the brain
 * list. In Smart mode the brain list is disabled (auto-routing is active).
 */
export default function BrainSelector({
  brains,
  selectedBrainId,
  brainMode,
  onSelectBrain,
  onSetMode,
}: {
  brains: BrainOption[];
  selectedBrainId: string | null;
  brainMode: BrainMode;
  onSelectBrain: (id: string | null) => void;
  onSetMode: (mode: BrainMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isSmart = brainMode === "smart";
  const selectedBrain = brains.find((b) => b.id === selectedBrainId) ?? null;

  return (
    <div ref={ref} className="relative px-2 py-1.5">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={isSmart ? "Smart mode: auto-routes to the best brain" : "Manual mode: choose a brain"}
        className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
          isSmart
            ? "border-violet-500/50 bg-violet-500/10 text-violet-600 dark:text-violet-400"
            : "border-border text-foreground hover:bg-accent"
        }`}
        style={
          !isSmart && selectedBrain
            ? { borderColor: selectedBrain.color + "50", color: selectedBrain.color }
            : undefined
        }
      >
        {isSmart ? (
          <Sparkles className="size-3" />
        ) : selectedBrain ? (
          <span className="text-[13px] leading-none">{selectedBrain.icon}</span>
        ) : (
          <Zap className="size-3" />
        )}
        <span>{isSmart ? "Smart" : selectedBrain?.name ?? "Manual"}</span>
        <ChevronDown className={`size-3 opacity-60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown — opens upward (selector sits just above the composer) */}
      {open && (
        <div
          role="listbox"
          className="absolute bottom-full left-2 z-50 mb-1.5 w-56 overflow-hidden rounded-lg border bg-popover py-1 shadow-lg"
        >
          <ModeRow
            icon={<Sparkles className="size-3.5" />}
            label="Smart"
            hint="Auto-route"
            active={isSmart}
            onClick={() => { onSetMode("smart"); setOpen(false); }}
          />
          <ModeRow
            icon={<Zap className="size-3.5" />}
            label="Manual"
            hint="Pick a brain"
            active={!isSmart}
            onClick={() => onSetMode("manual")}
          />

          <div className="my-1 h-px bg-border" />

          {brains.map((b) => {
            const selected = !isSmart && selectedBrainId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={isSmart}
                onClick={() => { onSelectBrain(b.id); onSetMode("manual"); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-[15px] leading-none">{b.icon}</span>
                <span className="flex-1 truncate">{b.name}</span>
                {selected && <Check className="size-3.5 text-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModeRow({
  icon, label, hint, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
    >
      <span className={active ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
      {active && <Check className="size-3.5 text-foreground" />}
    </button>
  );
}
