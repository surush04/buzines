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
  createDirective(companyId: string, instruction: string, sendTelegram = true) {
    return this.http.post<any>(`${this.base}/directives/companies/${companyId}`, {
      instruction,
      sendTelegram,
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

  // Telegram
  getTelegramUserStatus(companyId: string) {
    return this.http.get<any>(`${this.base}/telegram/companies/${companyId}/user/status`);
  }

  getTelegramApiCredentials(companyId: string) {
    return this.http.get<{ configured: boolean; apiId: number | null; apiHash: string; source: string }>(
      `${this.base}/telegram/companies/${companyId}/api-credentials`,
    );
  }

  saveTelegramApiCredentials(companyId: string, apiId: number, apiHash: string) {
    return this.http.post<{ configured: boolean; apiId: number | null; apiHash: string; source: string }>(
      `${this.base}/telegram/companies/${companyId}/api-credentials`,
      { apiId, apiHash },
    );
  }

  sendTelegramUserCode(companyId: string, phone: string) {
    return this.http.post<any>(`${this.base}/telegram/companies/${companyId}/user/send-code`, { phone });
  }

  confirmTelegramUser(companyId: string, code: string, password?: string) {
    return this.http.post<any>(`${this.base}/telegram/companies/${companyId}/user/confirm`, { code, password });
  }
}
