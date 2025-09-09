import assert from 'assert';
import { mergeActions } from './chartUtils.js';

const initial = [{ type: 'hline', label: 'ENTRY', price: 100 }];
const added = mergeActions(initial, [{ type: 'hline', label: 'SL', price: 90 }]);
assert.strictEqual(added.length, 2);
assert.strictEqual(added.find(a => a.label === 'SL').price, 90);

const modified = mergeActions(added, [{ type: 'hline', label: 'ENTRY', price: 110 }]);
assert.strictEqual(modified.length, 2);
assert.strictEqual(modified.find(a => a.label === 'ENTRY').price, 110);

console.log('chartUtils tests passed');
