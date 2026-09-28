@echo off
rem Instala ou atualiza o IPE Live neste computador (duplo clique).
rem Chama o instalar-windows.ps1 da mesma pasta; ele pede permissao de administrador.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-windows.ps1"
