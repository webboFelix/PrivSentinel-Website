export type ProfileCompletion = {
  fullName: string | null | undefined;
  phoneNumber: string | null | undefined;
  gender: string | null | undefined;
  countryCode?: string | null | undefined;
} | null;

export function canDownload(profile: ProfileCompletion) {
  return Boolean(profile?.fullName?.trim() && profile.phoneNumber?.trim() && profile.gender?.trim() && profile.countryCode?.trim());
}

export function isAdministrator(user: { role?: string | null } | null | undefined) {
  return user?.role === "admin" || user?.role === "super_admin";
}

export function isSuperAdministrator(user: { role?: string | null } | null | undefined) {
  return user?.role === "super_admin";
}

export function canManageRole(
  actor: { id: string; role?: string | null },
  target: { id: string; role?: string | null },
  newRole: string,
) {
  if (actor.id === target.id) return false;
  if (isSuperAdministrator(actor)) {
    return ["user", "admin", "super_admin"].includes(newRole);
  }
  return actor.role === "admin" && target.role === "user" && ["user", "admin"].includes(newRole);
}

export function isAccountSuspended(
  account: { banned?: boolean | null; banExpires?: Date | null },
  now = Date.now(),
) {
  return account.banned === true && (!account.banExpires || account.banExpires.getTime() > now);
}
