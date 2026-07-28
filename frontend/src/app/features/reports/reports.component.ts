import { Component, computed, inject } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ 'reports.title' | t }}</h2>
        <p class="text-sm text-slate-500">{{ 'reports.subtitle' | t }}</p>
      </div>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-5">
        @for (period of periods(); track period.key) {
          <button class="glass-card p-4 text-center transition-transform hover:scale-[1.02]">
            <span class="text-2xl">{{ period.icon }}</span>
            <p class="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{{ period.label }}</p>
          </button>
        }
      </div>

      <div class="glass-card p-6">
        <h3 class="mb-4 font-semibold">{{ 'reports.sample' | t }}</h3>
        <div class="space-y-4 text-sm text-slate-600 dark:text-slate-400">
          <p>{{ 'reports.body1' | t }}</p>
          <p class="text-xs text-slate-500">{{ 'reports.body2' | t }}</p>
        </div>
      </div>
    </div>
  `,
})
export class ReportsComponent {
  readonly i18n = inject(TranslationService);

  periods = computed(() => {
    this.i18n.lang();
    return [
      { key: 'daily', label: this.i18n.t('reports.period.daily'), icon: '📅' },
      { key: 'weekly', label: this.i18n.t('reports.period.weekly'), icon: '📊' },
      { key: 'monthly', label: this.i18n.t('reports.period.monthly'), icon: '📈' },
      { key: 'quarter', label: this.i18n.t('reports.period.quarter'), icon: '🗓️' },
      { key: 'yearly', label: this.i18n.t('reports.period.yearly'), icon: '🏆' },
    ];
  });
}
