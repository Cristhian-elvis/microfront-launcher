import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { MenuItem } from 'primeng/api';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { Textarea } from 'primeng/textarea';
import { finalize } from 'rxjs';

import { AppBootstrapService } from '../../core/app-bootstrap.service';
import { getHttpErrorMessage } from '../../core/http-error.util';
import type { Project } from '../../core/launcher.models';
import { AuthService, type AuthUserProfile } from '../../core/services/auth.service';
import { projectDisplayName } from '../../shared/utils/project-display-name.util';

interface ProfileForm {
  descripcion: string;
  cdUsuario: string;
  profileText: string;
}

@Component({
  selector: 'app-auth-profiles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BreadcrumbModule,
    Button,
    Dialog,
    FormsModule,
    InputText,
    PrimeTemplate,
    TableModule,
    Textarea,
  ],
  templateUrl: './auth-profiles-page.component.html',
  styleUrl: './auth-profiles-page.component.css',
})
export class AuthProfilesPageComponent {
  private readonly auth = inject(AuthService);
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly messages = inject(MessageService);

  readonly projects = this.bootstrap.projects;
  readonly selectedProject = signal<Project | null>(null);
  readonly profiles = signal<AuthUserProfile[]>([]);
  readonly loading = signal(false);
  readonly editingProfile = signal<AuthUserProfile | null>(null);
  readonly formVisible = signal(false);
  readonly form = signal<ProfileForm>(this.emptyForm());
  readonly breadCrumbItems: MenuItem[] = [
    { label: 'Tokens', routerLink: '/tokens' },
    { label: 'Gestionar perfiles' },
  ];

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const projectId = params.get('projectId');
      const project = this.projects().find((item) => item.id === projectId) ?? null;
      this.selectProject(project);
    });
  }

  displaySelectedProjectName(): string {
    return projectDisplayName(this.selectedProject()?.name);
  }

  private selectProject(project: Project | null): void {
    this.selectedProject.set(project);
    this.profiles.set([]);
    if (project?.configFolder) this.loadProfiles(project.configFolder);
  }

  openCreateForm(): void {
    if (!this.selectedProject()?.configFolder) return;
    this.editingProfile.set(null);
    this.form.set(this.emptyForm());
    this.formVisible.set(true);
  }

  openEditForm(profile: AuthUserProfile): void {
    this.editingProfile.set(profile);
    this.form.set({
      descripcion: profile.descripcion,
      cdUsuario: profile.cdUsuario,
      profileText: profile.profiles.join(', '),
    });
    this.formVisible.set(true);
  }

  saveProfile(): void {
    const project = this.selectedProject();
    if (!project?.configFolder) return;

    const form = this.form();
    const profileInput = {
      webapp: project.configFolder,
      descripcion: form.descripcion,
      cdUsuario: form.cdUsuario,
      profiles: form.profileText
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };
    const profile = this.editingProfile();
    this.loading.set(true);

    const request = profile
      ? this.auth.updateUserProfile(profile.id, profileInput)
      : this.auth.createUserProfile(profileInput);

    request
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (savedProfile) => {
          this.profiles.update((profiles) =>
            profile
              ? profiles.map((item) => (item.id === savedProfile.id ? savedProfile : item))
              : [...profiles, savedProfile],
          );
          this.formVisible.set(false);
          this.messages.add({
            severity: 'success',
            summary: profile ? 'Perfil actualizado' : 'Perfil creado',
            detail: 'Los datos del perfil se guardaron correctamente.',
          });
        },
        error: (error: unknown) => this.notifyError(error),
      });
  }

  removeProfile(profile: AuthUserProfile): void {
    this.loading.set(true);
    this.auth
      .deleteUserProfile(profile.id)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.profiles.update((profiles) => profiles.filter((item) => item.id !== profile.id));
          this.messages.add({
            severity: 'success',
            summary: 'Perfil eliminado',
            detail: 'El perfil se eliminó de este equipo.',
          });
        },
        error: (error: unknown) => this.notifyError(error),
      });
  }

  updateForm(field: keyof ProfileForm, value: string): void {
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  private loadProfiles(webapp: string): void {
    this.loading.set(true);
    this.auth
      .listUserProfiles(webapp)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (profiles) => this.profiles.set(profiles),
        error: (error: unknown) => this.notifyError(error),
      });
  }

  private emptyForm(): ProfileForm {
    return { descripcion: '', cdUsuario: '', profileText: '' };
  }

  private notifyError(error: unknown): void {
    this.messages.add({
      severity: 'error',
      summary: 'Error',
      detail: getHttpErrorMessage(error),
    });
  }
}
