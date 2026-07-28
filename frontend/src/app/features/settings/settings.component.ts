import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ 'settings.title' | t }}</h2>
        <p class="text-sm text-slate-500">{{ 'settings.subtitle' | t }}</p>
      </div>

      <!-- Personal Telegram -->
      <div class="glass-card p-6">
        <div class="mb-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-3xl">✈️</span>
            <div>
              <h3 class="font-semibold text-slate-900 dark:text-white">{{ 'settings.telegramTitle' | t }}</h3>
              <p class="text-xs text-slate-500">{{ 'settings.telegramDesc' | t }}</p>
            </div>
          </div>
          @if (userTelegram()?.connected) {
            <span class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">{{ 'settings.connected' | t }}</span>
          } @else {
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">{{ 'settings.disconnected' | t }}</span>
          }
        </div>

        @if (userTelegram()?.connected) {
          <div class="mb-4 rounded-xl bg-emerald-50 p-4 text-sm dark:bg-emerald-900/20">
            <p><strong>&#64;{{ userTelegram()?.username }}</strong> — {{ 'settings.messagesFrom' | t }}</p>
            <p class="text-xs text-slate-500 mt-1">{{ userTelegram()?.phone }}</p>
          </div>
        } @else {
          <div class="space-y-4">
            <div class="rounded-xl border border-slate-200/60 p-4 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <p class="font-medium mb-2">{{ 'settings.stepsTitle' | t }}</p>
              <ol class="list-decimal space-y-1 pl-4">
                <li>{{ 'settings.step1' | t }}</li>
                <li>{{ 'settings.step2' | t }}</li>
                <li>{{ 'settings.step3' | t }}</li>
                <li>{{ 'settings.step4' | t }}</li>
              </ol>
            </div>

            <div>
              <label class="mb-1 block text-xs text-slate-500">{{ 'settings.phone' | t }}</label>
              <input [(ngModel)]="phone" class="input-field" [placeholder]="'settings.phonePlaceholder' | t" />
            </div>

            @if (codeSent()) {
              @if (otpHint()) {
                <p class="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                  {{ otpHint() }}
                </p>
              }
              <div>
                <label class="mb-1 block text-xs text-slate-500">{{ 'settings.otp' | t }}</label>
                <input [(ngModel)]="otpCode" class="input-field" [placeholder]="'settings.otpPlaceholder' | t" inputmode="numeric" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-slate-500">{{ 'settings.password2fa' | t }}</label>
                <input [(ngModel)]="password2fa" type="password" class="input-field" [placeholder]="'settings.password2faPlaceholder' | t" />
              </div>
            }

            <div class="flex flex-wrap gap-2">
              @if (!codeSent()) {
                <button class="btn-primary !text-xs" (click)="sendCode()" [disabled]="telegramLoading() || !phone.trim()">
                  {{ telegramLoading() ? ('settings.connecting' | t) : ('settings.sendOtp' | t) }}
                </button>
              } @else {
                <button class="btn-primary !text-xs" (click)="confirmCode()" [disabled]="telegramLoading() || !otpCode.trim()">
                  {{ telegramLoading() ? '...' : ('settings.connect' | t) }}
                </button>
              }
              <button class="btn-secondary !text-xs" (click)="loadUserTelegram()" [disabled]="telegramLoading()">{{ 'settings.check' | t }}</button>
            </div>
          </div>
        }

        @if (telegramError()) {
          <p class="mt-3 text-sm text-red-500">{{ telegramError() }}</p>
        }
      </div>

      <!-- Business profile for AI -->
      <div class="glass-card p-6">
        <h3 class="mb-4 font-semibold text-slate-900 dark:text-white">{{ 'settings.businessProfile' | t }}</h3>
        <div class="space-y-3">
          <div>
            <label class="mb-1 block text-xs text-slate-500">{{ 'settings.description' | t }}</label>
            <textarea [(ngModel)]="businessProfile.description" rows="2" class="input-field"></textarea>
          </div>
          <div>
            <label class="mb-1 block text-xs text-slate-500">{{ 'settings.businessContext' | t }}</label>
            <textarea [(ngModel)]="businessProfile.businessContext" rows="3" class="input-field" [placeholder]="'settings.businessContext' | t"></textarea>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="btn-primary !text-xs" (click)="saveBusinessProfile()" [disabled]="saving()">{{ 'settings.saveProfile' | t }}</button>
            <button class="btn-secondary !text-xs text-red-600" (click)="resetData()" [disabled]="saving()">{{ 'settings.clearTasks' | t }}</button>
          </div>
          @if (saveMsg()) {
            <p class="text-xs text-emerald-600">{{ saveMsg() }}</p>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="glass-card p-6">
          <h3 class="mb-4 font-semibold">{{ 'settings.workHours' | t }}</h3>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="mb-1 block text-xs text-slate-500">{{ 'settings.start' | t }}</label>
                <input type="time" [(ngModel)]="settings.workingHoursStart" class="input-field" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-slate-500">{{ 'settings.end' | t }}</label>
                <input type="time" [(ngModel)]="settings.workingHoursEnd" class="input-field" />
              </div>
            </div>
          </div>
        </div>
        <div class="glass-card p-6">
          <h3 class="mb-4 font-semibold">{{ 'settings.aiSettings' | t }}</h3>
          <select [(ngModel)]="aiSettings.autonomyLevel" class="input-field mb-3">
            <option value="FULL_AUTONOMY">{{ 'settings.autonomyFull' | t }}</option>
            <option value="ADVISOR">{{ 'settings.autonomyAdvisor' | t }}</option>
          </select>
          <button class="btn-primary !text-xs w-full" (click)="saveAiSettings()" [disabled]="saving()">{{ 'settings.saveAi' | t }}</button>
        </div>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  theme = inject(ThemeService);
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  settings = { workingHoursStart: '09:00', workingHoursEnd: '18:00', dailyPlanTime: '07:30' };
  aiSettings = { autonomyLevel: 'FULL_AUTONOMY', personality: 'PROFESSIONAL', businessContext: '' };
  businessProfile = { description: '', businessContext: '' };
  saving = signal(false);
  saveMsg = signal('');
  userTelegram = signal<any>(null);
  telegramLoading = signal(false);
  telegramError = signal('');
  phone = '+992000406246';
  otpCode = '';
  password2fa = '';
  codeSent = signal(false);
  otpHint = signal('');

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: (id) => {
        this.loadUserTelegram();
        this.api.getCompany(id).subscribe({
          next: (company) => {
            if (company.settings) Object.assign(this.settings, company.settings);
            if (company.aiSettings) Object.assign(this.aiSettings, company.aiSettings);
            this.businessProfile.description = company.description ?? '';
            this.businessProfile.businessContext = company.aiSettings?.businessContext ?? '';
          },
        });
      },
    });
  }

  loadUserTelegram() {
    const id = this.companyContext.companyId();
    if (!id) return;
    this.telegramLoading.set(true);
    this.api.getTelegramUserStatus(id).subscribe({
      next: (s) => {
        this.userTelegram.set(s);
        this.telegramLoading.set(false);
      },
      error: (err) => {
        this.telegramLoading.set(false);
        this.telegramError.set(err.error?.message ?? this.i18n.t('settings.error'));
      },
    });
  }

  sendCode() {
    const id = this.companyContext.companyId();
    if (!id) return;
    this.telegramLoading.set(true);
    this.telegramError.set('');
    this.api.sendTelegramUserCode(id, this.phone.trim()).subscribe({
      next: (res) => {
        this.codeSent.set(true);
        this.otpHint.set(res.hint ?? this.i18n.t('settings.enterOtp'));
        this.otpCode = '';
        this.telegramLoading.set(false);
      },
      error: (err) => {
        this.telegramLoading.set(false);
        this.telegramError.set(err.error?.message ?? this.i18n.t('settings.otpFailed'));
      },
    });
  }

  confirmCode() {
    const id = this.companyContext.companyId();
    if (!id) return;
    this.telegramLoading.set(true);
    this.telegramError.set('');
    this.api.confirmTelegramUser(id, this.otpCode.trim(), this.password2fa || undefined).subscribe({
      next: () => {
        this.codeSent.set(false);
        this.otpCode = '';
        this.otpHint.set('');
        this.telegramLoading.set(false);
        this.loadUserTelegram();
      },
      error: (err) => {
        this.telegramLoading.set(false);
        this.telegramError.set(err.error?.message ?? this.i18n.t('settings.connectFailed'));
      },
    });
  }

  saveBusinessProfile() {
    const id = this.companyContext.companyId();
    if (!id) return;
    this.saving.set(true);
    this.api.updateBusinessProfile(id, {
      description: this.businessProfile.description,
      businessContext: this.businessProfile.businessContext,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveMsg.set(this.i18n.t('settings.profileSaved'));
      },
      error: () => this.saving.set(false),
    });
  }

  saveAiSettings() {
    const id = this.companyContext.companyId();
    if (!id) return;
    this.saving.set(true);
    this.api.updateAiSettings(id, this.aiSettings).subscribe({
      next: () => {
        this.saving.set(false);
        this.saveMsg.set(this.i18n.t('settings.aiSaved'));
      },
      error: () => this.saving.set(false),
    });
  }

  resetData() {
    if (!confirm(this.i18n.t('settings.confirmClear'))) return;
    const id = this.companyContext.companyId();
    if (!id) return;
    this.saving.set(true);
    this.api.resetCompanyData(id).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.saveMsg.set(r.message ?? this.i18n.t('settings.cleared'));
      },
      error: () => this.saving.set(false),
    });
  }
}
