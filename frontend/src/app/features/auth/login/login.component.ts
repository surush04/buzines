import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { CompanyContextService } from '../../../core/services/company-context.service';
import { ApiService } from '../../../core/services/api.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent, PasswordInputComponent],
  template: `
    <div class="relative min-h-screen overflow-hidden text-white">
      <img src="brand/ceo-ai-hero.jpg" alt="" class="absolute inset-0 h-full w-full object-cover object-[72%_center]" />
      <div class="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent"></div>

      <header class="relative z-10 flex items-start justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
        <div class="flex items-center gap-3">
          <img src="brand/ceo-ai-logo.png" alt="" class="h-14 w-14 object-contain [filter:drop-shadow(0_0_1px_#fff)_drop-shadow(0_0_10px_rgba(255,255,255,0.7))]" />
          <span class="hidden h-9 w-px bg-white/35 sm:block"></span>
          <div>
            <div class="text-[26px] font-extrabold leading-none tracking-tight">{{ 'auth.heroTitle' | t }}</div>
            <p class="mt-1 max-w-[240px] text-[11px] leading-snug text-white/75">{{ 'auth.tagline' | t }}</p>
          </div>
        </div>
        <app-language-switcher tone="gold" />
      </header>

      <div class="relative z-10 flex min-h-[calc(100vh-5.5rem)] items-center justify-start px-4 pb-6 sm:px-8 lg:px-10">
        <div class="animate-fade-in w-full max-w-[300px] rounded-[22px] bg-[#f6f1e6]/95 p-4 text-[#1c1915] shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <h1 class="text-lg font-extrabold tracking-tight text-[#1c1915]">{{ 'auth.loginHeading' | t }}</h1>

          @if (error()) {
            <div class="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{{ error() }}</div>
          }

          <form (ngSubmit)="onSubmit()" class="mt-3 space-y-2.5">
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-[#5c5348]">{{ 'auth.email' | t }}</label>
              <div class="relative">
                <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#b7ab9a]">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z"/></svg>
                </span>
                <input type="email" [(ngModel)]="email" name="email" class="input-field !rounded-full !py-2 pl-11" [placeholder]="'auth.emailPlaceholder' | t" required />
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-[#5c5348]">{{ 'auth.password' | t }}</label>
              <div class="relative">
                <span class="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#b7ab9a]">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V8a4 4 0 118 0v3M6 11h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z"/></svg>
                </span>
                <app-password-input [(value)]="password" name="password" [placeholder]="'auth.passwordPlaceholder' | t" [required]="true" extraClass="!rounded-full !py-2 pl-11" />
              </div>
            </div>
            <div class="space-y-1.5 text-xs">
              <label class="flex items-center gap-2 font-medium text-[#5c5348]">
                <input type="checkbox" [(ngModel)]="remember" name="remember" class="h-4 w-4 shrink-0 rounded accent-[#e0a41e]" />
                <span class="min-w-0 leading-snug">{{ 'auth.remember' | t }}</span>
              </label>
              <p class="text-right font-semibold leading-snug text-[#c99212]">{{ 'auth.forgot' | t }}</p>
            </div>
            <button type="submit" class="btn-primary w-full !py-2.5 text-sm" [disabled]="loading()">
              {{ loading() ? ('auth.loggingIn' | t) : ('auth.login' | t) }}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p class="mt-3 text-center text-xs text-[#8a8175]">
            {{ 'auth.noAccount' | t }}
            <a routerLink="/auth/register" class="font-extrabold text-ink">{{ 'auth.register' | t }}</a>
          </p>
        </div>

        <div class="pointer-events-none absolute inset-y-16 right-0 hidden w-[52%] lg:block">
          @for (chip of chips; track chip.key) {
            <div class="absolute flex max-w-[180px] items-center gap-2.5 rounded-2xl border border-white/25 bg-white/10 px-3 py-2.5 text-[13px] font-semibold leading-tight text-white shadow-lg backdrop-blur-md" [class]="chip.pos">
              <svg class="h-5 w-5 shrink-0 text-[#f3c85a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.7">
                <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="chip.icon" />
              </svg>
              <span>{{ chip.key | t }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private companyContext = inject(CompanyContextService);
  private api = inject(ApiService);
  readonly i18n = inject(TranslationService);

  email = '';
  password = '';
  remember = false;
  loading = signal(false);
  readonly chips = [
    { key: 'auth.feat.analysis', icon: 'M4 19V5m0 14h16M8 16l3-4 3 2 4-6', pos: 'left-[6%] top-[8%]' },
    { key: 'auth.feat.team', icon: 'M16 19v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 11a3 3 0 100-6 3 3 0 000 6zM19 19v-1a3 3 0 00-2-2.8', pos: 'left-[2%] top-[38%]' },
    { key: 'auth.feat.process', icon: 'M4 7h16M4 12h16M4 17h10', pos: 'left-[8%] bottom-[16%]' },
    { key: 'auth.feat.finance', icon: 'M12 3v18M7 8c0-2 2-3 5-3s5 1 5 3-2 3-5 3-5 1-5 3 2 3 5 3 5-1 5-3', pos: 'right-[4%] top-[10%]' },
    { key: 'auth.feat.marketing', icon: 'M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 010 6', pos: 'right-[0%] top-[42%]' },
    { key: 'auth.feat.growth', icon: 'M4 16l5-5 3 3 7-8M14 6h6v6', pos: 'right-[6%] bottom-[14%]' },
  ];
  error = signal('');

  onSubmit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        if (this.auth.user()?.role === 'EMPLOYEE') {
          this.loading.set(false);
          this.router.navigate(['/work']);
          return;
        }
        this.companyContext.ensureCompany().pipe(
          switchMap((id) => this.api.getCompany(id)),
        ).subscribe({
          next: (c) => {
            this.loading.set(false);
            this.companyContext.onboardingDone.set(c.onboardingDone ?? false);
            this.companyContext.companyName.set(c.name);
            this.router.navigate([c.onboardingDone ? '/commands' : '/onboarding']);
          },
          error: () => {
            this.loading.set(false);
            this.router.navigate(['/onboarding']);
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('auth.loginError'));
      },
    });
  }
}
