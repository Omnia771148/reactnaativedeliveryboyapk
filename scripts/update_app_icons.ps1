param (
    [string]$SourceImage = "$PSScriptRoot\..\assets\App Icon delivery boy.png"
)

Add-Type -AssemblyName System.Drawing

$SourcePath = [System.IO.Path]::GetFullPath($SourceImage)
if (-not (Test-Path $SourcePath)) {
    Write-Error "Source image not found at: $SourcePath"
    exit 1
}

Write-Host "Loading source logo from: $SourcePath"

# Load image into MemoryStream to prevent file locks
$fileBytes = [System.IO.File]::ReadAllBytes($SourcePath)
$ms = New-Object System.IO.MemoryStream(,$fileBytes)
$srcBmp = [System.Drawing.Image]::FromStream($ms)

# Sample top-left background color (#0D0E12 or dark black)
$sampleBmp = New-Object System.Drawing.Bitmap($srcBmp)
$bgColor = $sampleBmp.GetPixel(0, 0)
$sampleBmp.Dispose()
$transparentColor = [System.Drawing.Color]::Transparent

function Resize-And-Fit {
    param (
        [System.Drawing.Image]$img,
        [int]$width,
        [int]$height,
        [string]$destPath,
        [float]$scaleRatio = 0.80,
        [System.Drawing.Color]$fillColor = ([System.Drawing.Color]::Transparent)
    )
    $destDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }

    $canvas = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($fillColor.A -gt 0) {
        $brush = New-Object System.Drawing.SolidBrush($fillColor)
        $graphics.FillRectangle($brush, 0, 0, $width, $height)
        $brush.Dispose()
    } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
    }

    $innerW = [int]($width * $scaleRatio)
    $innerH = [int]($height * $scaleRatio)
    $posX = [int](($width - $innerW) / 2)
    $posY = [int](($height - $innerH) / 2)

    $graphics.DrawImage($img, $posX, $posY, $innerW, $innerH)
    $graphics.Dispose()

    if (Test-Path $destPath) {
        Remove-Item $destPath -Force
    }
    $canvas.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Host "Updated: $destPath ($width x $height)"
}

# Function to create clean transparent Android Notification Small Icon (Prevents solid white box ■)
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

    $scaled = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($scaled)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($img, 0, 0, $width, $height)
    $g.Dispose()

    # Key out dark background pixels to make background 100% transparent (so Android displays your scooter artwork logo shape cleanly)
    $transparentBmp = New-Object System.Drawing.Bitmap($width, $height)
    for ($x = 0; $x -lt $width; $x++) {
        for ($y = 0; $y -lt $height; $y++) {
            $pixel = $scaled.GetPixel($x, $y)
            if ($pixel.R -lt 40 -and $pixel.G -lt 40 -and $pixel.B -lt 40) {
                $transparentBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $transparentBmp.SetPixel($x, $y, $pixel)
            }
        }
    }
    $scaled.Dispose()

    if (Test-Path $destPath) {
        Remove-Item $destPath -Force
    }
    $transparentBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $transparentBmp.Dispose()
    Write-Host "Updated Clean Transparent Notification Icon: $destPath ($width x $height)"
}

$rootDir = [System.IO.Path]::GetFullPath("$PSScriptRoot\..")

# 1. Expo Assets
Resize-And-Fit -img $srcBmp -width 1024 -height 1024 -destPath "$rootDir\assets\images\icon.png" -scaleRatio 0.85 -fillColor $bgColor
Resize-And-Fit -img $srcBmp -width 512 -height 512 -destPath "$rootDir\assets\images\splash-icon.png" -scaleRatio 0.75 -fillColor $transparentColor
Resize-And-Fit -img $srcBmp -width 512 -height 512 -destPath "$rootDir\assets\images\logo-L.png" -scaleRatio 0.90 -fillColor $transparentColor
Resize-And-Fit -img $srcBmp -width 432 -height 432 -destPath "$rootDir\assets\images\android-icon-foreground.png" -scaleRatio 0.72 -fillColor $transparentColor

# 2. Android Native Mipmaps (App Launcher Icons - Full Color App Icon delivery boy.png)
$resDir = "$rootDir\android\app\src\main\res"

$mipmaps = @(
    @{ folder = "mipmap-mdpi"; launcher = 48; foreground = 108 },
    @{ folder = "mipmap-hdpi"; launcher = 72; foreground = 162 },
    @{ folder = "mipmap-xhdpi"; launcher = 96; foreground = 216 },
    @{ folder = "mipmap-xxhdpi"; launcher = 144; foreground = 324 },
    @{ folder = "mipmap-xxxhdpi"; launcher = 192; foreground = 432 }
)

foreach ($m in $mipmaps) {
    $targetFolder = "$resDir\$($m.folder)"
    
    Resize-And-Fit -img $srcBmp -width $m.launcher -height $m.launcher -destPath "$targetFolder\ic_launcher.png" -scaleRatio 0.85 -fillColor $bgColor
    Resize-And-Fit -img $srcBmp -width $m.launcher -height $m.launcher -destPath "$targetFolder\ic_launcher_round.png" -scaleRatio 0.75 -fillColor $bgColor
    Resize-And-Fit -img $srcBmp -width $m.foreground -height $m.foreground -destPath "$targetFolder\ic_launcher_foreground.png" -scaleRatio 0.68 -fillColor $transparentColor
    
    Remove-Item "$targetFolder\ic_launcher.webp" -ErrorAction SilentlyContinue
    Remove-Item "$targetFolder\ic_launcher_round.webp" -ErrorAction SilentlyContinue
    Remove-Item "$targetFolder\ic_launcher_foreground.webp" -ErrorAction SilentlyContinue
}

# 3. Android Native Drawables
$drawables = @(
    @{ folder = "drawable-mdpi"; splash = 128; notif = 48 },
    @{ folder = "drawable-hdpi"; splash = 192; notif = 72 },
    @{ folder = "drawable-xhdpi"; splash = 256; notif = 96 },
    @{ folder = "drawable-xxhdpi"; splash = 384; notif = 144 },
    @{ folder = "drawable-xxxhdpi"; splash = 512; notif = 192 }
)

foreach ($d in $drawables) {
    $targetFolder = "$resDir\$($d.folder)"
    
    # Splash Screen Logo (Full Color Photo)
    Resize-And-Fit -img $srcBmp -width $d.splash -height $d.splash -destPath "$targetFolder\splashscreen_logo.png" -scaleRatio 0.72 -fillColor $transparentColor

    # Notification Icon (Transparent Background so Android displays your Scooter Logo shape cleanly without turning into a solid white box ■)
    Create-Clean-Notification-Icon -img $srcBmp -width $d.notif -height $d.notif -destPath "$targetFolder\ic_notification.png"
}

$srcBmp.Dispose()
$ms.Dispose()
Write-Host "Icons updated successfully with transparent background for notification small icon and full color for launcher and splash screens!" -ForegroundColor Green
