import { 
  WebSocketProtocol as WebSocket,
  WebSocketClose
} from "./transport/websocket";

export {
  WebSocket
}

import type {
  HookFn
} from "./transport/protocol"

export type {
  HookFn,
  WebSocketClose
}