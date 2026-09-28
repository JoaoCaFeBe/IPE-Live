# Instala (ou atualiza) o IPE Live no computador da igreja (Windows 10/11).
#
# Uso: duplo clique em instalar-windows.bat (ele chama este arquivo como administrador).
# Rodar de novo = atualizar: puxa a versão nova, reinstala dependências e reinicia.
#
# O que faz, em ordem:
#   1. Node.js 22 (instalador oficial do nodejs.org, conferido pelo SHA256) e Git (winget)
#   2. Baixa/atualiza o projeto em C:\IPE\IPE-Live (o GitHub pede login na primeira vez)
#   3. Instala as dependências do Live (npm ci)
#   4. Cria o live\.env (pergunta o IP da máquina e a senha do OBS); se já existir, mantém
#   5. Libera a porta 3001 no Firewall só para a rede local
#   6. Sobe o Live no pm2 e agenda o religamento a cada logon
#   7. Cria atalhos na área de trabalho e testa o Painel
#
# Registro de tudo em C:\IPE\instalacao-<data>.log

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Raiz      = "C:\IPE"
$Repo      = Join-Path $Raiz "IPE-Live"
$Live      = Join-Path $Repo "live"
$CultosDir = Join-Path $Raiz "cultos"
$RepoUrl   = "https://github.com/JoaoCaFeBe/IPE-Live.git"
$Porta     = 3001
$App       = "IPE-Live"
$Reserva   = "https://live.ipe.desklaser.cloud"
$Liturgia  = "https://ipe.desklaser.cloud"

# --- Administrador -----------------------------------------------------------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Pedindo permissão de administrador..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

New-Item -ItemType Directory -Force -Path $Raiz, $CultosDir | Out-Null
$log = Join-Path $Raiz ("instalacao-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")
Start-Transcript -Path $log | Out-Null

