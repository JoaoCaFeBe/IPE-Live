# AI Bootstrap - IPE Live

> Fonte canonica inicial para orientar Codex e agentes neste projeto standalone.
> Criado pela portabilidade IA/Codex a partir do Base.Laravel, adaptado ao stack real do alvo.

## Idioma

- Sempre responda em portugues do Brasil.
- Preserve formatacao regional pt-BR para datas, moeda e numeros.

## Escopo

- Este projeto e **standalone**; nao trate como derivado do Base.Laravel.
- Nao use `template/main`, `template-sync`, `template-guardian`, Core Protegido ou fluxo de `Manutencao.command` do Base.Laravel.
- Antes de alterar codigo, identifique o modulo real, leia os arquivos vizinhos e respeite os padroes locais.

## Stack Detectado

- Stack inicial: Node.js.
- Familia operacional: `node`.
- Observacao de portabilidade: Node/subprojeto com .gemini e instrucoes antigas em .github.

## Documentacao E IA

- `AGENTS.md` e apenas wrapper fino.
- `.ai/AI_BOOTSTRAP.md` e a fonte de regras globais da IA neste projeto.
- `.ai/docs/IA_PORTABILIDADE.md` registra o diagnostico inicial, matriz e pendencias.
- Se futuramente surgirem workflows recorrentes, crie skills locais em `.codex/skills/{nome}/SKILL.md`; nao crie `*.agent.md`, `.prompt.md` ou nova arvore paralela.
- Conteudo proprio do projeto, runbooks, inventarios e evidencias devem ir para `.project/` quando essa estrutura for adotada.

## Legado De IA Encontrado

- `.github/copilot-instructions.md`

Esses itens podem continuar como compatibilidade enquanto nao forem migrados. Nao remova nem substitua sem aprovacao explicita.

## Comandos De Validacao

- `git status --short`
- `rg -n '^(<<<<<<<|=======|>>>>>>>)$' .`
- `npm scripts detectados: Live: dev, start; Liturgia: dev, start`
- `Nao executar pm2/reload/restart sem aprovacao explicita.`

## Seguranca

- Nao exponha, copie ou documente senhas, tokens, chaves ou credenciais encontradas em configs.
- Nao execute deploy, PM2 reload/restart, FTP/SFTP/SSH, migrations ou scripts destrutivos sem pedido explicito.
- Commits e pushes sao sempre manuais e dependem de aprovacao explicita.
