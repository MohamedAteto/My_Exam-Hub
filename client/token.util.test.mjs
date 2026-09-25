import { parseToken, getUserIdFromToken } from './src/utils/token.js';
import { describe, expect, it } from 'vitest';

// Helper: build a JWT-shaped token with URL-safe base64, padding stripped (the bug scenario)
function makeToken(payload) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${b64url({ sig: 'x' })}`;
}

describe('token utilities', () => {
  it('parses URL-safe base64 without padding and extracts the account ID', () => {
    const token = makeToken({ AccountId: 42, email: 'a@b.c' });
    expect(parseToken(token)?.AccountId).toBe(42);
    expect(getUserIdFromToken(token)).toBe(42);
  });

  it('round-trips base64url characters and resolves supported ID claims', () => {
    const token = makeToken({ AccountId: '???///+++', sub: 's' });
    expect(parseToken(token)?.AccountId).toBe('???///+++');
    expect(getUserIdFromToken(token)).toBe('???///+++');
    expect(getUserIdFromToken(makeToken({ accountId: '7' }))).toBe(7);
    expect(getUserIdFromToken(makeToken({ sub: 'sub-1' }))).toBe('sub-1');
    expect(getUserIdFromToken(makeToken({ id: 'id-1' }))).toBe('id-1');
    expect(getUserIdFromToken(makeToken({ nameid: 'nid' }))).toBe('nid');
    expect(getUserIdFromToken(makeToken({ userId: 'uid' }))).toBe('uid');
  });

  it('parses standard padded base64 payloads', () => {
    const token = `aaa.${Buffer.from(JSON.stringify({ sub: 'padded' })).toString('base64')}.bbb`;
    expect(parseToken(token)?.sub).toBe('padded');
  });

  it('returns null for invalid tokens without throwing', () => {
    for (const token of [null, undefined, '', 'not-a-jwt', 'a.b', 'a.%%%invalid.c', 12345, 'garbage']) {
      expect(parseToken(token)).toBeNull();
      expect(getUserIdFromToken(token)).toBeNull();
    }
    expect(getUserIdFromToken(makeToken({ email: 'x' }))).toBeNull();
  });
});
