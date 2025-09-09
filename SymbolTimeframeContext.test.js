// deno-lint-ignore-file
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import assert from 'node:assert';
import { SymbolTimeframeProvider, useSymbolTimeframe } from './SymbolTimeframeContext.js';

let getContext;
function TestComponent() {
  const ctx = useSymbolTimeframe();
  getContext = () => ctx;
  return null;
}

TestRenderer.create(
  React.createElement(SymbolTimeframeProvider, null,
    React.createElement(TestComponent, null)
  )
);

let ctx = getContext();
assert.strictEqual(ctx.symbol, 'XAUUSD');
assert.strictEqual(ctx.timeframe, '15m');

await act(async () => {
  ctx.setSymbol('EURUSD');
  ctx.setTimeframe('1h');
});

ctx = getContext();
assert.strictEqual(ctx.symbol, 'EURUSD');
assert.strictEqual(ctx.timeframe, '1h');

console.log('SymbolTimeframeContext tests passed');
