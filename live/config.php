<?php

/**
 * Carrega variáveis do arquivo .env da raiz do projeto.
 * Disponibiliza $SOCKET_SERVER para injeção nos scripts JS.
 */
$envPath = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . '.env';

if (file_exists($envPath)) {
    $linhas = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($linhas as $linha) {
        if (str_starts_with(trim($linha), '#')) continue;
        if (strpos($linha, '=') === false) continue;
        [$chave, $valor] = explode('=', $linha, 2);
        $_ENV[trim($chave)] = trim($valor);
    }
}

$SOCKET_SERVER = $_ENV['SOCKET_SERVER'] ?? 'localhost:3001';
$SOCKET_NAMESPACE = $_ENV['SOCKET_NAMESPACE'] ?? 'IPE.Transmissão';
