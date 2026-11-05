export function isAdminBootstrapInitialized(state: {
  hasCompletionTimestamp: boolean;
  hasCompletingAccount: boolean;
  hasSuperAdministrator: boolean;
}) {
  return state.hasSuperAdministrator || (state.hasCompletionTimestamp && state.hasCompletingAccount);
}
