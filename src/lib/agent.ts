// Helpers para integração com o agente Windows local via protocolo customizado.
// O agente é registrado no Windows como handler do esquema `lvinstall://`.
// Formato: lvinstall://install/<id>?url=<installerUrl>&type=exe|msi&args=<silentArgs>
//          lvinstall://uninstall/<id>?args=<silentArgs>&key=<uninstallRegistryKey>

import type { Tables } from "@/integrations/supabase/types";

export type Program = Tables<"programs">;

export const PROTOCOL = "lvinstall";

export function buildInstallUri(p: Program, installerUrl: string) {
  const params = new URLSearchParams({
    url: installerUrl,
    type: p.installer_type,
    args: p.silent_install_args,
    name: p.name,
  });
  return `${PROTOCOL}://install/${p.id}?${params.toString()}`;
}

export function buildUninstallUri(p: Program) {
  const params = new URLSearchParams({
    args: p.silent_uninstall_args,
    name: p.name,
  });
  if (p.uninstall_registry_key) params.set("key", p.uninstall_registry_key);
  if (p.installer_type) params.set("type", p.installer_type);
  return `${PROTOCOL}://uninstall/${p.id}?${params.toString()}`;
}

export function launchUri(uri: string) {
  // Usa um <a> invisível para evitar bloqueios de popup.
  const a = document.createElement("a");
  a.href = uri;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(b?: number | null) {
  if (!b && b !== 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = b;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
