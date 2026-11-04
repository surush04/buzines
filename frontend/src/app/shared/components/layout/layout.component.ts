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
    <div class="flex h-screen overflow-hidden bg-cream dark:bg-[#14120f]">
      <aside
        class="fixed inset-y-3 left-3 z-50 flex w-[248px] flex-col rounded-[28px] bg-white p-4 shadow-[0_12px_40px_rgba(70,50,20,0.06)] transition-transform dark:bg-[#1c1915] lg:static lg:m-3 lg:!translate-x-0"
        [class.-translate-x-[120%]]="!sidebarOpen()"
        [class.translate-x-0]="sidebarOpen()"
      >
        <div class="mb-4 flex items-center gap-3 px-2 pt-1">
          <span class="flex h-10 w-10 items-center justify-center text-ink dark:text-white">
            <svg viewBox="0 0 64 64" class="h-7 w-7"><path fill="currentColor" d="M32 4l5 23 23 5-23 5-5 23-5-23-23-5 23-5z"/></svg>
          </span>
          <div>
            <h1 class="text-sm font-extrabold tracking-tight">{{ 'brand.title' | t }}</h1>
            <p class="text-[11px] text-[#8a8175]">{{ 'brand.subtitle' | t }}</p>
          </div>
          <button class="ml-auto text-[#8a8175] lg:hidden" (click)="sidebarOpen.set(false)">✕</button>
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto">
          @for (item of navItems(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="sidebar-link-active" class="sidebar-link" (click)="sidebarOpen.set(false)">
              <svg class="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="item.icon" />
              </svg>
              {{ item.label }}
            </a>
          }
        </nav>

        <div class="mt-3 border-t border-[#f0e7d8] pt-3 dark:border-white/10">
          <div class="mb-3 flex justify-center">
            <app-language-switcher />
          </div>
          <div class="flex items-center gap-3 rounded-2xl bg-[#f7f3ea] p-3 dark:bg-white/5">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-xs font-extrabold text-white">
              {{ initials() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-extrabold">{{ auth.user()?.firstName }} {{ auth.user()?.lastName }}</p>
              <p class="truncate text-xs text-[#8a8175]">{{ auth.user()?.role }}</p>
            </div>
          </div>
          <div class="mt-2 flex gap-2">
            <button class="btn-secondary flex-1 !py-2 !text-xs" (click)="theme.toggle()">{{ theme.isDark() ? '☀' : '☾' }}</button>
            <button class="btn-secondary flex-1 !py-2 !text-xs" (click)="companyContext.clear(); auth.logout()">{{ 'layout.logout' | t }}</button>
          </div>
        </div>
      </aside>

      @if (sidebarOpen()) {
        <div class="fixed inset-0 z-40 bg-black/30 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <div class="flex flex-1 flex-col overflow-hidden">
        <header class="flex items-center gap-3 px-4 py-4 lg:px-6">
          <button class="rounded-full bg-white px-3 py-2 text-sm shadow-sm lg:hidden dark:bg-[#1c1915]" (click)="sidebarOpen.set(true)">☰</button>
          <div class="flex-1"></div>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:bg-[#1c1915] dark:text-emerald-300">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            {{ 'layout.aiActive' | t }}
          </span>
        </header>
        <main class="flex-1 overflow-y-auto px-4 pb-6 lg:px-6">
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
      { path: '/commands', label: this.i18n.t('nav.commands'), icon: 'M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-10.5z' },
      { path: '/projects', label: this.i18n.t('nav.projects'), icon: 'M4 7h6l2 2h8v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z' },
      { path: '/dashboard', label: this.i18n.t('nav.dashboard'), icon: 'M4 19V5m0 14h16M8 16l3-4 3 2 4-6' },
      { path: '/employees', label: this.i18n.t('nav.employees'), icon: 'M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3 3 0 100-6 3 3 0 000 6zM20 19v-1a3 3 0 00-2.2-2.9M16 5.1a3 3 0 010 5.8' },
      { path: '/reports', label: this.i18n.t('nav.reports'), icon: 'M6 3h8l4 4v14a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zm8 0v4h4M8 13h8M8 17h5' },
      { path: '/calendar', label: this.i18n.t('nav.calendar'), icon: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z' },
      { path: '/ai-manager', label: this.i18n.t('nav.aiManager'), icon: 'M12 3l1.6 5.2L19 10l-5.4 1.8L12 17l-1.6-5.2L5 10l5.4-1.8L12 3z' },
      { path: '/settings', label: this.i18n.t('nav.settings'), icon: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM4 12h2m12 0h2M12 4v2m0 12v2' },
      { path: '/os', label: this.i18n.t('nav.os'), icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zm-3 8h6M12 9v6' },
    ];
  });

  initials() {
    const u = this.auth.user();
    if (!u) return '?';
    return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
  }
}
