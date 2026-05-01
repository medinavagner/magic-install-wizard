import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UploadCloud, Loader2 } from "lucide-react";
import type { Program } from "@/lib/agent";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Program | null;
  onSaved: () => void;
}

const defaultArgsFor = (type: "exe" | "msi", action: "install" | "uninstall") => {
  if (type === "msi") return action === "install" ? "/qn /norestart" : "/qn /norestart";
  return action === "install" ? "/S /VERYSILENT /SUPPRESSMSGBOXES /NORESTART" : "/S /VERYSILENT /SUPPRESSMSGBOXES /NORESTART";
};

export const ProgramFormDialog = ({ open, onOpenChange, editing, onSaved }: Props) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [publisher, setPublisher] = useState("");
  const [installArgs, setInstallArgs] = useState("/S");
  const [uninstallArgs, setUninstallArgs] = useState("/S");
  const [registryKey, setRegistryKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setVersion(editing?.version ?? "");
      setPublisher(editing?.publisher ?? "");
      setInstallArgs(editing?.silent_install_args ?? "/S");
      setUninstallArgs(editing?.silent_uninstall_args ?? "/S");
      setRegistryKey(editing?.uninstall_registry_key ?? "");
      setFile(null);
    }
  }, [open, editing]);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext === "msi" || ext === "exe") {
      if (installArgs === "/S" || !installArgs) setInstallArgs(defaultArgsFor(ext, "install"));
      if (uninstallArgs === "/S" || !uninstallArgs) setUninstallArgs(defaultArgsFor(ext, "uninstall"));
    }
    if (!name) setName(f.name.replace(/\.(exe|msi)$/i, ""));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error("Informe o nome do programa"); return; }
    if (!editing && !file) { toast.error("Selecione o arquivo .exe ou .msi"); return; }
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext !== "exe" && ext !== "msi") { toast.error("Apenas .exe ou .msi"); return; }
    }

    setSaving(true);
    try {
      let installer_path = editing?.installer_path ?? "";
      let installer_type = editing?.installer_type ?? "exe";
      let file_size_bytes = editing?.file_size_bytes ?? null;

      if (file) {
        installer_type = file.name.split(".").pop()!.toLowerCase();
        installer_path = `${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("installers")
          .upload(installer_path, file, { contentType: "application/octet-stream", upsert: false });
        if (upErr) throw upErr;
        file_size_bytes = file.size;

        if (editing?.installer_path) {
          await supabase.storage.from("installers").remove([editing.installer_path]);
        }
      }

      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        version: version.trim() || null,
        publisher: publisher.trim() || null,
        installer_path,
        installer_type,
        silent_install_args: installArgs.trim() || "/S",
        silent_uninstall_args: uninstallArgs.trim() || "/S",
        uninstall_registry_key: registryKey.trim() || null,
        file_size_bytes,
      };

      if (editing) {
        const { error } = await supabase.from("programs").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Programa atualizado");
      } else {
        const { error } = await supabase.from("programs").insert(payload);
        if (error) throw error;
        toast.success("Programa cadastrado");
      }

      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar programa" : "Cadastrar programa"}</DialogTitle>
          <DialogDescription>
            Envie um instalador <span className="font-mono text-foreground">.exe</span> ou <span className="font-mono text-foreground">.msi</span> e configure os parâmetros silenciosos.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div>
            <Label>Instalador {editing && "(opcional ao editar)"}</Label>
            <label className="mt-1 flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground">
              <UploadCloud className="h-5 w-5" />
              <span>{file ? file.name : (editing ? "Substituir arquivo (opcional)" : "Selecionar .exe ou .msi")}</span>
              <input type="file" accept=".exe,.msi" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Google Chrome" />
            </div>
            <div>
              <Label>Versão</Label>
              <Input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="124.0.0" />
            </div>
          </div>

          <div>
            <Label>Fabricante</Label>
            <Input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Google LLC" />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Navegador web rápido e seguro." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="font-mono text-xs">Args de instalação silenciosa</Label>
              <Input value={installArgs} onChange={(e) => setInstallArgs(e.target.value)} className="font-mono" />
            </div>
            <div>
              <Label className="font-mono text-xs">Args de desinstalação silenciosa</Label>
              <Input value={uninstallArgs} onChange={(e) => setUninstallArgs(e.target.value)} className="font-mono" />
            </div>
          </div>

          <div>
            <Label className="font-mono text-xs">Chave de desinstalação (opcional, registry uninstall key ou GUID MSI)</Label>
            <Input value={registryKey} onChange={(e) => setRegistryKey(e.target.value)} className="font-mono" placeholder="{8A69D345-D564-463c-AFF1-A69D9E530F96} ou nome do app" />
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Dicas de switches silenciosos:</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              <li>• MSI: <span className="text-primary">msiexec /i app.msi /qn /norestart</span></li>
              <li>• Inno Setup: <span className="text-primary">/VERYSILENT /SUPPRESSMSGBOXES /NORESTART</span></li>
              <li>• NSIS: <span className="text-primary">/S</span></li>
              <li>• InstallShield: <span className="text-primary">/s /v"/qn"</span></li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-gradient-to-r from-primary to-[hsl(var(--primary-glow))] text-primary-foreground">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editing ? "Salvar alterações" : "Cadastrar programa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
