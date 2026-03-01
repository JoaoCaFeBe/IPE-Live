<?php include_once "config.php"; ?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta http-equiv="cache-control" content="no-cache">
    <meta http-equiv="expires" content="0">
    <meta http-equiv="pragma" content="no-cache">
    <meta charset="utf-8">
    <meta http-equiv="x-ua-compatible" content="ie=edge">
    <meta name="viewport" content="user-scalable=no, initial-scale=1, maximum-scale=1, minimum-scale=1, width=device-width, height=device-height, shrink-to-fit=no" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <!-- ---------------------------------------------------------------------------------- -->
    <?php include 'includes/bibliotecas.php'; ?>
    <!-- ---------------------------------------------------------------------------------- -->
    <title>Projetor</title>
    <link rel="stylesheet" href="Projetor.css">
    <link rel="stylesheet" href="Televisao.css">
    <script src="js\Base.js"></script>
    <script src="js\Projetor.js" telaPrincipal="<?php echo array_key_first($_GET) ?? ''; ?>"></script>
    <!-- ---------------------------------------------------------------------------------- -->
</head>

<body onload="$(`body>*`).fadeOut(); inicio();">
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

</body>

</html>