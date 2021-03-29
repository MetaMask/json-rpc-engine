/* eslint-env mocha */
'use strict';

const { strict: assert } = require('assert');
const { stub } = require('sinon');
const { JsonRpcEngine } = require('../dist');

describe('JsonRpcEngine', function () {
  it('handle: throws on truthy, non-function callback', function () {
    const engine = new JsonRpcEngine();
    assert.throws(
      () => engine.handle({}, true),
      { message: '"callback" must be a function if provided.' },
      'should throw expected error',
    );
  });

  it('handle: returns error for invalid request parameter', async function () {
    const engine = new JsonRpcEngine();
    let response = await engine.handle(null);
    assert.equal(response.error.code, -32600, 'should have expected error');
    assert.equal(response.result, undefined, 'should have no results');

    response = await engine.handle(true);
    assert.equal(response.error.code, -32600, 'should have expected error');
    assert.equal(response.result, undefined, 'should have no results');
  });

  it('handle: returns error for invalid request method', async function () {
    const engine = new JsonRpcEngine();
    let response = await engine.handle({ method: null });
    assert.equal(response.error.code, -32600, 'should have expected error');
    assert.equal(response.result, undefined, 'should have no results');

    response = await engine.handle({ method: true });
    assert.equal(response.error.code, -32600, 'should have expected error');
    assert.equal(response.result, undefined, 'should have no results');
  });

  it('handle: basic middleware test 1', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, end) {
      res.result = 42;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'did not error');
      assert.ok(res, 'has res');
      assert.equal(res.result, 42, 'has expected result');
      done();
    });
  });

  it('handle: basic middleware test 2', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (req, res, end) {
      req.method = 'banana';
      res.result = 42;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'did not error');
      assert.ok(res, 'has res');
      assert.equal(res.result, 42, 'has expected result');
      assert.equal(payload.method, 'hello', 'original request object is not mutated by middleware');
      done();
    });
  });

  it('handle (async): basic middleware test', async function () {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, end) {
      res.result = 42;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    const res = await engine.handle(payload);
    assert.ok(res, 'has res');
    assert.equal(res.result, 42, 'has expected result');
  });

  it('allow null result', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, end) {
      res.result = null;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'did not error');
      assert.ok(res, 'has res');
      assert.equal(res.result, null, 'has expected result');
      done();
    });
  });

  it('interacting middleware test', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (req, _res, _end) {
      req.resultShouldBe = 42;
    });

    engine.push(function (req, res, end) {
      res.result = req.resultShouldBe;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'did not error');
      assert.ok(res, 'has res');
      assert.equal(res.result, 42, 'has expected result');
      done();
    });
  });

  it('middleware ending request before all middlewares applied', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, end) {
      res.result = 42;
      end();
    });

    engine.push(function (_req, _res, _end) {
      assert.fail('should not have called second middleware');
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'did not error');
      assert.ok(res, 'has res');
      assert.equal(res.result, 42, 'has expected result');
      done();
    });
  });

  it('erroring middleware test: end(error)', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, _res, end) {
      end(new Error('no bueno'));
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ok(err, 'did error');
      assert.ok(res, 'does have response');
      assert.ok(res.error, 'does have error on response');
      assert.ok(!res.result, 'does not have result on response');
      done();
    });
  });

  it('erroring middleware test: res.error -> return', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, _end) {
      res.error = new Error('no bueno');
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ok(err, 'did error');
      assert.ok(res, 'does have response');
      assert.ok(res.error, 'does have error on response');
      assert.ok(!res.result, 'does not have result on response');
      done();
    });
  });

  it('erroring middleware test: res.error -> end()', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, end) {
      res.error = new Error('no bueno');
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ok(err, 'did error');
      assert.ok(res, 'does have response');
      assert.ok(res.error, 'does have error on response');
      assert.ok(!res.result, 'does not have result on response');
      done();
    });
  });

  it('erroring middleware test: returning truthy non-function', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, _res, _end) {
      return true;
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ok(err, 'should error');
      assert.ok(res, 'should have response');
      assert.ok(res.error, 'should have error on response');
      assert.equal(res.error.code, -32603, 'should have expected error');
      assert.ok(
        res.error.message.startsWith('JsonRpcEngine: return handlers must be functions.'),
        'should have expected error',
      );
      assert.ok(!res.result, 'should not have result on response');
      done();
    });
  });

  it('empty middleware test', function (done) {
    const engine = new JsonRpcEngine();

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, _res) {
      assert.ok(err, 'did error');
      done();
    });
  });

  it('handle: batch payloads', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (req, res, end) {
      if (req.id === 4) {
        delete res.result;
        res.error = new Error('foobar');
        return end(res.error);
      }
      res.result = req.id;
      return end();
    });

    const payloadA = { id: 1, jsonrpc: '2.0', method: 'hello' };
    const payloadB = { id: 2, jsonrpc: '2.0', method: 'hello' };
    const payloadC = { id: 3, jsonrpc: '2.0', method: 'hello' };
    const payloadD = { id: 4, jsonrpc: '2.0', method: 'hello' };
    const payloadE = { id: 5, jsonrpc: '2.0', method: 'hello' };
    const payload = [payloadA, payloadB, payloadC, payloadD, payloadE];

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'did not error');
      assert.ok(res, 'has res');
      assert.ok(Array.isArray(res), 'res is array');
      assert.equal(res[0].result, 1, 'has expected result');
      assert.equal(res[1].result, 2, 'has expected result');
      assert.equal(res[2].result, 3, 'has expected result');
      assert.ok(!res[3].result, 'has no result');
      assert.equal(res[3].error.code, -32603, 'has expected error');
      assert.equal(res[4].result, 5, 'has expected result');
      done();
    });
  });

  it('handle: batch payloads (async signature)', async function () {
    const engine = new JsonRpcEngine();

    engine.push(function (req, res, end) {
      if (req.id === 4) {
        delete res.result;
        res.error = new Error('foobar');
        return end(res.error);
      }
      res.result = req.id;
      return end();
    });

    const payloadA = { id: 1, jsonrpc: '2.0', method: 'hello' };
    const payloadB = { id: 2, jsonrpc: '2.0', method: 'hello' };
    const payloadC = { id: 3, jsonrpc: '2.0', method: 'hello' };
    const payloadD = { id: 4, jsonrpc: '2.0', method: 'hello' };
    const payloadE = { id: 5, jsonrpc: '2.0', method: 'hello' };
    const payload = [payloadA, payloadB, payloadC, payloadD, payloadE];

    const res = await engine.handle(payload);
    assert.ok(res, 'has res');
    assert.ok(Array.isArray(res), 'res is array');
    assert.equal(res[0].result, 1, 'has expected result');
    assert.equal(res[1].result, 2, 'has expected result');
    assert.equal(res[2].result, 3, 'has expected result');
    assert.ok(!res[3].result, 'has no result');
    assert.equal(res[3].error.code, -32603, 'has expected error');
    assert.equal(res[4].result, 5, 'has expected result');
  });

  it('handle: batch payload with bad request object', async function () {
    const engine = new JsonRpcEngine();

    engine.push(function (req, res, end) {
      res.result = req.id;
      return end();
    });

    const payloadA = { id: 1, jsonrpc: '2.0', method: 'hello' };
    const payloadB = true;
    const payloadC = { id: 3, jsonrpc: '2.0', method: 'hello' };
    const payload = [payloadA, payloadB, payloadC];

    const res = await engine.handle(payload);
    assert.ok(res, 'has res');
    assert.ok(Array.isArray(res), 'res is array');
    assert.equal(res[0].result, 1, 'should have expected result');
    assert.equal(res[1].error.code, -32600, 'should have expected error');
    assert.ok(!res[1].result, 'should have no result');
    assert.equal(res[2].result, 3, 'should have expected result');
  });

  it('basic notifications', function (done) {
    const engine = new JsonRpcEngine();

    engine.once('notification', (notif) => {
      assert.equal(notif.method, 'test_notif');
      done();
    });

    const payload = { jsonrpc: '2.0', method: 'test_notif' };
    engine.emit('notification', payload);
  });

  it('return handlers test', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, _end) {
      return () => {
        res.sawReturnHandler.push(3);
      };
    });

    engine.push(function (_req, res, _end) {
      return () => {
        res.sawReturnHandler.push(2);
      };
    });

    engine.push(function (_req, res, _end) {
      return () => {
        res.sawReturnHandler = [1];
      };
    });

    engine.push(function (_req, res, end) {
      res.result = true;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, res) {
      assert.ifError(err, 'should not error');
      assert.ok(res, 'should have res');
      assert.deepStrictEqual(
        res.sawReturnHandler,
        [1, 2, 3],
        'should interact with all return handlers',
      );
      done();
    });
  });

  it('return order of events', function (done) {
    const engine = new JsonRpcEngine();

    const events = [];

    engine.push(function (_req, _res, _end) {
      events.push('1-middleware');
      return () => {
        events.push('1-return');
      };
    });

    // Async middleware function
    engine.push(async function (_req, _res, _end) {
      events.push('2-middleware');
      await delay();
      return () => {
        events.push('2-return');
      };
    });

    engine.push(function (_req, res, end) {
      events.push('3-end');
      res.result = true;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, function (err, _res) {
      assert.ifError(err, 'did not error');
      assert.equal(events[0], '1-middleware', '(event 0) was "1-middleware"');
      assert.equal(events[1], '2-middleware', '(event 1) was "2-middleware"');
      assert.equal(events[2], '3-end', '(event 2) was "3-end"');
      assert.equal(events[3], '2-return', '(event 3) was "2-return"');
      assert.equal(events[4], '1-return', '(event 4) was "1-return"');
      done();
    });
  });

  it('calls back return handler even if error', function (done) {
    const engine = new JsonRpcEngine();

    let sawReturnHandlerCalled = false;

    engine.push(function (_req, _res, _end) {
      return () => {
        sawReturnHandlerCalled = true;
      };
    });

    engine.push(function (_req, _res, end) {
      end(new Error('boom'));
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, (err, _res) => {
      assert.ok(err, 'did error');
      assert.ok(sawReturnHandlerCalled, 'saw return handler called');
      done();
    });
  });

  it('ignores return handler if ending request first', function (done) {
    const engine = new JsonRpcEngine();

    let sawReturnHandlerCalled = false;

    engine.push(function (_req, res, end) {
      res.result = 'foo';
      end();
      return () => {
        sawReturnHandlerCalled = true;
      };
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, (_err, res) => {
      assert.strictEqual(res.result, 'foo', 'has correct result');
      assert.ok(!sawReturnHandlerCalled, 'should not have called return handler');
      done();
    });
  });

  it('calls back return handler even if async middleware rejects', function (done) {
    const engine = new JsonRpcEngine();

    let sawReturnHandlerCalled = false;

    engine.push(function (_req, _res, _end) {
      return () => {
        sawReturnHandlerCalled = true;
      };
    });

    engine.push(async function (_req, _res, _end) {
      throw new Error('boom');
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, (err, _res) => {
      assert.ok(err, 'did error');
      assert.ok(sawReturnHandlerCalled, 'saw return handler called');
      done();
    });
  });

  it('handles error in return handler', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, _res, _end) {
      return () => {
        throw new Error('foo');
      };
    });

    engine.push(function (_req, res, end) {
      res.result = 42;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, (err, _res) => {
      assert.ok(err, 'did error');
      assert.equal(err.message, 'foo', 'error has expected message');
      done();
    });
  });

  it('handles error in async return handler', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, _res, _end) {
      return () => {
        throw new Error('foo');
      };
    });

    engine.push(function (_req, res, end) {
      res.result = 42;
      end();
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, (err, _res) => {
      assert.ok(err, 'did error');
      assert.equal(err.message, 'foo', 'error has expected message');
      done();
    });
  });

  it('handles failure to end request', function (done) {
    const engine = new JsonRpcEngine();

    engine.push(function (_req, res, _end) {
      res.result = 42;
    });

    const payload = { id: 1, jsonrpc: '2.0', method: 'hello' };

    engine.handle(payload, (err, res) => {
      assert.ok(err, 'should have errored');
      assert.ok(
        err.message.startsWith('JsonRpcEngine: Nothing ended request:'),
        'should have expected error message',
      );
      assert.ok(!res.result, 'should not have result');
      done();
    });
  });

  it('handles batch request processing error', function (done) {
    const engine = new JsonRpcEngine();
    stub(engine, '_promiseHandle').throws(new Error('foo'));

    engine.handle([{}], (err) => {
      assert.ok(err, 'did error');
      assert.equal(err.message, 'foo', 'error has expected message');
      done();
    });
  });

  it('handles batch request processing error (async)', async function () {
    const engine = new JsonRpcEngine();
    stub(engine, '_promiseHandle').throws(new Error('foo'));

    try {
      await engine.handle([{}]);
      assert.fail('should have errored');
    } catch (err) {
      assert.ok(err, 'did error');
      assert.equal(err.message, 'foo', 'error has expected message');
    }
  });
});

function delay(ms = 1) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}
