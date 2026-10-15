# Instalação manual no Windows

Use este guia se escolheu a instalação manual. Para instalação assistida, siga [INSTALAR-COM-CODEX.md](INSTALAR-COM-CODEX.md).

## 1. Preparar a pasta

Tenha Node.js 24+ e o Codex instalado e conectado à conta que deseja acompanhar. Baixe o pacote completo e extraia em uma pasta permanente onde sua conta possa gravar. Não execute arquivos de dentro do ZIP. Não é preciso instalar dependências npm, NocoBase, Docker ou extensão.

O pacote contém `Abrir-Monitor.cmd`, `Configurar-Codex.cmd`, as pastas `src`, `scripts` e a interface pronta em `public`. Preserve essa estrutura.

## 2. Conectar os eventos ao Codex

Abra **Configurar-Codex.cmd**. O assistente:

1. Mostra o arquivo `hooks.json` encontrado e o coletor desta cópia.
2. Testa o comando no CMD e no PowerShell com um evento fictício em uma pasta temporária isolada.
3. Pede **S** para instalar ou **N** para cancelar.
4. Preserva handlers existentes e guarda um backup em `.local/backups`.
5. Relê o arquivo e confirma **9/9 eventos** desta cópia.

Cancelar não grava os hooks. Em falha, a janela permanece aberta com a mensagem; não siga como se a instalação tivesse sido confirmada.

Se usa outra cópia do monitor, confira o caminho mostrado. Este procedimento não migra seus cards nem remove handlers de outras instalações.

## 3. Revisar a confiança no Codex

Os novos hooks precisam ser revisados e autorizados por você no Codex. Na versão de terminal (CLI), a documentação indica o comando **`/hooks`** dentro do Codex. No aplicativo, use a revisão de hooks disponibilizada pela sua versão; se os novos eventos não aparecerem, feche e abra o Codex para recarregar a configuração. [Documentação oficial](https://learn.chatgpt.com/docs/hooks).

A confiança se aplica à definição atual: ao trocar de pasta, de comando ou de instalação do Node, poderá ser necessário reconfigurar e revisar novamente. O monitor não concede confiança nem aprova ferramentas por você.

## 4. Abrir o painel e cadastrar

Abra **Abrir-Monitor.cmd**. O endereço padrão é `http://127.0.0.1:13021`. O iniciador aguarda a chamada ao navegador e mostra o endereço se houver falha. Abrir novamente reutiliza o processo desta cópia.

Em **Tarefas**, cadastre o nome e a situação; projeto e link são opcionais. Depois, vincule um ID local ou `codex://threads/ID` pelo cadastro ou pela aba Monitor Codex. Links `/share/` não identificam um chat local.

Retome uma atividade no chat vinculado. O primeiro evento real inicia o acompanhamento; um chat parado pode continuar em Sem sinal. O estado do chat e a situação da tarefa são independentes.

## 5. Encerrar

Use **Encerrar aplicativo** no topo e confirme. Aguarde a tela de encerramento e depois feche a aba. Se já fechou a aba, execute **Encerrar-Monitor.cmd**. Fechar a aba sozinho não encerra o Node.

## Resolver problemas

| Situação | O que conferir |
| --- | --- |
| A janela fecha sem abrir a página | Use Diagnosticar-Monitor.cmd e abra manualmente o endereço mostrado. Use o iniciador atualizado, compatível com `node.cmd`. |
| Configuração pendente | Execute Configurar-Codex.cmd, digite S e aguarde 9/9. |
| Instalado, mas nenhum sinal | Confira a confiança no Codex, recarregue o aplicativo e retome uma atividade no chat vinculado. |
| Estado não confirmado | O monitor preserva o último estado e tenta confirmar automaticamente; use Tentar novamente quando disponível. |
| Porta ocupada | Não encerre processos de terceiros. Configure outra porta nesta cópia. |
| Cota/tokens indisponíveis | Confira o Codex conectado e a compatibilidade das fontes locais. Ausência de dado não significa zero. |

O diagnóstico mostra a contagem de eventos, o arquivo consultado, o estado do servidor e o resultado da última abertura. Não publique `.local`, configurações pessoais, bancos ou logs em issues.

### Porta e pasta do Codex

Se precisar, copie `config.example.json` para `config.local.json` e ajuste a porta. A interface e a API usam automaticamente a mesma porta. O aplicativo permanece restrito ao computador local.

Se o Codex usa outra pasta, configure `codexHome` nessa cópia privada antes de executar Configurar-Codex.cmd. O caminho padrão é `~/.codex`; a variável `CODEX_HOME`, quando definida, tem prioridade. Não grave esses caminhos pessoais no repositório.
