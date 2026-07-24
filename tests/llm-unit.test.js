require('./_stub-backend');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseDiffBlocks, applyDiffs } = require('../lib/llm');

test('parseDiffBlocks extracts SEARCH/REPLACE pairs', () => {
  const content = `<<<<<<< SEARCH
old text
=======
new text
>>>>>>> REPLACE`;
  const blocks = parseDiffBlocks(content);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].search, 'old text');
  assert.equal(blocks[0].replace, 'new text');
});

test('parseDiffBlocks handles multiple blocks', () => {
  const content = `<<<<<<< SEARCH
a
=======
b
>>>>>>> REPLACE
<<<<<<< SEARCH
c
=======
d
>>>>>>> REPLACE`;
  const blocks = parseDiffBlocks(content);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].search, 'c');
});

test('parseDiffBlocks returns [] for empty/invalid input', () => {
  assert.deepEqual(parseDiffBlocks(''), []);
  assert.deepEqual(parseDiffBlocks('no markers here'), []);
  assert.deepEqual(parseDiffBlocks(null), []);
});

test('applyDiffs replaces matched text', () => {
  const result = applyDiffs('hello world', [{ search: 'world', replace: 'there' }]);
  assert.equal(result, 'hello there');
});

test('applyDiffs handles multiple non-overlapping diffs', () => {
  const result = applyDiffs('a b c', [
    { search: 'a', replace: 'x' },
    { search: 'c', replace: 'z' },
  ]);
  assert.equal(result, 'x b z');
});

test('applyDiffs throws DIFF_MATCH_FAILED when search not found', () => {
  assert.throws(
    () => applyDiffs('hello', [{ search: 'missing', replace: 'x' }]),
    (err) => err.code === 'DIFF_MATCH_FAILED',
  );
});

test('applyDiffs throws DIFF_OVERLAP on overlapping blocks', () => {
  // After replacing 'abcd' with 'XX' (range [0,2]), a second block whose match
  // lands inside that range is detected as an overlap.
  assert.throws(
    () => applyDiffs('abcdef', [
      { search: 'abcd', replace: 'XX' },
      { search: 'X', replace: 'Y' },
    ]),
    (err) => err.code === 'DIFF_OVERLAP',
  );
});

test('applyDiffs coerces non-string input to string', () => {
  const result = applyDiffs(123, [{ search: '1', replace: '9' }]);
  assert.equal(result, '923');
});
