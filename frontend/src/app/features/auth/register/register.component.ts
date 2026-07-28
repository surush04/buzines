import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-4">
      <div class="absolute right-4 top-4 z-10">
        <app-language-switcher />
      </div>

      <div class="animate-fade-in w-full max-w-md">
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-bold text-white">{{ 'auth.register' | t }}</h1>
          <p class="mt-2 text-sm text-slate-400">{{ 'auth.registerSubtitle' | t }}</p>
        </div>

        <div class="glass-card !bg-white/10 !border-white/10 p-8">
          @if (error()) {
            <div class="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error() }}</div>
          }

          <form (ngSubmit)="onSubmit()" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-300">{{ 'auth.firstName' | t }}</label>
                <input [(ngModel)]="firstName" name="firstName" class="input-field !bg-white/5 !border-white/10 !text-white" required />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-slate-300">{{ 'auth.lastName' | t }}</label>
                <input [(ngModel)]="lastName" name="lastName" class="input-field !bg-white/5 !border-white/10 !text-white" required />
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-300">{{ 'auth.email' | t }}</label>
              <input type="email" [(ngModel)]="email" name="email" class="input-field !bg-white/5 !border-white/10 !text-white" required />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-slate-300">{{ 'auth.password' | t }}</label>
              <input type="password" [(ngModel)]="password" name="password" class="input-field !bg-white/5 !border-white/10 !text-white" minlength="8" required />
            </div>
            <button type="submit" class="btn-primary w-full" [disabled]="loading()">
              {{ loading() ? ('auth.registering' | t) : ('auth.register' | t) }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-slate-400">
            {{ 'auth.hasAccount' | t }}
            <a routerLink="/auth/login" class="font-semibold text-primary-400 hover:text-primary-300">{{ 'auth.login' | t }}</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  private auth = inject(AuthService);
  readonly i18n = inject(TranslationService);

  firstName = '';
  lastName = '';
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  onSubmit() {
    this.loading.set(true);
    this.error.set('');
    this.auth.register({ email: this.email, password: this.password, firstName: this.firstName, lastName: this.lastName }).subscribe({
      next: () => {
        this.loading.set(false);
        window.location.href = '/onboarding';
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('auth.registerError'));
      },
    });
  }
}
