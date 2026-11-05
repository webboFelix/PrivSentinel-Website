import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type NavigationDensity = "comfortable" | "compact";
type UiPreferences = {
  navigationDensity: NavigationDensity;
  toggleNavigationDensity: () => void;
};

export const useUiPreferencesStore = create<UiPreferences>()(persist(
  (set) => ({
    navigationDensity: "comfortable",
    toggleNavigationDensity: () => set((state) => ({
      navigationDensity: state.navigationDensity === "comfortable" ? "compact" : "comfortable",
    })),
  }),
  {
    name: "privsentinel-ui-preferences",
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({ navigationDensity: state.navigationDensity }),
    skipHydration: true,
  },
));

export function clearUiPreferences() {
  useUiPreferencesStore.setState({ navigationDensity: "comfortable" });
  useUiPreferencesStore.persist.clearStorage();
}
