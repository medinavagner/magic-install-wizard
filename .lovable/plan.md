Plano para corrigir a falha de instalação dos programas

O problema mais provável está no agente Windows gerado: ele baixa o instalador, mas executa os comandos de instalação de forma frágil e sem feedback para o usuário. Também há risco de argumentos silenciosos incorretos para alguns EXE, e hoje a tela sempre mostra “Instalando...” mesmo se o agente não estiver instalado, se o protocolo falhar, ou se o instalador retornar erro.

O que vou alterar:

1. Reforçar o agente Windows
- Atualizar `supabase/functions/download-agent/index.ts` para gerar uma nova versão do `deploy-agent.ps1`.
- Melhorar os logs em `C:\ProgramData\DeployConsoleAgent\agent.log`, registrando:
  - ação recebida (`install` ou `uninstall`),
  - URL baixada,
  - arquivo temporário criado,
  - comando executado,
  - código de saída,
  - erros detalhados.
- Tornar o download mais compatível com Windows antigos, usando TLS 1.2 e fallback para `WebClient`/`Invoke-WebRequest` quando necessário.
- Corrigir a execução de `.msi` para sempre usar `msiexec.exe /i "arquivo.msi" ...`.
- Para `.exe`, melhorar a execução e validação do arquivo baixado antes de rodar.
- Evitar que uma chamada de instalação seja confundida com desinstalação nos logs.

2. Adicionar retorno visual no site
- Atualizar `src/lib/agent.ts` para abrir o protocolo `lvinstall://` de forma mais controlada.
- Atualizar `src/components/ProgramCard.tsx` para não afirmar “instalado” imediatamente; em vez disso, mostrar uma mensagem mais correta:
  - “Solicitação enviada ao agente Windows”.
  - Instrução para verificar se o navegador pediu permissão para abrir o agente.
  - Instrução para instalar/atualizar o agente se nada acontecer.
- Adicionar um botão/atalho para baixar o agente também no catálogo público, porque usuários finais precisam ter o agente instalado para o botão “Instalar” funcionar.

3. Ajustar argumentos silenciosos padrão
- Revisar `ProgramFormDialog.tsx` para orientar melhor o cadastro dos argumentos:
  - MSI: `/qn /norestart`
  - NSIS, como 7-Zip EXE: `/S`
  - Inno Setup: `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`
- Se o formulário hoje estiver preenchendo EXE com argumentos misturados, ajustar o texto de ajuda/default para reduzir falhas.
- Observação: o programa `7z2601-x64-exe` está com `/S /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`. Para 7-Zip EXE normalmente basta `/S`; argumentos extras podem causar comportamento inesperado. Vou preparar a interface para evitar esse erro e, se necessário, incluir uma correção de dados para os registros já cadastrados.

4. Criar diagnóstico para TI
- Adicionar no diálogo do agente instruções claras para atualizar o agente:
  - baixar o novo ZIP,
  - executar `install-agent.bat` como administrador novamente,
  - testar a instalação.
- Adicionar uma seção “Como verificar erro” apontando para:
  - `C:\ProgramData\DeployConsoleAgent\agent.log`
  - códigos comuns: `0` sucesso, `1603` erro MSI, `3010` sucesso com reinicialização necessária.

5. Corrigir dados existentes, se aprovado
- Atualizar os argumentos silenciosos dos programas já cadastrados quando houver configuração claramente incorreta:
  - `7z2601-x64-exe`: usar `/S`.
  - manter MSI com `/qn /norestart`.
- Para `IRPF2026Win64v1.0`, manter como EXE, mas deixar o diagnóstico mostrar o código de erro real caso os argumentos não sejam aceitos pelo instalador da Receita.

Resultado esperado
- Ao clicar em “Instalar”, o navegador chama corretamente o agente local.
- O agente baixa e executa o instalador com logs claros.
- Se algum instalador específico falhar por argumento silencioso incorreto, a equipe de TI conseguirá ver o motivo no log e ajustar o cadastro.
- Usuários finais terão instrução clara para instalar/atualizar o agente antes de usar o catálogo.

Depois de aprovado, vou aplicar as mudanças no código e, se necessário, criar a migração para corrigir os argumentos silenciosos dos programas existentes.