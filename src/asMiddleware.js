'use strict'

module.exports = function asMiddleware (engine) {
  return async function engineAsMiddleware (req, res, next, end) {
    // engine._runMiddlewareDown(req, res)
    //   .then(({ isComplete, returnHandlers }) => {

    //   })
    const { isComplete, returnHandlers } = await engine._runMiddlewareDown(req, res)

    let err = null

    if (isComplete) {
      return runReturnHandlers()
        .catch((_err) => {
          err = _err
        })
        .finally(() => {
          end(err)
        })
    }

    return next(async (cb) => {
      await runReturnHandlers()
      cb()
    })

    async function runReturnHandlers () {
      for (const handler of returnHandlers) {
        await new Promise((resolve) => handler(resolve))
      }
    }
  }
}
