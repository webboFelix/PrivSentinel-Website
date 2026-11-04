export type ProfileCompletion = {
  fullName: string | null | undefined;
  phoneNumber: string | null | undefined;
  gender: string | null | undefined;
} | null;

export function canDownload(profile: ProfileCompletion) {
  return Boolean(profile?.fullName?.trim() && profile.phoneNumber?.trim() && profile.gender?.trim());
}

export function isAdministrator(user: { role?: string | null } | null | undefined) {
  return user?.role === "admin";
}
