import { Component, inject, signal, computed, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { CompanyContextService } from '../../core/services/company-context.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface KpiCard {
  label: string;
  value: string;
  icon: string;
  change: string | null;
  changePositive: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  template: `
    <div class="animate-fade-in space-y-6">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (stat of kpiCards(); track stat.label) {
          <div class="stat-card">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ stat.label }}</p>
              <span class="text-lg">{{ stat.icon }}</span>
            </div>
            <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{{ stat.value }}</p>
            @if (stat.change) {
              <p class="mt-1 text-xs" [class]="stat.changePositive ? 'text-emerald-600' : 'text-red-500'">
                {{ stat.change }}
              </p>
            }
          </div>
        }
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="glass-card p-6">
          <h3 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'dashboard.chart.productivity' | t }}</h3>
          <canvas #productivityChart height="200"></canvas>
        </div>
        <div class="glass-card p-6">
          <h3 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'dashboard.chart.tasks' | t }}</h3>
          <canvas #taskChart height="200"></canvas>
        </div>
      </div>

      <!-- AI Recommendations + Project Progress -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="glass-card p-6 lg:col-span-1">
          <h3 class="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <span class="text-base">🤖</span> {{ 'dashboard.aiRecommendations' | t }}
          </h3>
          <div class="space-y-3">
            @for (rec of recommendations(); track rec.id) {
              <div class="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <div class="flex items-start justify-between">
                  <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ rec.title }}</p>
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                    [class]="rec.impact === 'HIGH' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'">
                    {{ rec.impact }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-500">{{ rec.description }}</p>
              </div>
            } @empty {
              <p class="text-sm text-slate-500">{{ 'dashboard.noRecommendations' | t }}</p>
            }
          </div>
        </div>

        <div class="glass-card p-6 lg:col-span-2">
          <h3 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">{{ 'dashboard.projectProgress' | t }}</h3>
          <div class="space-y-4">
            @for (project of projects(); track project.id) {
              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-sm font-medium text-slate-800 dark:text-slate-200">{{ project.name }}</span>
                  <span class="text-xs text-slate-500">{{ project.progress }}%</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                    [style.width.%]="project.progress"
                  ></div>
                </div>
                <div class="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>{{ 'dashboard.health' | t }} {{ project.healthScore }}%</span>
                  <span>{{ 'dashboard.deadline' | t }} {{ project.deadline | date:'mediumDate' }}</span>
                </div>
              </div>
            } @empty {
              <p class="text-sm text-slate-500">{{ 'dashboard.noProjects' | t }}</p>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit, AfterViewInit {
  private api = inject(ApiService);
  private companyContext = inject(CompanyContextService);
  readonly i18n = inject(TranslationService);

  @ViewChild('productivityChart') productivityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('taskChart') taskCanvas!: ElementRef<HTMLCanvasElement>;

  private summary = signal<any>(null);

  kpiCards = computed((): KpiCard[] => {
    this.i18n.lang();
    const s = this.summary();
    if (!s) {
      return [
        { label: this.i18n.t('dashboard.kpi.activeEmployees'), value: '—', icon: '👥', change: null, changePositive: true },
        { label: this.i18n.t('dashboard.kpi.completedTasks'), value: '—', icon: '✅', change: null, changePositive: true },
        { label: this.i18n.t('dashboard.kpi.overdueTasks'), value: '—', icon: '⚠️', change: null, changePositive: false },
        { label: this.i18n.t('dashboard.kpi.efficiency'), value: '—', icon: '📈', change: null, changePositive: true },
      ];
    }
    return [
      {
        label: this.i18n.t('dashboard.kpi.activeEmployees'),
        value: String(s.activeEmployees),
        icon: '👥',
        change: this.i18n.t('dashboard.kpi.online', { count: s.employeesOnline }),
        changePositive: true,
      },
      {
        label: this.i18n.t('dashboard.kpi.completedTasks'),
        value: String(s.completedTasks),
        icon: '✅',
        change: null,
        changePositive: true,
      },
      {
        label: this.i18n.t('dashboard.kpi.overdueTasks'),
        value: String(s.overdueTasks),
        icon: '⚠️',
        change: this.i18n.t('dashboard.kpi.pending', { count: s.blockedTasks }),
        changePositive: false,
      },
      {
        label: this.i18n.t('dashboard.kpi.efficiency'),
        value: `${s.productivityScore}%`,
        icon: '📈',
        change: this.i18n.t('dashboard.kpi.activeProjects', { count: s.activeProjects }),
        changePositive: true,
      },
    ];
  });

  recommendations = signal<any[]>([]);
  projects = signal<any[]>([]);
  companyId = this.companyContext.companyId;

  ngOnInit() {
    this.companyContext.ensureCompany().subscribe({
      next: (id) => this.loadDashboard(id),
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.initCharts(), 500);
  }

  private loadDashboard(companyId: string) {
    this.api.getDashboard(companyId).subscribe({
      next: (data) => {
        this.summary.set(data.summary);
        this.recommendations.set(data.aiRecommendations ?? []);
        this.projects.set(data.projectProgress ?? []);
        setTimeout(() => this.initCharts(data.charts), 100);
      },
    });
  }

  private initCharts(charts?: any) {
    if (this.productivityCanvas?.nativeElement) {
      new Chart(this.productivityCanvas.nativeElement, {
        type: 'line',
        data: {
          labels: charts?.productivity?.map((d: any) => d.date) ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          datasets: [{
            label: this.i18n.t('dashboard.chart.productivityLabel'),
            data: charts?.productivity?.map((d: any) => d.score) ?? [65, 72, 68, 80, 85],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
          }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } },
      });
    }

    if (this.taskCanvas?.nativeElement) {
      new Chart(this.taskCanvas.nativeElement, {
        type: 'bar',
        data: {
          labels: charts?.taskCompletion?.map((d: any) => d.date) ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          datasets: [{
            label: this.i18n.t('dashboard.chart.completedLabel'),
            data: charts?.taskCompletion?.map((d: any) => d.completed) ?? [4, 7, 5, 9, 6],
            backgroundColor: '#3b82f6',
            borderRadius: 8,
          }],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
      });
    }
  }
}
