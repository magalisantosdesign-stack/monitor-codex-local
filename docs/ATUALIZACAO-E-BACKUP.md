# Atualização e backup

## Fazer backup

1. Encerre o aplicativo pelo botão ou Encerrar-Monitor.cmd.
2. Copie **`.local/data` inteira** para uma pasta privada. Ela contém tarefas, estados e histórico.
3. Se existir, guarde também `config.local.json`. Backups de hooks ficam em `.local/backups`.

O ZIP público não contém esses dados. Não envie backups, bancos ou configurações pessoais ao GitHub.

## Atualizar mantendo as tarefas

1. Encerre o aplicativo e faça o backup acima.
2. Extraia a nova versão e copie os arquivos públicos para a **mesma pasta permanente** da instalação existente.
3. Preserve `.local` e `config.local.json`. O pacote não contém essas pastas/arquivos para substituir.
4. Confira as notas da versão. Se a definição do hook mudou, execute Configurar-Codex.cmd e revise a nova confiança no Codex.
5. Abra Abrir-Monitor.cmd e confira suas tarefas e a nova versão no cabeçalho.

Se mudar a pasta da instalação, os caminhos dos hooks também mudam. Nesse caso será preciso apontar o Codex para a nova cópia. Não remova hooks de outras instalações sem identificar a origem.

## Restaurar

Esta versão não tem restauração por botão. Encerre o aplicativo antes de qualquer restauração manual, preserve a pasta atual e restaure o backup completo na mesma instalação compatível. Não substitua arquivos SQLite enquanto o aplicativo estiver rodando. Se houver erro de esquema ou corrupção, preserve os arquivos e investigue; o monitor não reinicializa silenciosamente o banco.

## O que o arquivamento significa

Stand-by organiza o acompanhamento de chats. Arquivar na aba Uso do Codex oculta o chat da análise principal, mantendo o histórico; não exclui a tarefa nem interrompe a coleta de chats ainda vinculados. Remover/trocar o link encerra a coleta do chat antigo quando nenhum outro cadastro o usa, preservando o histórico já observado.
