import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_DONE_FLAG,
  CITY_CLUES,
  availableOutcomes,
  canVerify,
  caseStage,
  chosenOutcome,
  chosenTheory,
  clueFlag,
  foundClues,
  outcomeFlag,
  theoryFlag,
} from '../../src/engine/cityCase.ts';

test('所有线索与可持久化标识均稳定唯一', () => {
  assert.equal(CITY_CLUES.length, 3);
  assert.equal(new Set(CITY_CLUES.map(c => c.id)).size, 3);
  assert.deepEqual(foundClues([clueFlag('camera'), clueFlag('receipt')]), ['receipt', 'camera']);
});

test('不足两条证据不能下判断', () => {
  assert.equal(caseStage([]), 'investigation');
  assert.equal(caseStage([clueFlag('receipt')]), 'investigation');
  assert.equal(caseStage([clueFlag('receipt'), clueFlag('camera')]), 'theory');
});

test('错误推断不会意外解锁正式核实方案', () => {
  const f = [clueFlag('receipt'), clueFlag('camera'), clueFlag('voicemail'), theoryFlag('theft')];
  assert.equal(chosenTheory(f), 'theft');
  assert.equal(canVerify(f, ['shenzhaoning', 'murongxue']), false);
  assert.deepEqual(availableOutcomes(f, ['shenzhaoning', 'murongxue']), ['publish', 'settle']);
});

test('正确推断 + 全部证据允许不依赖抽卡完成正式核实', () => {
  const f = [clueFlag('receipt'), clueFlag('camera'), clueFlag('voicemail'), theoryFlag('rescue')];
  assert.equal(canVerify(f, []), true);
  assert.deepEqual(availableOutcomes(f, []), ['publish', 'verify', 'settle']);
});

test('抽到祁宁或沈疏桐可以加速调查，但必须有对应证据', () => {
  const withReceipt = [clueFlag('receipt'), clueFlag('voicemail'), theoryFlag('rescue')];
  const withCamera = [clueFlag('camera'), clueFlag('voicemail'), theoryFlag('rescue')];
  assert.equal(canVerify(withReceipt, []), false);
  assert.equal(canVerify(withReceipt, ['shenzhaoning']), true);
  assert.equal(canVerify(withReceipt, ['murongxue']), false);
  assert.equal(canVerify(withCamera, ['murongxue']), true);
  assert.equal(canVerify(withCamera, ['shenzhaoning']), false);
});

test('完整结局已写入存档标记后仍可恢复状态', () => {
  const f = [clueFlag('receipt'), clueFlag('camera'), theoryFlag('rescue'), outcomeFlag('settle'), CASE_DONE_FLAG];
  assert.equal(chosenOutcome(f), 'settle');
  assert.equal(caseStage(f), 'ending');
});
