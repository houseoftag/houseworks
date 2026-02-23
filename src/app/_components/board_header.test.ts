import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BoardHeader } from './board_header';

test('BoardHeader shows Delete when onDeleteBoard is provided', () => {
  const html = renderToStaticMarkup(
    React.createElement(BoardHeader, {
      boardName: 'Test Board',
      memberCount: 3,
      onDeleteBoard: () => undefined,
    }),
  );

  assert.match(html, />Delete</);
});

test('BoardHeader hides Delete when onDeleteBoard is not provided', () => {
  const html = renderToStaticMarkup(
    React.createElement(BoardHeader, { boardName: 'Test Board', memberCount: 3 }),
  );

  assert.doesNotMatch(html, />Delete</);
});
