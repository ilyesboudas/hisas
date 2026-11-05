/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { validateDatabaseSchema } from '../utils/storage.ts';
import {
  saveSnapshotToIndexedDB,
  listSnapshotsFromIndexedDB,
  deleteSnapshotFromIndexedDB,
  LocalDBSnapshot,
} from '../utils/indexedDb.ts';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  Download,
  Upload,
  Database,
  History,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  HardDrive,
  Camera,
  Trash2,
  FolderArchive,
  Laptop,
  Smartphone,
} from 'lucide-react';


export const DataBackupView: React.FC = () => {
  const {
    db,
    exportJsonBackup,
    importJsonBackup,
    resetToDemoData,
    clearAllData,
    showToast,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importCandidate, setImportCandidate] = useState<{
    content: string;
    summary: {
      version: number;
      exportedAt: string;
      baseCount: number;
      recordsCount: number;
      weeksCount: number;
    };
  } | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const validation = validateDatabaseSchema(parsed);

        if (!validation.isValid) {
          setImportError(validation.error || 'الملف لا يتطابق مع بنية بيانات النظام.');
          return;
        }

        setImportCandidate({
          content: text,
          summary: {
            version: parsed.version,
            exportedAt: parsed.exportedAt || 'غير محدد',
            baseCount: Array.isArray(parsed.baseSchedule) ? parsed.baseSchedule.length : 0,
            recordsCount: Array.isArray(parsed.dailyRecords) ? parsed.dailyRecords.length : 0,
            weeksCount: Array.isArray(parsed.weeks) ? parsed.weeks.length : 0,
          },
        });
      } catch (err) {
        setImportError('الملف المحدد ليس ملف JSON صالحًا أو تالف.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importCandidate) return;
    const res = await importJsonBackup(importCandidate.content);
    if (res.success) {
      setImportCandidate(null);
      setImportError(null);
      await loadSnapshots();
    } else {
      setImportError(res.error || 'فشلت عملية الاستيراد.');
    }
  };

  const [snapshots, setSnapshots] = useState<LocalDBSnapshot[]>([]);

  const [snapshotNote, setSnapshotNote] = useState('');
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // Load snapshots on mount
  React.useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      const list = await listSnapshotsFromIndexedDB();
      setSnapshots(list);
    } catch (err) {
      console.warn('Failed to load snapshots:', err);
    }
  };

  const handleCreateSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try {
      const note = snapshotNote.trim() || `نقطة استعادة - ${new Date().toLocaleDateString('ar-DZ')}`;
      await saveSnapshotToIndexedDB(db, note);
      setSnapshotNote('');
      await loadSnapshots();
      showToast('success', 'تم إنشاء نقطة الاستعادة بنجاح في IndexedDB');
    } catch (err) {
      showToast('error', 'تعذر إنشاء نقطة الاستعادة');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot: LocalDBSnapshot) => {
    const jsonStr = JSON.stringify(snapshot.data);
    const res = await importJsonBackup(jsonStr);
    if (res.success) {
      showToast('success', `تمت استعادة البيانات من نقطة: ${snapshot.note}`);
    } else {
      showToast('error', res.error || 'تعذرت استعادة نقطة الحفظ');
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    await deleteSnapshotFromIndexedDB(id);
    await loadSnapshots();
    showToast('info', 'تم حذف نقطة الاستعادة');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            <span>البيانات والنسخ الاحتياطي (JSON)</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            تصدير واستيراد قاعدة البيانات محليًا بصيغة JSON، وسجل العمليات والتعديلات
          </p>
        </div>
      </div>

      {/* Export & Import Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Export Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-4">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              تصدير نسخة احتياطية كاملة (JSON)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              تحميل ملف JSON كامل بترميز UTF-8 يتضمن جميع الحصص الأساسية، حصص الدعم، السجلات اليومية، الأسابيع المعتمدة، والتصفيات المالية السابقة.
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl text-2xs text-slate-600 space-y-1">
              <div>• حصص الجدول الأساسي: <span className="font-bold">{db.baseSchedule.length}</span></div>
              <div>• سجلات الحصص اليومية: <span className="font-bold">{db.dailyRecords.length}</span></div>
              <div>• الأسابيع المسجلة: <span className="font-bold">{db.weeks.length}</span></div>
              <div>• التصفيات المؤرشفة: <span className="font-bold">{db.liquidations.length}</span></div>
            </div>
          </div>

          <button
            onClick={exportJsonBackup}
            className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل ملف النسخة الاحتياطية</span>
          </button>
        </div>

        {/* Import Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              استيراد نسخة احتياطية (JSON)
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              استعادة البيانات من ملف JSON تم تصديره سابقًا. يتحقق النظام تلقائيًا من سلامة الملف، وينشئ نسخة احتياطية وقائية قبل الاستبدال.
            </p>

            {importError && (
              <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{importError}</span>
              </div>
            )}
          </div>

          <div className="mt-6">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>اختيار ملف JSON للاستيراد</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Import Modal */}
      {importCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-indigo-600" />
                <span>تأكيد استيراد البيانات</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تم فحص الملف بنجاح. راجع محتويات الملف قبل الاستبدال:
              </p>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-slate-700">
                <div>إصدار بنية البيانات: <span className="font-bold">{importCandidate.summary.version}</span></div>
                <div>تاريخ التصدير: <span className="font-mono">{importCandidate.summary.exportedAt}</span></div>
                <div>عدد الحصص الأساسية: <span className="font-bold">{importCandidate.summary.baseCount}</span></div>
                <div>عدد سجلات الحضور: <span className="font-bold">{importCandidate.summary.recordsCount}</span></div>
                <div>عدد الأسابيع: <span className="font-bold">{importCandidate.summary.weeksCount}</span></div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                <span className="font-bold">تحذير:</span> سيتم استبدال البيانات الحالية ببيانات الملف المستورد. سيقوم النظام بحفظ نسخة احتياطية وقائية قبل الاستبدال.
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportCandidate(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-5 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                تأكيد واستبدال البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Storage Engine & Instant Snapshots */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                طبقة الحفظ المحلي المزدوجة ونقاط الاستعادة (IndexedDB & Snapshots)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تأمين بياناتك محلياً ضد فقدان الذاكرة أو تنظيف المتصفح مع إمكانية أخذ لقطات فورية واسترجاعها
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>حفظ مزدوج نشط: IndexedDB + LocalStorage</span>
          </div>
        </div>

        {/* Create Snapshot Form */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            value={snapshotNote}
            onChange={(e) => setSnapshotNote(e.target.value)}
            placeholder="ملاحظة نقطة الاستعادة (مثال: قبل تصفية شهر أكتوبر، أو نهاية الفصل)..."
            className="flex-1 w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          <button
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            <span>{isCreatingSnapshot ? 'جارٍ الإنشاء...' : 'حفظ نقطة استعادة جديدة'}</span>
          </button>
        </div>

        {/* Snapshots List */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 mb-2">نقاط الاستعادة المحفوظة محلياً ({snapshots.length})</h4>
          {snapshots.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
              لا توجد نقاط استعادة مخصصة بعد. يمكنك حفظ لقطة أمان لأي مرحلة عمل بنقرة زر أعلاه.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {snapshots.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-200 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">{s.note}</div>
                    <div className="text-2xs text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{new Date(s.timestamp).toLocaleString('ar-DZ')}</span>
                      <span>•</span>
                      <span>{s.recordCount} حصة مسجلة</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleRestoreSnapshot(s)}
                      className="px-2.5 py-1 text-2xs font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                    >
                      استرجاع
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(s.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Offline Standalone ZIP Package Card */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 p-6 rounded-2xl border border-indigo-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <FolderArchive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base">
                  حزمة التشغيل دون إنترنت المستقلة للحاسوب (Offline ZIP Bundle)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-2xs font-extrabold">
                  جاهز للتحميل
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                حزمة كاملة جاهزة للعمل دون اتصال بالإنترنت. تتضمن ملف تشغيل بنقرة واحدة لويندوز (<code className="bg-indigo-100/70 text-indigo-900 px-1 py-0.5 rounded font-mono text-2xs">تشغيل-البرنامج.bat</code>) مع خادم محلي آمن مدمج عبر PowerShell، وسكربت لماك ولينكس، ودليل تشغيل عربي مبسط.
              </p>
            </div>
          </div>

          <a
            href="/tadween-offline-package.zip"
            download="tadween-teaching-sessions-offline.zip"
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>تحميل حزمة ZIP للحاسوب (350 KB)</span>
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-indigo-100 text-xs">
          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-xl border border-indigo-100/60">
            <Laptop className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">تشغيل ويندوز الفوري</div>
              <div className="text-2xs text-slate-500 mt-0.5">فك الضغط واضغط مرتين على <span className="font-semibold text-slate-700">تشغيل-البرنامج.bat</span> دون تثبيت أي برامج مسبقة.</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-xl border border-indigo-100/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">تثبيت PWA الدائم</div>
              <div className="text-2xs text-slate-500 mt-0.5">اضغط على زر «تثبيت التطبيق» في الشريط العلوي لتثبيته كبرنامج مستقل على سطح المكتب.</div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-white/80 p-3 rounded-xl border border-indigo-100/60">
            <Smartphone className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900">تطبيق أندرويد والهاتف</div>
              <div className="text-2xs text-slate-500 mt-0.5">ثبته من متصفح الهاتف عبر «إضافة إلى الشاشة الرئيسية»، ومشروع أندرويد الأصلي متاح للبناء.</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <h3 className="font-bold text-slate-900 text-sm mb-3">إجراءات الصيانة وإعادة التهيئة</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>استعادة البيانات النموذجية (Demo Data)</span>
          </button>

          <button
            onClick={() => setIsClearConfirmOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>مسح جميع البيانات والبدء من الصفر</span>
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>سجل العمليات والتعديلات المهمة (Audit Log)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              توثيق زمني تلقائي لجميع عمليات الاعتماد، وإعادة الفتح، والتعديلات المحاسبية
            </p>
          </div>
          <span className="text-xs text-slate-400">
            <span className="font-mono">{db.auditLogs.length}</span> عملية موثقة
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-3.5">الوقت والتاريخ</th>
                <th className="p-3.5">نوع العملية</th>
                <th className="p-3.5">العنصر المتأثر</th>
                <th className="p-3.5">تفاصيل العملية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-400">
                    لا توجد عمليات مسجلة في سجل التدقيق بعد.
                  </td>
                </tr>
              ) : (
                db.auditLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('ar-DZ')}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded-md text-2xs font-bold bg-slate-100 text-slate-700 font-mono">
                        {log.eventType}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap text-slate-600 font-mono">
                      {log.entity}
                    </td>
                    <td className="p-3.5 text-slate-900 font-medium">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Confirmation */}
      <ConfirmModal
        isOpen={isResetConfirmOpen}
        title="استعادة البيانات النموذجية"
        message="هل تريد استعادة البيانات النموذجية (14 ساعة أسبوعية، حصص دعم، أسبوع معتمد)؟ سيتم استبدال البيانات الحالية."
        confirmLabel="استعادة البيانات النموذجية"
        variant="warning"
        onConfirm={() => {
          resetToDemoData();
          setIsResetConfirmOpen(false);
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Clear Confirmation */}
      <ConfirmModal
        isOpen={isClearConfirmOpen}
        title="تأكيد مسح جميع البيانات"
        message="تحذير: سيتم مسح جميع الجداول والحصص والأسابيع والتصفيات نهائيًا. هل تريد الاستمرار؟"
        confirmLabel="مسح كل شيء"
        variant="danger"
        onConfirm={() => {
          clearAllData();
          setIsClearConfirmOpen(false);
        }}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </div>
  );
};
