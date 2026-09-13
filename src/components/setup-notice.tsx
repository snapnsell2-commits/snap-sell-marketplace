import { Info } from "lucide-react";

import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * Shown until the owner connects their own Supabase project.
 * Browsing works on sample data; accounts, selling and syncing need the connection.
 */
export function SetupNotice({ className }: { className?: string }) {
  if (isSupabaseConfigured) return null;
  return (
    <div
      className={
        "flex items-start gap-3 rounded-2xl border border-dashed bg-surface px-4 py-3 text-sm text-muted-foreground " +
        (className ?? "")
      }
    >
      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
      <p>
        <span className="font-medium text-foreground">Demo mode.</span> Sample listings are shown
        and saved items stay on this device. Connect your Supabase project in Project Settings →
        Connectors to switch on real accounts, listings and photo uploads.
      </p>
    </div>
  );
}
