@echo off
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