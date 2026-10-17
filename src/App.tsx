/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider } from './context/AppContext.tsx';
import { Navbar, NavTab } from './components/Navbar.tsx';
import { Toast } from './components/Toast.tsx';
import { DashboardView } from './views/DashboardView.tsx';
import { BaseScheduleView } from './views/BaseScheduleView.tsx';
import { SupportScheduleView } from './views/SupportScheduleView.tsx';
import { ExtraSessionsView } from './views/ExtraSessionsView.tsx';
import { DailyLoggingView } from './views/DailyLoggingView.tsx';
import { WeeksView } from './views/WeeksView.tsx';
import { LiquidationView } from './views/LiquidationView.tsx';
import { DataBackupView } from './views/DataBackupView.tsx';
import { SettingsView } from './views/SettingsView.tsx';

function MainApp() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
        {currentTab === 'daily' && <DailyLoggingView />}
        {currentTab === 'base_schedule' && <BaseScheduleView />}
        {currentTab === 'support_schedule' && <SupportScheduleView />}
        {currentTab === 'extra_sessions' && <ExtraSessionsView />}
        {currentTab === 'weeks' && <WeeksView />}
        {currentTab === 'liquidation' && <LiquidationView />}
        {currentTab === 'backup' && <DataBackupView />}
        {currentTab === 'settings' && <SettingsView />}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 font-medium flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>نظام «تدوين حصص التدريس» — إدارة الساعات والأنصبة والتصفية المالية</span>
          <span>محاسبة زمنية دقيقة بالدقائق • تخزين محلي آمن 100% دون إنترنت</span>
        </div>
      </footer>

      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
