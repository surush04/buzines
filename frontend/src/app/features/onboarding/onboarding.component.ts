import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

const TOTAL_STEPS = 6;
const MIN_TEXT = 3;

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
          @for (n of stepNumbers; track n) {
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
            <div class="grid gap-3 sm:grid-cols-2">
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
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.location' | t }}</label>
                <input [(ngModel)]="form.location" class="input-field" [placeholder]="'onboarding.locationPlaceholder' | t" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.businessModel' | t }}</label>
                <select [(ngModel)]="form.businessModel" class="input-field">
                  @for (option of businessModels(); track option.value) {
                    <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
              </div>
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
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.salesChannels' | t }}</label>
              <textarea [(ngModel)]="form.salesChannels" rows="2" class="input-field"
                [placeholder]="'onboarding.salesChannelsPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.competitors' | t }}</label>
              <textarea [(ngModel)]="form.competitors" rows="2" class="input-field"
                [placeholder]="'onboarding.competitorsPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 3) {
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.currentState' | t }}</label>
              <textarea [(ngModel)]="form.currentState" rows="3" class="input-field"
                [placeholder]="'onboarding.currentStatePlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.teamStructure' | t }}</label>
              <textarea [(ngModel)]="form.teamStructure" rows="2" class="input-field"
                [placeholder]="'onboarding.teamStructurePlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.workProcesses' | t }}</label>
              <textarea [(ngModel)]="form.workProcesses" rows="3" class="input-field"
                [placeholder]="'onboarding.workProcessesPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.toolsAndSystems' | t }}</label>
              <textarea [(ngModel)]="form.toolsAndSystems" rows="2" class="input-field"
                [placeholder]="'onboarding.toolsAndSystemsPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 4) {
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
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.kpis' | t }}</label>
              <textarea [(ngModel)]="form.kpis" rows="2" class="input-field"
                [placeholder]="'onboarding.kpisPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.seasonality' | t }}</label>
              <textarea [(ngModel)]="form.seasonality" rows="2" class="input-field"
                [placeholder]="'onboarding.seasonalityPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 5) {
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.customerCommunication' | t }}</label>
              <textarea [(ngModel)]="form.customerCommunication" rows="2" class="input-field"
                [placeholder]="'onboarding.customerCommunicationPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.employeeExpectations' | t }}</label>
              <textarea [(ngModel)]="form.employeeExpectations" rows="2" class="input-field"
                [placeholder]="'onboarding.employeeExpectationsPlaceholder' | t"></textarea>
            </div>
            <div>
              <label class="mb-1 block text-xs text-slate-300">{{ 'onboarding.extraNotes' | t }}</label>
              <textarea [(ngModel)]="form.businessContext" rows="2" class="input-field"
                [placeholder]="'onboarding.extraNotesPlaceholder' | t"></textarea>
            </div>
          }

          @if (step() === 6) {
            <div class="rounded-xl bg-white/5 p-4 text-sm text-slate-300">
              <p class="font-semibold text-white">{{ 'onboarding.reviewTitle' | t }}</p>
              <p class="mt-2">{{ form.companyName }} · {{ form.industry }} · {{ form.location }}</p>
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

          @if (validationErrors().length) {
            <div class="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
              <p class="text-sm font-medium text-red-300">{{ 'onboarding.validation.title' | t }}</p>
              <ul class="mt-2 list-inside list-disc space-y-1 text-sm text-red-400">
                @for (err of validationErrors(); track err) {
                  <li>{{ err }}</li>
                }
              </ul>
            </div>
          }

          @if (error()) {
            <p class="text-sm text-red-400">{{ error() }}</p>
          }

          <div class="flex gap-2">
            @if (step() > 1) {
              <button type="button" class="btn-secondary flex-1" (click)="prevStep()">{{ 'onboarding.back' | t }}</button>
            }
            @if (step() < TOTAL_STEPS) {
              <button type="button" class="btn-primary flex-1" (click)="nextStep()">
                {{ 'onboarding.next' | t }}
              </button>
            } @else {
              <button type="button" class="btn-primary flex-1" (click)="submit()" [disabled]="loading()">
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
  readonly TOTAL_STEPS = TOTAL_STEPS;
  readonly stepNumbers = [1, 2, 3, 4, 5, 6];

  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  private router = inject(Router);
  readonly i18n = inject(TranslationService);

  loading = signal(false);
  error = signal('');
  validationErrors = signal<string[]>([]);
  step = signal(1);

  form = {
    companyName: '',
    industry: '',
    businessModel: '',
    teamSize: 0 as number,
    location: '',
    description: '',
    products: '',
    customers: '',
    salesChannels: '',
    competitors: '',
    currentState: '',
    teamStructure: '',
    workProcesses: '',
    toolsAndSystems: '',
    goals: '',
    challenges: '',
    kpis: '',
    seasonality: '',
    customerCommunication: '',
    employeeExpectations: '',
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
      this.i18n.t('onboarding.step5Title'),
      this.i18n.t('onboarding.step6Title'),
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

  businessModels = computed(() => {
    this.i18n.lang();
    return [
      { value: '', label: this.i18n.t('onboarding.businessModel.select') },
      { value: 'B2C offline', label: this.i18n.t('onboarding.businessModel.b2cOffline') },
      { value: 'B2C online', label: this.i18n.t('onboarding.businessModel.b2cOnline') },
      { value: 'B2B', label: this.i18n.t('onboarding.businessModel.b2b') },
      { value: 'Mixed', label: this.i18n.t('onboarding.businessModel.mixed') },
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
            if (c.businessType) this.form.businessModel = c.businessType;
          },
        });
      },
    });
  }

  private fieldLabel(key: string): string {
    return this.i18n.t(key);
  }

  private textFieldError(labelKey: string, value: string, min = MIN_TEXT): string | null {
    const field = this.fieldLabel(labelKey);
    const trimmed = value.trim();
    if (!trimmed) return this.i18n.t('onboarding.validation.fieldRequired', { field });
    if (trimmed.length < min) return this.i18n.t('onboarding.validation.fieldTooShort', { field, min });
    return null;
  }

  private collectStepErrors(s: number): string[] {
    const errors: string[] = [];

    switch (s) {
      case 1: {
        const name = this.form.companyName.trim();
        if (!name) errors.push(this.i18n.t('onboarding.validation.companyNameRequired'));
        else if (name.length < 2) errors.push(this.i18n.t('onboarding.validation.companyNameTooShort', { min: 2 }));
        if (!this.form.industry) errors.push(this.i18n.t('onboarding.validation.industryRequired'));
        if (this.form.teamSize <= 0) errors.push(this.i18n.t('onboarding.validation.teamSizeRequired'));
        const loc = this.form.location.trim();
        if (!loc) errors.push(this.i18n.t('onboarding.validation.locationRequired'));
        else if (loc.length < 3) errors.push(this.i18n.t('onboarding.validation.locationTooShort', { min: 3 }));
        if (!this.form.businessModel) errors.push(this.i18n.t('onboarding.validation.businessModelRequired'));
        const descErr = this.textFieldError('onboarding.description', this.form.description);
        if (descErr) errors.push(descErr);
        break;
      }
      case 2: {
        for (const [key, field] of [
          ['onboarding.products', 'products'],
          ['onboarding.customers', 'customers'],
          ['onboarding.salesChannels', 'salesChannels'],
          ['onboarding.competitors', 'competitors'],
        ] as const) {
          const err = this.textFieldError(key, this.form[field]);
          if (err) errors.push(err);
        }
        break;
      }
      case 3: {
        for (const [key, field] of [
          ['onboarding.currentState', 'currentState'],
          ['onboarding.teamStructure', 'teamStructure'],
          ['onboarding.workProcesses', 'workProcesses'],
        ] as const) {
          const err = this.textFieldError(key, this.form[field]);
          if (err) errors.push(err);
        }
        break;
      }
      case 4: {
        for (const [key, field] of [
          ['onboarding.goals', 'goals'],
          ['onboarding.challenges', 'challenges'],
          ['onboarding.kpis', 'kpis'],
        ] as const) {
          const err = this.textFieldError(key, this.form[field]);
          if (err) errors.push(err);
        }
        break;
      }
      case 5: {
        for (const [key, field] of [
          ['onboarding.customerCommunication', 'customerCommunication'],
          ['onboarding.employeeExpectations', 'employeeExpectations'],
        ] as const) {
          const err = this.textFieldError(key, this.form[field]);
          if (err) errors.push(err);
        }
        break;
      }
    }

    return errors;
  }

  nextStep() {
    const errors = this.collectStepErrors(this.step());
    if (errors.length) {
      this.validationErrors.set(errors);
      return;
    }
    this.validationErrors.set([]);
    this.step.update((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  prevStep() {
    this.validationErrors.set([]);
    this.step.update((s) => Math.max(1, s - 1));
  }

  submit() {
    const id = this.companyContext.companyId();
    if (!id) return;

    const allErrors: string[] = [];
    for (let s = 1; s <= 5; s++) {
      const stepErrors = this.collectStepErrors(s);
      if (stepErrors.length) {
        allErrors.push(this.i18n.t('onboarding.validation.stepIncomplete', { step: s }));
        allErrors.push(...stepErrors);
      }
    }

    if (allErrors.length) {
      this.validationErrors.set(allErrors);
      const firstBad = [1, 2, 3, 4, 5].find((s) => this.collectStepErrors(s).length > 0);
      if (firstBad) this.step.set(firstBad);
      return;
    }

    this.validationErrors.set([]);
    this.error.set('');
    this.loading.set(true);

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
