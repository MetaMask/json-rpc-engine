/* eslint-env mocha */
'use strict'

const assert = require('assert')
const RpcEngine = require('../src/index.js')

describe('promise-returning tests', function () {
  it('basic middleware test', async function () {
    let engine = new RpcEngine()

    engine.push(function (req, res, next, end) {
      res.result = 42
      end()
    })

    let payload = { id: 1, jsonrpc: '2.0', method: 'hello' }

    try {
       const res = await engine.handle(payload);
       assert(res, 'has res')
       assert.equal(res.result, 42, 'has expected result')
       return res
    } catch (err) {
       assert.ifError(err, 'did not error')
    }
  })
})
