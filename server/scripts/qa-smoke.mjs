import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';

try {
  process.loadEnvFile('../.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const apiBase = process.env.SCHOOLPASS_API_BASE ?? 'http://127.0.0.1:3001/api/v1';
const password = process.env.SEED_PASSWORD;
assert.ok(password, 'Set SEED_PASSWORD in the root .env before running the smoke test.');

async function call(path, { token, expectedStatus = 200, ...requestOptions } = {}) {
  const headers = new Headers(requestOptions.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (requestOptions.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${apiBase}${path}`, { ...requestOptions, headers });
  assert.equal(
    response.status,
    expectedStatus,
    `${requestOptions.method ?? 'GET'} ${path}: expected HTTP ${expectedStatus}, received ${response.status}`,
  );
  return response.status === 404 ? undefined : response.json();
}

const parent = await call('/auth/login', {
  method: 'POST',
  expectedStatus: 200,
  body: JSON.stringify({ email: 'parent.a@example.test', password }),
});
const teacher = await call('/auth/login', {
  method: 'POST',
  expectedStatus: 200,
  body: JSON.stringify({ email: 'teacher@example.test', password }),
});
const unrelatedParent = await call('/auth/login', {
  method: 'POST',
  expectedStatus: 200,
  body: JSON.stringify({ email: 'parent.b@example.test', password }),
});
const students = await call('/students/mine', { token: parent.accessToken });
assert.ok(students.length > 0, 'Seeded Parent must have at least one child.');

const absenceDate = new Date(
  Date.now() + randomInt(1, 36_500) * 24 * 60 * 60 * 1000,
)
  .toISOString()
  .slice(0, 10);
const created = await call('/leave-requests', {
  method: 'POST',
  expectedStatus: 201,
  token: parent.accessToken,
  body: JSON.stringify({
    studentId: students[0].id,
    absenceDate,
    type: 'PERMISSION',
    reason: 'Permintaan izin fiktif untuk smoke test.',
  }),
});
assert.equal(created.status, 'PENDING');

const teacherRequests = await call('/leave-requests', {
  token: teacher.accessToken,
});
assert.ok(
  teacherRequests.some((request) => request.id === created.id),
  'Assigned Teacher must see the Parent request.',
);

await call(`/leave-requests/${created.id}/decision`, {
  method: 'PATCH',
  token: teacher.accessToken,
  body: JSON.stringify({ status: 'APPROVED' }),
});
const parentView = await call(`/leave-requests/${created.id}`, {
  token: parent.accessToken,
});
assert.equal(parentView.status, 'APPROVED');
await call(`/leave-requests/${created.id}`, {
  token: unrelatedParent.accessToken,
  expectedStatus: 404,
});

console.log('PASS Parent → Teacher → Parent flow; unrelated Parent received 404.');
console.log('The smoke test created one fictional leave request in the local database.');
