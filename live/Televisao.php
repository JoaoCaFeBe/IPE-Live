<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta http-equiv="cache-control" content="no-cache">
    <meta http-equiv="expires" content="0">
    <meta http-equiv="pragma" content="no-cache">
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, shrink-to-fit=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta names="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <!-- ---------------------------------------------------------------------------------- -->
    <script src='Bibliotecas\jquery.min.js'></script>

    <link rel='stylesheet' type='text/css' href="Bibliotecas\bootstrap.min.css">
    <script src='Bibliotecas\bootstrap.min.js'></script>

    <script src='Bibliotecas\bootbox.min.js'></script>

    <link rel="stylesheet" href="Bibliotecas\animate.min.css">

    <link rel='stylesheet' type='text/css' href="Bibliotecas\fontawesome.min.css">
    <link rel='stylesheet' type='text/css' href="Bibliotecas\all.min.css">
    <link rel='stylesheet' type='text/css' href="Bibliotecas\v4-shims.min.css">
    <script src='Bibliotecas\fontawesome.min.js'></script>
    <script src='Bibliotecas\all.min.js'></script>
    <script src='Bibliotecas\v4-shims.min.js'></script>

    <script src='Bibliotecas\socket.io.min.js'></script>
    <!-- ---------------------------------------------------------------------------------- -->
    <title>Projetor</title>
    <link rel="stylesheet" href="Projetor.css">
    <link rel="stylesheet" href="Televisao.css">
    <script src="js\Televisao.js" telaPrincipal="<?php echo array_key_first($_GET) ?? ''; ?>"></script>
    <!-- ---------------------------------------------------------------------------------- -->

    <style>
        #clock {
            font-size: 4em;
            margin-top: 15%;
            text-align: center;
            font-weight: 600;
        }
    </style>
</head>

<body onload="$('body>*:not(#clock)').fadeOut(); inicio();">

    <passagem>
        <titulo></titulo>
        <corpo></corpo>
    </passagem>
    <louvor>
        <titulo></titulo>
        <corpo></corpo>
    </louvor>
    <mensagem id="mensagem">
        <titulo></titulo>
        <corpo></corpo>
        <rodape></rodape>
    </mensagem>
    <div id="clock"></div>

</body>

</html>