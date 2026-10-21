import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface AuthUserProfile {
  id: number;
  cdUsuario: string;
  webapp: string;
  profiles: string[];
  descripcion: string;
}

export interface AuthTokenResponse {
  accessToken?: string;
}

export interface StoredAuthToken {
  id: number;
  userProfileId: number;
  webapp: string;
  profileDescription: string;
  cdUsuario: string;
  accessToken: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  listUserProfiles(webapp: string) {
    return this.http.get<AuthUserProfile[]>('/api/auth/user-profiles', {
      params: new HttpParams().set('webapp', webapp),
    });
  }

  createUserProfile(profile: Omit<AuthUserProfile, 'id'>) {
    return this.http.post<AuthUserProfile>('/api/auth/user-profiles', profile);
  }

  updateUserProfile(id: number, profile: Omit<AuthUserProfile, 'id'>) {
    return this.http.put<AuthUserProfile>(`/api/auth/user-profiles/${id}`, profile);
  }

  deleteUserProfile(id: number) {
    return this.http.delete<void>(`/api/auth/user-profiles/${id}`);
  }

  generateToken(projectId: string, userProfileId: number) {
    return this.http.post<AuthTokenResponse>('/api/auth/token', { projectId, userProfileId });
  }

  listStoredTokens() {
    return this.http.get<StoredAuthToken[]>('/api/auth/tokens');
  }

  deleteStoredToken(id: number) {
    return this.http.delete<void>(`/api/auth/tokens/${id}`);
  }
}
