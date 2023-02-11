import { expectError, expectType } from 'tsd';
import type {
  Json,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from '@metamask/utils';
import { JsonRpcEngine, ValidParam } from './JsonRpcEngine';

const jsonrpc = '2.0' as const;

const notification = { jsonrpc, method: 'test_notify' };
const request: JsonRpcRequest<ValidParam> = {
  id: 1,
  jsonrpc,
  method: 'test_request',
};

// Allows constructing a notification-only engine.
const handleNotification = ({
  request: _request,
}: {
  request: JsonRpcNotification<ValidParam>;
}) => undefined;
const notificationEngine = new JsonRpcEngine({
  middleware: [handleNotification],
});
expectType<JsonRpcEngine<JsonRpcNotification<ValidParam>, Json>>(
  notificationEngine,
);

// Handles a notification without error
notificationEngine.handle(notification);

// Returns nothing.
expectType<Promise<void>>(notificationEngine.handle(notification));

// No error when passed a request because requests satisfy all requirements of a notification
notificationEngine.handle(request);

// Allows constructing a request-only engine.
const handleRequest = ({
  request: _request,
}: {
  request: JsonRpcRequest<ValidParam>;
}) => undefined;
const requestEngine = new JsonRpcEngine({
  middleware: [handleRequest],
});
expectType<JsonRpcEngine<JsonRpcRequest<ValidParam>, Json>>(requestEngine);

// Handles a request without error
requestEngine.handle(request);

// TypeScript is unable to determine that `void` is impossible here because the request satisfies
// all requirements of a notification
expectType<Promise<JsonRpcResponse<ValidParam> | void>>(
  requestEngine.handle(request),
);

// Error when passed a notification due to missing id
expectError(requestEngine.handle(notification));
