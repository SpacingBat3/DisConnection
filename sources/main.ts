/*
 * TODO: Implement class somewhere in this file that bundles multiple transport
 *       implementation into single `Protocol` implementation. This should be 
 *       worked on once there will be multiple transports, currently there's
 *       only a WebSocket.
 */
import {
  WebSocketProtocol as WebSocket,
  WebSocketClose,
} from "./transport/websocket";

import { RPCActivity } from "./transport/protocol";

export {
  WebSocket,
  WebSocketClose,
  RPCActivity
};

import type {
  HookFn,
  HookSignatures,
  Message
} from "./transport/protocol";

import type { ServerDetails } from "./transport/websocket";

export type {
  HookFn,
  HookSignatures,
  Message,
  ServerDetails
};