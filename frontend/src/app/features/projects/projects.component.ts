import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ 'projects.title' | t }}</h2>
          <p class="text-sm text-slate-500">{{ 'projects.subtitle' | t }}</p>
        </div>
        <button class="btn-primary" (click)="showForm.set(true)">{{ 'projects.add' | t }}</button>
      </div>

      @if (showForm()) {
        <div class="glass-card p-6">
          <h3 class="mb-4 font-semibold">{{ 'projects.new' | t }}</h3>
          <form (ngSubmit)="createProject()" class="space-y-4">
            <input [(ngModel)]="form.name" name="name" class="input-field" [placeholder]="'projects.placeholder.name' | t" required />
            <textarea [(ngModel)]="form.description" name="description" class="input-field" rows="3" [placeholder]="'projects.placeholder.description' | t"></textarea>
            <div class="grid grid-cols-2 gap-4">
              <input [(ngModel)]="form.deadline" name="deadline" type="date" class="input-field" required />
              <select [(ngModel)]="form.priority" name="priority" class="input-field">
                @for (option of priorities(); track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </div>
            <div class="flex gap-3">
              <button type="submit" class="btn-primary">{{ 'projects.create' | t }}</button>
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">{{ 'employees.cancel' | t }}</button>
            </div>
          </form>
        </div>
      }

      <div class="space-y-4">
        @for (project of projects(); track project.id) {
          <div class="glass-card p-6">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-3">
                  <h3 class="text-lg font-semibold text-slate-900 dark:text-white">{{ project.name }}</h3>
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    [class]="priorityClass(project.priority)">
                    {{ project.priority }}
                  </span>
                  <span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {{ project.status }}
                  </span>
                </div>
                @if (project.description) {
                  <p class="mt-1 text-sm text-slate-500">{{ project.description }}</p>
                }
              </div>
              <button class="btn-secondary !py-2 !text-xs" (click)="triggerAiBreakdown(project.id)" [disabled]="breaking()">
                {{ breaking() ? ('projects.aiWorking' | t) : ('projects.aiAssign' | t) }}
              </button>
            </div>

            <div class="mt-4">
              <div class="mb-1 flex justify-between text-sm">
                <span class="text-slate-500">{{ 'projects.progress' | t }}</span>
                <span class="font-medium">{{ project.progress }}%</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div class="h-full rounded-full bg-gradient-to-r from-primary-500 to-emerald-400" [style.width.%]="project.progress"></div>
              </div>
            </div>

            <div class="mt-4 flex items-center gap-6 text-sm text-slate-500">
              <span>{{ 'projects.deadline' | t }} {{ project.deadline | date:'mediumDate' }}</span>
              <span>{{ 'projects.tasks' | t:{ count: project._count?.tasks ?? 0 } }}</span>
              <span>{{ 'projects.health' | t }} {{ project.healthScore }}%</span>
            </div>
          </div>
        } @empty {
          <div class="glass-card p-12 text-center">
            <p class="text-slate-500">{{ 'projects.empty' | t }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProjectsComponent implements OnInit {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  projects = signal<any[]>([]);
  showForm = signal(false);
  breaking = signal(false);
  companyId = this.companyContext.companyId;

  form = { name: '', description: '', deadline: '', priority: 'MEDIUM' };

  priorities = computed(() => {
    this.i18n.lang();
    return [
      { value: 'LOW', label: this.i18n.t('projects.priority.low') },
      { value: 'MEDIUM', label: this.i18n.t('projects.priority.medium') },
      { value: 'HIGH', label: this.i18n.t('projects.priority.high') },
      { value: 'CRITICAL', label: this.i18n.t('projects.priority.critical') },
    ];
  });

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: () => this.loadProjects(),
    });
  }

  loadProjects() {
    const id = this.companyId();
    if (!id) return;
    this.api.getProjects(id).subscribe({
      next: (data) => this.projects.set(data),
    });
  }

  createProject() {
    const id = this.companyId();
    if (!id) return;
    this.api.createProject(id, {
      ...this.form,
      deadline: new Date(this.form.deadline).toISOString(),
    }).subscribe({
      next: (project) => {
        this.showForm.set(false);
        this.form = { name: '', description: '', deadline: '', priority: 'MEDIUM' };
        this.loadProjects();
        this.triggerAiBreakdown(project.id);
      },
    });
  }

  triggerAiBreakdown(projectId: string) {
    this.breaking.set(true);
    this.api.breakdownProject(projectId).subscribe({
      next: () => {
        this.breaking.set(false);
        this.loadProjects();
      },
      error: () => this.breaking.set(false),
    });
  }

  priorityClass(priority: string) {
    const map: Record<string, string> = {
      CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      LOW: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    };
    return map[priority] ?? map['MEDIUM'];
  }
}
