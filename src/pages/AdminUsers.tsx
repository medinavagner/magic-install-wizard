import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  roles: ("admin" | "pending")[];
};

const AdminUsers = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const byUser = new Map<string, ("admin" | "pending")[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    });
    setRows((profiles ?? []).map((p: any) => ({ ...p, roles: byUser.get(p.id) ?? [] })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const promote = async (uid: string) => {
    setBusyId(uid);
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "pending");
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    setBusyId(null);
    if (error) toast.error(error.message);
    else { toast.success("Usuário aprovado como administrador"); load(); }
  };

  const revoke = async (uid: string) => {
    if (uid === user?.id) { toast.error("Você não pode revogar a si mesmo"); return; }
    if (!confirm("Revogar acesso de administrador deste usuário?")) return;
    setBusyId(uid);
    await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    await supabase.from("user_roles").insert({ user_id: uid, role: "pending" });
    setBusyId(null);
    toast.success("Acesso revogado");
    load();
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-6 py-6">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> voltar
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Usuários da TI</h1>
            <p className="text-sm text-muted-foreground">Gerencie quem tem acesso ao painel administrativo.</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="rounded-xl border border-border bg-card">
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isAdmin = r.roles.includes("admin");
                  const isMe = r.id === user?.id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.full_name || "—"} {isMe && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell>
                        {isAdmin
                          ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Administrador</Badge>
                          : <Badge variant="outline">Pendente</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin ? (
                          <Button size="sm" variant="ghost" disabled={isMe || busyId === r.id} onClick={() => revoke(r.id)} className="text-destructive hover:text-destructive">
                            <ShieldOff className="mr-1 h-3 w-3" /> Revogar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => promote(r.id)}>
                            <ShieldCheck className="mr-1 h-3 w-3" /> Aprovar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-10">Nenhum usuário cadastrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminUsers;
