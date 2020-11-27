import { getUniqueId } from './getUniqueId';
import { JsonRpcMiddleware } from './JsonRpcEngine';

export function createIdRemapMiddleware(): JsonRpcMiddleware<unknown, unknown> {
  return (req, res, next, _end) => {
    const originalId = req.id;
    const newId = getUniqueId();
    res.id = newId;
    next((done) => {
      res.id = originalId;
      done();
    });
  };
}
