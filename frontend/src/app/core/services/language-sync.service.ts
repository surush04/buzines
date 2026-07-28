import { inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { CompanyContextService } from './company-context.service';
import { AuthService } from './auth.service';
import type { AppLang } from '../i18n/translations';

@Injectable({ providedIn: 'root' })
export class LanguageSyncService {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  private auth = inject(AuthService);

  sync(lang: AppLang) {
    if (!this.auth.isAuthenticated()) return;

    const push = (companyId: string) => {
      this.api.updateCompanySettings(companyId, { language: lang }).subscribe({
        error: () => {},
      });
    };

    const id = this.companyContext.companyId();
    if (id) {
      push(id);
      return;
    }

    this.companyContext.ensureCompany().subscribe({
      next: (companyId) => push(companyId),
      error: () => {},
    });
  }
}
