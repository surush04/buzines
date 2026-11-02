import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

type Tab = 'control' | 'workflows' | 'memory' | 'verify' | 'workload' | 'sim' | 'integrations';

@Component({
  selector: 'app-os',
  standalone: true,
  imports: [FormsModule, DatePipe, JsonPipe, TranslatePipe],
  template: `
    <div class="space-y-6 animate-fade-in">
      <div>
        <h1 class="text-2xl font-bold">{{ 'os.title' | t }}</h1>
        <p class="text-sm text-slate-500">{{ 'os.subtitle' | t }}</p>
      </div>
      @if (error()) {
        <p class="text-sm text-red-500">{{ error() }}</p>
      }
      <div class="flex flex-wrap gap-2">
        @for (t of tabs; track t) {
          <button class="btn-secondary !py-1.5 !text-xs" [class.btn-primary]="tab() === t" (click)="open(t)">
            {{ ('os.tab.' + t) | t }}
          </button>
        }
      </div>

      @if (loading()) {
        <p class="text-sm text-slate-500">…</p>
      }

      @switch (tab()) {
        @case ('control') {
          <div class="grid gap-4 md:grid-cols-3">
            <div class="stat-card">
              <p class="text-xs text-slate-500">Autonomy</p>
              <p class="font-semibold">{{ center()?.autonomyLabels?.[center()?.settings?.autonomyLevel] }}</p>
              <p class="text-xs">{{ center()?.settings?.aiPaused ? ('os.paused' | t) : '' }}</p>
            </div>
            <div class="stat-card">
              <p class="text-xs text-slate-500">Failed ops / Groq</p>
              <p class="text-2xl font-bold">{{ center()?.failedOps ?? 0 }} / {{ center()?.groqFails ?? 0 }}</p>
            </div>
            <div class="stat-card">
              <p class="text-xs text-slate-500">Tokens (7d est.)</p>
              <p class="text-2xl font-bold">{{ center()?.tokensUsed ?? 0 }}</p>
              <p class="text-xs">{{ center()?.estimatedCostUsd ? ('$' + center()?.estimatedCostUsd) : 'n/a' }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn-primary !text-xs" (click)="pause(true)">{{ 'os.pause' | t }}</button>
            <button class="btn-secondary !text-xs" (click)="pause(false)">{{ 'os.resume' | t }}</button>
          </div>
          <div class="glass-card p-4 overflow-x-auto">
            <h3 class="mb-2 font-semibold">Operations</h3>
            @for (op of center()?.operations ?? []; track op.id) {
              <p class="text-xs py-1 border-b border-slate-100 dark:border-slate-800">
                {{ op.createdAt | date:'short' }} · {{ op.type }} · {{ op.status }} — {{ op.summary }}
              </p>
            } @empty { <p class="text-sm text-slate-500">{{ 'os.empty' | t }}</p> }
          </div>
        }
        @case ('workflows') {
          <form class="glass-card p-4 space-y-2" (ngSubmit)="saveWorkflow()">
            <input class="input-field" name="wfName" [(ngModel)]="wf.name" placeholder="Name" required />
            <select class="input-field" name="wfTrigger" [(ngModel)]="wf.triggerType">
              <option>TASK_OVERDUE</option>
              <option>COMPLETION_SUBMITTED</option>
              <option>COMPLETION_REJECTED</option>
              <option>TASK_STATUS_CHANGED</option>
              <option>SCHEDULED_TIME</option>
              <option>EMPLOYEE_OVERLOADED</option>
            </select>
            <select class="input-field" name="wfAction" [(ngModel)]="wf.action">
              <option>NOTIFY</option>
              <option>CREATE_TASK</option>
              <option>ESCALATE</option>
              <option>FOLLOW_UP_REMINDER</option>
              <option>GENERATE_DIAGNOSIS</option>
            </select>
            <label class="text-xs flex items-center gap-2">
              <input type="checkbox" [(ngModel)]="wf.requireApproval" name="wfAppr" /> Approval required
            </label>
            <button class="btn-primary !text-xs">{{ 'os.save' | t }}</button>
          </form>
          @for (w of workflows(); track w.id) {
            <div class="glass-card p-4 flex justify-between gap-3">
              <div>
                <p class="font-semibold">{{ w.name }}</p>
                <p class="text-xs text-slate-500">{{ w.triggerType }} · {{ w.enabled ? 'on' : 'off' }}</p>
              </div>
              <button class="btn-secondary !text-xs" (click)="toggleWf(w)">{{ w.enabled ? 'Disable' : 'Enable' }}</button>
            </div>
          }
        }
        @case ('memory') {
          <form class="glass-card p-4 space-y-2" (ngSubmit)="saveMemory()">
            <select class="input-field" name="mk" [(ngModel)]="mem.kind">
              <option>FACT</option><option>RULE</option><option>LESSON</option><option>PROBLEM</option><option>SUMMARY</option>
            </select>
            <input class="input-field" name="mt" [(ngModel)]="mem.title" placeholder="Title" required />
            <textarea class="input-field" name="mc" rows="3" [(ngModel)]="mem.content" required></textarea>
            <button class="btn-primary !text-xs">{{ 'os.save' | t }}</button>
          </form>
          @for (m of memories(); track m.id) {
            <div class="glass-card p-4">
              <p class="text-xs text-slate-500">{{ m.kind }} / {{ m.provenance }}</p>
              <p class="font-semibold">{{ m.title }}</p>
              <p class="text-sm">{{ m.content }}</p>
              <button class="btn-secondary !text-xs mt-2" (click)="delMem(m.id)">Delete</button>
            </div>
          }
        }
        @case ('verify') {
          @for (r of reports(); track r.id) {
            <div class="glass-card p-4 space-y-2">
              <p class="font-semibold">{{ r.task?.title }} — {{ r.employee?.firstName }}</p>
              <p class="text-sm">{{ r.summary }}</p>
              <p class="text-xs text-amber-700">{{ r.status }} · {{ r.internalRecordNote }}</p>
              @if (r.status === 'PENDING_REVIEW' || r.status === 'UNVERIFIED' || r.status === 'DISCREPANCY') {
                <input class="input-field" [(ngModel)]="rejectReason[r.id]" [placeholder]="'os.reason' | t" />
                <div class="flex gap-2">
                  <button class="btn-primary !text-xs" (click)="review(r.id, true)">{{ 'os.approve' | t }}</button>
                  <button class="btn-secondary !text-xs" (click)="review(r.id, false)">{{ 'os.reject' | t }}</button>
                </div>
              }
            </div>
          } @empty { <p class="text-sm text-slate-500">{{ 'os.empty' | t }}</p> }
        }
        @case ('workload') {
          @for (e of workload()?.employees ?? []; track e.employeeId) {
            <div class="glass-card p-4">
              <p class="font-semibold">{{ e.name }} · {{ e.loadPct }}%</p>
              <p class="text-xs">{{ e.estimatedOpenHours }}h / {{ e.hoursPerWeek }}h · open {{ e.openTasks }} · overdue {{ e.overdue }}</p>
              <p class="text-xs" [class.text-red-500]="!e.available">{{ e.available ? 'available' : 'unavailable' }}</p>
            </div>
          }
        }
        @case ('sim') {
          <form class="glass-card p-4 space-y-2" (ngSubmit)="runSim()">
            <input class="input-field" name="sn" [(ngModel)]="sim.name" placeholder="Name" required />
            <textarea class="input-field" name="sh" rows="2" [(ngModel)]="sim.hypothesis" required></textarea>
            <input class="input-field" type="number" name="hire" [(ngModel)]="sim.hireCount" placeholder="Hire count" />
            <button class="btn-primary !text-xs">{{ 'os.run' | t }}</button>
          </form>
          @if (simResult()) {
            <pre class="glass-card p-4 text-xs overflow-auto">{{ simResult() | json }}</pre>
          }
        }
        @case ('integrations') {
          @for (i of integrations(); track i.type) {
            <div class="glass-card p-4 flex justify-between gap-3">
              <div>
                <p class="font-semibold">{{ i.type }}</p>
                <p class="text-xs">{{ i.connectionStatus }}</p>
                <p class="text-xs text-slate-500">{{ 'os.disconnected' | t }}</p>
              </div>
              <button class="btn-secondary !text-xs" (click)="tryConnect(i.type)">Connect</button>
            </div>
          }
        }
      }
    </div>
  `,
})
export class OsComponent implements OnInit {
  private api = inject(ApiService);
  private company = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  tabs: Tab[] = ['control', 'workflows', 'memory', 'verify', 'workload', 'sim', 'integrations'];
  tab = signal<Tab>('control');
  loading = signal(false);
  error = signal('');
  center = signal<any>(null);
  workflows = signal<any[]>([]);
  memories = signal<any[]>([]);
  reports = signal<any[]>([]);
  workload = signal<any>(null);
  integrations = signal<any[]>([]);
  simResult = signal<any>(null);
  rejectReason: Record<string, string> = {};
  wf = { name: '', triggerType: 'TASK_OVERDUE', action: 'NOTIFY', requireApproval: false };
  mem = { kind: 'FACT', title: '', content: '' };
  sim = { name: '', hypothesis: '', hireCount: 0 };

