import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ApiMessage,
  MicrofrontendBuildOptions,
  Project,
  ProjectGitInfo,
  ShellPrepareOptions,
} from '../launcher.models';

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

  openWebapp(projectId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/projects/open-webapp', { projectId });
  }

  prepareShellServer(projectId: string, options?: ShellPrepareOptions): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/shell/prepare', { projectId, ...options });
  }

  buildMicrofronts(
    projectId: string,
    microfrontendIds: string[],
    options?: MicrofrontendBuildOptions,
  ): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/build-batch', {
      projectId,
      microfrontendIds,
      ...options,
    });
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

  buildMicrofront(
    projectId: string,
    microfrontendId: string,
    options?: MicrofrontendBuildOptions,
  ): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/microfrontends/build', {
      projectId,
      microfrontendId,
      ...options,
    });
  }
}
