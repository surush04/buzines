import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, ThemeService } from '../../../core/services/auth.service';
import { CompanyContextService } from '../../../core/services/company-context.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <aside
        class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200/60 bg-white/80 backdrop-blur-xl transition-transform dark:border-slate-800 dark:bg-slate-900/80 lg:static lg:translate-x-0"
        [class.-translate-x-full]="!sidebarOpen()"
        [class.translate-x-0]="sidebarOpen()"
      >
        <div class="flex h-16 items-center gap-3 border-b border-slate-200/60 px-6 dark:border-slate-800">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/30 text-white text-lg">
            🤖
          </div>
          <div>
            <h1 class="text-sm font-bold text-slate-900 dark:text-white">{{ 'brand.title' | t }}</h1>
            <p class="text-xs text-slate-500">{{ 'brand.subtitle' | t }}</p>
          </div>
          <button class="ml-auto lg:hidden text-slate-500" (click)="sidebarOpen.set(false)">✕</button>
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto p-4">
          @for (item of navItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="sidebar-link-active"
              class="sidebar-link"
              (click)="sidebarOpen.set(false)"
            >
              <span class="text-lg">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="border-t border-slate-200/60 p-4 dark:border-slate-800">
          <div class="mb-3 flex justify-center">
            <app-language-switcher />
          </div>
          <div class="flex items-center gap-3 rounded-xl p-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              {{ initials() }}
            </div>
            <div class="flex-1 truncate">
              <p class="text-sm font-semibold">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</p>
              <p class="truncate text-xs text-slate-500">{{ auth.user()?.role }}</p>
            </div>
          </div>
          <div class="mt-2 flex gap-2">
            <button class="btn-secondary flex-1 !py-2 !text-xs" (click)="theme.toggle()">
              {{ theme.isDark() ? '☀️' : '🌙' }}
            </button>
            <button class="btn-secondary flex-1 !py-2 !text-xs" (click)="companyContext.clear(); auth.logout()">
              🚪
            </button>
          </div>
        </div>
      </aside>

      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-40 bg-black/30 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <div class="flex flex-1 flex-col overflow-hidden">
        <header class="flex h-16 items-center gap-4 border-b border-slate-200/60 bg-white/60 px-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/60">
          <button class="lg:hidden text-xl" (click)="sidebarOpen.set(true)">☰</button>
          <div class="flex-1">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">{{ 'layout.panel' | t }}</h2>
          </div>
          <app-language-switcher class="hidden sm:block" />
          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <span class="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-500"></span>
            {{ 'layout.aiActive' | t }}
          </span>
        </header>
        <main class="flex-1 overflow-y-auto p-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class LayoutComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  sidebarOpen = signal(false);

  ngOnInit() {
    this.i18n.syncLangToBackend();
  }

  navItems = computed(() => {
    this.i18n.lang();
    return [
      { path: '/commands', label: this.i18n.t('nav.commands'), icon: '🎯' },
      { path: '/employees', label: this.i18n.t('nav.employees'), icon: '👥' },
      { path: '/dashboard', label: this.i18n.t('nav.dashboard'), icon: '📊' },
      { path: '/projects', label: this.i18n.t('nav.projects'), icon: '📁' },
      { path: '/ai-manager', label: this.i18n.t('nav.aiManager'), icon: '🤖' },
      { path: '/reports', label: this.i18n.t('nav.reports'), icon: '📈' },
      { path: '/calendar', label: this.i18n.t('nav.calendar'), icon: '📅' },
      { path: '/settings', label: this.i18n.t('nav.settings'), icon: '⚙️' },
    ];
  });

  initials() {
    const u = this.auth.user();
    if (!u) return '?';
    return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
  }
}
