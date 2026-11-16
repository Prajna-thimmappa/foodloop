import test from 'node:test';
import assert from 'node:assert/strict';

import { VALID_ROLES, isValidRole } from '../src/roles.js';

test('valid roles are the supported app roles and admin is accepted', () => {
  assert.deepEqual(VALID_ROLES, ['donor', 'ngo', 'volunteer', 'admin']);
  assert.equal(isValidRole('donor'), true);
  assert.equal(isValidRole('ngo'), true);
  assert.equal(isValidRole('volunteer'), true);
  assert.equal(isValidRole('admin'), true);
  assert.equal(isValidRole('unknown-role'), false);
});
