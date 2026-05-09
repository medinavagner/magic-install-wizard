import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Terminal } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export const AgentInstallDialog = ({ open, onOpenChange }: Props) => {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-agent`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" /> Baixar instalador Deploy Console
          </DialogTitle>
          <DialogDescription>
            Um único aplicativo para Windows que lista todos os programas do catálogo e instala em silêncio os que você marcar.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-2 text-sm">
          <li><span className="font-mono text-primary">1.</span> Baixe o ZIP e extraia em qualquer pasta.</li>
          <li><span className="font-mono text-primary">2.</span> Execute <code className="font-mono text-primary">DeployConsole.bat</code> (será solicitada permissão de administrador).</li>
          <li><span className="font-mono text-primary">3.</span> Marque os programas desejados e clique em <strong>Instalar selecionados</strong>.</li>
        </ol>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          Compatível com Windows 7 SP1 ou superior · PowerShell 2.0+ · Logs em <code className="font-mono">%ProgramData%\DeployConsole\install.log</code>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
            <a href={`${base}?file=zip`} target="_blank" rel="noopener">
              <Download className="mr-2 h-4 w-4" /> Baixar DeployConsole.zip
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href={`${base}?file=bat`} target="_blank" rel="noopener">
              <Download className="mr-2 h-4 w-4" /> .bat
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href={`${base}?file=ps1`} target="_blank" rel="noopener">
              <Download className="mr-2 h-4 w-4" /> .ps1
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
