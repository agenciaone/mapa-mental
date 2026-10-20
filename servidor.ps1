# Servidor local mínimo (acessível somente neste computador) para abrir e instalar o app.
# Uso: clique duas vezes em "iniciar.bat" ou execute:
#   powershell -ExecutionPolicy Bypass -File servidor.ps1 [-Port 8080] [-NoBrowser]
param([int]$Port = 8080, [switch]$NoBrowser)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'
  '.webmanifest' = 'application/manifest+json'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
try { $listener.Start() } catch { Write-Host "Porta $Port ocupada. Tente: servidor.ps1 -Port 8081"; exit 1 }
$url = "http://localhost:$Port/"
Write-Host "Mapas Mentais rodando em $url"
Write-Host "Feche esta janela para parar o servidor."
if (-not $NoBrowser) { Start-Process $url }

function Send-Response($client, [byte[]]$raw) {
  $stream = $client.GetStream()
  $text = [System.Text.Encoding]::ASCII.GetString($raw)
  $line = ($text -split "`r`n")[0]
  $parts = $line.Split(' ')
  if ($parts.Length -lt 2) { return }
  $path = [System.Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
  if ($path -eq '/') { $path = '/index.html' }
  $full = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('/')))
  $status = '200 OK'
  if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
    $status = '404 Not Found'; $body = [System.Text.Encoding]::UTF8.GetBytes('Nao encontrado'); $type = 'text/plain'
  } else {
    $body = [System.IO.File]::ReadAllBytes($full)
    $type = $types[[System.IO.Path]::GetExtension($full).ToLower()]
    if (-not $type) { $type = 'application/octet-stream' }
  }
  $head = "HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($parts[0] -ne 'HEAD') { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

# Atende várias conexões ao mesmo tempo, por varredura simples.
$pending = New-Object System.Collections.ArrayList
while ($true) {
  while ($listener.Pending()) {
    [void]$pending.Add(@{ c = $listener.AcceptTcpClient(); t = [DateTime]::Now; buf = New-Object System.IO.MemoryStream })
  }
  foreach ($p in @($pending)) {
    $c = $p.c
    try {
      if ($c.Available -gt 0) {
        $tmp = New-Object byte[] $c.Available
        $n = $c.GetStream().Read($tmp, 0, $tmp.Length)
        $p.buf.Write($tmp, 0, $n)
        $raw = $p.buf.ToArray()
        if ([System.Text.Encoding]::ASCII.GetString($raw).Contains("`r`n`r`n")) {
          Send-Response $c $raw
          $c.Close(); $pending.Remove($p)
        }
      } elseif (([DateTime]::Now - $p.t).TotalSeconds -gt 15) {
        $c.Close(); $pending.Remove($p)
      }
    } catch { try { $c.Close() } catch { }; $pending.Remove($p) }
  }
  if ($pending.Count -eq 0 -and -not $listener.Pending()) { Start-Sleep -Milliseconds 15 } else { Start-Sleep -Milliseconds 1 }
}
