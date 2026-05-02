import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TerminalSquare, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});
const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome").max(100),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  // Login fields
  const [lEmail, setLEmail] = useState("");
  const [lPwd, setLPwd] = useState("");

  // Signup fields
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPwd, setSPwd] = useState("");

  useEffect(() => {
    if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email: lEmail, password: lPwd });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciais inválidas" : error.message);
      return;
    }
    toast.success("Login efetuado");
    navigate("/admin", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email: sEmail, password: sPwd, fullName: sName });
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        data: { full_name: parsed.data.fullName },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Conta criada", {
      description: "Se for o primeiro usuário, você já é administrador. Caso contrário, aguarde aprovação.",
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-10">
      <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> voltar ao catálogo
        </Link>

        <div className="rounded-xl border border-border bg-card/80 p-8 backdrop-blur">
          <div className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-primary">
            <TerminalSquare className="h-4 w-4" /> Área da TI
          </div>
          <h1 className="text-2xl font-bold">Acesso administrativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Entre ou crie sua conta para gerenciar o catálogo.</p>

          <Tabs defaultValue="login" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={lEmail} onChange={(e) => setLEmail(e.target.value)} autoComplete="email" required />
                </div>
                <div>
                  <Label>Senha</Label>
                  <Input type="password" value={lPwd} onChange={(e) => setLPwd(e.target.value)} autoComplete="current-password" required />
                </div>
                <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 pt-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input value={sName} onChange={(e) => setSName(e.target.value)} autoComplete="name" required />
                </div>
                <div>
                  <Label>E-mail corporativo</Label>
                  <Input type="email" value={sEmail} onChange={(e) => setSEmail(e.target.value)} autoComplete="email" required />
                </div>
                <div>
                  <Label>Senha (mín. 8 caracteres)</Label>
                  <Input type="password" value={sPwd} onChange={(e) => setSPwd(e.target.value)} autoComplete="new-password" required />
                </div>
                <Button type="submit" disabled={busy} className="w-full">
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cadastrar
                </Button>
                <p className="text-xs text-muted-foreground">
                  O primeiro cadastro vira administrador automaticamente. Os próximos ficam pendentes de aprovação.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
