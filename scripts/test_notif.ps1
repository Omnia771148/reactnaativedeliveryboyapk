Add-Type -AssemblyName System.Drawing

$srcPath = "$PSScriptRoot\..\assets\App Icon delivery boy.png"
$fileBytes = [System.IO.File]::ReadAllBytes($srcPath)
$ms = New-Object System.IO.MemoryStream(,$fileBytes)
$srcImg = [System.Drawing.Image]::FromStream($ms)

function Create-Clean-Notification-Icon {
    param (
        [System.Drawing.Image]$img,
        [int]$width,
        [int]$height,
        [string]$destPath
    )
    $destDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    # 1. Scale down original photo high quality
    $scaled = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($scaled)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $width, $height)
    $g.Dispose()

    # 2. Key out dark background (make dark pixels transparent)
    $result = New-Object System.Drawing.Bitmap($width, $height)
    for ($x = 0; $x -lt $width; $x++) {
        for ($y = 0; $y -lt $height; $y++) {
            $pixel = $scaled.GetPixel($x, $y)
            # Threshold: if pixel is dark background, set Alpha to 0 (Transparent)
            if ($pixel.R -lt 40 -and $pixel.G -lt 40 -and $pixel.B -lt 40) {
                $result.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                # Preserve non-background scooter artwork
                $result.SetPixel($x, $y, $pixel)
            }
        }
    }
    $scaled.Dispose()

    if (Test-Path $destPath) {
        Remove-Item $destPath -Force
    }
    $result.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $result.Dispose()
    Write-Host "Created Clean Transparent Notification Icon: $destPath ($width x $height)"
}

Create-Clean-Notification-Icon $srcImg 96 96 "$PSScriptRoot\test_notif.png"
$srcImg.Dispose()
$ms.Dispose()
