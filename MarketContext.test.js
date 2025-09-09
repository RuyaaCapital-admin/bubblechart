import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { MarketProvider, useMarket } from './MarketContext.js';

test('MarketProvider shares symbol and timeframe with setters', () => {
  let ctx;
  function Consumer() {
    ctx = useMarket();
    return null;
  }
  create(
    React.createElement(
      MarketProvider,
      { initialSymbol: 'EURUSD', initialTimeframe: '1h' },
      React.createElement(Consumer)
    )
  );
  assert.equal(ctx.symbol, 'EURUSD');
  assert.equal(ctx.timeframe, '1h');
  act(() => ctx.setSymbol('BTCUSD'));
  assert.equal(ctx.symbol, 'BTCUSD');
  act(() => ctx.setTimeframe('15m'));
  assert.equal(ctx.timeframe, '15m');
});
