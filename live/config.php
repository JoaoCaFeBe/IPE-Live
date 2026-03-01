<?php

/**
 * Carrega variáveis do arquivo .env da pasta live/.
 * Disponibiliza $SOCKET_SERVER, $SOCKET_NAMESPACE e $CULTOS_URL para injeção nos scripts JS.
 */
$envPath = __DIR__ . DIRECTORY_SEPARATOR . '.env';

if (file_exists($envPath)) {
    $linhas = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($linhas as $linha) {
        if (str_starts_with(trim($linha), '#')) continue;
        if (strpos($linha, '=') === false) continue;
        [$chave, $valor] = explode('=', $linha, 2);
        $_ENV[trim($chave)] = trim($valor);
    }
}

$SOCKET_SERVER    = $_ENV['SOCKET_SERVER']    ?? 'localhost:3001';
$SOCKET_NAMESPACE = $_ENV['SOCKET_NAMESPACE'] ?? 'IPE.Transmissão';
$CULTOS_URL       = $_ENV['CULTOS_URL']       ?? '../Liturgia/cultos';
