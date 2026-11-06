# Buang semua ikon aplikasi (web + Android) dari favicon.svg.
# Area di luar garis oranye dibuat transparan; favicon.svg sudah dipotong, jadi
# tugas skrip ini hanya merender vektornya dan memperkecil hasilnya.
#
# Pakai:  powershell -ExecutionPolicy Bypass -File scripts\make-icons.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
# Folder kerja tanpa spasi: Chrome headless menolak argumen berisi spasi.
$tmp = Join-Path $env:TEMP 'neko-icons'
$masterSize = 2048

# 1. Cari browser untuk merender SVG (Chrome/Edge headless).
$candidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome atau Edge tidak ditemukan.' }

# 2. Halaman render: SVG memenuhi viewport, latar halaman transparan.
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Copy-Item (Join-Path $root 'favicon.svg') (Join-Path $tmp 'neko.svg') -Force
@'
<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}img{display:block;width:100vw;height:100vh}</style>
</head><body><img src="neko.svg" alt=""></body></html>
'@ | Set-Content -Encoding UTF8 (Join-Path $tmp 'icon.html')

$master = Join-Path $tmp "master-$masterSize.png"
if (Test-Path $master) { Remove-Item $master -Force }
$pageUri = ([System.Uri](Join-Path $tmp 'icon.html')).AbsoluteUri
$chromeArgs = @(
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--allow-file-access-from-files', '--default-background-color=00000000',
  "--window-size=$masterSize,$masterSize",
  "--screenshot=$master",
  $pageUri
)
Start-Process -FilePath $browser -ArgumentList $chromeArgs -Wait -NoNewWindow
if (-not (Test-Path $master)) { throw 'Render master gagal.' }

Add-Type -AssemblyName System.Drawing

# 3. Pastikan benar-benar ada transparansinya.
$cek = New-Object System.Drawing.Bitmap $master
$corner = $cek.GetPixel(0, 0).A
$tengah = $cek.GetPixel([int]($masterSize / 2), [int]($masterSize / 2)).A
$cek.Dispose()
if ($corner -ne 0 -or $tengah -eq 0) {
  throw "Transparansi tidak sesuai (sudut=$corner tengah=$tengah). Periksa clipPath di favicon.svg."
}

function Resize-To([int]$size, [string]$out) {
  $src = New-Object System.Drawing.Bitmap $master
  $dst = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($dst)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $size, $size))
  $g.Dispose(); $src.Dispose()
  New-Item -ItemType Directory -Force -Path (Split-Path $out -Parent) | Out-Null
  $dst.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $dst.Dispose()
  Write-Output ("  {0,5}px -> {1}" -f $size, $out.Substring($root.Length + 1))
}

# 4. Ikon web / PWA.
Write-Output 'Ikon web:'
$icons = Join-Path $root 'public\icons'
foreach ($s in 32, 180, 192, 512, 1024) { Resize-To $s (Join-Path $icons "neko-$s.png") }
Resize-To 180 (Join-Path $icons 'apple-touch-icon.png')

# 5. Ikon launcher Android.
Write-Output 'Ikon Android:'
$mip = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
foreach ($d in $mip.Keys) {
  Resize-To $mip[$d] (Join-Path $root "android-apk\app\src\main\res\mipmap-$d\ic_launcher.png")
}

Write-Output 'Selesai. Lanjutkan: powershell -File update-apk-assets.ps1 lalu build APK.'
