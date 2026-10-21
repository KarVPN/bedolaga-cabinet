import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextKarvpnVersion } from './karvpn-version.mjs';

test('first KarVPN release keeps the exact adopted upstream patch', () => {
  assert.equal(nextKarvpnVersion('1.80.1', '1.80.1'), '1.80.1-karvpn.1');
});
test('ordinary fixes and features use the same independent revision counter', () => {
  assert.equal(nextKarvpnVersion('1.80.1', '1.80.1-karvpn.1'), '1.80.1-karvpn.2');
  assert.equal(nextKarvpnVersion('1.80.1', '1.80.1-karvpn.9'), '1.80.1-karvpn.10');
});
test('repeated runs before merging the release PR propose the same version', () => {
  for (let i = 0; i < 3; i++)
    assert.equal(nextKarvpnVersion('1.80.1', '1.80.1-karvpn.1'), '1.80.1-karvpn.2');
});
test('adopting a new original release resets only the KarVPN revision', () => {
  assert.equal(nextKarvpnVersion('1.81.2', '1.80.1-karvpn.12'), '1.81.2-karvpn.1');
});
test('decimal version parts compare numerically', () => {
  assert.equal(nextKarvpnVersion('1.100.0', '1.99.9-karvpn.20'), '1.100.0-karvpn.1');
});
test('a mistaken upstream downgrade fails instead of producing a release', () => {
  assert.throws(() => nextKarvpnVersion('1.79.9', '1.80.1-karvpn.1'), /downgrade/);
});
test('invalid or foreign version formats fail', () => {
  for (const value of ['1.80.1.1', '1.80.1-beta.1', '1.80.1-karvpn.0', '1.80.1\nversion=bad']) {
    assert.throws(() => nextKarvpnVersion('1.80.1', value), /previous/);
  }
  assert.throws(() => nextKarvpnVersion('1.80.1\n', '1.80.1'), /upstream/);
});
