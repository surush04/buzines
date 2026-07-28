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

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-4">
      <div class="absolute right-4 top-4 z-10">
        <app-language-switcher />
      </div>

      <div class="animate-fade-in w-full max-w-md">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-2xl shadow-primary-500/40">
            <svg class="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">{{ 'brand.title' | t }} {{ 'brand.subtitle' | t }}</h1>
          <p class="mt-2 text-sm text-slate-400">{{ 'auth.tagline' | t }}</p>
        </div>

        <div class="glass-card !bg-white/10 !border-white/10 p-8">
          <h2 class="mb-6 text-xl font-semibold text-white">{{ 'auth.login' | t }}</h2>

          @if (error()) {
            <div class="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error() }}</div>
          }

          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-300">{{ 'auth.email' | t }}</label>
              <input type="email" [(ngModel)]="email" name="email" class="input-field !bg-white/5 !border-white/10 !text-white" [placeholder]="'auth.emailPlaceholder' | t" required />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-300">{{ 'auth.password' | t }}</label>
              <input type="password" [(ngModel)]="password" name="password" class="input-field !bg-white/5 !border-white/10 !text-white" [placeholder]="'auth.passwordPlaceholder' | t" required />
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              {{ loading() ? ('auth.loggingIn' | t) : ('auth.login' | t) }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate-400">
            {{ 'auth.noAccount' | t }}
            <a routerLink="/auth/register" class="font-semibold text-primary-400 hover:text-primary-300">{{ 'auth.register' | t }}</a>
          </p>
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
  loading = signal(false);
  error = signal('');

  onSubmit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
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
