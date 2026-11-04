import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-commands',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslatePipe],
  template: `
    <div class="animate-fade-in grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div class="space-y-5">
        <div>
          <h2 class="text-2xl font-extrabold tracking-tight text-ink dark:text-white">{{ 'layout.greeting' | t }}{{ authName() ? ', ' + authName() : '' }}</h2>
          <p class="mt-1 max-w-2xl text-sm text-[#8a8175]">{{ 'layout.greetingLead' | t }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          @for (step of steps(); track step.label) {
            <div class="glass-card p-4">
              <div class="text-lg">{{ step.icon }}</div>
              <p class="mt-2 text-xs font-extrabold">{{ step.label }}</p>
              <p class="mt-1 text-[11px] text-[#8a8175]">{{ step.desc }}</p>
            </div>
          }
        </div>

        <div class="flex items-center justify-between">
          <h3 class="text-lg font-extrabold">{{ 'commands.yourCommands' | t }} <span class="text-[#8a8175]">({{ directives().length }})</span></h3>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          @for (d of directives(); track d.id) {
            <div class="glass-card p-5">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-extrabold text-ink dark:text-white">{{ d.instruction }}</p>
                  @if (d.aiAnalysis) {
                    <p class="mt-1 line-clamp-2 text-xs text-[#8a8175]">{{ d.aiAnalysis }}</p>
                  }
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
                <div class="h-1.5 overflow-hidden rounded-full bg-[#f0e7d8] dark:bg-white/10">
                  <div class="h-full rounded-full bg-gradient-to-r from-[#f3c85a] to-[#e0a41e]" [style.width.%]="d.progress"></div>
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
            <div class="glass-card p-12 text-center text-[#8a8175] md:col-span-2">{{ 'commands.empty' | t }}</div>
          }
        </div>
      </div>

      <aside class="glass-card flex h-fit flex-col p-4 xl:sticky xl:top-0">
        <div class="mb-3 flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-white">
            <svg viewBox="0 0 64 64" class="h-4 w-4"><path fill="currentColor" d="M32 6l4 22 22 4-22 4-4 22-4-22-22-4 22-4z"/></svg>
          </span>
          <div>
            <p class="text-sm font-extrabold">{{ 'brand.title' | t }}</p>
            <p class="text-[11px] font-semibold text-emerald-600">{{ 'os.online' | t }}</p>
          </div>
        </div>
        <label class="mb-2 text-xs font-bold text-[#8a8175]">{{ 'commands.label' | t }}</label>
        <textarea [(ngModel)]="instruction" rows="4" class="input-field mb-3" [placeholder]="'commands.placeholder' | t"></textarea>
        <label class="mb-3 flex items-center gap-2 text-xs text-[#6f675c]">
          <input type="checkbox" [(ngModel)]="autoSend" class="rounded accent-[#e0a41e]" />
          {{ 'commands.autoSend' | t }}
        </label>
        <div class="flex flex-col gap-2">
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
        @if (aiWarning()) { <p class="mt-3 text-xs text-amber-600">{{ aiWarning() }}</p> }
        @if (dispatchResult()) {
          <p class="mt-3 text-xs" [class]="dispatchResult()!.sent > 0 ? 'text-emerald-600' : 'text-amber-600'">{{ dispatchResult()!.message }}</p>
        }
        @if (error()) { <p class="mt-3 text-xs text-red-500">{{ error() }}</p> }
      </aside>
    </div>
  `,
})
export class CommandsComponent implements OnInit {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  private auth = inject(AuthService);
  readonly i18n = inject(TranslationService);

  authName() {
    return this.auth.user()?.firstName ?? '';
  }

  instruction = '';
  autoSend = true;

  loading = signal(false);
  dispatchLoading = signal(false);
  followUpLoading = signal(false);
  deletingTaskId = signal<string | null>(null);
  deletingDirectiveId = signal<string | null>(null);

  error = signal('');
  dispatchResult = signal<{ sent: number; failed: number; message: string } | null>(null);
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
      next: () => this.loadDirectives(),
    });
  }

  submitOrder() {
    const companyId = this.companyContext.companyId();
    if (!companyId || !this.instruction.trim()) return;

    this.loading.set(true);
    this.error.set('');
    this.dispatchResult.set(null);
    this.aiWarning.set('');
    this.api.createDirective(companyId, this.instruction.trim(), this.autoSend).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.instruction = '';
        if (res.aiWarning) this.aiWarning.set(res.aiWarning);
        const summary = res.dispatchSummary ?? res.telegramSummary;
        if (summary) this.dispatchResult.set(summary);
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
    this.dispatchResult.set(null);

    this.api.dispatchTasks(companyId, directiveId).subscribe({
      next: (res) => {
        this.dispatchLoading.set(false);
        const summary = res.dispatchSummary ?? res.telegramSummary ?? res;
        if (summary?.message) this.dispatchResult.set(summary);
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
        this.dispatchResult.set({
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
