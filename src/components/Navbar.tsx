/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  Clock,
  Sparkles,
  BarChart3,
  Receipt,
  Database,
  Settings,
  Save,
  Check,
  Menu,
  X,
  FileSpreadsheet,
  GraduationCap,
  CalendarRange,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton.tsx';
import { SaveStatusIndicator } from './SaveStatusIndicator.tsx';

export type NavTab =
  | 'dashboard'
  | 'calendar'
  | 'daily'
  | 'base_schedule'
  | 'support_schedule'
  | 'extra_sessions'
  | 'weeks'
  | 'liquidation'
  | 'trainings'
  | 'backup'
  | 'settings';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { hasUnsavedChanges, lastSavedAt, saveAll } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'calendar', label: 'الرزنامة الأسبوعية', icon: CalendarRange },
    { id: 'daily', label: 'التسجيل اليومي', icon: CalendarCheck },
    { id: 'base_schedule', label: 'جدول الحصص', icon: CalendarDays },
    { id: 'support_schedule', label: 'حصص الدعم الثابتة', icon: Clock },
    { id: 'extra_sessions', label: 'الحصص الإضافية', icon: Sparkles },
    { id: 'weeks', label: 'الأسابيع والتقييم', icon: BarChart3 },
    { id: 'liquidation', label: 'التصفية المالية', icon: Receipt },
    { id: 'trainings', label: 'التكوينات والتكليفات', icon: GraduationCap },
    { id: 'backup', label: 'البيانات والنسخ', icon: Database },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSelectTab('dashboard')}
              className="flex items-center gap-3 text-right group cursor-pointer focus:outline-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                  تدوين حصص التدريس
                </span>
                <span className="block text-xs text-slate-500 font-medium">
                  نظام إدارة الساعات والأنصبة والتصفية
                </span>
              </div>
            </button>
          </div>

          {/* Action Bar (Save Button & Status) */}
          <div className="flex items-center gap-2.5">
            {/* Real-time Auto-Save Status Indicator */}
            <div className="hidden md:block">
              <SaveStatusIndicator variant="full" />
            </div>

            {/* PWA Install Button */}
            <div className="hidden sm:block">
              <PWAInstallButton variant="navbar" />
            </div>

            {/* Backup Manual Save Button */}
            <button
              onClick={() => saveAll(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80"
              title="تأكيد كتابة جميع التعديلات فورياً في IndexedDB"
            >
              <Save className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">حفظ فوري</span>
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="القائمة الرئيسية"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>


      {/* Desktop Navigation Tabs */}
      <div className="hidden lg:block bg-slate-50/70 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 space-x-reverse overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-1 shadow-lg animate-fade-in">
          <div className="flex items-center justify-between gap-2 text-xs px-3 py-2 mb-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
            <SaveStatusIndicator variant="compact" />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => saveAll(true)}
                className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-2xs hover:bg-indigo-100"
              >
                حفظ
              </button>
              <PWAInstallButton variant="compact" />
            </div>
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-right ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
