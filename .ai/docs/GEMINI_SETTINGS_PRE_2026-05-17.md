# Backup do .gemini/settings.json antes da limpeza

Criado em 2026-05-17 pela skill `ia-bootstrap` durante reconciliacao delta.

## Motivo

O `.gemini/settings.json` deste projeto Node continha configuracao herdada de um projeto Laravel diferente (`Desklaser.Odontologia`), incluindo MCP servers `laravel-boost` e `herd-mcp` com `SITE_PATH` apontando para fora deste repositorio. Esses servidores nao se aplicam ao IPE Live (Node.js puro).

A limpeza foi aprovada pelo usuario.

## Conteudo original preservado

```json
{
    "mcpServers": {
        "laravel-boost": {
            "command": "php",
            "args": [
                "artisan",
                "boost:mcp"
            ]
        },
        "herd": {
            "command": "php",
            "args": [
                "/Applications/Herd.app/Contents/Resources/herd-mcp.phar"
            ],
            "env": {
                "SITE_PATH": "/Users/joaocfb/Library/Mobile Documents/com~apple~CloudDocs/Desenvol/php/Laravel/Desklaser.Odontologia"
            }
        }
    }
}
```

## Pos-limpeza

`.gemini/settings.json` ficou com `mcpServers` vazio. MCPs reais relevantes para este projeto Node, se houver, devem ser adicionados depois com base em necessidade explicita.
