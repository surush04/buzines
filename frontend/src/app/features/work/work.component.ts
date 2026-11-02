import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';

type WorkTask = {
  assignmentId: string;
  assignmentStatus: string;
  assignedAt: string;
  completedAt: string | null;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    deadline: string | null;
    projectName: string;
  };
  lastResponses: Array<{ message: string | null; createdAt: string; progressPct: number | null }>;
};

@Component({
  selector: 'app-work',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslatePipe, LanguageSwitcherComponent],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p class="text-xs text-slate-500">{{ me()?.employee?.companyName }}</p>
            <h1 class="text-base font-semibold text-slate-900 dark:text-white">
              {{ 'work.title' | t }}
            </h1>
            <p class="text-sm text-slate-700 dark:text-slate-300">
              {{ me()?.employee?.firstName }} {{ me()?.employee?.lastName }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <app-language-switcher />
            <button class="btn-secondary !py-1.5 !text-xs" (click)="auth.logout()">{{ 'layout.logout' | t }}</button>
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div class="grid grid-cols-2 gap-3">
          <div class="glass-card p-4">
            <p class="text-2xl font-bold text-amber-600">{{ me()?.stats?.open ?? 0 }}</p>
            <p class="text-xs text-slate-500">{{ 'work.open' | t }}</p>
          </div>
          <div class="glass-card p-4">
            <p class="text-2xl font-bold text-emerald-600">{{ me()?.stats?.done ?? 0 }}</p>
            <p class="text-xs text-slate-500">{{ 'work.done' | t }}</p>
          </div>
        </div>

        @if (error()) {
          <p class="text-sm text-red-500">{{ error() }}</p>
        }
        @if (aiReply()) {
          <div class="rounded-xl bg-primary-50 p-3 text-sm text-primary-800 dark:bg-primary-900/30 dark:text-primary-200">
            {{ aiReply() }}
          </div>
        }

        <section>
          <h2 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'work.openList' | t }}</h2>
          <div class="space-y-3">
            @for (item of open(); track item.assignmentId) {
              <div class="glass-card p-4 space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="font-semibold text-slate-900 dark:text-white">{{ item.task.title }}</p>
                    <p class="text-xs text-slate-500">{{ item.task.projectName }}</p>
                  </div>
                  <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{{ item.task.status }}</span>
                </div>
                @if (item.task.description) {
                  <p class="text-sm text-slate-600 dark:text-slate-400">{{ item.task.description }}</p>
                }
                @if (item.task.deadline) {
                  <p class="text-xs text-slate-500">{{ 'work.deadline' | t }}: {{ item.task.deadline | date:'medium':'':i18n.dateLocale() }}</p>
                }
                <textarea
                  class="input-field"
                  rows="2"
                  [(ngModel)]="drafts[item.task.id]"
                  [placeholder]="'work.reportPlaceholder' | t"
                ></textarea>
                <input class="input-field" [(ngModel)]="evidence[item.task.id]" [placeholder]="'work.evidence' | t" />
                <input class="input-field" [(ngModel)]="outcomes[item.task.id]" [placeholder]="'work.outcome' | t" />
                <button
                  class="btn-primary !text-xs"
                  [disabled]="submitting() === item.task.id || !drafts[item.task.id]?.trim()"
                  (click)="submit(item.task.id)"
                >
                  {{ submitting() === item.task.id ? ('work.sending' | t) : ('work.submit' | t) }}
                </button>
              </div>
            } @empty {
              <div class="glass-card p-8 text-center text-sm text-slate-500">{{ 'work.noOpen' | t }}</div>
            }
          </div>
        </section>

        <section>
          <h2 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'work.doneList' | t }}</h2>
          <div class="space-y-2">
            @for (item of done(); track item.assignmentId) {
              <div class="glass-card p-4">
                <p class="font-medium text-slate-900 dark:text-white">{{ item.task.title }}</p>
                <p class="text-xs text-emerald-600">{{ 'work.completed' | t }}
                  @if (item.completedAt) {
                    · {{ item.completedAt | date:'medium':'':i18n.dateLocale() }}
                  }
                </p>
              </div>
            } @empty {
              <div class="glass-card p-6 text-center text-sm text-slate-500">{{ 'work.noDone' | t }}</div>
            }
          </div>
        </section>
      </main>
    </div>
  `,
})
export class WorkComponent implements OnInit {
  readonly auth = inject(AuthService);
  private api = inject(ApiService);
  readonly i18n = inject(TranslationService);

  me = signal<any>(null);
  open = signal<WorkTask[]>([]);
  done = signal<WorkTask[]>([]);
  error = signal('');
  aiReply = signal('');
  submitting = signal<string | null>(null);
  drafts: Record<string, string> = {};
  evidence: Record<string, string> = {};
  outcomes: Record<string, string> = {};

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.api.getMyWork().subscribe({
      next: (r) => this.me.set(r),
      error: () => this.error.set(this.i18n.t('work.loadError')),
    });
    this.api.getMyTasks().subscribe({
      next: (r) => {
        this.open.set(r.open ?? []);
        this.done.set(r.done ?? []);
      },
      error: () => this.error.set(this.i18n.t('work.loadError')),
    });
  }

  submit(taskId: string) {
    const message = (this.drafts[taskId] ?? '').trim();
    if (!message) return;
    this.submitting.set(taskId);
    this.error.set('');
    const links = (this.evidence[taskId] ?? '')
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s));
    this.api.respondMyTask(taskId, message, {
      evidenceLinks: links,
      measurableOutcome: this.outcomes[taskId]?.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.submitting.set(null);
        this.drafts[taskId] = '';
        this.evidence[taskId] = '';
        this.outcomes[taskId] = '';
        this.aiReply.set(res.reply ?? '');
        this.reload();
      },
      error: (err) => {
        this.submitting.set(null);
        this.error.set(err.error?.message ?? this.i18n.t('work.sendError'));
      },
    });
  }
}
