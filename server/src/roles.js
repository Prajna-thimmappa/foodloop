export const VALID_ROLES = ['donor', 'ngo', 'volunteer', 'admin'];
export const REGISTRATION_ROLES = ['donor', 'ngo', 'volunteer'];

export function normalizeRole(role) {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function isValidRole(role) {
  const normalizedRole = normalizeRole(role);
  return VALID_ROLES.includes(normalizedRole);
}

export function isRegistrationRole(role) {
  const normalizedRole = normalizeRole(role);
  return REGISTRATION_ROLES.includes(normalizedRole);
}
