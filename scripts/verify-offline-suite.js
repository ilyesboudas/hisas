import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('====================================================');
console.log('       اختبارات التحقق الإلزامية للنسخة Offline      ');
console.log('====================================================\n');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// 1. Verify index.html contains no external CDN dependencies (anti-CDN check)
test('فحص عدم الاعتماد على أي موارد CDN خارجية في index.html', () => {
  const html = fs.readFileSync('dist/index.html', 'utf-8');
  assert(!html.includes('https://cdn.'), 'يجب ألا يحتوي index.html على روابط cdn خارجية');
  assert(!html.includes('http://cdn.'), 'يجب ألا يحتوي index.html على روابط cdn خارجية');
  assert(!html.includes('unpkg.com'), 'يجب ألا يحتوي index.html على روابط unpkg');
  assert(!html.includes('cdnjs.cloudflare.com'), 'يجب ألا يحتوي index.html على روابط cloudflare cdn');
  assert(!html.includes('fonts.googleapis.com'), 'يجب الاعتماد على الخطوط المحلية أو خطوط النظام المتاحة دون إنترنت');
});

// 2. Verify Service Worker and precache manifest
test('فحص توليد Service Worker وملفات التخزين المؤقت (Workbox Precache)', () => {
  assert(fs.existsSync('dist/sw.js'), 'sw.js يجب أن يتواجد داخل مجلد dist');
  const swContent = fs.readFileSync('dist/sw.js', 'utf-8');
  assert(swContent.includes('workbox') || swContent.includes('precache'), 'sw.js يجب أن يحتوي على كود التخزين المؤقت للعمل بدون إنترنت');
});

// 3. Verify Manifest and PWA Icons
test('فحص سلامة ملف Web App Manifest والأيقونات المحلية بمقاسات 192 و 512 و maskable', () => {
  assert(fs.existsSync('dist/manifest.json') || fs.existsSync('dist/manifest.webmanifest'), 'ملف manifest مفقود');
  const manifestPath = fs.existsSync('dist/manifest.webmanifest') ? 'dist/manifest.webmanifest' : 'dist/manifest.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.strictEqual(manifest.name, 'تدوين حصص التدريس', 'اسم التطبيق في manifest غير مطابق');
  assert.strictEqual(manifest.display, 'standalone', 'وضع العرض يجب أن يكون standalone');
  assert(fs.existsSync('dist/pwa-192x192.png'), 'أيقونة 192x192 مفقودة');
  assert(fs.existsSync('dist/pwa-512x512.png'), 'أيقونة 512x512 مفقودة');
  assert(fs.existsSync('dist/pwa-maskable-512x512.png'), 'أيقونة maskable مفقودة');
  assert(fs.existsSync('dist/apple-touch-icon.png'), 'أيقونة apple-touch-icon مفقودة');
});

// 4. Verify Local Database Schema & Deduplication logic
test('فحص آلية التحقق من بنية البيانات والحماية من تكرار السجلات (Deduplication)', async () => {
  const { validateDatabaseSchema, deduplicateRecords, DEFAULT_SETTINGS } = await import('../src/utils/storage.ts');
  
  // Valid database structure
  const validDb = {
    version: 1,
    settings: DEFAULT_SETTINGS,
    baseSchedule: [
      { id: 'b1', dayIndex: 0, dayName: 'الأحد', sessionOrder: 1, startTime: '08:00', endTime: '08:55', durationMinutes: 55, classGroup: '3م1', subject: 'رياضيات', room: 'قاعة 1' },
      { id: 'b1', dayIndex: 0, dayName: 'الأحد', sessionOrder: 1, startTime: '08:00', endTime: '08:55', durationMinutes: 55, classGroup: '3م1', subject: 'رياضيات', room: 'قاعة 1' } // Duplicate
    ],
    supportSchedule: [],
    dailyRecords: [],
    weeks: [],
    liquidations: [],
    auditLogs: [],
  };

  const validation = validateDatabaseSchema(validDb);
  assert(validation.isValid, `البنية الصحيحة يجب أن تجتاز الفحص: ${validation.error}`);
  
  // Deduplicate records test
  const deduped = deduplicateRecords(validDb.baseSchedule);
  assert.strictEqual(deduped.length, 1, 'يجب دمج ومنع تكرار السجلات التي تحمل نفس المعرف id');
});

