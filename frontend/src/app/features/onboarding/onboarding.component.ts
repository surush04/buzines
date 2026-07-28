import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 p-4">
      <div class="absolute right-4 top-4 z-10">
        <app-language-switcher />
      </div>

      <div class="animate-fade-in w-full max-w-2xl">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 text-3xl">🧠</div>
          <h1 class="text-2xl font-bold text-white">{{ 'onboarding.title' | t }}</h1>
          <p class="mt-2 text-sm text-slate-400">{{ 'onboarding.subtitle' | t }}</p>
          <p class="mt-1 text-xs text-amber-400/90">{{ 'onboarding.requiredHint' | t }}</p>
        </div>

        <div class="mb-4 flex gap-2">
          @for (n of [1,2,3,4]; track n) {
            <div class="h-1.5 flex-1 rounded-full transition-colors"
              [class]="step() >= n ? 'bg-primary-500' : 'bg-white/10'"></div>
          }
        </div>
        <p class="mb-4 text-center text-xs text-slate-500">{{ stepTitle() }}</p>

        <div class="glass-card !bg-white/10 !border-white/10 space-y-5 p-8">
          @if (step() === 1) {
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.companyName' | t }}</label>
              <input [(ngModel)]="form.companyName" class="input-field" [placeholder]="'onboarding.companyPlaceholder' | t" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.industry' | t }}</label>
              <select [(ngModel)]="form.industry" class="input-field">
                @for (option of industries(); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.teamSize' | t }}</label>
              <select [(ngModel)]="form.teamSize" class="input-field">
                @for (option of teamSizes(); track option.value) {
                  <option [ngValue]="option.value">{{ option.label }}</option>
                }
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.description' | t }}</label>
              <textarea [(ngModel)]="form.description" rows="3" class="input-field"
                [placeholder]="'onboarding.descriptionPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 2) {
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.products' | t }}</label>
              <textarea [(ngModel)]="form.products" rows="3" class="input-field"
                [placeholder]="'onboarding.productsPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.customers' | t }}</label>
              <textarea [(ngModel)]="form.customers" rows="3" class="input-field"
                [placeholder]="'onboarding.customersPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 3) {
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.currentState' | t }}</label>
              <textarea [(ngModel)]="form.currentState" rows="3" class="input-field"
                [placeholder]="'onboarding.currentStatePlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.goals' | t }}</label>
              <textarea [(ngModel)]="form.goals" rows="3" class="input-field"
                [placeholder]="'onboarding.goalsPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.challenges' | t }}</label>
              <textarea [(ngModel)]="form.challenges" rows="3" class="input-field"
                [placeholder]="'onboarding.challengesPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.extraNotes' | t }}</label>
              <textarea [(ngModel)]="form.businessContext" rows="2" class="input-field"
                [placeholder]="'onboarding.extraNotesPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 4) {
            <div class="rounded-xl bg-white/5 p-4 text-sm text-slate-300">
              <p class="font-semibold text-white">{{ 'onboarding.reviewTitle' | t }}</p>
              <p class="mt-2">{{ form.companyName }} · {{ form.industry }}</p>
              <p class="mt-1 text-xs text-slate-400">{{ 'onboarding.reviewHint' | t }}</p>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.aiMode' | t }}</label>
              <select [(ngModel)]="form.autonomyLevel" class="input-field">
                <option value="FULL_AUTONOMY">{{ 'onboarding.autonomyFull' | t }}</option>
                <option value="ADVISOR">{{ 'onboarding.autonomyAdvisor' | t }}</option>
              </select>
            </div>
          }

          @if (error()) {
            <p class="text-sm text-red-400">{{ error() }}</p>
          }

          <div class="flex gap-2">
            @if (step() > 1) {
              <button type="button" class="btn-secondary flex-1" (click)="prevStep()">{{ 'onboarding.back' | t }}</button>
            }
            @if (step() < 4) {
              <button type="button" class="btn-primary flex-1" (click)="nextStep()" [disabled]="!isStepValid()">
                {{ 'onboarding.next' | t }}
              </button>
            } @else {
              <button type="button" class="btn-primary flex-1" (click)="submit()" [disabled]="loading() || !isValid()">
                {{ loading() ? ('onboarding.preparing' | t) : ('onboarding.start' | t) }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class OnboardingComponent {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  private router = inject(Router);
  readonly i18n = inject(TranslationService);

  loading = signal(false);
  error = signal('');
  step = signal(1);

  form = {
    companyName: '',
    industry: '',
    businessType: 'general',
    teamSize: 0 as number,
    description: '',
    products: '',
    customers: '',
    currentState: '',
    goals: '',
    challenges: '',
    businessContext: '',
    autonomyLevel: 'FULL_AUTONOMY',
  };

  stepTitle = computed(() => {
    this.i18n.lang();
    const titles = [
      this.i18n.t('onboarding.step1Title'),
      this.i18n.t('onboarding.step2Title'),
      this.i18n.t('onboarding.step3Title'),
      this.i18n.t('onboarding.step4Title'),
    ];
    return titles[this.step() - 1] ?? '';
  });

  industries = computed(() => {
    this.i18n.lang();
    return [
      { value: '', label: this.i18n.t('onboarding.industry.select') },
      { value: 'Фуруш / Retail', label: this.i18n.t('onboarding.industry.retail') },
      { value: 'Хизматрасонӣ', label: this.i18n.t('onboarding.industry.services') },
      { value: 'IT / Tech', label: this.i18n.t('onboarding.industry.it') },
      { value: 'Таълим', label: this.i18n.t('onboarding.industry.education') },
      { value: 'Дигар', label: this.i18n.t('onboarding.industry.other') },
    ];
  });

  teamSizes = computed(() => {
    this.i18n.lang();
    return [
      { value: 0, label: this.i18n.t('onboarding.teamSize.select') },
      { value: 1, label: this.i18n.t('onboarding.teamSize.solo') },
      { value: 5, label: this.i18n.t('onboarding.teamSize.small') },
      { value: 15, label: this.i18n.t('onboarding.teamSize.medium') },
      { value: 50, label: this.i18n.t('onboarding.teamSize.large') },
    ];
  });

  constructor() {
    this.companyContext.ensureCompany().subscribe({
      next: (id) => {
        this.api.getCompany(id).subscribe({
          next: (c) => {
            if (c.onboardingDone) {
              this.router.navigate(['/commands']);
              return;
            }
            if (c.name && !c.name.includes("'s Company")) {
              this.form.companyName = c.name;
            }
            if (c.description) this.form.description = c.description;
            if (c.teamSize) this.form.teamSize = c.teamSize;
          },
        });
      },
    });
  }

  isStepValid(): boolean {
    const min = 10;
    switch (this.step()) {
      case 1:
        return (
          this.form.companyName.trim().length >= 2 &&
          !!this.form.industry &&
          this.form.teamSize > 0 &&
          this.form.description.trim().length >= min
        );
      case 2:
        return this.form.products.trim().length >= min && this.form.customers.trim().length >= min;
      case 3:
        return (
          this.form.currentState.trim().length >= min &&
          this.form.goals.trim().length >= min &&
          this.form.challenges.trim().length >= min
        );
      case 4:
        return this.isValid();
      default:
        return false;
    }
  }

  isValid() {
    const min = 10;
    return (
      this.form.companyName.trim().length >= 2 &&
      !!this.form.industry &&
      this.form.teamSize > 0 &&
      this.form.description.trim().length >= min &&
      this.form.products.trim().length >= min &&
      this.form.customers.trim().length >= min &&
      this.form.currentState.trim().length >= min &&
      this.form.goals.trim().length >= min &&
      this.form.challenges.trim().length >= min
    );
  }

  nextStep() {
    if (!this.isStepValid()) return;
    this.step.update((s) => Math.min(4, s + 1));
  }

  prevStep() {
    this.step.update((s) => Math.max(1, s - 1));
  }

  submit() {
    const id = this.companyContext.companyId();
    if (!id || !this.isStepValid()) return;

    this.loading.set(true);
    this.error.set('');

    this.api.completeOnboarding(id, { ...this.form, language: this.i18n.lang() }).subscribe({
      next: (company) => {
        this.companyContext.companyName.set(company.name);
        this.companyContext.onboardingDone.set(true);
        this.loading.set(false);
        this.router.navigate(['/employees']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message ?? this.i18n.t('onboarding.error'));
      },
    });
  }
}
