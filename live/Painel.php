<?php
include_once "dados.php";
?>
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

    <link rel="stylesheet" href="Bibliotecas\animate.min.css">

    <link rel='stylesheet' type='text/css' href="Bibliotecas\fontawesome.min.css">
    <link rel='stylesheet' type='text/css' href="Bibliotecas\all.min.css">
    <link rel='stylesheet' type='text/css' href="Bibliotecas\v4-shims.min.css">
    <script src='Bibliotecas\fontawesome.min.js'></script>
    <script src='Bibliotecas\all.min.js'></script>
    <script src='Bibliotecas\v4-shims.min.js'></script>

    <script src='Bibliotecas\socket.io.min.js'></script>
    <!-- ---------------------------------------------------------------------------------- -->
    <title>Painel</title>
    <link rel="stylesheet" href="Painel.css">
    <script src="js\Painel.js" painelOBS="<?php echo array_key_first($_GET) ?? ''; ?>"></script>
    <!-- ---------------------------------------------------------------------------------- -->
</head>

<body class="p-1 bg-dark container-fluid scrollJC" onload="inicio();">
    <div class="input-group mb-1 biblia">
        <span class="input-group-text"><i class="fa-solid fa-book-bible"></i></span>
        <select id='livro' class="form-select form-select-sm" aria-label="Small select" onchange="capitulo.value = 1; capitulos(this.value)">
            <?php
            $livros = dados::tabela('SELECT 
                                        verse.book_id id, 
                                        book.name, 
                                        max(verse.chapter) capitulos 
                                    from 
                                        verse inner join 
                                        book on (verse.book_id = book.id)
                                    group by 
                                        verse.book_id');

            $selecionado = 'selected';
            foreach ($livros as $livro) {
                echo "<option value='$livro->id' capitulos='$livro->capitulos' $selected>$livro->name</option>";
                $selecionado = '';
            }
            ?>
        </select>
        </select>
        <select id="versao" class="form-select form-select-sm" style="max-width: 12ch;" aria-label="Small select">
            <?php
                $versoes = [
                    ["id" => "ARA", "nome" => 'Almeida Revista e Atualizada - ARA.sqlite'],
                    ["id" => "NAA", "nome" => 'Nova Almeida Atualizada - NAA.sqlite'],
                    ["id" => "NVI", "nome" => 'Nova Versão Internacional - NVI.sqlite'],
                ];

                $selecionado = 'selected';
                foreach ($versoes as $versao) {
                    echo "<option value='{$versao['nome']}' $selecionado>{$versao['id']}</option>";
                    $selecionado = '';
                }
            ?>
        </select>
        <input class="input-group-text" style="width: 50px;" type="number" id="capitulo" min='1' value='1' max='50' onblur="if (parseInt(this.value) > parseInt(this.max)) this.value=this.max; listaVersiculos(livro.value, this.value, versao.value);">
        <button class="btn btn-warning" type="button" id="button-addon2" onclick="socket.emit('IPE.Transmissão', 'fecharBiblia');">Limpar</button>
    </div>
    <input type="text" class="w-100 mb-1" id='mensagem' name='mensagem' placeholder="Mensagem para o pulpito">

</body>

</html>