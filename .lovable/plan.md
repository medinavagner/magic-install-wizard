Esclarecimento e plano para tornar o agente permanente

Situação atual
- O agente já fica instalado de forma permanente: o `install-agent.bat` copia `deploy-agent.ps1` para `C:\ProgramData\DeployConsoleAgent\` e registra o protocolo `lvinstall://` no registro do Windows (`HKCR\lvinstall`).
- Ele NÃO precisa ficar rodando em segundo plano: o Windows invoca o PowerShell automaticamente toda vez que o navegador chama um link `lvinstall://...`. É exatamente como Zoom, Teams, Spotify, Steam funcionam.
- Portanto, depois de instalado uma vez (como administrador), o agente está sempre pronto para uso, mesmo após reiniciar a máquina.

O que vou melhorar para garantir que ele realmente fique sempre ativo

1. Registro em escopo de máquina, não de usuário
- Atualizar `install-agent.bat` para registrar o protocolo em `HKLM\SOFTWARE\Classes\lvinstall` (todos os usuários da máquina), além de `HKCR`. Isso garante que mesmo trocando de usuário Windows o agente continua funcionando.

2. Tarefa agendada de auto-reparo (Health Check)
- Criar uma Tarefa Agendada do Windows chamada `DeployConsoleAgent-HealthCheck` que roda no logon e diariamente.
- Ela executa um pequeno script que verifica:
  - Se `deploy-agent.ps1` está em `C:\ProgramData\DeployConsoleAgent\`.
  - Se as chaves de registro do protocolo `lvinstall://` ainda existem.
- Se algo estiver faltando, ela restaura os arquivos e o registro automaticamente. Isso protege contra antivírus, limpadores de sistema ou usuários removendo por engano.

3. Permissões corretas na pasta do agente
- Definir permissões em `C:\ProgramData\DeployConsoleAgent\` para que qualquer usuário possa ler e executar, mas só administradores possam alterar. Evita que um usuário comum quebre o agente.

4. Indicador de versão
- Salvar um arquivo `version.txt` na pasta do agente.
- Adicionar no diálogo "Baixar agente Windows" do site uma observação clara: "Se você já instalou o agente antes, basta rodar `install-agent.bat` novamente como administrador para atualizar — todas as configurações são preservadas."

5. Atualizar o desinstalador
- `uninstall-agent.bat` também removerá a Tarefa Agendada e as chaves em `HKLM`, para uma desinstalação limpa.

O que NÃO vou fazer (e por quê)
- Não vou transformar o agente em um Serviço Windows que fica rodando 24/7. Não há necessidade — ele só precisa existir e estar registrado. Manter um serviço rodando consome memória sem benefício, já que o protocolo é o gatilho.
- Não vou criar um ícone na bandeja do sistema. O agente é "invisível por design": o usuário só interage com ele via cliques no painel web.

Resultado esperado
- Após executar `install-agent.bat` uma vez como administrador:
  - O agente fica registrado para todos os usuários da máquina.
  - Sobrevive a reinicializações.
  - Se algo apagar acidentalmente, a tarefa agendada restaura sozinha.
  - Atualizações futuras são feitas só rodando o `install-agent.bat` novo, sem precisar desinstalar antes.

Arquivos que vou alterar
- `supabase/functions/download-agent/index.ts` — atualizar `INSTALL_BAT`, `UNINSTALL_BAT`, adicionar script de health-check no ZIP.
- `src/components/AgentInstallDialog.tsx` — atualizar instruções e adicionar nota sobre atualização e persistência.