import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApiMessage, Project } from './launcher.models';

/** Shared HTTP boundary for launcher data and commands. */
@Injectable({ providedIn: 'root' })
export class LauncherService {
  private readonly http = inject(HttpClient);

  savePreferredVersion(preferredTag: string): Observable<ApiMessage> {
    return this.http.put<ApiMessage>('/api/mova/preferences', { preferredTag });
  }

  startComponents(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/components/start', {});
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
}
