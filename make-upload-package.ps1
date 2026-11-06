# Kemas versi web NEKO siap unggah (MediaFire / hosting statis / cadangan).
# Hasil: dist\NEKO-web-v<versi>.zip — TIDAK berisi .env, db.json, atau kunci apa pun.
#
# Pakai:  powershell -ExecutionPolicy Bypass -File scripts\make-upload-package.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$versi = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
$stage = Join-Path $env:TEMP "neko-web-v$versi"
$zip = Join-Path $root "dist\NEKO-web-v$versi.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $zip -Parent) | Out-Null

# 1. Folder yang ikut.
foreach ($d in 'css', 'js', 'data', 'assets', 'public', 'api', 'scripts', 'server') {
  $src = Join-Path $root $d
  if (-not (Test-Path $src)) { continue }
  $dst = Join-Path $stage $d
  robocopy $src $dst /E /NFL /NDL /NJH /NJS /XD node_modules __pycache__ .git | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "robocopy gagal untuk $d" }
}
$LASTEXITCODE = 0

# 2. Berkas di root.
foreach ($f in 'index.html', 'manifest.webmanifest', 'favicon.svg', 'vercel.json',
                'package.json', 'package-lock.json', 'README.md', 'ROADMAP.md', '.nojekyll') {
  $src = Join-Path $root $f
  if (Test-Path $src) { Copy-Item $src $stage -Force }
}

# 3. Yang tidak boleh ikut: kunci, data pengguna, sisa build.
Get-ChildItem -Path $stage -Recurse -Force |
  Where-Object { $_.Name -like '.env*' -or $_.Name -eq 'db.json' -or $_.Name -like '*.log' -or $_.FullName -match '\\(build|intermediates|neko-backup|supabase)(\\|$)' } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# 4. Pastikan benar-benar bersih sebelum dikemas.
$bocor = Get-ChildItem -Path $stage -Recurse -Force -File |
  Where-Object { $_.Name -like '.env*' -or $_.Name -eq 'db.json' }
if ($bocor) { throw "Masih ada berkas rahasia: " + ($bocor.FullName -join ', ') }

if (Test-Path $zip) { Remove-Item $zip -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Compress-Archive dan CreateFromDirectory sama-sama menulis pemisah '\' di Windows
# PowerShell, sehingga hasil unzip di server/hosting menjadi satu nama file panjang.
# Entri dibuat manual supaya pemisah jalurnya '/' dan berkas tersembunyi ikut terbawa.
$stream = [System.IO.File]::Open($zip, [System.IO.FileMode]::Create)
$arsip = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
$jumlah = 0
Get-ChildItem -Path $stage -Recurse -Force -File | ForEach-Object {
  $rel = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
  $entri = $arsip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
  $tujuan = $entri.Open()
  $isi = [System.IO.File]::ReadAllBytes($_.FullName)
  $tujuan.Write($isi, 0, $isi.Length)
  $tujuan.Dispose()
  $script:jumlah++
}
$arsip.Dispose(); $stream.Dispose()
$ukuran = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Output "SELESAI -> $zip"
Write-Output "Berkas: $jumlah · Ukuran: $ukuran MB · Versi: $versi"
Write-Output 'Unggah file ini ke MediaFire, atau deploy foldernya ke hosting statis.'