function Passo($texto) { Write-Host ""; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok($texto)    { Write-Host "    OK  $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "    !!  $texto" -ForegroundColor Yellow }
function Falha($texto) {
    Write-Host ""; Write-Host "ERRO: $texto" -ForegroundColor Red
    Write-Host "Registro completo: $log"
    Stop-Transcript | Out-Null
    Read-Host "Tecle Enter para fechar"
    exit 1
}
function Atualizar-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
    $npmGlobal = Join-Path $env:APPDATA "npm"
    if ($env:Path -notlike "*$npmGlobal*") { $env:Path += ";$npmGlobal" }
}
function Existe($comando) { return [bool](Get-Command $comando -ErrorAction SilentlyContinue) }
function Rodar($exe, [string[]]$argumentos, $oQue) {
    # Programas externos (git, npm, pm2) escrevem progresso no stderr; no PowerShell 5.1 isso
    # vira exceção com ErrorActionPreference=Stop. Quem decide o erro aqui é o código de saída.
    $ErrorActionPreference = "Continue"
    & $exe @argumentos
    if ($LASTEXITCODE -ne 0) { Falha "$oQue (código $LASTEXITCODE)." }
}

Write-Host "IPE Live — instalação/atualização no computador da igreja" -ForegroundColor White
Atualizar-Path

# --- 1. Node.js 22 e Git -----------------------------------------------------
Passo "Node.js 22"
$precisaNode = $true
if (Existe "node") {
    $versao = (& node -v).Trim()
    if ($versao -match '^v22\.') { Ok "já instalado ($versao)"; $precisaNode = $false }
    else {
        Aviso "encontrado Node $versao; o Live foi testado no Node 22."
        $resp = Read-Host "    Instalar o Node 22 por cima? (S/n)"
        if ($resp -match '^[nN]') { $precisaNode = $false; Aviso "seguindo com $versao" }
    }
}
if ($precisaNode) {
    $base = "https://nodejs.org/dist/latest-v22.x"
    $somas = (Invoke-WebRequest "$base/SHASUMS256.txt" -UseBasicParsing).Content -split "`n"
    $linha = $somas | Where-Object { $_ -match 'node-v22\.[0-9.]+-x64\.msi\s*$' } | Select-Object -First 1
    if (-not $linha) { Falha "não achei o instalador do Node 22 em $base." }
    $hashEsperado, $arquivo = ($linha.Trim() -split '\s+')
    $msi = Join-Path $env:TEMP $arquivo
    Write-Host "    baixando $arquivo ..."
    Invoke-WebRequest "$base/$arquivo" -OutFile $msi -UseBasicParsing
    $hash = (Get-FileHash $msi -Algorithm SHA256).Hash.ToLower()
    if ($hash -ne $hashEsperado.ToLower()) { Remove-Item $msi -Force; Falha "o instalador baixado não confere com o SHA256 oficial." }
    Ok "instalador conferido (SHA256)"
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /qn /norestart" -Wait -PassThru
    Remove-Item $msi -Force
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { Falha "o instalador do Node terminou com código $($p.ExitCode)." }
    Atualizar-Path
    if (-not (Existe "node")) { Falha "o Node foi instalado mas não apareceu no PATH. Feche esta janela e rode o instalador de novo." }
    Ok "Node $((& node -v).Trim()) instalado"
}

Passo "Git"
if (Existe "git") { Ok "já instalado ($((& git --version).Trim()))" }
else {
    if (-not (Existe "winget")) { Falha "o Git não está instalado e o winget não existe nesta máquina. Instale o Git por https://git-scm.com/download/win e rode de novo." }
    Rodar "winget" @("install", "--id", "Git.Git", "-e", "--source", "winget", "--silent", "--accept-package-agreements", "--accept-source-agreements") "falha ao instalar o Git"
    Atualizar-Path
    $gitPadrao = "C:\Program Files\Git\cmd"
    if (-not (Existe "git") -and (Test-Path $gitPadrao)) { $env:Path += ";$gitPadrao" }
    if (-not (Existe "git")) { Falha "o Git foi instalado mas não apareceu no PATH. Feche esta janela e rode de novo." }
    Ok "Git instalado"
}

# --- 2. Projeto --------------------------------------------------------------
Passo "Projeto em $Repo"
if (Test-Path (Join-Path $Repo ".git")) {
    Rodar "git" @("-C", $Repo, "pull", "--ff-only") "não consegui atualizar o projeto (git pull)"
    Ok "atualizado"
} else {
    Write-Host "    O GitHub vai pedir login na primeira vez (janela do navegador)."
    Rodar "git" @("clone", $RepoUrl, $Repo) "não consegui baixar o projeto (git clone)"
    Ok "baixado"
}
if (-not (Test-Path (Join-Path $Live "server.js"))) { Falha "não encontrei $Live\server.js depois de baixar o projeto." }

# --- 3. Dependências ---------------------------------------------------------
Passo "Dependências do Live"
Push-Location $Live
Rodar "npm.cmd" @("ci", "--omit=dev", "--no-audit", "--no-fund") "falha no npm ci"
Pop-Location
Ok "instaladas"

# --- 4. Configuração (.env) --------------------------------------------------
Passo "Configuração (live\.env)"
$envArq = Join-Path $Live ".env"
$ip = $null
if (Test-Path $envArq) {
    $linhaSocket = Select-String -Path $envArq -Pattern '^SOCKET_SERVER=' | Select-Object -First 1
    if ($linhaSocket) { $ip = (($linhaSocket.Line -replace '^SOCKET_SERVER=', '') -replace '^https?://', '') -replace ':\d+$', '' }
    Ok "já existe; mantido (IP $ip). Para refazer, apague o live\.env e rode de novo."
} else {
    $candidatos = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|Loopback|VirtualBox|VMware' } |
        Select-Object -ExpandProperty IPAddress)
    $sugestao = if ($candidatos -contains "10.0.0.253") { "10.0.0.253" } elseif ($candidatos.Count -gt 0) { $candidatos[0] } else { "" }
    Write-Host "    IPs desta máquina: $($candidatos -join ', ')"
    Write-Host "    Use o IP fixo reservado no roteador: é por ele que Projetor, Legendas e OBS se conectam."
    $ip = Read-Host "    IP desta máquina [$sugestao]"
    if ([string]::IsNullOrWhiteSpace($ip)) { $ip = $sugestao }
    if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Falha "IP inválido: '$ip'." }
    $obsPass = Read-Host "    Senha do OBS WebSocket (Enter se não tiver)"
    $conteudo = @(
        "# Gerado por scripts\instalar-windows.ps1 em $(Get-Date -Format 'dd/MM/yyyy HH:mm')",
        "PORT=$Porta",
        "# Abra as telas SEMPRE por este endereço (não por localhost): o Socket só aceita a mesma origem.",
        "SOCKET_SERVER=http://${ip}:$Porta",
        "SOCKET_NAMESPACE=IPE.Transmissão",
        "CULTOS_URL=$Liturgia/Cultos",
        "# Reserva para culto sem internet: salve aqui o arquivo do 'Baixar liturgia' (AAAA-MM-DD.json)",
        "CULTOS_DIR=$CultosDir",
        "OBS_WS_HOST=localhost",
        "OBS_WS_PORT=4455",
        "OBS_WS_PASS=$obsPass",
        "SOCKET_TOKEN=",
        "SOCKET_SCHEMA_MODE=warn"
    ) -join "`r`n"
    [IO.File]::WriteAllText($envArq, $conteudo + "`r`n", (New-Object Text.UTF8Encoding($false)))
    Ok "criado (IP $ip, liturgias de reserva em $CultosDir)"
}
if (-not $ip) { $ip = "localhost"; Aviso "não achei o IP no .env; atalhos vão usar localhost." }

