<?php
include_once "dados.php";
$nomeLivro = $_GET['nomeLivro'];
$livro = $_GET['livro'];
$capitulo = $_GET['capitulo'];

?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- ---------------------------------------------------------------------------------- -->
    <script src='Bibliotecas\jquery.min.js'></script>

    <link rel='stylesheet' type='text/css' href="Bibliotecas\bootstrap.min.css">
    <script src='Bibliotecas\bootstrap.min.js'></script>

    <link rel="stylesheet" href="Bibliotecas\animate.min.css">

    <link rel='stylesheet' type='text/css' href="Bibliotecas\fontawesome.min.css">
    <link rel='stylesheet' type='text/css' href="Bibliotecas\all.min.css">
    <link rel='stylesheet' type='text/css' href="Bibliotecas\v4-shims.min.css">
    <script src='Bibliotecas\fontawesome.min.js'></script>
    <script src='Bibliotecas\all.min.js'></script>
    <script src='Bibliotecas\v4-shims.min.js'></script>

    <script src='Bibliotecas\socket.io.min.js'></script>
    <!-- ---------------------------------------------------------------------------------- -->
    <title><?php echo $nomeLivro . ' ' . $capitulo ?></title>
    <link rel="stylesheet" href="Painel.css">
    <script src="js\Biblia.js"></script>
    <!-- ---------------------------------------------------------------------------------- -->
</head>

<body class="p-1 bg-dark container-fluid scrollJC" onload="inicio();" style="height:800px!important;overflow-y:auto!important;">
    <div class="btn-group-vertical" role="group" aria-label="Vertical button group" style='width:100%; display:block!important;'>
        <?php
        $versiculos = dados::tabela("select book.name, verse.verse, verse.text from verse inner join book on (verse.book_id=book.id) where verse.book_id=$livro and verse.chapter=$capitulo");
        foreach ($versiculos as $i => $versiculo) {
            echo <<<botao
                <input type='radio' class='btn-check' name='btnPassagem' id='btnPassagem$i' titulo='$versiculo->name $capitulo' autocomplete='off'>
                <label class='btn btn-secondary text-start' style='text-overflow:unset!important;white-space:normal!important;' for='btnPassagem$i'>$versiculo->verse. $versiculo->text</label>
            botao;
        } ?>
    </div>
</body>

</html>