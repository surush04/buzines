import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [FormsModule, DecimalPipe, TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">{{ 'employees.title' | t }}</h2>
          <p class="text-sm text-slate-500">{{ 'employees.subtitle' | t }}</p>
          <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
            {{ 'employees.telegramHint' | t }}
          </p>
        </div>
        <button class="btn-primary" (click)="showForm.set(true)" [disabled]="!companyId()">{{ 'employees.add' | t }}</button>
      </div>

      @if (error()) {
        <div class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{{ error() }}</div>
      }

      @if (showForm()) {
        <div class="glass-card p-6">
          <h3 class="mb-4 font-semibold">{{ 'employees.newEmployee' | t }}</h3>
          <form (ngSubmit)="addEmployee()" class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input [(ngModel)]="form.firstName" name="firstName" class="input-field" [placeholder]="'employees.placeholder.firstName' | t" required />
            <input [(ngModel)]="form.lastName" name="lastName" class="input-field" [placeholder]="'employees.placeholder.lastName' | t" required />
            <input [(ngModel)]="form.email" name="email" type="email" class="input-field" [placeholder]="'employees.placeholder.email' | t" required />
            <input [(ngModel)]="form.role" name="role" class="input-field" [placeholder]="'employees.placeholder.role' | t" required />
            <input [(ngModel)]="form.phone" name="phone" class="input-field" [placeholder]="'employees.placeholder.phone' | t" />
            <input [(ngModel)]="form.telegramUsername" name="telegram" class="input-field" [placeholder]="'employees.placeholder.telegram' | t" required />
            <input [(ngModel)]="form.skills" name="skills" class="input-field md:col-span-2" [placeholder]="'employees.placeholder.skills' | t" />
            <div class="flex gap-3 md:col-span-2">
              <button type="submit" class="btn-primary" [disabled]="saving()">{{ 'employees.save' | t }}</button>
              <button type="button" class="btn-secondary" (click)="showForm.set(false)">{{ 'employees.cancel' | t }}</button>
            </div>
          </form>
        </div>
      }

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (emp of employees(); track emp.id) {
          <div class="glass-card p-6 transition-transform hover:scale-[1.01]">
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-lg font-bold text-white">
                {{ emp.firstName[0] }}{{ emp.lastName[0] }}
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-slate-900 dark:text-white">{{ emp.firstName }} {{ emp.lastName }}</h3>
                <p class="text-sm text-primary-600 dark:text-primary-400">{{ emp.role }}</p>
                <p class="text-xs text-slate-500">{{ emp.department?.name ?? ('employees.noDepartment' | t) }}</p>
              </div>
              <span class="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                [class]="emp.telegramUsername ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'">
                {{ emp.telegramUsername ? '✈️ @' + emp.telegramUsername : ('employees.noTelegram' | t) }}
              </span>
            </div>

            @if (emp.telegramUsername) {
              <div class="mt-4 rounded-xl border border-primary-200 bg-primary-50/50 p-3 dark:border-primary-800 dark:bg-primary-900/20">
                <p class="text-xs text-slate-500">{{ 'employees.tasksGoTo' | t }}</p>
                <p class="font-mono text-sm font-bold text-primary-700">&#64;{{ emp.telegramUsername }}</p>
              </div>
            }

            @if (emp.skills?.length) {
              <div class="mt-4 flex flex-wrap gap-1.5">
                @for (skill of emp.skills; track skill.name) {
                  <span class="rounded-lg bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{{ skill.name }}</span>
                }
              </div>
            }

            @if (emp.aiProfile) {
              <div class="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/60 pt-4 dark:border-slate-700">
                <div class="text-center">
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ emp.aiProfile.productivityScore | number:'1.0-0' }}%</p>
                  <p class="text-xs text-slate-500">{{ 'employees.efficiency' | t }}</p>
                </div>
                <div class="text-center">
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ emp.aiProfile.taskCompletionRate | number:'1.0-0' }}%</p>
                  <p class="text-xs text-slate-500">{{ 'employees.completion' | t }}</p>
                </div>
                <div class="text-center">
                  <p class="text-lg font-bold text-slate-900 dark:text-white">{{ emp.experienceLevel }}</p>
                  <p class="text-xs text-slate-500">{{ 'employees.level' | t }}</p>
                </div>
              </div>
            }
          </div>
        } @empty {
          <div class="glass-card col-span-full p-12 text-center">
            <p class="text-slate-500">{{ 'employees.empty' | t }}</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class EmployeesComponent implements OnInit {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  employees = signal<any[]>([]);
  showForm = signal(false);
  saving = signal(false);
  error = signal('');
  companyId = this.companyContext.companyId;

  form = {
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    phone: '',
    telegramUsername: '',
    skills: '',
  };

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: () => this.loadEmployees(),
      error: () => this.error.set(this.i18n.t('employees.error.loadCompany')),
    });
  }

  loadEmployees() {
    const id = this.companyId();
    if (!id) return;
    this.api.getEmployees(id).subscribe({
      next: (data) => this.employees.set(data),
      error: () => this.error.set(this.i18n.t('employees.error.load')),
    });
  }

  addEmployee() {
    const id = this.companyId();
    if (!id) {
      this.error.set(this.i18n.t('employees.error.noCompany'));
      return;
    }
    if (!this.form.telegramUsername.trim()) {
      this.error.set(this.i18n.t('employees.error.telegramRequired'));
      return;
    }

    this.saving.set(true);
    this.error.set('');

    const skills = this.form.skills.split(',').map((s) => s.trim()).filter(Boolean);

    this.api.createEmployee(id, { ...this.form, skills }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.form = { firstName: '', lastName: '', email: '', role: '', phone: '', telegramUsername: '', skills: '' };
        this.loadEmployees();
      },
      error: (err) => {
        this.saving.set(false);
        const msg = err.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join(', ') : msg ?? this.i18n.t('employees.error.addFailed'));
      },
    });
  }
}
