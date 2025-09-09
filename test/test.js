import assert from 'node:assert';
import { getRealtimePrice } from '../getRealtimePrice.js';
import { getTechnicalIndicator } from '../getTechnicalIndicator.js';

async function runTests() {
  // getRealtimePrice parameter validation
  await assert.rejects(() => getRealtimePrice(''), /code must be a non-empty string/);

  // getRealtimePrice success
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ close: 100, timestamp: 123, change: 1, change_p: 2 })
  });
  const price = await getRealtimePrice('AAPL.US');
  assert.deepStrictEqual(price, {
    ticker: 'AAPL.US',
    price: 100,
    timestamp: 123,
    change: 1,
    change_percent: 2
  });

  // getRealtimePrice fetch error
  global.fetch = async () => { throw new Error('network'); };
  await assert.rejects(() => getRealtimePrice('AAPL.US'), /network/);

  // getTechnicalIndicator parameter validation
  await assert.rejects(() => getTechnicalIndicator('AAPL.US', 'rsi', 0), /period must be a positive integer/);

  // getTechnicalIndicator success
  global.fetch = async () => ({
    ok: true,
    json: async () => ([{ date: '2024-01-01', rsi: 55 }])
  });
  const ind = await getTechnicalIndicator('AAPL.US', 'rsi', 14);
  assert.deepStrictEqual(ind, {
    ticker: 'AAPL.US',
    date: '2024-01-01',
    value: 55
  });

  // getTechnicalIndicator fetch error
  global.fetch = async () => { throw new Error('network'); };
  await assert.rejects(() => getTechnicalIndicator('AAPL.US', 'rsi', 14), /network/);

  console.log('All tests passed');
}

runTests();