// 5. Verify Backup Export / Import Roundtrip Integrity
test('فحص تصدير واستيراد النسخ الاحتياطية JSON بدون فقدان للبيانات', async () => {
  const { validateDatabaseSchema, DEFAULT_SETTINGS } = await import('../src/utils/storage.ts');
  
  const originalData = {
    version: 1,
    settings: DEFAULT_SETTINGS,
    baseSchedule: [],
    supportSchedule: [],
    dailyRecords: [{
      id: 'd1',
      date: '2026-10-18',
      dayIndex: 0,
      dayName: 'الأحد',
      sessionOrder: 1,
      startTime: '08:00',
      endTime: '08:55',
      scheduledDurationMinutes: 55,
      effectiveDurationMinutes: 55,
      netDifferenceMinutes: 0,
      sessionType: 'base',
      executionState: 'completed',
      classGroup: '3م1',
      subject: 'رياضيات',
      delayMinutes: 0
    }],
    weeks: [{ id: 'w1', weekIndex: 1, startDate: '2026-10-18', endDate: '2026-10-22', isEvaluated: true, evaluatedAt: '2026-10-22T14:00:00Z', notes: 'أسبوع معتمد' }],
    liquidations: [],
    auditLogs: [{ id: 'log1', timestamp: '2026-10-18T10:00:00Z', actionType: 'create', entity: 'session', details: 'تسجيل حصة تجريبية' }],
  };

  const jsonStr = JSON.stringify(originalData);
  const parsed = JSON.parse(jsonStr);
  const res = validateDatabaseSchema(parsed);
  assert(res.isValid, `البيانات بعد الاستيراد يجب أن تكون مطابقة وصحيحة: ${res.error}`);
  assert.strictEqual(parsed.dailyRecords.length, 1);
  assert.strictEqual(parsed.dailyRecords[0].id, 'd1');
  assert.strictEqual(parsed.weeks[0].isEvaluated, true);
});

// 6. Verify Offline Standalone ZIP and Batch script
test('فحص حزمة ZIP المستقلة وملفات تشغيل ويندوز وماك ولينكس', () => {
  assert(fs.existsSync('tadween-teaching-sessions-offline.zip'), 'ملف tadween-teaching-sessions-offline.zip يجب أن يتواجد في الجذر');
  assert(fs.existsSync('public/tadween-offline-package.zip'), 'ملف public/tadween-offline-package.zip يجب أن يتواجد للتحميل المباشر');
  assert(fs.existsSync('offline_package/تشغيل-البرنامج.bat'), 'ملف تشغيل-البرنامج.bat يجب أن يتواجد داخل حزمة أوفلاين');
  assert(fs.existsSync('offline_package/server.ps1'), 'ملف server.ps1 يجب أن يتواجد داخل حزمة أوفلاين');
  assert(fs.existsSync('offline_package/start-mac-linux.sh'), 'ملف start-mac-linux.sh يجب أن يتواجد');
  assert(fs.existsSync('offline_package/دليل-التشغيل-بدون-انترنت.txt'), 'دليل التشغيل العربي يجب أن يتواجد');
  
  const bat = fs.readFileSync('offline_package/تشغيل-البرنامج.bat', 'utf-8');
  assert(bat.includes('server.ps1') || bat.includes('http.server'), 'سكربت ويندوز يجب أن يستدعي الخادم المحلي التلقائي');
});

// 7. Verify Native Android Project Structure
test('فحص مشروع تطبيق Android الأصلي وملف strings.xml واسم التطبيق', () => {
  assert(fs.existsSync('android/app/build.gradle'), 'مشروع أندرويد gradle موجود');
  assert(fs.existsSync('android/app/src/main/assets/public/index.html'), 'أصول الويب منسوخة إلى مشروع أندرويد');
  assert(fs.existsSync('android/app/src/main/res/values/strings.xml'), 'ملف strings.xml موجود');
  const strings = fs.readFileSync('android/app/src/main/res/values/strings.xml', 'utf-8');
  assert(strings.includes('تدوين حصص التدريس'), 'اسم التطبيق العربي موجود في إعدادات أندرويد');
  assert(fs.existsSync('capacitor.config.ts'), 'ملف capacitor.config.ts موجود');
});

async function runAll() {
  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`✓ [نجاح]: ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`✗ [فشل]: ${t.name}`);
      console.error(`  السبب: ${err.message}`);
    }
  }
  console.log(`\nالنتيجة النهائية للاختبارات: ${passed} من أصل ${tests.length} اختبارات ناجحة.`);
  if (passed === tests.length) {
    console.log('جميع اختبارات النسخة Offline ناجحة بنسبة 100%!');
  } else {
    process.exit(1);
  }
}

runAll();
