param([Parameter(Mandatory = $true)][string]$ReleaseFolder)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$releaseBase = [IO.Path]::GetFullPath((Join-Path $projectRoot 'release'))
$sourceRoot = (Resolve-Path -LiteralPath $ReleaseFolder).Path
if (-not $sourceRoot.StartsWith($releaseBase + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Use uma exportacao criada em release/ deste projeto.' }
$package = Get-Content -LiteralPath (Join-Path $sourceRoot 'package.json') -Raw | ConvertFrom-Json
if ($package.name -ne 'monitor-codex-local' -or $package.version -notmatch '^\d+\.\d+\.\d+$') { throw 'Pacote ou versao invalidos.' }
$files = @('package.json') + @($package.files) + @('SHA256SUMS.txt')
$archivePath = Join-Path $releaseBase ('monitor-codex-local-v' + $package.version + '-windows.zip')
if (Test-Path -LiteralPath $archivePath) { throw 'O ZIP desta versao ja existe. Preserve-o ou escolha uma nova versao.' }
foreach ($name in $files) {
 if ($name -match '(?:^|/)(?:\.local|node_modules|\.git)(?:/|$)|config\.local|\.sqlite|\.log$|\.env') { throw 'Arquivo privado no manifesto.' }
 $absolute = [IO.Path]::GetFullPath((Join-Path $sourceRoot $name))
 if (-not $absolute.StartsWith($sourceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Arquivo fora da exportacao.' }
 if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) { throw 'Arquivo do manifesto ausente.' }
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::Open($archivePath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
 foreach ($name in $files) {
  [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $sourceRoot $name), ('monitor-codex-local/' + $name.Replace('\','/')), [System.IO.Compression.CompressionLevel]::Optimal)
 }
} finally { $archive.Dispose() }
$verify = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
try { if ($verify.Entries.Count -ne $files.Count) { throw 'Quantidade de arquivos incorreta no ZIP.' } } finally { $verify.Dispose() }
$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($archivePath + '.sha256', $hash + '  ' + [IO.Path]::GetFileName($archivePath) + "`n")
Write-Output $archivePath
