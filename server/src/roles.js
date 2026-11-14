export const VALID_ROLES = ['donor', 'ngo', 'volunteer', 'admin'];

export function isValidRole(role) {
  return VALID_ROLES.includes(role);
}
