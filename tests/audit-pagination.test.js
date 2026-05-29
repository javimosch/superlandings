/**
 * Tests for getAuditLogPaginated NaN/invalid input handling.
 * Pure logic tests — no external deps.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Inline the fixed pagination logic for pure testing
function paginateEntries(entries, { limit = 50, offset = 0 } = {}) {
  const safeLimit = (Number.isFinite(limit) && limit > 0) ? Math.floor(limit) : 50;
  const safeOffset = (Number.isFinite(offset) && offset >= 0) ? Math.floor(offset) : 0;
  const total = entries.length;
  const paginatedEntries = entries.slice(safeOffset, safeOffset + safeLimit);
  return {
    entries: paginatedEntries,
    total,
    hasMore: safeOffset + safeLimit < total
  };
}

// Also test the route-level parseInt pattern
function parseQueryParam(raw, fallback) {
  return Math.max(fallback === 0 ? 0 : 1, parseInt(raw, 10) || fallback);
}

const ENTRIES = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}` }));

test('normal pagination returns correct slice', () => {
  const result = paginateEntries(ENTRIES, { limit: 5, offset: 0 });
  assert.equal(result.entries.length, 5);
  assert.equal(result.total, 20);
  assert.equal(result.hasMore, true);
});

test('second page', () => {
  const result = paginateEntries(ENTRIES, { limit: 5, offset: 5 });
  assert.deepEqual(result.entries, ENTRIES.slice(5, 10));
  assert.equal(result.hasMore, true);
});

test('last page sets hasMore=false', () => {
  const result = paginateEntries(ENTRIES, { limit: 5, offset: 15 });
  assert.equal(result.entries.length, 5);
  assert.equal(result.hasMore, false);
});

test('NaN limit falls back to 50 (not empty array)', () => {
  const result = paginateEntries(ENTRIES, { limit: NaN, offset: 0 });
  // Without the guard: slice(0, NaN) = slice(0, 0) = [] (bug!)
  // With the guard: uses safeLimit=50, returns all 20 entries
  assert.equal(result.entries.length, 20);
  assert.equal(result.total, 20);
});

test('NaN offset falls back to 0 (not empty array)', () => {
  const result = paginateEntries(ENTRIES, { limit: 5, offset: NaN });
  assert.equal(result.entries.length, 5);
  assert.deepEqual(result.entries, ENTRIES.slice(0, 5));
});

test('negative limit falls back to 50', () => {
  const result = paginateEntries(ENTRIES, { limit: -1, offset: 0 });
  assert.equal(result.entries.length, 20);
});

test('negative offset falls back to 0', () => {
  const result = paginateEntries(ENTRIES, { limit: 5, offset: -10 });
  assert.equal(result.entries.length, 5);
  assert.deepEqual(result.entries, ENTRIES.slice(0, 5));
});

test('empty entries returns hasMore=false', () => {
  const result = paginateEntries([], { limit: 10, offset: 0 });
  assert.equal(result.entries.length, 0);
  assert.equal(result.hasMore, false);
});

// Route-level parseInt guard
test('parseInt of non-numeric string yields NaN; || fallback prevents it', () => {
  assert.equal(parseQueryParam('abc', 50), 50);
  assert.equal(parseQueryParam('-1', 50), 1);  // Math.max(1, -1) = 1
  assert.equal(parseQueryParam('10', 50), 10);
  assert.equal(parseQueryParam(undefined, 50), 50);
});

test('parseInt of 0 offset is valid', () => {
  const offset = Math.max(0, parseInt('0', 10) || 0);
  assert.equal(offset, 0);
});
