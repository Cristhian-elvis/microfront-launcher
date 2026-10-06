import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApiMessage, Project, ProjectGitInfo } from '../launcher.models';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);

  getInfoBranchesByShellId(shellId: Signal<string>) {
    return httpResource<ProjectGitInfo>(() => {
      const projectId = shellId();
      return projectId ? `/api/projects/${encodeURIComponent(projectId)}/git-info` : undefined;
    });
  }

  refreshAll(): Observable<Project[]> {
    return this.http.post<Project[]>('/api/projects/refresh', {});
  }

  refresh(projectId: string): Observable<Project> {
    return this.http.get<Project>(`/api/projects/${encodeURIComponent(projectId)}/refresh`);
  }

  openWebapp(projectId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/projects/open-webapp', { projectId });
  }

  rebuildShell(projectId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/shell/rebuild', { projectId });
  }

  buildMicrofronts(projectId: string, microfrontendIds: string[]): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/build-batch', { projectId, microfrontendIds });
  }

  changeMicrofrontBranches(projectId: string, microfrontendIds: string[], branch: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/branch-batch', { projectId, microfrontendIds, branch });
  }

  openMicrofrontFolder(projectId: string, microfrontendId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/open-folder', { projectId, microfrontendId });
  }

  openMicrofrontInVsCode(projectId: string, microfrontendId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/open', { projectId, microfrontendId });
  }

  buildMicrofront(projectId: string, microfrontendId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/build', { projectId, microfrontendId });
  }
}
