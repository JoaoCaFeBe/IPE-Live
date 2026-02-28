<?php
include_once "config.php";
include_once "dados.php";
$nomeLivro = htmlspecialchars($_GET['nomeLivro'] ?? '', ENT_QUOTES, 'UTF-8');
$livro = (int)($_GET['livro'] ?? 0);
$capitulo = (int)($_GET['capitulo'] ?? 0);

?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- ---------------------------------------------------------------------------------- -->
    <?php include 'includes/bibliotecas.php'; ?>
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