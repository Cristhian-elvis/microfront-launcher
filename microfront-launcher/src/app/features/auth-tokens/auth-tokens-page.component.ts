import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { MenuItem } from 'primeng/api';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { Button } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { finalize } from 'rxjs';

import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { getHttpErrorMessage } from '../../core/http-error.util';
import type { Project } from '../../core/launcher.models';
import { AuthService, type StoredAuthToken } from '../../core/services/auth.service';
import { projectDisplayName } from '../../shared/utils/project-display-name.util';
import { AuthTokenDialogComponent } from '../shell-detail/components/auth-token-dialog.component';

type TokenStatus = 'active' | 'expiring' | 'expired' | 'unknown';

@Component({
  selector: 'app-auth-tokens-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthTokenDialogComponent,
    BreadcrumbModule,
    Button,
    DatePipe,
    PrimeTemplate,
    RouterLink,
    TableModule,
    Tag,
    Tooltip,
  ],
  templateUrl: './auth-tokens-page.component.html',
  styleUrl: './auth-tokens-page.component.css',
})
export class AuthTokensPageComponent {
  private readonly auth = inject(AuthService);
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);

  readonly projects = this.bootstrap.projects;
  readonly tokens = signal<StoredAuthToken[]>([]);
  readonly loading = signal(false);
  readonly tokenProject = signal<Project | null>(null);
  readonly tokenProfileId = signal<number | null>(null);
  readonly copiedTokenId = signal<number | null>(null);
  readonly activeTokens = computed(
    () => this.tokens().filter((token) => this.status(token) !== 'expired').length,
  );
  readonly breadCrumbItems: MenuItem[] = [{ label: 'Tokens de acceso' }];

  constructor() {
    this.loadTokens();
  }

  loadTokens(): void {
    this.loading.set(true);
    this.auth
      .listStoredTokens()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (tokens) => this.tokens.set(tokens),
        error: (error: unknown) => this.notifyError(error),
      });
  }

  tokenForProject(project: Project): StoredAuthToken | null {
    return this.tokens().find((token) => token.webapp === project.configFolder) ?? null;
  }

  openTokenGeneration(project: Project): void {
    if (!project.configFolder) {
      this.messages.add({
        severity: 'error',
        summary: 'Webapp no disponible',
        detail: 'El proyecto seleccionado no tiene una webapp configurada.',
      });
      return;
    }

    const token = this.tokenForProject(project);
    this.tokenProfileId.set(token?.userProfileId ?? null);
    this.tokenProject.set(project);
  }

  closeTokenDialog(): void {
    this.tokenProject.set(null);
    this.tokenProfileId.set(null);
    this.loadTokens();
  }

  displayProjectName(project: Project): string {
    return projectDisplayName(project.name);
  }

  async copyToken(token: StoredAuthToken): Promise<void> {
    try {
      await navigator.clipboard.writeText(token.accessToken);
      this.copiedTokenId.set(token.id);
      this.messages.add({
        severity: 'success',
        summary: 'Token copiado',
        detail: 'El token de acceso está listo para pegarlo en tu aplicación local.',
      });
    } catch {
      this.messages.add({
        severity: 'error',
        summary: 'No se pudo copiar',
        detail: 'El navegador no permitió acceder al portapapeles.',
      });
    }
  }

  status(token: StoredAuthToken): TokenStatus {
    const expiresAt = this.expirationDate(token);
    if (!expiresAt) return 'unknown';

    const remainingMs = expiresAt.getTime() - Date.now();
    if (remainingMs <= 0) return 'expired';
    if (remainingMs <= 5 * 60 * 1000) return 'expiring';
    return 'active';
  }

  expirationDate(token: StoredAuthToken): Date | null {
    const payload = this.decodeJwtPayload(token.accessToken);
    const expiration = Number(payload?.['exp']);
    if (!Number.isFinite(expiration) || expiration <= 0) return null;

    return new Date(expiration * 1000);
  }

  statusLabel(token: StoredAuthToken): string {
    const labels: Record<TokenStatus, string> = {
      active: 'Vigente',
      expiring: 'Expira pronto',
      expired: 'Expirado',
      unknown: 'Sin expiración',
    };
    return labels[this.status(token)];
  }

  statusSeverity(token: StoredAuthToken): 'success' | 'warn' | 'danger' | 'info' {
    const severities: Record<TokenStatus, 'success' | 'warn' | 'danger' | 'info'> = {
      active: 'success',
      expiring: 'warn',
      expired: 'danger',
      unknown: 'info',
    };
    return severities[this.status(token)];
  }

  private decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const encodedPayload = token.split('.')[1];
      if (!encodedPayload) return null;

      const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(
        normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
        '=',
      );
      return JSON.parse(atob(paddedPayload)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: getHttpErrorMessage(error),
    });
  }
}
