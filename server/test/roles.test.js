import test from 'node:test';
import assert from 'node:assert/strict';

import { VALID_ROLES, isValidRole } from '../src/roles.js';

test('valid roles include volunteer and are used for donor/ngo flows', () => {
  assert.ok(VALID_ROLES.includes('volunteer'));
  assert.equal(isValidRole('donor'), true);
  assert.equal(isValidRole('ngo'), true);
  assert.equal(isValidRole('volunteer'), true);
  assert.equal(isValidRole('admin'), true);
  assert.equal(isValidRole('unknown-role'), false);
});
