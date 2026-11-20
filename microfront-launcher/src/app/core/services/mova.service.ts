import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApiMessage, LauncherPreferences } from '../launcher.models';

@Injectable({ providedIn: 'root' })
export class MovaService {
  private readonly http = inject(HttpClient);

  startComponents(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/components/start', {});
  }

  stopComponents(): Observable<ApiMessage> {
    return this.http.post<ApiMessage>('/api/components/stop', {});
  }

  savePreferences(preferences: Partial<LauncherPreferences>): Observable<ApiMessage> {
    return this.http.put<ApiMessage>('/api/mova/preferences', preferences);
  }
}
