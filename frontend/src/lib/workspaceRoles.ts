export function canAdministerWorkspace(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export function canOrganise(role: string | null | undefined) {
  return canAdministerWorkspace(role) || role === 'organiser';
}
