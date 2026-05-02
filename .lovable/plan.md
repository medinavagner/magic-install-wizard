# Corrigir download do agente Windows

## Causa

No ambiente de preview do Lovable, o proxy de fetch interfere no download de arquivos binários estáticos servidos a partir de `/agent/*` (especialmente `.zip` contendo `.bat`/`.ps1`). Resultado: o download falha **e** a sessão do iframe é quebrada, deslogando o usuário.

O código atual está correto — o problema é exclusivo do preview. Na URL publicada já funcionaria, mas vamos resolver para funcionar nos dois ambientes.

## Solução

Servir o agente através de uma **edge function** do Lovable Cloud. Edge functions não passam pelo proxy do preview e respondem com `Content-Disposition: attachment` direto do CDN do Supabase.

## Mudanças

### 1. Nova edge function `supabase/functions/download-agent/index.ts`
- Pública (sem JWT), com CORS liberado.
- `GET /functions/v1/download-agent?file=zip` → devolve o `deploy-console-agent.zip` montado on-the-fly com JSZip, contendo: `install-agent.bat`, `deploy-agent.ps1`, `uninstall-agent.bat`, `README.txt`.
- `?file=ps1` | `?file=bat` | `?file=uninstall` | `?file=readme` → devolve cada arquivo individualmente como `text/plain` com `Content-Disposition: attachment`.
- Os conteúdos dos scripts ficam embutidos como strings dentro da função (mesmos conteúdos atuais de `public/agent/`), então não há dependência do filesystem do frontend nem necessidade de upload prévio.

### 2. `src/components/AgentInstallDialog.tsx`
- Construir a URL base da função: `${VITE_SUPABASE_URL}/functions/v1/download-agent`.
- Trocar os 3 botões de download para apontar para essa URL com o `?file=` correspondente.
- Adicionar `target="_blank" rel="noopener"` em cada `<a>` — isso evita que a navegação quebre a sessão do iframe do preview, mesmo no pior caso.
- Adicionar uma nota discreta: *"O download abre em nova aba. Se estiver no preview e nada acontecer, publique o projeto e tente pela URL publicada."*

### 3. Manter `public/agent/*` como fallback
Não removo os arquivos estáticos — eles continuam servindo como redundância para a URL publicada e como fonte de verdade para revisão de código.

## Detalhes técnicos

```text
ANTES                              DEPOIS
Browser                            Browser
   │                                  │
   ▼ /agent/deploy-console-agent.zip  ▼ /functions/v1/download-agent?file=zip
   │  (interceptado pelo proxy        │  (Supabase Edge — sem proxy)
   │   do preview)                    │
   ✗ falha + deslogout                ✓ ZIP gerado on-the-fly
```

- Runtime: Deno (edge function padrão do Supabase).
- Dependência: `npm:jszip@3.10.1` para empacotar o ZIP em memória.
- Resposta ZIP: `Content-Type: application/zip` + `Content-Disposition: attachment; filename="deploy-console-agent.zip"`.
- Sem secrets adicionais — usa apenas o que já existe.
- Sem mudanças no banco de dados.
- Após deploy, valido com `curl` na função para garantir que o ZIP é retornado corretamente (cabeçalhos e tamanho).

## Resultado esperado

Clicar em "Baixar agente (.zip)" no diálogo abre uma nova aba que dispara o download imediatamente, sem deslogar do Lovable, tanto no preview quanto na URL publicada.
