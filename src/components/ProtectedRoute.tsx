import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, isPending, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">
            {isPending ? "Aguardando aprovação" : "Acesso negado"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isPending
              ? "Sua conta foi criada e está aguardando um administrador aprovar seu acesso à área de TI."
              : "Sua conta não tem permissão para acessar esta área."}
          </p>
          <Button className="mt-6 w-full" variant="outline" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
