<?php
date_default_timezone_set('America/Sao_Paulo');

header('Content-Type: application/json');
echo json_encode([
    'hora' => date('H:i:s'),
    'data' => date('Y-m-d'),
    'fuso' => date_default_timezone_get()
]);