  ngOnInit() {
    this.company.ensureCompany().subscribe({ next: () => this.open('control') });
  }

  cid() {
    return this.company.companyId();
  }

  open(t: Tab) {
    this.tab.set(t);
    const id = this.cid();
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    const done = () => this.loading.set(false);
    const fail = (e: any) => {
      this.loading.set(false);
      this.error.set(e?.error?.message ?? 'Error');
    };
    if (t === 'control') this.api.getControlCenter(id).subscribe({ next: (r) => { this.center.set(r); done(); }, error: fail });
    if (t === 'workflows') this.api.getWorkflows(id).subscribe({ next: (r) => { this.workflows.set(r); done(); }, error: fail });
    if (t === 'memory') this.api.getMemories(id).subscribe({ next: (r) => { this.memories.set(r); done(); }, error: fail });
    if (t === 'verify') this.api.getVerificationReports(id).subscribe({ next: (r) => { this.reports.set(r); done(); }, error: fail });
    if (t === 'workload') this.api.getWorkload(id).subscribe({ next: (r) => { this.workload.set(r); done(); }, error: fail });
    if (t === 'sim') { this.loading.set(false); }
    if (t === 'integrations') this.api.getIntegrations(id).subscribe({ next: (r) => { this.integrations.set(r); done(); }, error: fail });
  }

