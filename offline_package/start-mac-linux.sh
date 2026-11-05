#!/usr/bin/env bash
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