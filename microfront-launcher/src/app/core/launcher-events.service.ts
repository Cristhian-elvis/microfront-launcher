import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface LauncherEvent {
  type: 'log' | 'state';
  payload: unknown;
}

@Injectable({ providedIn: 'root' })
export class LauncherEventsService {
  private readonly zone = inject(NgZone);


  events(): Observable<LauncherEvent> {
    return new Observable<LauncherEvent>((subscriber) => {
      const source = new EventSource('/api/events');
      source.onmessage = ({ data }: MessageEvent<string>) => this.zone.run(() => {
        try {
          console.log('Launcher event received:', JSON.parse(data));
          subscriber.next(JSON.parse(data) as LauncherEvent);
        } catch {
          subscriber.error(new Error('Evento del launcher inválido.'));
        }
      });
      source.onerror = () => this.zone.run(() => subscriber.error(new Error('Se perdió la conexión con el launcher.')));
      return () => source.close();
    });
  }
}
