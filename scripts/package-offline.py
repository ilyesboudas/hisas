#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Package offline distribution for Tadween Teaching Sessions.
Creates standalone ZIP with Windows BAT, PowerShell zero-dependency HTTP server,
Mac/Linux shell script, and user documentation in Arabic.
"""

import os
import shutil
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT_DIR / "dist"
PACKAGE_DIR = ROOT_DIR / "offline_package"
ZIP_OUTPUT_PUBLIC = ROOT_DIR / "public" / "tadween-offline-package.zip"
ZIP_OUTPUT_ROOT = ROOT_DIR / "tadween-teaching-sessions-offline.zip"

def create_package():
    print("Preparing offline package structure...")
    if PACKAGE_DIR.exists():
        shutil.rmtree(PACKAGE_DIR)
    
    PACKAGE_DIR.mkdir(parents=True, exist_ok=True)
    app_target_dir = PACKAGE_DIR / "app"
    
    # Copy compiled web assets from dist
    if not DIST_DIR.exists():
        raise RuntimeError("dist/ directory does not exist! Run npm run build first.")
        
    shutil.copytree(DIST_DIR, app_target_dir)

    # 1. PowerShell Zero-Dependency HTTP Server (server.ps1)
    powershell_server = r'''# Zero-dependency local web server for Windows using built-in .NET HttpListener
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
'''
    with open(PACKAGE_DIR / "server.ps1", "w", encoding="utf-8") as f:
        f.write(powershell_server.strip())

    # 2. Windows Batch Runner (start-windows.bat & تشغيل-البرنامج.bat)
    bat_content = r'''@echo off
chcp 65001 >nul
title تدوين حصص التدريس - تشغيل أوفلاين
cd /d "%~dp0"

echo ==========================================================
echo           تدوين حصص التدريس - نسخة العمل بدون إنترنت
echo ==========================================================
echo.
echo جاري تهيئة وتشغيل التطبيق محلياً...

:: Check if Python is available
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo تم العثور على بايثون. جاري التشغيل...
    start http://localhost:8080
    python -m http.server 8080 --directory "%~dp0app"
    goto end
)

:: Check if py launcher is available
where py >nul 2>&1
if %errorlevel% equ 0 (
    echo تم العثور على بايثون. جاري التشغيل...
    start http://localhost:8080
    py -m http.server 8080 --directory "%~dp0app"
    goto end
)

:: Run via PowerShell built-in server (works on 100% of Windows 7/10/11 without any install)
echo تشغيل الخادم الآمن المدمج عبر PowerShell...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080

:end
pause
'''
    with open(PACKAGE_DIR / "start-windows.bat", "w", encoding="utf-8") as f:
        f.write(bat_content.strip())
    
    with open(PACKAGE_DIR / "تشغيل-البرنامج.bat", "w", encoding="utf-8") as f:
        f.write(bat_content.strip())

    # 3. Mac & Linux Shell Runner (start-mac-linux.sh)
    sh_content = r'''#!/usr/bin/env bash
# تدوين حصص التدريس - تشغيل على ماك ولينكس بدون إنترنت
cd "$(dirname "$0")"

PORT=8080
APP_DIR="$(pwd)/app"

echo "=========================================================="
echo "          تدوين حصص التدريس - تشغيل بدون إنترنت            "
echo "=========================================================="

open_browser() {
    sleep 1
    URL="http://localhost:$PORT"
    if command -v xdg-open > /dev/null; then
        xdg-open "$URL"
    elif command -v open > /dev/null; then
        open "$URL"
    fi
}

open_browser &

if command -v python3 > /dev/null; then
    echo "تشغيل الخادم عبر Python 3..."
    python3 -m http.server $PORT --directory "$APP_DIR"
elif command -v python > /dev/null; then
    echo "تشغيل الخادم عبر Python..."
    python -m http.server $PORT --directory "$APP_DIR"
elif command -v php > /dev/null; then
    echo "تشغيل الخادم عبر PHP..."
    php -S localhost:$PORT -t "$APP_DIR"
elif command -v npx > /dev/null; then
    echo "تشغيل الخادم عبر npx serve..."
    npx serve -s "$APP_DIR" -l $PORT
else
    echo "يرجى تثبيت Python أو تشغيل متصفح يدعم localhost."
fi
'''
    with open(PACKAGE_DIR / "start-mac-linux.sh", "w", encoding="utf-8") as f:
        f.write(sh_content.strip())
    os.chmod(PACKAGE_DIR / "start-mac-linux.sh", 0o755)

    # 4. Arabic Instruction Manual (دليل-التشغيل-بدون-انترنت.txt)
    guide_content = """========================================================================
             دليل تشغيل تطبيق «تدوين حصص التدريس» دون إنترنت (Offline)
========================================================================

مرحباً بك!
هذه الحزمة مجهزة بالكامل للعمل بنسبة 100% دون الحاجة إلى أي اتصال بالإنترنت أو تثبيت برامج تطوير معقدة.

