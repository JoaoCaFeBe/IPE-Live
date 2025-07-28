<?php
if (session_status() !== PHP_SESSION_ACTIVE) session_start();

if (isset($_GET['biblia'])) {
    $_SESSION['biblia'] = $_GET['biblia'];
}

if (!isset($_SESSION['biblia'])) $_SESSION['biblia'] = 'Almeida Revista e Atualizada - ARA.sqlite';

if (!class_exists('dados')) {

    abstract class dados
    {
        public static $conn;

        public static function open()
        {
            $conn = new PDO("sqlite:Biblias/" . $_SESSION['biblia']);

            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            self::$conn = $conn;
        }

        public static function parametrosSQL($sql, $parametros)
        {
            self::open();
            $stmt = self::$conn->prepare($sql);
            foreach ($parametros as $key => $value) {
                $stmt->bindValue(
                    $key,
                    $value,
                    PDO::PARAM_LOB
                );
            };
            $stmt->execute();

            return $stmt->fetchAll(PDO::FETCH_OBJ)[0] ?? true;
        }

        public static function executaSQL($sql)
        {
            self::open();
            return self::$conn->query($sql)->fetchAll(PDO::FETCH_OBJ);
        }

        public static function tabela($sql, ...$parametros)
        {
            $registros = 0;
            foreach ($parametros as $value) {
                if (is_integer($value)) {
                    $registros = $value;
                }
            }
            $query = self::executaSQL($sql);
            $retorno = [];
            $processados = 0;
            foreach ($query as $row) {
                $retorno[] = $row;
                if ($registros === 1) $retorno = $row;
                if ($registros && $processados++ === $registros) break;
            }

            return $retorno;
        }

        public static function close()
        {
            self::$conn = null;
        }
    }
}
