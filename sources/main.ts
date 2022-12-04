import {
  WebSocketProtocol as WebSocket,
  WebSocketClose
} from "./transport/websocket";

import { RPCActivity } from "./transport/protocol";

export { WebSocket, WebSocketClose, RPCActivity };

import type { HookFn } from "./transport/protocol";
export type { HookFn };