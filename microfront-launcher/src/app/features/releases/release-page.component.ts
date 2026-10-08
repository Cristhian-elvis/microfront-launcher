import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService, PrimeTemplate } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { AppBootstrapService } from '../../core/app-bootstrap.service';
import type { Project } from '../../core/launcher.models';

type ReleaseAction = 'createTags' | 'updateWebapp' | 'push';
type ReleaseType = 'patch' | 'minor' | 'major';
type Microfront = NonNullable<Project['microfrontends']>[number];

interface ReleaseOptions {
  createTags: boolean;
  updateWebapp: boolean;
  push: boolean;
}

@Component({
  selector: 'app-release-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './release-page.component.html',
  styleUrl: './release-page.component.css',
  imports: [
    FormsModule,
    BreadcrumbModule,
    Button,
    Checkbox,
    Popover,
    PrimeTemplate,
    Select,
    TableModule,
    Tag,
  ],
})
export class ReleasePageComponent {
  private readonly bootstrap = inject(AppBootstrapService);
  private readonly messages = inject(MessageService);

  protected readonly projects = this.bootstrap.projects;
  protected readonly selectedProjectId = signal('');
  protected readonly selectedMicrofrontIds = signal<string[]>([]);
  protected readonly microfrontReleaseTypes = signal<Record<string, ReleaseType>>({});
  protected readonly webappReleaseType = signal<ReleaseType>('patch');
  protected readonly options = signal<ReleaseOptions>({
    createTags: true,
    updateWebapp: true,
    push: false,
  });
  protected readonly planVisible = signal(false);
  protected readonly breadCrumbItems = [{ label: 'Versiones' }];
  protected readonly releaseTypeOptions = [
    { label: 'Patch — corrección', value: 'patch' },
    { label: 'Minor — nueva funcionalidad', value: 'minor' },
    { label: 'Major — cambio incompatible', value: 'major' },
  ];
  protected readonly releaseTypeSelectOptions = [
    { label: 'Patch', value: 'patch' },
    { label: 'Minor', value: 'minor' },
    { label: 'Major', value: 'major' },
  ];
  protected readonly projectOptions = computed(() => this.projects().map((project) => ({
    label: project.name,
    value: project.id,
  })));
  protected readonly selectedProject = computed(() =>
    this.projects().find((project) => project.id === this.selectedProjectId()),
  );
  protected readonly microfronts = computed<Microfront[]>(() =>
    this.selectedProject()?.microfrontends ?? [],
  );
  protected readonly selectedMicrofronts = computed(() => {
    const ids = new Set(this.selectedMicrofrontIds());
    return this.microfronts().filter((microfront) => ids.has(microfront.id));
  });
  protected readonly allSelected = computed(() =>
    this.microfronts().length > 0 && this.selectedMicrofrontIds().length === this.microfronts().length,
  );
  protected readonly canGeneratePlan = computed(() =>
    Boolean(this.selectedProject() && this.selectedMicrofrontIds().length),
  );

  protected selectProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.selectedMicrofrontIds.set([]);
    this.microfrontReleaseTypes.set({});
    this.planVisible.set(false);
  }

  protected toggleMicrofront(id: string, selected: boolean): void {
    this.selectedMicrofrontIds.update((ids) =>
      selected ? [...new Set([...ids, id])] : ids.filter((value) => value !== id),
    );
    this.planVisible.set(false);
  }

  protected toggleAll(selected: boolean): void {
    this.selectedMicrofrontIds.set(selected ? this.microfronts().map((microfront) => microfront.id) : []);
    this.planVisible.set(false);
  }

  protected updateOption(action: ReleaseAction, value: boolean): void {
    this.options.update((options) => ({ ...options, [action]: value }));
    this.planVisible.set(false);
  }

  protected selectMicrofrontReleaseType(id: string, type: ReleaseType): void {
    this.microfrontReleaseTypes.update((types) => ({ ...types, [id]: type }));
    this.planVisible.set(false);
  }

  protected selectWebappReleaseType(type: ReleaseType): void {
    this.webappReleaseType.set(type);
    this.planVisible.set(false);
  }

  protected generatePlan(): void {
    if (!this.canGeneratePlan()) return;
    this.planVisible.set(true);
    this.messages.add({
      severity: 'info',
      summary: 'Plan generado',
      detail: 'La publicación aún no se ejecuta: falta conectar el endpoint de releases.',
    });
  }

  protected isSelected(microfront: Microfront): boolean {
    return this.selectedMicrofrontIds().includes(microfront.id);
  }

  protected hasOption(action: ReleaseAction): boolean {
    return this.options()[action];
  }

  protected releaseTypeFor(microfront: Microfront): ReleaseType {
    return this.microfrontReleaseTypes()[microfront.id] ?? 'patch';
  }

  protected targetVersionFor(microfront: Microfront): string {
    return this.nextVersion(microfront.version ?? '0.0.0', this.releaseTypeFor(microfront));
  }

  private nextVersion(version: string, type: ReleaseType): string {
    const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    const major = Number(match?.[1] ?? 0);
    const minor = Number(match?.[2] ?? 0);
    const patch = Number(match?.[3] ?? 0);
    if (type === 'major') return `${major + 1}.0.0`;
    if (type === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }
}
