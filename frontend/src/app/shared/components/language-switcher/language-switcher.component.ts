import { Component, inject, input } from '@angular/core';
import { TranslationService } from '../../../core/i18n/translation.service';
import { APP_LANGS } from '../../../core/i18n/translations';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  template: `
    <div
      class="flex items-center gap-1 rounded-full p-1"
      [class]="tone() === 'gold'
        ? 'border border-white/15 bg-black/25 backdrop-blur'
        : 'border border-[#eadfce] bg-white dark:border-white/10 dark:bg-[#221e19]'"
    >
      @for (lang of langs; track lang) {
        <button
          type="button"
          class="rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide transition-colors"
          [class]="i18n.lang() === lang
            ? (tone() === 'gold' ? 'bg-[#f0c14b] text-[#2a220c]' : 'bg-ink text-white dark:bg-white dark:text-ink')
            : (tone() === 'gold' ? 'text-white/80 hover:text-white' : 'text-[#8a8175] hover:text-ink dark:text-slate-400')"
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
  tone = input<'light' | 'gold'>('light');
}