  pause(paused: boolean) {
    const id = this.cid();
    if (!id) return;
    this.api.pauseAi(id, paused, paused ? 'Emergency pause from control center' : '').subscribe({
      next: () => this.open('control'),
      error: (e) => this.error.set(e?.error?.message ?? 'Error'),
    });
  }

  saveWorkflow() {
    const id = this.cid();
    if (!id) return;
    this.api.createWorkflow(id, {
      name: this.wf.name,
      triggerType: this.wf.triggerType,
      conditions: [{ field: 'task.status', op: 'neq', value: 'COMPLETED' }],
      actions: [{ type: this.wf.action, config: { title: this.wf.name, message: this.wf.name } }],
      requireApproval: this.wf.requireApproval,
    }).subscribe({
      next: () => this.open('workflows'),
      error: (e) => this.error.set(e?.error?.message ?? 'Error'),
    });
  }

  toggleWf(w: any) {
    const id = this.cid();
    if (!id) return;
    this.api.updateWorkflow(id, w.id, { enabled: !w.enabled }).subscribe({ next: () => this.open('workflows') });
  }

  saveMemory() {
    const id = this.cid();
    if (!id) return;
    this.api.createMemory(id, this.mem).subscribe({
      next: () => { this.mem = { kind: 'FACT', title: '', content: '' }; this.open('memory'); },
      error: (e) => this.error.set(e?.error?.message ?? 'Error'),
    });
  }

  delMem(mid: string) {
    const id = this.cid();
    if (!id || !confirm('Delete memory?')) return;
    this.api.deleteMemory(id, mid).subscribe({ next: () => this.open('memory') });
  }

  review(reportId: string, approve: boolean) {
    const id = this.cid();
    if (!id) return;
    if (!approve && !this.rejectReason[reportId]?.trim()) {
      this.error.set(this.i18n.t('os.reason'));
      return;
    }
    this.api.reviewCompletion(id, reportId, approve, this.rejectReason[reportId]).subscribe({
      next: () => this.open('verify'),
      error: (e) => this.error.set(e?.error?.message ?? 'Error'),
    });
  }

  runSim() {
    const id = this.cid();
    if (!id) return;
    this.api.runScenario(id, {
      name: this.sim.name,
      hypothesis: this.sim.hypothesis,
      assumptions: { hireCount: Number(this.sim.hireCount) || 0 },
    }).subscribe({
      next: (r) => this.simResult.set(r),
      error: (e) => this.error.set(e?.error?.message ?? 'Error'),
    });
  }

  tryConnect(type: string) {
    const id = this.cid();
    if (!id) return;
    this.api.connectIntegration(id, type).subscribe({
      next: () => this.open('integrations'),
      error: (e) => this.error.set(e?.error?.message ?? this.i18n.t('os.disconnected')),
    });
  }
}
