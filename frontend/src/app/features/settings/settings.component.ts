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

      <div class="glass-card p-6">
        <h3 class="mb-2 font-semibold text-slate-900 dark:text-white">{{ 'settings.employeeAppTitle' | t }}</h3>
        <p class="text-sm text-slate-500">{{ 'settings.employeeAppDesc' | t }}</p>
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
            <option value="OBSERVER">{{ 'settings.autonomyObserver' | t }}</option>
            <option value="ADVISOR">{{ 'settings.autonomyAdvisor' | t }}</option>
            <option value="GUIDED_AUTONOMY">{{ 'settings.autonomyGuided' | t }}</option>
            <option value="FULL_AUTONOMY">{{ 'settings.autonomyFull' | t }}</option>
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

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: (id) => {
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
