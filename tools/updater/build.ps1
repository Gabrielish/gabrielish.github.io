param([string]$OutputDirectory = 'dist')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$outputFolder = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $OutputDirectory))
New-Item -ItemType Directory -Force $outputFolder | Out-Null
$outputFile = Join-Path $outputFolder 'BG3RO-Updater.exe'
New-Item -ItemType Directory -Force assets | Out-Null
Add-Type -AssemblyName System.Drawing
$logo = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'assets/brand-mark.png'))
$sizes = @(16,20,24,28,32,40,48,56,64,96,128,256)
$frames = @()
foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap $size,$size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($logo,0,0,$size,$size)
  $memory = New-Object System.IO.MemoryStream
  $bitmap.Save($memory,[System.Drawing.Imaging.ImageFormat]::Png)
  $frames += ,$memory.ToArray()
  $memory.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
$logo.Dispose()
$stream = [System.IO.File]::Create((Join-Path $PSScriptRoot 'assets/icon.ico'))
$writer = New-Object System.IO.BinaryWriter $stream
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($i=0; $i -lt $sizes.Count; $i++) {
    $dimension = if($sizes[$i] -eq 256){0}else{$sizes[$i]}
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
    $offset += $frames[$i].Length
  }
  foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
} finally { $writer.Dispose(); $stream.Dispose() }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ /utf8output "/out:$outputFile" /win32manifest:app.manifest /win32icon:assets/icon.ico /resource:assets/icon.ico,theme.app-icon /resource:assets/brand-mark.png,theme.brand /resource:assets/cta-outline.png,theme.outline /resource:assets/cta-filled.png,theme.filled /resource:assets/EBGaramond-SemiBold.ttf,theme.font /resource:assets/OFL-EB-Garamond.txt,theme.font-license /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Net.Http.dll /reference:System.Web.Extensions.dll Program.cs Theme.cs
if ($LASTEXITCODE -ne 0) { throw 'Compilarea a eșuat.' }
$sha = [System.Security.Cryptography.SHA256]::Create()
$binary = [System.IO.File]::OpenRead($outputFile)
try { Write-Output ('SHA256: ' + [System.BitConverter]::ToString($sha.ComputeHash($binary)).Replace('-','')) }
finally { $binary.Dispose(); $sha.Dispose() }
