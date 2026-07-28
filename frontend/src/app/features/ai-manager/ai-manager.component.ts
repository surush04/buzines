import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-ai-manager',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <div class="glass-card p-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-violet-600 shadow-2xl shadow-primary-500/30">
          <span class="text-3xl">🧠</span>
        </div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ 'aiManager.title' | t }}</h2>
        <p class="mx-auto mt-2 max-w-lg text-sm text-slate-500">{{ 'aiManager.subtitle' | t }}</p>
      </div>

      @if (businessAnalysis()) {
        <div class="glass-card space-y-4 p-6">
          <h3 class="font-semibold">{{ 'aiManager.businessAnalysis' | t }}</h3>
          @if (businessAnalysis()!.summary) {
            <p class="text-sm text-slate-700 dark:text-slate-300">{{ businessAnalysis()!.summary }}</p>
          }
          @if (businessAnalysis()!.fullAnalysis) {
            <p class="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-400">{{ businessAnalysis()!.fullAnalysis }}</p>
          }
          <div class="grid gap-4 md:grid-cols-2">
            @if (businessAnalysis()!.strengths?.length) {
              <div>
                <h4 class="mb-2 text-xs font-semibold uppercase text-emerald-600">{{ 'aiManager.strengths' | t }}</h4>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
                  @for (item of businessAnalysis()!.strengths; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              </div>
            }
            @if (businessAnalysis()!.weaknesses?.length) {
              <div>
                <h4 class="mb-2 text-xs font-semibold uppercase text-amber-600">{{ 'aiManager.weaknesses' | t }}</h4>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
                  @for (item of businessAnalysis()!.weaknesses; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              </div>
            }
            @if (businessAnalysis()!.risks?.length) {
              <div>
                <h4 class="mb-2 text-xs font-semibold uppercase text-red-600">{{ 'aiManager.risks' | t }}</h4>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
                  @for (item of businessAnalysis()!.risks; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              </div>
            }
            @if (businessAnalysis()!.opportunities?.length) {
              <div>
                <h4 class="mb-2 text-xs font-semibold uppercase text-primary-600">{{ 'aiManager.opportunities' | t }}</h4>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
                  @for (item of businessAnalysis()!.opportunities; track item) {
                    <li>{{ item }}</li>
                  }
                </ul>
              </div>
            }
          </div>
          @if (businessAnalysis()!.recommendedActions?.length) {
            <div>
              <h4 class="mb-2 text-xs font-semibold uppercase text-slate-500">{{ 'aiManager.recommendedActions' | t }}</h4>
              <ul class="list-inside list-decimal text-sm text-slate-700 dark:text-slate-300">
                @for (item of businessAnalysis()!.recommendedActions; track item) {
                  <li>{{ item }}</li>
                }
              </ul>
            </div>
          }
        </div>
      }

      @if (opsSnapshot()) {
        <div class="glass-card p-6">
          <h3 class="mb-3 font-semibold">{{ 'aiManager.snapshot' | t }}</h3>
          <pre class="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">{{ opsSnapshot() }}</pre>
        </div>
      }

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        @for (action of actions(); track action.label) {
          <button class="glass-card p-6 text-left transition-transform hover:scale-[1.02]" (click)="action.fn()" [disabled]="loading()">
            <span class="text-2xl">{{ action.icon }}</span>
            <h3 class="mt-3 font-semibold text-slate-900 dark:text-white">{{ action.label }}</h3>
            <p class="mt-1 text-xs text-slate-500">{{ action.description }}</p>
          </button>
        }
      </div>

      <div class="glass-card p-6">
        <h3 class="mb-4 font-semibold">{{ 'aiManager.activityLog' | t }}</h3>
        <div class="space-y-3">
          @for (log of activityLog(); track log.time) {
            <div class="flex items-start gap-3 rounded-xl bg-slate-50/50 p-4 dark:bg-slate-800/50">
              <span class="mt-0.5 text-sm">{{ log.icon }}</span>
              <div>
                <p class="text-sm text-slate-800 dark:text-slate-200">{{ log.message }}</p>
                <p class="text-xs text-slate-500">{{ log.time }}</p>
              </div>
            </div>
          } @empty {
            <p class="text-sm text-slate-500">{{ 'aiManager.noActivity' | t }}</p>
          }
        </div>
      </div>

      <div class="glass-card p-6">
        <h3 class="mb-4 font-semibold">{{ 'aiManager.howItWorks' | t }}</h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          @for (step of workflow(); track step.title) {
            <div class="rounded-xl border border-slate-200/60 p-4 dark:border-slate-700">
              <span class="text-lg font-bold text-primary-600">{{ step.step }}</span>
              <h4 class="mt-2 font-semibold text-slate-800 dark:text-slate-200">{{ step.title }}</h4>
              <p class="mt-1 text-xs text-slate-500">{{ step.description }}</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class AiManagerComponent implements OnInit {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  loading = signal(false);
  activityLog = signal<{ icon: string; message: string; time: string }[]>([]);
  opsSnapshot = signal('');
  businessAnalysis = signal<any | null>(null);
  companyId = this.companyContext.companyId;

  workflow = computed(() => {
    this.i18n.lang();
    return [
      { step: '01', title: this.i18n.t('aiManager.workflow.breakdown'), description: this.i18n.t('aiManager.workflow.breakdownDesc') },
      { step: '02', title: this.i18n.t('aiManager.workflow.assign'), description: this.i18n.t('aiManager.workflow.assignDesc') },
      { step: '03', title: this.i18n.t('aiManager.workflow.daily'), description: this.i18n.t('aiManager.workflow.dailyDesc') },
      { step: '04', title: this.i18n.t('aiManager.workflow.followUp'), description: this.i18n.t('aiManager.workflow.followUpDesc') },
    ];
  });

  actions = computed(() => {
    this.i18n.lang();
    return [
      {
        icon: '📊',
        label: this.i18n.t('aiManager.businessAnalysis'),
        description: this.i18n.t('aiManager.businessAnalysisDesc'),
        fn: () => this.runAction('business-analysis'),
      },
      {
        icon: '🧠',
        label: this.i18n.t('aiManager.analyze'),
        description: this.i18n.t('aiManager.subtitle'),
        fn: () => this.runAction('auto-analyze'),
      },
      {
        icon: '📋',
        label: this.i18n.t('aiManager.dailyPlan'),
        description: this.i18n.t('aiManager.dailyPlanDesc'),
        fn: () => this.runAction('daily-plans'),
      },
      {
        icon: '💡',
        label: this.i18n.t('aiManager.recommendations'),
        description: this.i18n.t('aiManager.recommendationsDesc'),
        fn: () => this.runAction('recommendations'),
      },
    ];
  });

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: (id) => {
        this.loadActivity(id);
        this.loadStatus(id);
        this.loadBusinessAnalysis(id);
      },
    });
  }

  loadStatus(companyId: string) {
    this.api.getAiStatus(companyId).subscribe({
      next: (r) => this.opsSnapshot.set(r.snapshot),
    });
  }

  loadBusinessAnalysis(companyId: string) {
    this.api.getBusinessAnalysis(companyId).subscribe({
      next: (r) => {
        if (r.analyzed) this.businessAnalysis.set(r);
      },
      error: () => {},
    });
  }

  loadActivity(companyId: string) {
    this.api.getAiActivity(companyId).subscribe({
      next: (logs) => this.activityLog.set(logs),
    });
  }

  runAction(type: string) {
    const id = this.companyId();
    if (!id) return;
    this.loading.set(true);
    const now = new Date().toLocaleTimeString();

    if (type === 'business-analysis') {
      this.api.getBusinessAnalysis(id).subscribe({
        next: (r) => {
          if (r.analyzed) {
            this.businessAnalysis.set(r);
            this.addLog('📊', r.summary ?? this.i18n.t('aiManager.log.businessAnalysisDone'), now);
          } else {
            this.addLog('📊', r.reason ?? this.i18n.t('aiManager.log.analysisDone'), now);
          }
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else if (type === 'daily-plans') {
      this.api.generateDailyPlans(id).subscribe({
        next: () => {
          this.addLog('📋', this.i18n.t('aiManager.log.dailyPlan'), now);
          this.loading.set(false);
          const cid = this.companyId();
          if (cid) this.loadActivity(cid);
        },
        error: () => this.loading.set(false),
      });
    } else if (type === 'auto-analyze') {
      this.api.autoAnalyze(id).subscribe({
        next: (r) => {
          const msg = r.directive
            ? `${this.i18n.t('aiManager.log.analyze')} ${r.summary ?? ''}`
            : r.followUp
              ? `${this.i18n.t('aiManager.log.followUp')} ${r.summary ?? ''}`
              : r.summary ?? r.reason ?? this.i18n.t('aiManager.log.analysisDone');
          this.addLog('🧠', msg, now);
          this.loading.set(false);
          this.loadActivity(id);
          this.loadStatus(id);
        },
        error: () => this.loading.set(false),
      });
    } else if (type === 'recommendations') {
      this.api.getRecommendations(id).subscribe({
        next: (recs) => {
          this.addLog('💡', this.i18n.t('aiManager.log.recommendations', { count: recs.length }), now);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loading.set(false);
    }
  }

  private addLog(icon: string, message: string, time: string) {
    this.activityLog.update((logs) => [{ icon, message, time }, ...logs]);
  }
}
