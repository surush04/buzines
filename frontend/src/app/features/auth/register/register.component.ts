import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/components/language-switcher/language-switcher.component';

import { PasswordInputComponent } from '../../../shared/components/password-input/password-input.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent, PasswordInputComponent],
  styles: `
    .login-scene {
      background:
        radial-gradient(ellipse at 72% 42%, rgba(240, 193, 75, 0.28), transparent 36%),
        linear-gradient(115deg, #14110e 0%, #2a241c 48%, #0e0c0a 100%);
    }
  `,
  template: `
    <div class="login-scene relative flex min-h-screen items-center justify-center p-4">
      <div class="absolute right-4 top-4 z-10">
        <app-language-switcher tone="gold" />
      </div>
      <div class="animate-fade-in w-full max-w-md rounded-[28px] bg-[#f7f3ea] p-7 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <h1 class="text-2xl font-extrabold">{{ 'auth.register' | t }}</h1>
        <p class="mt-1 text-sm text-[#8a8175]">{{ 'auth.registerSubtitle' | t }}</p>
        @if (error()) {
          <div class="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-600">{{ error() }}</div>
        }
        <form (ngSubmit)="onSubmit()" class="mt-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-[#5c5348]">{{ 'auth.firstName' | t }}</label>
              <input [(ngModel)]="firstName" name="firstName" class="input-field" required />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-[#5c5348]">{{ 'auth.lastName' | t }}</label>
              <input [(ngModel)]="lastName" name="lastName" class="input-field" required />
            </div>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-semibold text-[#5c5348]">{{ 'auth.email' | t }}</label>
            <input type="email" [(ngModel)]="email" name="email" class="input-field" required />
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-semibold text-[#5c5348]">{{ 'auth.password' | t }}</label>
            <app-password-input [(value)]="password" name="password" [minlength]="8" [required]="true" />
          </div>
          <button type="submit" class="btn-primary w-full" [disabled]="loading()">
            {{ loading() ? ('auth.registering' | t) : ('auth.register' | t) }}
          </button>
        </form>
        <p class="mt-6 text-center text-sm text-[#8a8175]">
          {{ 'auth.hasAccount' | t }}
          <a routerLink="/auth/login" class="font-extrabold text-ink">{{ 'auth.login' | t }}</a>
        </p>
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
