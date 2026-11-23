export interface WorkspaceModuleVisibility {
  aiReviews: boolean;
  staff: boolean;
  inventory: boolean;
  gamesLoyalty: boolean;
}

export const DEFAULT_WORKSPACE_MODULES: WorkspaceModuleVisibility = {
  aiReviews: true,
  staff: true,
  inventory: true,
  gamesLoyalty: true,
};

function getStorageKey(businessId: string): string {
  return `vitaran_workspace_modules_${businessId.trim()}`;
}

export function loadWorkspaceModules(
  businessId: string,
): WorkspaceModuleVisibility {
  if (!businessId) return { ...DEFAULT_WORKSPACE_MODULES };
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_WORKSPACE_MODULES };
    }
    const raw = window.localStorage.getItem(getStorageKey(businessId));
    if (!raw) return { ...DEFAULT_WORKSPACE_MODULES };
    const parsed = JSON.parse(raw) as Partial<WorkspaceModuleVisibility>;
    return {
      aiReviews:
        typeof parsed.aiReviews === 'boolean' ? parsed.aiReviews : true,
      staff: typeof parsed.staff === 'boolean' ? parsed.staff : true,
      inventory:
        typeof parsed.inventory === 'boolean' ? parsed.inventory : true,
      gamesLoyalty:
        typeof parsed.gamesLoyalty === 'boolean' ? parsed.gamesLoyalty : true,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_MODULES };
  }
}

export function saveWorkspaceModules(
  businessId: string,
  modules: WorkspaceModuleVisibility,
): WorkspaceModuleVisibility {
  try {
    if (typeof window !== 'undefined' && window.localStorage && businessId) {
      window.localStorage.setItem(
        getStorageKey(businessId),
        JSON.stringify(modules),
      );
    }
  } catch {
    // ignore storage quota restrictions
  }
  return modules;
}
