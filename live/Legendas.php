<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests"> -->
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
    <title>Legendas</title>
    <link rel="stylesheet" href="Legendas.css">
    <script src="js\Legendas.js"></script>
    <!-- ---------------------------------------------------------------------------------- -->
</head>

<body onload="$(`body>*`).fadeOut(); inicio();">
    <passagem>
        <titulo></titulo>
        <corpo></corpo>
        <rodape></rodape>
    </passagem>
    <louvor>
        <titulo></titulo>
        <corpo></corpo>
        <rodape></rodape>
    </louvor>
    <mensagem id="mensagem">
        <titulo></titulo>
        <corpo></corpo>
        <rodape></rodape>
    </mensagem>

</body>

</html>