# --- 5. Firewall -------------------------------------------------------------
Passo "Firewall (porta $Porta, só rede local)"
$regra = "IPE Live ($Porta)"
if (Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue) { Ok "regra já existe" }
else {
    New-NetFirewallRule -DisplayName $regra -Direction Inbound -Protocol TCP -LocalPort $Porta -Action Allow -Profile Any -RemoteAddress LocalSubnet | Out-Null
    Ok "regra criada"
}

# --- 6. pm2 e religamento automático -----------------------------------------
Passo "Serviço (pm2)"
if (-not (Existe "pm2")) {
    Rodar "npm.cmd" @("install", "-g", "pm2", "--no-audit", "--no-fund") "falha ao instalar o pm2"
    Atualizar-Path
}
$pm2 = Join-Path $env:APPDATA "npm\pm2.cmd"
if (-not (Test-Path $pm2)) { $pm2 = (Get-Command pm2 -ErrorAction SilentlyContinue).Source }
if (-not $pm2) { Falha "o pm2 não foi encontrado depois de instalado." }

$ErrorActionPreference = "Continue"
$lista = (& $pm2 jlist 2>$null | Out-String)
$ErrorActionPreference = "Stop"
$jaNoPm2 = $lista -match ('"name":"' + $App + '"')
if (-not $jaNoPm2) {
    $ocupada = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction SilentlyContinue
    if ($ocupada) {
        $proc = Get-Process -Id ($ocupada | Select-Object -First 1).OwningProcess -ErrorAction SilentlyContinue
        Falha "a porta $Porta já está em uso por '$($proc.ProcessName)' (provavelmente o Live antigo). Feche-o e rode este instalador de novo."
    }
    Push-Location $Live
    Rodar $pm2 @("start", "ecosystem.config.js") "falha ao iniciar o Live no pm2"
    Pop-Location
    Ok "Live iniciado"
} else {
    Rodar $pm2 @("restart", $App, "--update-env") "falha ao reiniciar o Live no pm2"
    Ok "Live reiniciado"
}
Rodar $pm2 @("save") "falha no pm2 save"

$tarefa = "IPE Live"
$acao = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$pm2`" resurrect"
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $tarefa -Action $acao -Trigger $gatilho -Settings $ajustes -Description "Religa o IPE Live (pm2 resurrect) ao entrar no Windows" -Force | Out-Null
Ok "religamento automático agendado (tarefa '$tarefa', ao entrar no Windows)"

# --- 7. Atalhos e teste ------------------------------------------------------
Passo "Atalhos na área de trabalho"
$desk = [Environment]::GetFolderPath("Desktop")
function Atalho($nome, $url) {
    [IO.File]::WriteAllText((Join-Path $desk "$nome.url"), "[InternetShortcut]`r`nURL=$url`r`n", (New-Object Text.UTF8Encoding($false)))
}
Atalho "IPE Live - Painel" "http://${ip}:$Porta/Painel"
Atalho "IPE Live - Projetor" "http://${ip}:$Porta/Projetor"
Atalho "IPE Live - Reserva online" "$Reserva/Painel"
Atalho "IPE Liturgia" $Liturgia
$bat = Join-Path $Live "scripts\instalar-windows.bat"
$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut((Join-Path $desk "Atualizar IPE Live.lnk"))
$lnk.TargetPath = $bat
$lnk.WorkingDirectory = Split-Path $bat
$lnk.Save()
Ok "Painel, Projetor, Reserva online, Liturgia e 'Atualizar IPE Live'"

Passo "Teste"
Start-Sleep -Seconds 4
try {
    $r = Invoke-WebRequest "http://${ip}:$Porta/Painel" -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -ne 200) { throw "status $($r.StatusCode)" }
    Ok "Painel respondeu em http://${ip}:$Porta/Painel"
} catch {
    Aviso "o Painel não respondeu ($($_.Exception.Message)). Veja os erros com: pm2 logs $App"
}

Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
Write-Host "  Painel:        http://${ip}:$Porta/Painel"
Write-Host "  Legendas OBS:  http://${ip}:$Porta/Legendas  e  /LegendasAoVivo"
Write-Host "  Reserva:       $Reserva/Painel"
Write-Host "  Registro:      $log"
Stop-Transcript | Out-Null
Start-Process "http://${ip}:$Porta/Painel"
Read-Host "Tecle Enter para fechar"
