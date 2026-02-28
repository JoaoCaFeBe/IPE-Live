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
            if (self::$conn !== null) return;

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

        public static function tabela($sql, $limite = 0)
        {
            $query = self::executaSQL($sql);
            if ($limite === 1) return $query[0] ?? null;
            if ($limite > 0) return array_slice($query, 0, $limite);
            return $query;
        }

        public static function close()
        {
            self::$conn = null;
        }
    }
}
