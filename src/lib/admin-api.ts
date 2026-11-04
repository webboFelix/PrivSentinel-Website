import { getAdministrator, getPrincipal, type Principal } from "@/lib/authorization";
import { isAdministrator, isSuperAdministrator } from "@/lib/permissions";

export async function requireAdminApi(request: Request): Promise<Principal | Response> {
  const principal = await getPrincipal(request.headers);
  if (!principal) {
    return Response.json({ error: "Authentication is required." }, { status: 401 });
  }
  if (!isAdministrator(principal.actor)) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }
  return principal;
}

export async function requireSuperAdminApi(request: Request): Promise<Principal | Response> {
  const principal = await getAdministrator(request.headers);
  if (!principal) {
    const signedIn = await getPrincipal(request.headers);
    return Response.json(
      { error: signedIn ? "Super-administrator access is required." : "Authentication is required." },
      { status: signedIn ? 403 : 401 },
    );
  }
  if (!isSuperAdministrator(principal.actor)) {
    return Response.json({ error: "Super-administrator access is required." }, { status: 403 });
  }
  return principal;
}

export function isResponse(value: Principal | Response): value is Response {
  return value instanceof Response;
}
