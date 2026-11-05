# Zero-dependency local web server for Windows using built-in .NET HttpListener
param (
    [int]$Port = 8080
)

$baseDir = Join-Path $PSScriptRoot "app"
if (-not (Test-Path $baseDir)) {
    Write-Host "[ERROR] Directory 'app' not found at: $baseDir" -ForegroundColor Red
    Pause
    exit 1
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "[WARN] Port $Port is busy, trying port 8085..." -ForegroundColor Yellow
    $Port = 8085
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  نظام تدوين حصص التدريس - الخادم المحلي المستقل         " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "الخادم يعمل بنجاح على العنوان: $prefix" -ForegroundColor White
Write-Host "جاري فتح التطبيق في المتصفح الافتراضي تلقائياً..." -ForegroundColor Yellow
Write-Host "اترك هذه النافذة مفتوحة طوال فترة استخدامك للتطبيق." -ForegroundColor Gray
Write-Host "للإيقاف: أغلق هذه النافذة أو اضغط Ctrl + C." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Open default browser
Start-Process $prefix

$mimeMap = @{
    ".html" = "text/html; charset=utf-8";
    ".htm"  = "text/html; charset=utf-8";
    ".js"   = "application/javascript; charset=utf-8";
    ".mjs"  = "application/javascript; charset=utf-8";
    ".css"  = "text/css; charset=utf-8";
    ".json" = "application/json; charset=utf-8";
    ".webmanifest" = "application/manifest+json; charset=utf-8";
    ".png"  = "image/png";
    ".jpg"  = "image/jpeg";
    ".jpeg" = "image/jpeg";
    ".svg"  = "image/svg+xml";
    ".ico"  = "image/x-icon";
    ".woff" = "font/woff";
    ".woff2"= "font/woff2";
    ".ttf"  = "font/ttf";
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($urlPath)) {
            $urlPath = "index.html"
        }

        # Normalize URL path and secure against traversal
        $filePath = Join-Path $baseDir $urlPath
        $fullPath = [System.IO.Path]::GetFullPath($filePath)
        $baseFullPath = [System.IO.Path]::GetFullPath($baseDir)

        if (-not $fullPath.StartsWith($baseFullPath)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        # SPA fallback: if file does not exist, serve index.html
        if (-not (Test-Path $fullPath -PathType Leaf)) {
            $fullPath = Join-Path $baseDir "index.html"
        }

        if (Test-Path $fullPath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = "application/octet-stream"
            if ($mimeMap.ContainsKey($ext)) {
                $mime = $mimeMap[$ext]
            }

            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $response.ContentType = $mime
            $response.ContentLength64 = $bytes.Length
            $response.StatusCode = 200
            $response.AddHeader("Cache-Control", "no-cache")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.Close()
    } catch {
        # continue loop
    }
}