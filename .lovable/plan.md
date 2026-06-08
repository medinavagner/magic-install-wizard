Plano para corrigir o botão de desinstalação do agente:

1. Ajustar a busca no Registro do Windows
- Corrigir `Find-UninstallEntry`, que hoje pode não devolver corretamente os resultados encontrados dentro do `ForEach-Object`.
- Fazer a função retornar uma lista real de entradas candidatas para desinstalação.

2. Tornar a desinstalação mais confiável
- Melhorar o tratamento de `QuietUninstallString` e `UninstallString`.
- Detectar comandos MSI dentro do `UninstallString`, como `MsiExec.exe /I{GUID}` ou `/X{GUID}`, e convertê-los para desinstalação silenciosa com `msiexec /x {GUID} /qn /norestart`.
- Preservar argumentos silenciosos cadastrados quando forem necessários para EXE.

3. Melhorar retorno visual e diagnóstico
- Exibir no status quando a entrada de desinstalação não for encontrada.
- Registrar no log qual entrada foi encontrada, qual comando foi executado e o código de saída.
- Atualizar o README do ZIP para mencionar o botão “Desinstalar selecionados” e o log.

4. Validar a função do agente
- Fazer uma validação estática do arquivo gerado para garantir que o PS1 contenha o botão e o handler de desinstalação.
- Depois da alteração, você deverá baixar novamente o ZIP do agente e testar com um programa instalado.