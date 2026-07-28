import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { CompanyContextService } from '../services/company-context.service';
import { ApiService } from '../services/api.service';

function clearStaleSession(router: Router) {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  router.navigate(['/auth/login']);
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.getToken()) return true;
  clearStaleSession(router);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const companyContext = inject(CompanyContextService);
  const api = inject(ApiService);

  if (!auth.isAuthenticated() || !auth.getToken()) return true;

  return companyContext.ensureCompany().pipe(
    switchMap((id) => api.getCompany(id)),
    tap((c) => {
      companyContext.onboardingDone.set(c.onboardingDone ?? false);
      companyContext.companyName.set(c.name);
    }),
    map((c) => {
      router.navigate([c.onboardingDone ? '/commands' : '/onboarding']);
      return false;
    }),
    catchError(() => {
      companyContext.clear();
      clearStaleSession(router);
      return of(false);
    }),
  );
};

export const onboardingGuard: CanActivateFn = () => {
  const companyContext = inject(CompanyContextService);
  const api = inject(ApiService);
  const router = inject(Router);
  const auth = inject(AuthService);

  if (companyContext.onboardingDone() === true) return true;
  if (!auth.getToken()) {
    clearStaleSession(router);
    return false;
  }

  return companyContext.ensureCompany().pipe(
    switchMap((id) => api.getCompany(id)),
    tap((c) => companyContext.onboardingDone.set(c.onboardingDone ?? false)),
    map((c) => {
      if (!c.onboardingDone) {
        router.navigate(['/onboarding']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      companyContext.clear();
      clearStaleSession(router);
      return of(false);
    }),
  );
};
