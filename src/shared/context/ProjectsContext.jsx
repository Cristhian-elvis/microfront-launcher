import { createContext, useReducer, useEffect, useRef } from 'react';
import { api } from '../../lib/api.js';

export const ProjectsContext = createContext(null);

const projectsReducer = (state, action) => {
  switch (action.type) {
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload, loading: false };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

export function ProjectsProvider({ children }) {
  const [state, dispatch] = useReducer(projectsReducer, {
    projects: [],
    loading: true,
  });

  const hasInitialized = useRef(false);
  const hasLoadedProjectsOnce = useRef(false);

  useEffect(() => {
    if (hasInitialized.current || hasLoadedProjectsOnce.current) return;
    hasInitialized.current = true;

    (async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        const projects = await api('/api/projects');
        hasLoadedProjectsOnce.current = true;
        dispatch({ type: 'SET_PROJECTS', payload: projects });
      } catch (e) {
        console.error('Error loading projects:', e.message);
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      hasInitialized.current = false;
    };
  }, []);

  const refreshProjects = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const projects = await api('/api/projects');
      dispatch({ type: 'SET_PROJECTS', payload: projects });
      return projects;
    } catch (e) {
      dispatch({ type: 'SET_LOADING', payload: false });
      throw e;
    }
  };

  const replaceProject = (project) => {
    dispatch({ type: 'UPDATE_PROJECT', payload: project });
  };

  const updateProject = async (projectId, refresh = true) => {
    try {
      const updated = await api(
        `/api/projects/${encodeURIComponent(projectId)}`
      );
      replaceProject(updated);
      return updated;
    } catch (e) {
      if (refresh) {
        await refreshProjects();
      }
      throw e;
    }
  };

  const value = {
    projects: state.projects,
    loading: state.loading,
    refreshProjects,
    replaceProject,
    updateProject,
  };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}
