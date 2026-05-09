import type { Tables } from "@/integrations/supabase/types";

export type Program = Tables<"programs">;

export function formatBytes(b?: number | null) {
  if (!b && b !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
