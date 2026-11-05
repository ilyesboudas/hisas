/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { loadDatabaseFromLocalStorage, normalizeDatabase } from '../utils/storage.ts';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleEmergencyExport = () => {
    try {
      const raw = loadDatabaseFromLocalStorage();
      const safe = normalizeDatabase(raw);
      const jsonStr = JSON.stringify(safe, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `emergency_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Emergency export failed:', e);
      alert('تعذر استخراج النسخة الاحتياطية تلقائيًا.');
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-red-100 p-6 sm:p-8 text-right">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">تعذر عرض الواجهة مؤقتًا</h1>
                <p className="text-sm text-slate-500 font-medium">بياناتك وسجلاتك آمنة بالكامل في التخزين المحلي ولم تُفقد</p>
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900 text-xs sm:text-sm mb-6 leading-relaxed">
              <span className="font-bold block mb-1">طمأنينة تامة:</span>
              نظام التخزين المحلي وقاعدة بيانات IndexedDB محفوظة بالكامل. يمكنك تنزيل نسخة احتياطية فورية من بياناتك الآن، أو إعادة محاولة فتح التطبيق.
            </div>

            {this.state.error && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 mb-6 max-h-32 overflow-y-auto ltr text-left">
                {this.state.error.toString()}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-sm text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                إعادة تحميل التطبيق
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                إعادة محاولة العرض
              </button>
            </div>

            <button
              onClick={this.handleEmergencyExport}
              className="w-full py-2 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              تصدير نسخة احتياطية فورية من البيانات (JSON)
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
