import { Injectable, inject, signal } from '@angular/core';
import { translations, type AppLang } from './translations';
import { LanguageSyncService } from '../services/language-sync.service';

const STORAGE_KEY = 'buzines_lang';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly languageSync = inject(LanguageSyncService);
  readonly lang = signal<AppLang>(this.loadLang());

  t(key: string, params?: Record<string, string | number>): string {
    const dict = translations[this.lang()] ?? translations.tg;
    let text = dict[key] ?? translations.tg[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{{${k}}}`, String(v));
      }
    }
    return text;
  }

  setLang(lang: AppLang) {
    localStorage.setItem(STORAGE_KEY, lang);
    this.lang.set(lang);
    document.documentElement.lang = lang === 'tg' ? 'tg-TJ' : lang === 'ru' ? 'ru-RU' : 'en';
    this.languageSync.sync(lang);
  }

  /** Push saved UI language to backend so AI uses the same language */
  syncLangToBackend() {
    this.languageSync.sync(this.lang());
  }

  dateLocale(): string {
    const map: Record<AppLang, string> = { tg: 'tg-TJ', ru: 'ru-RU', en: 'en-US' };
    return map[this.lang()];
  }

  langLabel(lang: AppLang): string {
    const labels: Record<AppLang, string> = { tg: 'ТОҶ', ru: 'РУС', en: 'ENG' };
    return labels[lang];
  }

  private loadLang(): AppLang {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLang | null;
    if (saved && (saved === 'tg' || saved === 'ru' || saved === 'en')) return saved;
    return 'tg';
  }
}
