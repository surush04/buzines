import { Component, inject } from '@angular/core';
import { TranslationService } from '../../../core/i18n/translation.service';
import { APP_LANGS, type AppLang } from '../../../core/i18n/translations';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  template: `
    <div class="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white/80 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
      @for (lang of langs; track lang) {
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs font-semibold transition-colors"
          [class]="i18n.lang() === lang
            ? 'bg-primary-500 text-white shadow-sm'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'"
          (click)="i18n.setLang(lang)"
        >
          {{ i18n.langLabel(lang) }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcherComponent {
  readonly i18n = inject(TranslationService);
  readonly langs = APP_LANGS;
}
