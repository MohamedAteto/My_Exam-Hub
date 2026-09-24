import { parseToken, getUserIdFromToken } from './src/utils/token.js';

// Helper: build a JWT-shaped token with URL-safe base64, padding stripped (the bug scenario)
function makeToken(payload) {
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.${b64url({ sig: 'x' })}`;
}

let pass = 0, fail = 0;
const assert = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('FAIL:', msg); } };

// 1. URL-safe base64 without padding — the exact pattern that broke atob(token.split('.')[1])
const t1 = makeToken({ AccountId: 42, email: 'a@b.c' });
const p1 = parseToken(t1);
assert(p1 && p1.AccountId === 42, 'parses URL-safe base64 without padding');
assert(getUserIdFromToken(t1) === 42, 'getUserIdFromToken finds AccountId');

// 2. Payload containing chars that map to - and _ in base64url
const t2 = makeToken({ AccountId: '???///+++', sub: 's' });
assert(parseToken(t2)?.AccountId === '???///+++', 'handles -/_ translation round-trip');
assert(getUserIdFromToken(t2) === '???///+++', 'claim chain still resolves after translation');

// 3. All known claim names
assert(getUserIdFromToken(makeToken({ accountId: '7' })) === '7', 'accountId claim');
assert(getUserIdFromToken(makeToken({ sub: 'sub-1' })) === 'sub-1', 'sub claim');
assert(getUserIdFromToken(makeToken({ id: 'id-1' })) === 'id-1', 'id claim');
assert(getUserIdFromToken(makeToken({ nameid: 'nid' })) === 'nameid claim');
assert(getUserIdFromToken(makeToken({ userId: 'uid' })) === 'uid', 'userId claim');

// 4. Standard padded base64 payload also still works
const t4 = `aaa.${Buffer.from(JSON.stringify({ sub: 'padded' })).toString('base64')}.bbb`;
assert(parseToken(t4)?.sub === 'padded', 'parses standard padded base64');

// 5. Failure modes must return null (never throw)
assert(parseToken(null) === null, 'null token -> null');
assert(parseToken(undefined) === null, 'undefined token -> null');
assert(parseToken('') === null, 'empty token -> null');
assert(parseToken('not-a-jwt') === null, 'non-JWT string -> null');
assert(parseToken('a.b') === null, 'two-part token -> null');
assert(parseToken('a.%%%invalid.c') === null, 'invalid base64 payload -> null');
assert(parseToken(12345) === null, 'non-string token -> null');
assert(getUserIdFromToken('garbage') === null, 'getUserIdFromToken garbage -> null');
assert(getUserIdFromToken(makeToken({ email: 'x' })) === null, 'no id claims -> null');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
