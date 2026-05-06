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

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs">
            <p className="mb-2 font-semibold text-foreground">Instalação permanente:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>→ Registrado para <strong>todos os usuários</strong> da máquina (HKLM).</li>
              <li>→ <strong>Sobrevive a reinicializações</strong> — não roda em segundo plano, é acionado pelo navegador via protocolo.</li>
              <li>→ Tarefa agendada de <strong>auto-reparo</strong> restaura o registro automaticamente se for removido.</li>
              <li>→ Para <strong>atualizar</strong>: baixe o novo ZIP e rode <code className="font-mono text-primary">install-agent.bat</code> de novo como admin.</li>
            </ul>
          </div>

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

          {(() => {
            const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-agent`;
            return (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
                    <a href={`${base}?file=zip`} target="_blank" rel="noopener">
                      <Download className="mr-2 h-4 w-4" /> Baixar agente (.zip)
                    </a>
                  </Button>
                  <Button asChild variant="secondary">
                    <a href={`${base}?file=bat`} target="_blank" rel="noopener">
                      <Download className="mr-2 h-4 w-4" /> install-agent.bat
                    </a>
                  </Button>
                  <Button asChild variant="secondary">
                    <a href={`${base}?file=ps1`} target="_blank" rel="noopener">
                      <Download className="mr-2 h-4 w-4" /> deploy-agent.ps1
                    </a>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O download abre em nova aba. Se nada acontecer no preview, publique o projeto e baixe pela URL publicada.
                </p>
              </>
            );
          })()}

          <div className="rounded-lg border border-border bg-card/40 p-4 text-xs">
            <p className="mb-2 font-semibold text-foreground">Não está instalando? Verifique:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>→ O agente foi instalado uma vez via <code className="font-mono text-primary">install-agent.bat</code> como administrador?</li>
              <li>→ O navegador perguntou “Abrir Deploy Console Agent?” e você autorizou?</li>
              <li>→ Logs em <code className="font-mono text-primary">C:\ProgramData\DeployConsoleAgent\agent.log</code></li>
              <li>→ Códigos: <span className="font-mono">0</span> sucesso · <span className="font-mono">3010</span> sucesso (reiniciar) · <span className="font-mono">1603</span> erro MSI · outros: argumento silencioso pode estar incorreto.</li>
              <li>→ Se atualizou o agente, rode novamente <code className="font-mono text-primary">install-agent.bat</code> como admin.</li>
            </ul>
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
