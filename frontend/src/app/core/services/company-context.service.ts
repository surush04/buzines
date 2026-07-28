import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, switchMap, tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class CompanyContextService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  readonly companyId = signal<string | null>(null);
  readonly companyName = signal<string | null>(null);
  readonly onboardingDone = signal<boolean | null>(null);

  /** Returns company ID, creating a default company if the user has none. */
  ensureCompany(): Observable<string> {
    const existing = this.companyId();
    if (existing) {
      return new Observable((observer) => {
        observer.next(existing);
        observer.complete();
      });
    }

    return this.api.getCompanies().pipe(
      switchMap((companies) => {
        if (companies.length) {
          this.companyId.set(companies[0].id);
          this.companyName.set(companies[0].name);
          this.onboardingDone.set(companies[0].onboardingDone ?? false);
          return new Observable<string>((observer) => {
            observer.next(companies[0].id);
            observer.complete();
          });
        }

        const user = this.auth.user();
        const name = user ? `${user.firstName}'s Company` : 'My Company';
        return this.api.createCompany({ name }).pipe(
          tap((company) => {
            this.companyId.set(company.id);
            this.companyName.set(company.name);
            this.onboardingDone.set(company.onboardingDone ?? false);
          }),
          map((company) => company.id as string),
        );
      }),
    );
  }

  clear() {
    this.companyId.set(null);
    this.companyName.set(null);
    this.onboardingDone.set(null);
  }
}
