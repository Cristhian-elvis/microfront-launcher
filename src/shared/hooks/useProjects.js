import { useContext } from 'react';
import { ProjectsContext } from '../context/ProjectsContext.jsx';

export function useProjects() {
  const context = useContext(ProjectsContext);

  if (!context) {
    throw new Error('useProjects debe usarse dentro de ProjectsProvider');
  }

  return {
    projects: context.projects,
    loading: context.loading,
    refreshProjects: context.refreshProjects,
    replaceProject: context.replaceProject,
    updateProject: context.updateProject,
  };
}
