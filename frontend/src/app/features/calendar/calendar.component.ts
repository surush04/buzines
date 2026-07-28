import { Component, computed, inject } from '@angular/core';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ 'calendar.title' | t }}</h2>
        <p class="text-sm text-slate-500">{{ 'calendar.subtitle' | t }}</p>
      </div>

      <div class="glass-card p-6">
        <div class="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500">
          @for (day of weekDays(); track day) {
            <div class="py-2">{{ day }}</div>
          }
        </div>
        <div class="mt-2 grid grid-cols-7 gap-2">
          @for (day of calendarDays(); track day.date) {
            <div
              class="min-h-[80px] rounded-xl border border-slate-200/60 p-2 dark:border-slate-700"
              [class]="day.isToday ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : ''"
            >
              <span class="text-sm font-medium" [class]="day.isToday ? 'text-primary-600' : 'text-slate-700 dark:text-slate-300'">{{ day.day }}</span>
              @for (event of day.events; track event) {
                <div class="mt-1 truncate rounded bg-primary-100 px-1 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  {{ event }}
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CalendarComponent {
  readonly i18n = inject(TranslationService);

  weekDays = computed(() => {
    this.i18n.lang();
    return [
      this.i18n.t('calendar.day.mon'),
      this.i18n.t('calendar.day.tue'),
      this.i18n.t('calendar.day.wed'),
      this.i18n.t('calendar.day.thu'),
      this.i18n.t('calendar.day.fri'),
      this.i18n.t('calendar.day.sat'),
      this.i18n.t('calendar.day.sun'),
    ];
  });

  calendarDays = computed(() => {
    this.i18n.lang();
    return Array.from({ length: 35 }, (_, i) => {
      const d = i + 1;
      return {
        date: d,
        day: d <= 31 ? d : '',
        isToday: d === 27,
        events:
          d === 15
            ? [this.i18n.t('calendar.event.team')]
            : d === 27
              ? [this.i18n.t('calendar.event.sprint')]
              : d === 30
                ? [this.i18n.t('calendar.event.deadline')]
                : [],
      };
    });
  });
}
