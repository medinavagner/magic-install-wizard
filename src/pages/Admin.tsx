import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgramCard } from "@/components/ProgramCard";
import { ProgramFormDialog } from "@/components/ProgramFormDialog";
import { AgentInstallDialog } from "@/components/AgentInstallDialog";
import { Plus, Search, TerminalSquare, PackageSearch, Download, Users, LogOut } from "lucide-react";
import type { Program } from "@/lib/agent";

const Admin = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("programs").select("*").order("created_at", { ascending: false });
    if (data) setPrograms(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = programs.filter((p) =>
    [p.name, p.publisher, p.description].filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="container relative mx-auto px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
                <TerminalSquare className="h-4 w-4" /> Painel administrativo · TI
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                Gerenciamento de <span className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] bg-clip-text text-transparent">softwares</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/users"><Users className="mr-1 h-4 w-4" /> Usuários</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/">Ver catálogo público</Link>
              </Button>
              <Button onClick={handleSignOut} variant="ghost" size="sm">
                <LogOut className="mr-1 h-4 w-4" /> Sair
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground glow-primary">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar programa
            </Button>
            <Button onClick={() => setAgentOpen(true)} variant="secondary">
              <Download className="mr-2 h-4 w-4" /> Baixar agente Windows
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Biblioteca de softwares</h2>
            <p className="text-sm text-muted-foreground">{programs.length} {programs.length === 1 ? "programa cadastrado" : "programas cadastrados"}</p>
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
            <h3 className="mt-4 text-lg font-semibold">Nenhum programa ainda</h3>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre o primeiro programa para começar.</p>
            <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Cadastrar programa
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProgramCard
                key={p.id}
                program={p}
                onEdit={(prog) => { setEditing(prog); setFormOpen(true); }}
                onDeleted={load}
              />
            ))}
          </div>
        )}
      </main>

      <ProgramFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={load} />
      <AgentInstallDialog open={agentOpen} onOpenChange={setAgentOpen} />
    </div>
  );
};

export default Admin;