------------------------------------------------------------------------
أولاً: التشغيل على نظام ويندوز (Windows)
------------------------------------------------------------------------
1. فك ضغط هذا الملف (ZIP) في أي مجلد تختاره على حاسوبك (مثلاً على سطح المكتب أو المستندات).
2. انقر نقراً مزدوجاً على الملف:
   «تشغيل-البرنامج.bat»  أو  «start-windows.bat»
3. سيقوم البرنامج تلقائياً ببدء خادم محلي آمن وفتح التطبيق في متصفحك الافتراضي (Edge, Chrome, Firefox).
4. اترك النافذة السوداء مفتوحة أثناء العمل على التطبيق، وأغلقها عند الانتهاء.

ملاحظة هامة لنظام Windows:
- لا تحتاج لتثبيت أي برامج! الخادم المدمج يعتمد على PowerShell المدمج في ويندوز.
- إذا كان لديك Python مثبت، سيعمل تلقائياً أيضاً.

------------------------------------------------------------------------
ثانياً: التشغيل على نظام ماك أو لينكس (macOS / Linux)
------------------------------------------------------------------------
1. فك ضغط الحزمة.
2. افتح الطرفية (Terminal) في مجلد الحزمة واكتب:
   chmod +x start-mac-linux.sh
   ./start-mac-linux.sh
3. سيفتح التطبيق تلقائياً في متصفحك.

------------------------------------------------------------------------
ثالثاً: تثبيت التطبيق كـ PWA (تطبيق دائم على سطح المكتب والهاتف)
------------------------------------------------------------------------
بمجرد فتح التطبيق في المتصفح (Chrome أو Edge):
1. ستلاحظ زراً في الشريط العلوي باسم «تثبيت التطبيق» أو أيقونة تثبيت في شريط العنوان أعلى المتصفح.
2. اضغط على الزر واختر «تثبيت».
3. سيصبح للتطبيق أيقونة خاصة على سطح المكتب وقائمة البرامج تعمل كنافذة مستقلة تشبه برامج الويندوز الأصلية.
4. بفضل تقنية Service Worker المخزنة، سيعمل التطبيق حتى بعد إعادة تشغيل الجهاز ودون فتح الخادم في بعض المتصفحات.

------------------------------------------------------------------------
رابعاً: حفظ البيانات والأمان المحلي
------------------------------------------------------------------------
1. يتم حفظ كافة الحصص، الجداول، والسجلات محلياً في جهازك باستخدام:
   - التخزين المزدوج: IndexedDB + LocalStorage لضمان عدم ضياع أي معلومة.
2. يمكنك في أي وقت الانتقال إلى شاشة «النسخ الاحتياطي والبيانات»:
   - تصدير نسخة احتياطية بصيغة JSON والاحتفاظ بها في فلاش ميموري أو سحابياً.
   - استيراد النسخة في أي وقت أو نقلها لحاسوب آخر.
3. تنبيه هام: قم بتصدير نسخة JSON احتياطية دائماً قبل تنظيف بيانات المتصفح أو نقل التطبيق لجهاز آخر.

------------------------------------------------------------------------
خامساً: تشغيل نسخة الهاتف (Android)
------------------------------------------------------------------------
- يمكنك فتح التطبيق من متصفح الهاتف (Chrome) على نفس الشبكة، ثم الضغط على خيارات المتصفح (⋮) واختيار «إضافة إلى الشاشة الرئيسية» (Add to Home Screen).
- مشروع تطبيق أندرويد الأصلي (Android Project) جاهز ومضمّن في مجلد المشروع لمن يرغب في استخراج ملف APK عبر Android Studio.

نتمنى لك تجربة موفقة ومثمرة!
"""
    with open(PACKAGE_DIR / "دليل-التشغيل-بدون-انترنت.txt", "w", encoding="utf-8") as f:
        f.write(guide_content.strip())

    with open(PACKAGE_DIR / "README-OFFLINE.md", "w", encoding="utf-8") as f:
        f.write(guide_content.strip())

    # 5. Build ZIP archives
    print(f"Creating root ZIP: {ZIP_OUTPUT_ROOT}...")
    with zipfile.ZipFile(ZIP_OUTPUT_ROOT, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(PACKAGE_DIR):
            for file in files:
                abs_path = Path(root) / file
                rel_path = abs_path.relative_to(PACKAGE_DIR)
                zipf.write(abs_path, arcname=str(rel_path))

    print(f"Creating public ZIP for web download: {ZIP_OUTPUT_PUBLIC}...")
    shutil.copy(ZIP_OUTPUT_ROOT, ZIP_OUTPUT_PUBLIC)

    print("Offline packaging completed successfully!")
    print(f"Package folder: {PACKAGE_DIR}")
    print(f"Root ZIP size: {ZIP_OUTPUT_ROOT.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    create_package()
