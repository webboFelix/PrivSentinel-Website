import { create } from "zustand";

type UiState = {
  mobileNavigationOpen: boolean;
  profileMenuOpen: boolean;
  setMobileNavigationOpen: (open: boolean) => void;
  setProfileMenuOpen: (open: boolean) => void;
  closeNavigation: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  mobileNavigationOpen: false,
  profileMenuOpen: false,
  setMobileNavigationOpen: (mobileNavigationOpen) => set({ mobileNavigationOpen }),
  setProfileMenuOpen: (profileMenuOpen) => set({ profileMenuOpen }),
  closeNavigation: () => set({ mobileNavigationOpen: false, profileMenuOpen: false }),
}));
