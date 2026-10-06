import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApiMessage, LauncherConfig } from '../launcher.models';

@Injectable({ providedIn: 'root' })
export class EnvironmentService {
  private readonly http = inject(HttpClient);

  getConfig(): Observable<LauncherConfig> {
    return this.http.get<LauncherConfig>('/api/config');
  }

  saveConfig(config: LauncherConfig): Observable<ApiMessage> {
    return this.http.put<ApiMessage>('/api/config', config);
  }

  completeSetup(config: LauncherConfig): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/setup', config);
  }

  start(projectId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/environment/start', { projectId });
  }

  stop(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/environment/stop', {});
  }

  openBrowser(mode: 'tab' | 'window', browser?: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/chrome/open', { mode, ...(browser ? { browser } : {}) });
  }
}
