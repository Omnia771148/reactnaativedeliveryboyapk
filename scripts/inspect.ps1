Add-Type -AssemblyName System.Drawing
$path = "$PSScriptRoot\..\assets\App Icon delivery boy.png"
$img = [System.Drawing.Image]::FromFile($path)
$bmp = New-Object System.Drawing.Bitmap($img)
Write-Host "Width: $($bmp.Width) Height: $($bmp.Height) PixelFormat: $($bmp.PixelFormat)"
Write-Host "Top-Left Pixel: $($bmp.GetPixel(0,0))"
Write-Host "Center Pixel: $($bmp.GetPixel([int]($bmp.Width/2), [int]($bmp.Height/2)))"
$bmp.Dispose()
$img.Dispose()
