# Servidor HTTP local minimo para o Clone Finder.
# Uso: .\iniciar.ps1   (abre http://localhost:8080 automaticamente)
param([int]$Porta = 8080)

$raiz = $PSScriptRoot
$tipos = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Porta/")
$listener.Start()
Write-Host "Clone Finder disponivel em http://localhost:$Porta  (Ctrl+C para parar)"
Start-Process "http://localhost:$Porta"

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
        if ($caminho -eq '') { $caminho = 'index.html' }

        $arquivoCompleto = [IO.Path]::GetFullPath((Join-Path $raiz $caminho))

        if ($arquivoCompleto.StartsWith($raiz) -and (Test-Path $arquivoCompleto -PathType Leaf)) {
            $ext = [IO.Path]::GetExtension($arquivoCompleto).ToLower()
            $tipo = $tipos[$ext]
            if (-not $tipo) { $tipo = 'application/octet-stream' }
            $ctx.Response.ContentType = $tipo
            $ctx.Response.Headers['Cache-Control'] = 'no-store'
            $bytes = [IO.File]::ReadAllBytes($arquivoCompleto)
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
        }
        $ctx.Response.Close()
    }
} finally {
    $listener.Stop()
}
