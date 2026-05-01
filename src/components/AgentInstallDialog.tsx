import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Terminal, ShieldCheck } from "lucide-react";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; }

export const AgentInstallDialog = ({ open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" /> Instalar o Deploy Console Agent
          </DialogTitle>
          <DialogDescription>
            O agente é um pequeno script que registra o protocolo <code className="font-mono text-primary">lvinstall://</code> no Windows
            e executa os instaladores em segundo plano sem interagir com o usuário. Compatível com Windows 7 SP1 ou superior.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="font-mono text-primary">1.</span>
              <span>Baixe o pacote do agente abaixo.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-primary">2.</span>
              <span>Clique com o botão direito em <code className="font-mono text-primary">install-agent.bat</code> → <strong>Executar como administrador</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-primary">3.</span>
              <span>Pronto. Volte aqui e clique em <strong>Instalar</strong> em qualquer programa.</span>
            </li>
          </ol>

          <div className="rounded-lg border border-border bg-secondary/40 p-4 text-xs font-mono text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">O que o agente faz:</p>
            <ul className="space-y-1">
              <li>→ Baixa o instalador via HTTPS para %TEMP%</li>
              <li>→ Para .exe: executa com os switches silenciosos cadastrados</li>
              <li>→ Para .msi: <span className="text-primary">msiexec /i pacote.msi /qn /norestart</span></li>
              <li>→ Para desinstalar: usa o uninstaller do registro (silencioso)</li>
              <li>→ Tudo em segundo plano. Sem prompts, sem janelas.</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
              <a href="/agent/deploy-console-agent.zip" download>
                <Download className="mr-2 h-4 w-4" /> Baixar agente (.zip)
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/agent/install-agent.bat" download>
                <Download className="mr-2 h-4 w-4" /> install-agent.bat
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/agent/deploy-agent.ps1" download>
                <Download className="mr-2 h-4 w-4" /> deploy-agent.ps1
              </a>
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground/90">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
            <p>
              O agente requer privilégios de administrador apenas para registrar o protocolo (uma vez).
              As instalações posteriores rodarão elevadas via UAC se o instalador exigir, sem janelas extras quando o switch silencioso for aceito.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
