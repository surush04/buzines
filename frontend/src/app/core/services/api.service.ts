import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Companies
  getCompanies() {
    return this.http.get<any[]>(`${this.base}/companies`);
  }

  getCompany(id: string) {
    return this.http.get<any>(`${this.base}/companies/${id}`);
  }

  createCompany(data: { name: string; description?: string; industry?: string }) {
    return this.http.post<any>(`${this.base}/companies`, data);
  }

  completeOnboarding(companyId: string, data: any) {
    return this.http.post<any>(`${this.base}/companies/${companyId}/onboarding`, data);
  }

  updateCompanySettings(companyId: string, data: any) {
    return this.http.put<any>(`${this.base}/companies/${companyId}/settings`, data);
  }

  updateAiSettings(companyId: string, data: any) {
    return this.http.put<any>(`${this.base}/companies/${companyId}/ai-settings`, data);
  }

  updateBusinessProfile(companyId: string, data: any) {
    return this.http.put<any>(`${this.base}/companies/${companyId}/business-profile`, data);
  }

  resetCompanyData(companyId: string) {
    return this.http.post<any>(`${this.base}/companies/${companyId}/reset-data`, {});
  }

  // Employees
  getEmployees(companyId: string) {
    return this.http.get<any[]>(`${this.base}/companies/${companyId}/employees`);
  }

  createEmployee(companyId: string, data: any) {
    return this.http.post<any>(`${this.base}/companies/${companyId}/employees`, data);
  }

  // Projects
  getProjects(companyId: string) {
    return this.http.get<any[]>(`${this.base}/companies/${companyId}/projects`);
  }

  createProject(companyId: string, data: any) {
    return this.http.post<any>(`${this.base}/companies/${companyId}/projects`, data);
  }

  // Dashboard
  getDashboard(companyId: string) {
    return this.http.get<any>(`${this.base}/dashboard/companies/${companyId}`);
  }

  getManagerDashboard(companyId: string) {
    return this.http.get<any>(`${this.base}/dashboard/companies/${companyId}/manager`);
  }

  // AI
  breakdownProject(projectId: string) {
    return this.http.post(`${this.base}/ai/projects/${projectId}/breakdown`, {});
  }

  generateDailyPlans(companyId: string) {
    return this.http.post(`${this.base}/ai/companies/${companyId}/daily-plans`, {});
  }

  getRecommendations(companyId: string) {
    return this.http.get<any[]>(`${this.base}/ai/companies/${companyId}/recommendations`);
  }

  getAiActivity(companyId: string) {
    return this.http.get<{ icon: string; message: string; time: string }[]>(
      `${this.base}/ai/companies/${companyId}/activity`,
    );
  }

  // Admin Directives — owner gives order, AI executes
  createDirective(companyId: string, instruction: string, autoDispatch = true) {
    return this.http.post<any>(`${this.base}/directives/companies/${companyId}`, {
      instruction,
      autoDispatch,
    });
  }

  dispatchTasks(companyId: string, directiveId?: string) {
    return this.http.post<any>(`${this.base}/directives/companies/${companyId}/dispatch`, {
      directiveId,
    });
  }

  getDirectives(companyId: string) {
    return this.http.get<any[]>(`${this.base}/directives/companies/${companyId}`);
  }

  deleteTask(taskId: string, companyId: string) {
    return this.http.delete<any>(`${this.base}/directives/tasks/${taskId}/companies/${companyId}`);
  }

  deleteDirective(directiveId: string, companyId: string) {
    return this.http.delete<any>(`${this.base}/directives/${directiveId}/companies/${companyId}`);
  }

  followUpDirectives(companyId: string) {
    return this.http.post(`${this.base}/directives/companies/${companyId}/follow-up`, {});
  }

  runProactiveAi(companyId: string) {
    return this.http.post<any>(`${this.base}/directives/companies/${companyId}/proactive`, {});
  }

  autoAnalyze(companyId: string) {
    return this.http.post<any>(`${this.base}/directives/companies/${companyId}/auto-analyze`, {});
  }

  getAiStatus(companyId: string) {
    return this.http.get<{ snapshot: string }>(`${this.base}/ai/companies/${companyId}/status`);
  }

  getBusinessAnalysis(companyId: string) {
    return this.http.post<any>(`${this.base}/ai/companies/${companyId}/business-analysis`, {});
  }

  getCeoBoard(companyId: string) {
    return this.http.get<any>(`${this.base}/ceo/companies/${companyId}`);
  }

  diagnoseCeo(companyId: string) {
    return this.http.post<any>(`${this.base}/ceo/companies/${companyId}/diagnose`, {});
  }

  createCeoGoal(companyId: string, data: { title: string; description?: string; targetValue?: number; unit?: string }) {
    return this.http.post<any>(`${this.base}/ceo/companies/${companyId}/goals`, data);
  }

  createCeoKpi(companyId: string, data: { employeeId: string; name: string; planValue?: number; factValue?: number; unit?: string }) {
    return this.http.post<any>(`${this.base}/ceo/companies/${companyId}/kpis`, data);
  }

  decideCeo(companyId: string, decisionId: string, approve: boolean) {
    return this.http.post<any>(`${this.base}/ceo/companies/${companyId}/decisions/${decisionId}`, { approve });
  }

  verifyCeo(companyId: string, decisionId: string, actualEffect: string) {
    return this.http.post<any>(`${this.base}/ceo/companies/${companyId}/decisions/${decisionId}/verify`, {
      actualEffect,
    });
  }

  getMyWork() {
    return this.http.get<any>(`${this.base}/work/me`);
  }

  getMyTasks() {
    return this.http.get<{ open: any[]; done: any[] }>(`${this.base}/work/tasks`);
  }

  respondMyTask(
    taskId: string,
    message: string,
    extras?: { evidenceLinks?: string[]; measurableOutcome?: string; claimedValue?: number },
  ) {
    return this.http.post<any>(`${this.base}/work/tasks/${taskId}/respond`, { message, ...extras });
  }

  getControlCenter(companyId: string) {
    return this.http.get<any>(`${this.base}/ops/companies/${companyId}/control-center`);
  }

  pauseAi(companyId: string, paused: boolean, reason?: string) {
    return this.http.post<any>(`${this.base}/ops/companies/${companyId}/pause`, { paused, reason });
  }

  getVerificationReports(companyId: string, status?: string) {
    const q = status ? `?status=${status}` : '';
    return this.http.get<any[]>(`${this.base}/verification/companies/${companyId}/reports${q}`);
  }

  reviewCompletion(companyId: string, reportId: string, approve: boolean, reason?: string) {
    return this.http.post<any>(`${this.base}/verification/companies/${companyId}/reports/${reportId}/review`, {
      approve,
      reason,
    });
  }

  getWorkflows(companyId: string) {
    return this.http.get<any[]>(`${this.base}/workflows/companies/${companyId}`);
  }

  createWorkflow(companyId: string, data: any) {
    return this.http.post<any>(`${this.base}/workflows/companies/${companyId}`, data);
  }

  updateWorkflow(companyId: string, id: string, data: any) {
    return this.http.put<any>(`${this.base}/workflows/companies/${companyId}/${id}`, data);
  }

  deleteWorkflow(companyId: string, id: string) {
    return this.http.delete<any>(`${this.base}/workflows/companies/${companyId}/${id}`);
  }

  getMemories(companyId: string, q?: string) {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.http.get<any[]>(`${this.base}/memory/companies/${companyId}${qs}`);
  }

  createMemory(companyId: string, data: any) {
    return this.http.post<any>(`${this.base}/memory/companies/${companyId}`, data);
  }

  deleteMemory(companyId: string, id: string) {
    return this.http.delete<any>(`${this.base}/memory/companies/${companyId}/${id}`);
  }

  getWorkload(companyId: string) {
    return this.http.get<any>(`${this.base}/resources/companies/${companyId}`);
  }

  saveCapacity(companyId: string, employeeId: string, data: any) {
    return this.http.put<any>(`${this.base}/resources/companies/${companyId}/employees/${employeeId}/capacity`, data);
  }

  getScenarios(companyId: string) {
    return this.http.get<any[]>(`${this.base}/simulator/companies/${companyId}`);
  }

  runScenario(companyId: string, data: any) {
    return this.http.post<any>(`${this.base}/simulator/companies/${companyId}`, data);
  }

  getIntegrations(companyId: string) {
    return this.http.get<any[]>(`${this.base}/integrations/companies/${companyId}`);
  }

  connectIntegration(companyId: string, type: string) {
    return this.http.post<any>(`${this.base}/integrations/companies/${companyId}/${type}/connect`, {});
  }

  disconnectIntegration(companyId: string, type: string) {
    return this.http.post<any>(`${this.base}/integrations/companies/${companyId}/${type}/disconnect`, {});
  }

  getDecisionJournal(companyId: string) {
    return this.http.get<any[]>(`${this.base}/ceo/companies/${companyId}/decisions`);
  }
}
