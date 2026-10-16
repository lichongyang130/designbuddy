import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Connector, Expert, Skill } from "./models/workspace";

interface WorkspaceState {
  experts: Expert[];
  skills: Skill[];
  connectors: Connector[];
  assets: WorkspaceAsset[];
  setExperts: (items: Expert[]) => void;
  upsertExpert: (item: Expert) => void;
  setSkills: (items: Skill[]) => void;
  upsertSkill: (item: Skill) => void;
  setConnectors: (items: Connector[]) => void;
  upsertConnector: (item: Connector) => void;
  addAsset: (item: WorkspaceAsset) => void;
  removeAsset: (id: string, type: WorkspaceAsset["type"]) => void;
}

export interface WorkspaceAsset { id: string; name: string; type: "systems" | "templates" | "plugins" | "skills"; addedAt: string }

export const useWorkspaceStore = create<WorkspaceState>()(persist((set) => ({
  experts: [],
  skills: [],
  connectors: [],
  assets: [],
  setExperts: (experts) => set({ experts }),
  upsertExpert: (expert) => set((state) => ({ experts: [...state.experts.filter((item) => item.id !== expert.id), expert] })),
  setSkills: (skills) => set({ skills }),
  upsertSkill: (skill) => set((state) => ({ skills: [...state.skills.filter((item) => item.id !== skill.id), skill] })),
  setConnectors: (connectors) => set({ connectors }),
  upsertConnector: (connector) => set((state) => ({ connectors: [...state.connectors.filter((item) => item.id !== connector.id), connector] })),
  addAsset: (asset) => set((state) => ({ assets: [...state.assets.filter((item) => item.id !== asset.id || item.type !== asset.type), asset] })),
  removeAsset: (id, type) => set((state) => ({ assets: state.assets.filter((item) => item.id !== id || item.type !== type) })),
}), {
  name: "designbuddy.workspace.v1",
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ experts: state.experts, skills: state.skills, connectors: state.connectors, assets: state.assets }),
}));

export const workspaceStore = useWorkspaceStore.getState();
