# Gera data/clientes.json a partir dos servidores SQL.
# Consulta somente leitura em sys.databases, com autenticacao integrada do Windows.
# Uso: .\gerar-clientes.ps1
param(
    [string[]]$Servidores = @('FLASH', 'FENIX', 'CICLOPE', 'WOLVERINE'),
    [string]$Sufixo = '_erp_head',
    [int]$TimeoutSegundos = 15
)

$ErrorActionPreference = 'Stop'
$destino = Join-Path $PSScriptRoot 'data\clientes.json'
$destinoJs = Join-Path $PSScriptRoot 'data\clientes.js'

$consulta = @"
SELECT name
FROM sys.databases
WHERE name LIKE '%' + REPLACE(@sufixo, '_', '[_]')
ORDER BY name;
"@

$clientes = New-Object System.Collections.Generic.List[object]
$falhas = @()

foreach ($servidor in $Servidores) {
    $stringConexao = "Server=$servidor;Database=master;Integrated Security=True;" +
                     "Connect Timeout=$TimeoutSegundos;Application Name=CloneFinder"
    $conexao = New-Object System.Data.SqlClient.SqlConnection $stringConexao
    try {
        $conexao.Open()
        $comando = $conexao.CreateCommand()
        $comando.CommandText = $consulta
        $comando.CommandTimeout = 60
        [void]$comando.Parameters.AddWithValue('@sufixo', $Sufixo)

        $leitor = $comando.ExecuteReader()
        $qtd = 0
        while ($leitor.Read()) {
            $banco = [string]$leitor['name']
            $clientes.Add([ordered]@{
                cliente  = $banco.Substring(0, $banco.Length - $Sufixo.Length)
                banco    = $banco
                servidor = $servidor
            })
            $qtd++
        }
        $leitor.Close()
        Write-Host ("{0,-10} {1} bancos" -f $servidor, $qtd)
    }
    catch {
        $falhas += $servidor
        Write-Warning "$servidor : $($_.Exception.Message)"
    }
    finally {
        $conexao.Dispose()
    }
}

if ($falhas.Count -eq $Servidores.Count) {
    throw 'Nenhum servidor respondeu. O arquivo de clientes nao foi alterado.'
}

$saida = [ordered]@{
    geradoEm   = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
    servidores = $Servidores
    clientes   = @($clientes | Sort-Object { $_.cliente }, { $_.servidor })
}

$json = $saida | ConvertTo-Json -Depth 4
$utf8 = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText($destino, $json, $utf8)

# Mesmos dados em JS, para abrir o index.html direto do disco (sem servidor HTTP)
[IO.File]::WriteAllText($destinoJs, "window.CLONE_FINDER_DADOS = $json;`n", $utf8)

Write-Host "Total: $($clientes.Count) clientes gravados em $destino e $destinoJs"
if ($falhas) {
    Write-Warning "Servidores sem resposta: $($falhas -join ', '). Os clientes deles ficaram fora do arquivo."
}
