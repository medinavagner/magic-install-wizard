import { Download, Trash2, Package, FileBox, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { buildInstallUri, buildUninstallUri, formatBytes, launchUri, type Program } from "@/lib/agent";
import { toast } from "sonner";

interface Props {
  program: Program;
  onEdit?: (p: Program) => void;
  onDeleted?: () => void;
  readOnly?: boolean;
}

export const ProgramCard = ({ program, onEdit, onDeleted, readOnly = false }: Props) => {
  const installerUrl = supabase.storage
    .from("installers")
    .getPublicUrl(program.installer_path).data.publicUrl;

  const handleInstall = () => {
    launchUri(buildInstallUri(program, installerUrl));
    toast.message(`Solicitação enviada ao agente: ${program.name}`, {
      description:
        "Se o navegador perguntar, autorize abrir o Deploy Console Agent. Se nada acontecer, instale o agente Windows e tente novamente. Logs em C:\\ProgramData\\DeployConsoleAgent\\agent.log.",
      duration: 8000,
    });
  };

  const handleUninstall = () => {
    launchUri(buildUninstallUri(program));
    toast.message(`Solicitação de desinstalação enviada: ${program.name}`, {
      description: "O agente irá remover silenciosamente. Verifique o log do agente em caso de erro.",
      duration: 6000,
    });
  };

  const handleDelete = async () => {
    if (!confirm(`Remover ${program.name} do catálogo?`)) return;
    await supabase.storage.from("installers").remove([program.installer_path]);
    const { error } = await supabase.from("programs").delete().eq("id", program.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido do catálogo"); onDeleted?.(); }
  };

  return (
    <div className="group surface-elevated relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-primary">
          {program.icon_url
            ? <img src={program.icon_url} alt="" className="h-10 w-10 rounded" />
            : program.installer_type === "msi"
              ? <FileBox className="h-6 w-6" />
              : <Package className="h-6 w-6" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold">{program.name}</h3>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">{program.installer_type}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[program.publisher, program.version].filter(Boolean).join(" · ") || "Sem metadados"}
          </p>
        </div>
      </div>

      {program.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">{program.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
        <span>{formatBytes(program.file_size_bytes)}</span>
        <span className="truncate ml-2">args: {program.silent_install_args}</span>
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button onClick={handleInstall} className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground hover:opacity-90">
          <Download className="mr-1 h-4 w-4" /> Instalar
        </Button>
        <Button onClick={handleUninstall} variant="secondary">
          <Trash2 className="mr-1 h-4 w-4" /> Desinstalar
        </Button>
      </div>

      {!readOnly && (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit?.(program)} className="h-7 text-xs text-muted-foreground">
            <Pencil className="mr-1 h-3 w-3" /> Editar
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} className="h-7 text-xs text-destructive hover:text-destructive">
            <Trash2 className="mr-1 h-3 w-3" /> Remover
          </Button>
        </div>
      )}
    </div>
  );
};
