import test from 'node:test';
import assert from 'node:assert/strict';

import { REGISTRATION_ROLES, VALID_ROLES, isRegistrationRole, isValidRole, normalizeRole } from '../src/roles.js';

test('valid roles are the supported app roles and admin is accepted', () => {
  assert.deepEqual(VALID_ROLES, ['donor', 'ngo', 'volunteer', 'admin']);
  assert.equal(isValidRole('donor'), true);
  assert.equal(isValidRole('ngo'), true);
  assert.equal(isValidRole('volunteer'), true);
  assert.equal(isValidRole('admin'), true);
  assert.equal(isValidRole(' ADMIN '), true);
  assert.equal(isValidRole('unknown-role'), false);
  assert.equal(normalizeRole('  VOLUNTEER  '), 'volunteer');
});

test('public registration excludes the administrator role', () => {
  assert.deepEqual(REGISTRATION_ROLES, ['donor', 'ngo', 'volunteer']);
  assert.equal(isRegistrationRole('  DONOR '), true);
  assert.equal(isRegistrationRole('admin'), false);
});
