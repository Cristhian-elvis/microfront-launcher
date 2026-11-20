import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ApiMessage,
  Microfrontend,
  MicrofrontendBuildOptions,
  Project,
  ShellPrepareOptions,
} from '../launcher.models';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);

  getProjectDetailsByShellId(shellId: Signal<string>) {
    return httpResource<Project>(() => {
      const projectId = shellId();
      return projectId ? `/api/projects/${encodeURIComponent(projectId)}` : undefined;
    });
  }

  getMicrofrontendsByShellId(shellId: Signal<string>, isShellAvailable: Signal<boolean>) {
    return httpResource<Microfrontend[]>(() => {
      const projectId = shellId();
      return projectId && isShellAvailable()
        ? `/api/projects/${encodeURIComponent(projectId)}/microfrontends`
        : undefined;
    });
  }

  refreshAll(): Observable<Project[]> {
    return this.http.post<Project[]>('/api/projects/refresh', {});
  }

  getProject(projectId: string): Observable<Project> {
    return this.http.get<Project>(`/api/projects/${encodeURIComponent(projectId)}`);
  }

  openProjectTarget(
    projectId: string,
    action: 'folder' | 'terminal' | 'vscode',
    target: { type: 'shell' | 'webapp' | 'microfrontend'; id?: string },
  ): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(
      `/api/projects/${encodeURIComponent(projectId)}/open-target`,
      { action, target },
    );
  }

  prepareShellServer(projectId: string, options?: ShellPrepareOptions): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/shell/prepare', { projectId, ...options });
  }

  checkMicrofrontends(
    projectId: string,
    microfrontendIds: string[],
    options?: MicrofrontendBuildOptions,
  ): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/check-project', {
      projectId,
      microfrontendIds,
      ...options,
    });
  }

  changeMicrofrontBranches(projectId: string, microfrontendIds: string[], branch: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/branch-batch', { projectId, microfrontendIds, branch });
  }

}
