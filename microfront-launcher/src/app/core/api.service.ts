import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);


  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }

  post<T>(url: string, body: object = {}): Observable<T> {
    return this.http.post<T>(url, body);
  }

  put<T>(url: string, body: object): Observable<T> {
    return this.http.put<T>(url, body);
  }
}
