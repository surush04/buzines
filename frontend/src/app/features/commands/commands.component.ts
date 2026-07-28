import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-commands',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, TranslatePipe],
  template: `
    <div class="animate-fade-in mx-auto max-w-4xl space-y-8">
      <div class="glass-card p-8 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 text-3xl shadow-xl">
          🎯
        </div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">{{ 'commands.title' | t }}</h2>
        <p class="mx-auto mt-2 max-w-lg text-sm text-slate-500">{{ 'commands.subtitle' | t }}</p>
      </div>

      <div class="glass-card p-6">
        @if (telegramWarning()) {
          <div class="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
            ⚠️ <strong>{{ 'commands.telegramNotConnected' | t }}</strong> {{ telegramWarning() }}
            <a routerLink="/settings" class="ml-1 font-semibold underline">{{ 'commands.settingsOtp' | t }}</a>
          </div>
        }

        <label class="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
          {{ 'commands.label' | t }}
        </label>
        <textarea
          [(ngModel)]="instruction"
          rows="3"
          class="input-field mb-4"
          [placeholder]="'commands.placeholder' | t"
        ></textarea>
        <label class="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" [(ngModel)]="autoSend" class="rounded" />
          {{ 'commands.autoSend' | t }}
        </label>
        <div class="flex flex-wrap gap-2">
          <button class="btn-primary" (click)="submitOrder()" [disabled]="loading() || !instruction.trim()">
            {{ loading() ? ('commands.aiWorking' | t) : ('commands.createTasks' | t) }}
          </button>
          <button class="btn-secondary" (click)="sendTasks()" [disabled]="dispatchLoading()">
            {{ dispatchLoading() ? '...' : ('commands.dispatch' | t) }}
          </button>
          <button class="btn-secondary" (click)="followUp()" [disabled]="followUpLoading()">
            {{ followUpLoading() ? '...' : ('commands.followUp' | t) }}
          </button>
        </div>

        @if (aiWarning()) {
          <p class="mt-3 text-sm text-amber-600">{{ aiWarning() }}</p>
        }
        @if (telegramResult()) {
          <p class="mt-3 text-sm" [class]="telegramResult()!.sent > 0 ? 'text-emerald-600' : 'text-amber-600'">
            {{ telegramResult()!.message }}
          </p>
        }
        @if (error()) {
          <p class="mt-3 text-sm text-red-500">{{ error() }}</p>
        }
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
        @for (step of steps(); track step.label) {
          <div class="glass-card p-4 text-center">
            <div class="text-2xl">{{ step.icon }}</div>
            <p class="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200">{{ step.label }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ step.desc }}</p>
          </div>
        }
      </div>

      <div>
        <h3 class="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{{ 'commands.yourCommands' | t }}</h3>
        <div class="space-y-4">
          @for (d of directives(); track d.id) {
            <div class="glass-card p-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="font-semibold text-slate-900 dark:text-white">"{{ d.instruction }}"</p>
                  @if (d.aiAnalysis) {
                    <p class="mt-1 text-xs text-slate-500">{{ d.aiAnalysis }}</p>
                  }
                  <p class="mt-2 text-xs text-slate-400">{{ d.createdAt | date:'medium':'':i18n.dateLocale() }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="rounded-full px-3 py-1 text-xs font-medium" [class]="statusClass(d.status)">
                    {{ statusLabel(d.status) }}
                  </span>
                  <button
                    type="button"
                    class="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                    (click)="deleteDirective(d.id)"
                    [disabled]="deletingDirectiveId() === d.id"
                    [title]="'commands.deleteDirective' | t"
                  >
                    🗑
                  </button>
                </div>
              </div>

              <div class="mt-4">
                <div class="mb-1 flex justify-between text-xs text-slate-500">
                  <span>{{ 'commands.tasksDone' | t:{ done: d.tasksDone, total: d.tasksTotal } }}</span>
                  <span>{{ d.progress }}%</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div class="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-400 transition-all" [style.width.%]="d.progress"></div>
                </div>
              </div>

              <div class="mt-3 flex flex-wrap justify-end gap-2">
                <button class="btn-secondary !text-xs" (click)="followUp()" [disabled]="followUpLoading()">
                  {{ 'commands.followUp' | t }}
                </button>
                <button class="btn-secondary !text-xs" (click)="sendTasks(d.id)" [disabled]="dispatchLoading()">
                  {{ 'commands.dispatch' | t }}
                </button>
              </div>

              @if (d.project?.tasks?.length) {
                <div class="mt-4 space-y-2 border-t border-slate-200/60 pt-4 dark:border-slate-700">
                  @for (task of d.project.tasks; track task.id) {
                    @if (task.assignments?.length) {
                      <div class="flex items-center justify-between gap-2 rounded-lg bg-slate-50/80 px-3 py-2 text-sm dark:bg-slate-800/50">
                        <div class="min-w-0 flex-1">
                          <span class="text-slate-700 dark:text-slate-300">{{ task.title }}</span>
                          @if (task.deadline) {
                            <p class="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                              ⏰ {{ task.deadline | date:'medium':'':i18n.dateLocale() }}
                            </p>
                          }
                        </div>
                        <div class="flex shrink-0 items-center gap-2">
                          <span class="text-xs text-slate-500">→ {{ task.assignments[0].employee.firstName }}</span>
                          <span class="rounded px-1.5 py-0.5 text-xs" [class]="taskStatusClass(task.status)">
                            {{ taskStatusLabel(task.status) }}
                          </span>
                          <button
                            type="button"
                            class="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                            (click)="deleteTask(task.id)"
                            [disabled]="deletingTaskId() === task.id"
                            [title]="'commands.deleteTask' | t"
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          } @empty {
            <div class="glass-card p-12 text-center text-slate-500">{{ 'commands.empty' | t }}</div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CommandsComponent implements OnInit {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  instruction = '';
  autoSend = true;

  loading = signal(false);
  dispatchLoading = signal(false);
  followUpLoading = signal(false);
  deletingTaskId = signal<string | null>(null);
  deletingDirectiveId = signal<string | null>(null);

  error = signal('');
  telegramWarning = signal('');
  telegramResult = signal<{ sent: number; failed: number; message: string } | null>(null);
  aiWarning = signal('');
  directives = signal<any[]>([]);

  steps = computed(() => {
    this.i18n.lang();
    return [
      { icon: '💬', label: this.i18n.t('commands.step1.label'), desc: this.i18n.t('commands.step1.desc') },
      { icon: '🧠', label: this.i18n.t('commands.step2.label'), desc: this.i18n.t('commands.step2.desc') },
      { icon: '📱', label: this.i18n.t('commands.step3.label'), desc: this.i18n.t('commands.step3.desc') },
      { icon: '🔄', label: this.i18n.t('commands.step4.label'), desc: this.i18n.t('commands.step4.desc') },
    ];
  });

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: (id) => {
        this.loadDirectives();
        this.loadTelegramStatus(id);
      },
    });
  }

  loadTelegramStatus(companyId: string) {
    this.api.getTelegramUserStatus(companyId).subscribe({
      next: (s) => {
        if (!s.configured) {
          this.telegramWarning.set(this.i18n.t('commands.telegramEnvWarning'));
        } else if (!s.connected) {
          this.telegramWarning.set(this.i18n.t('commands.telegramOtpWarning'));
        } else {
          this.telegramWarning.set('');
        }
      },
    });
  }

  submitOrder() {
    const companyId = this.companyContext.companyId();
    if (!companyId || !this.instruction.trim()) return;

    this.loading.set(true);
    this.error.set('');
    this.telegramResult.set(null);
    this.aiWarning.set('');
    this.api.createDirective(companyId, this.instruction.trim(), this.autoSend).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.instruction = '';
        if (res.aiWarning) this.aiWarning.set(res.aiWarning);
        if (res.telegramSummary) this.telegramResult.set(res.telegramSummary);
        this.loadDirectives();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('commands.submitError'));
      },
    });
  }

  sendTasks(directiveId?: string) {
    const companyId = this.companyContext.companyId();
    if (!companyId) return;

    this.dispatchLoading.set(true);
    this.error.set('');
    this.telegramResult.set(null);

    this.api.dispatchTasks(companyId, directiveId).subscribe({
      next: (res) => {
        this.dispatchLoading.set(false);
        const summary = res.telegramSummary ?? res;
        if (summary?.message) this.telegramResult.set(summary);
        this.loadDirectives();
      },
      error: (err) => {
        this.dispatchLoading.set(false);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('commands.dispatchError'));
      },
    });
  }

  followUp() {
    const companyId = this.companyContext.companyId();
    if (!companyId) return;

    this.followUpLoading.set(true);
    this.error.set('');

    this.api.followUpDirectives(companyId).subscribe({
      next: (res: { followedUp?: number }) => {
        this.followUpLoading.set(false);
        this.telegramResult.set({
          sent: res.followedUp ?? 0,
          failed: 0,
          message: this.i18n.t('commands.followUpResult', { count: res.followedUp ?? 0 }),
        });
      },
      error: (err) => {
        this.followUpLoading.set(false);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('commands.followUpError'));
      },
    });
  }

  deleteDirective(directiveId: string) {
    const companyId = this.companyContext.companyId();
    if (!companyId || !confirm(this.i18n.t('commands.confirmDeleteDirective'))) return;

    this.deletingDirectiveId.set(directiveId);
    this.api.deleteDirective(directiveId, companyId).subscribe({
      next: () => {
        this.deletingDirectiveId.set(null);
        this.loadDirectives();
      },
      error: (err) => {
        this.deletingDirectiveId.set(null);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('commands.deleteError'));
      },
    });
  }

  deleteTask(taskId: string) {
    const companyId = this.companyContext.companyId();
    if (!companyId || !confirm(this.i18n.t('commands.confirmDeleteTask'))) return;

    this.deletingTaskId.set(taskId);
    this.api.deleteTask(taskId, companyId).subscribe({
      next: () => {
        this.deletingTaskId.set(null);
        this.loadDirectives();
      },
      error: (err) => {
        this.deletingTaskId.set(null);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('commands.deleteError'));
      },
    });
  }

  loadDirectives() {
    const companyId = this.companyContext.companyId();
    if (!companyId) return;
    this.api.getDirectives(companyId).subscribe({
      next: (data) => this.directives.set(data),
    });
  }

  statusLabel(status: string) {
    this.i18n.lang();
    return this.i18n.t(`status.directive.${status}`) || status;
  }

  taskStatusLabel(status: string) {
    this.i18n.lang();
    return this.i18n.t(`status.task.${status}`) || status;
  }

  statusClass(status: string) {
    const map: Record<string, string> = {
      COMPLETED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      DISPATCHED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      IN_PROGRESS: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      ANALYZING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  taskStatusClass(status: string) {
    const map: Record<string, string> = {
      COMPLETED: 'bg-emerald-100 text-emerald-700',
      ASSIGNED: 'bg-blue-100 text-blue-700',
      IN_PROGRESS: 'bg-amber-100 text-amber-700',
      BLOCKED: 'bg-red-100 text-red-700',
      OVERDUE: 'bg-red-100 text-red-700',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }
}
