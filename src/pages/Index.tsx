import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgramCard } from "@/components/ProgramCard";
import { AgentInstallDialog } from "@/components/AgentInstallDialog";
import { Search, TerminalSquare, PackageSearch, ShieldCheck, Download } from "lucide-react";
import type { Program } from "@/lib/agent";

const Index = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
      if (data) setPrograms(data);
      setLoading(false);
    })();
  }, []);

  const filtered = programs.filter((p) =>
    [p.name, p.publisher, p.description].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="container relative mx-auto px-6 py-12 md:py-20">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
              <TerminalSquare className="h-4 w-4" /> Deploy Console · Windows 7+
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setAgentOpen(true)} variant="outline" size="sm" className="text-xs">
                <Download className="mr-1 h-3 w-3" /> Baixar agente Windows
              </Button>
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to="/auth"><ShieldCheck className="mr-1 h-3 w-3" /> Área da TI</Link>
              </Button>
            </div>
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Instale softwares no Windows <span className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] bg-clip-text text-transparent">com um clique</span>, em silêncio.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Antes de instalar pela primeira vez, baixe e execute o <span className="font-mono text-foreground">agente Windows</span>. Depois, escolha um software no catálogo e clique em <span className="font-mono text-foreground">Instalar</span>.
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Catálogo de softwares</h2>
            <p className="text-sm text-muted-foreground">{programs.length} {programs.length === 1 ? "programa disponível" : "programas disponíveis"}</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar…" className="pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0,1,2].map(i => <div key={i} className="h-56 animate-pulse rounded-xl border border-border bg-card/50" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-16 text-center">
            <PackageSearch className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum programa disponível</h3>
            <p className="mt-1 text-sm text-muted-foreground">A equipe de TI ainda não publicou softwares no catálogo.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProgramCard key={p.id} program={p} readOnly />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Deploy Console — workflow de instalação silenciosa para Windows 7 ou superior.
      </footer>

      <AgentInstallDialog open={agentOpen} onOpenChange={setAgentOpen} />
    </div>
  );
};

export default Index;
