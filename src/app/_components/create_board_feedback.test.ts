import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCreateBoardErrorCopy,
  getCreateBoardStatusCopy,
} from './create_board_feedback';

test('create-board error copy tells user to check input and retry', () => {
  const copy = getCreateBoardErrorCopy();

  assert.match(copy, /check/i);
  assert.match(copy, /retry/i);
});

test('create-board success status copy confirms outcome', () => {
  const copy = getCreateBoardStatusCopy('success');

  assert.match(copy, /created successfully/i);
});
