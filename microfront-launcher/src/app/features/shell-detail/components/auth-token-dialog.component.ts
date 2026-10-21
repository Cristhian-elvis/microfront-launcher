import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';

import { getHttpErrorMessage } from '../../../core/http-error.util';
import { AuthService, type AuthUserProfile } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-token-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Dialog, Button, Select, Textarea],
  template: `
    <p-dialog
      header="Generar token"
      [modal]="true"
      [visible]="true"
      [draggable]="false"
      [style]="{ width: 'min(600px, calc(100vw - 2rem))' }"
      (visibleChange)="closed.emit()"
    >
      <div class="grid gap-4">
        <p class="m-0 text-sm text-slate-400">
          Webapp:
          <strong>{{ webapp() }}</strong>
        </p>
        <p-select
          [options]="profiles()"
          optionLabel="descripcion"
          placeholder="Selecciona un perfil"
          [ngModel]="selected()"
          (ngModelChange)="selected.set($event)"
          [disabled]="loading()"
          [appendTo]="'body'"
        />
        @if (profiles().length === 0 && !loading()) {
          <p class="m-0 text-sm text-amber-300">
            No hay perfiles configurados para esta webapp. Créalo desde “Gestionar perfiles”.
          </p>
        }
        @if (token()) {
          <div class="grid gap-2 border-t border-slate-700 pt-4">
            <strong class="text-sm">Token de acceso</strong>
            <textarea
              pTextarea
              [ngModel]="token()"
              rows="5"
              readonly
              aria-label="Token de acceso generado"
            ></textarea>
          </div>
        }
        @if (error()) {
          <p class="m-0 text-sm text-red-300">{{ error() }}</p>
        }
      </div>
      <div class="mt-5 flex justify-end gap-2">
        <p-button label="Cerrar" styleClass="p-button-outlined" (onClick)="closed.emit()" />
        <p-button
          label="Generar token"
          icon="pi pi-key"
          [disabled]="loading() || !selected()"
          (onClick)="generateToken()"
        />
      </div>
    </p-dialog>
  `,
})
export class AuthTokenDialogComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly webapp = input.required<string>();
  readonly initialUserProfileId = input<number | null>(null);
  readonly closed = output<void>();

  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profiles = signal<AuthUserProfile[]>([]);
  readonly selected = signal<AuthUserProfile | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly token = signal('');

  ngOnInit(): void {
    this.loadProfiles();
  }

  generateToken(): void {
    const profile = this.selected();
    if (!profile) return;
    this.loading.set(true);
    this.error.set('');
    this.auth
      .generateToken(this.projectId(), profile.id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (result) => this.token.set(result.accessToken ?? ''),
        error: (error: unknown) => this.error.set(getHttpErrorMessage(error)),
      });
  }

  private loadProfiles(): void {
    this.loading.set(true);
    this.auth
      .listUserProfiles(this.webapp())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profiles) => {
          this.profiles.set(profiles);
          const initialUserProfileId = this.initialUserProfileId();
          if (initialUserProfileId) {
            this.selected.set(
              profiles.find((profile) => profile.id === initialUserProfileId) ?? null,
            );
          }
        },
        error: (error: unknown) => this.error.set(getHttpErrorMessage(error)),
      });
  }
}
