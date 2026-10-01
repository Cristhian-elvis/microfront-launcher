import { HttpClient, httpResource } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApiMessage, ComponentsVersionPreference, LatestMovaVersion, MovaVersion, Project, ProjectGitInfo } from './launcher.models';

/** Shared HTTP boundary for launcher data and commands. */
@Injectable({ providedIn: 'root' })
export class LauncherService {
  private readonly http = inject(HttpClient);

  getInfoBranchesByShellId(shellId: Signal<string>) {
    return httpResource<ProjectGitInfo>(() => {
      const projectId = shellId();
      return projectId ? `/api/projects/${encodeURIComponent(projectId)}/git-info` : undefined;
    });
  }

  saveComponentsVersion(componentsVersion: ComponentsVersionPreference): Observable<ApiMessage> {
    return this.http.put<ApiMessage>('/api/mova/preferences', { componentsVersion });
  }

  getVersions(): Observable<MovaVersion[]> {
    return this.http.get<MovaVersion[]>('/api/mova/versions');
  }

  getLatestVersion(projectId: string): Observable<LatestMovaVersion> {
    return this.http.get<LatestMovaVersion>(`/api/mova/latest?projectId=${encodeURIComponent(projectId)}`);
  }

  startComponents(projectId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/components/start', { projectId });
  }

  stopComponents(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/components/stop', {});
  }

  startEnvironment(projectId: string): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/environment/start', { projectId });
  }

  stopEnvironment(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/environment/stop', {});
  }

  openBrowser(mode: 'tab' | 'window'): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/chrome/open', { mode });
  }

  refreshProjects(): Observable<Project[]> {
    return this.http.post<Project[]>('/api/projects/refresh', {});
  }

  saveFavoriteShells(favoriteShellIds: string[]): Observable<ApiMessage> {
    return this.http.put<ApiMessage>('/api/mova/preferences', { favoriteShellIds });
  }

  savePreferences(preferences: { favoriteShellIds?: string[]; favoriteMicrofrontIds?: string[]; avatarLetters?: string }): Observable<ApiMessage> {
    return this.http.put<ApiMessage>('/api/mova/preferences', preferences);
  }
}
