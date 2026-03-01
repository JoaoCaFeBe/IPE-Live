<?php include_once "config.php"; ?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests"> -->
    <!-- ---------------------------------------------------------------------------------- -->
    <?php include 'includes/bibliotecas.php'; ?>
    <!-- ---------------------------------------------------------------------------------- -->
    <title>Legendas</title>
    <link rel="stylesheet" href="Legendas.css?v=<?php echo filemtime(__DIR__ . '/Legendas.css'); ?>">
    <script src="js\Base.js?v=<?php echo filemtime(__DIR__ . '/js/Base.js'); ?>"></script>
    <script src="js\Legendas.js?v=<?php echo filemtime(__DIR__ . '/js/Legendas.js'); ?>"></script>
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