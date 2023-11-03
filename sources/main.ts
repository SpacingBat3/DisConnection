/*
 * TODO: Implement class somewhere in this file that bundles multiple transport
 *       implementation into single `Protocol` implementation. This should be 
 *       worked on once there will be multiple transports, currently there's
 *       only a WebSocket.
 */
export {
  WebSocketProtocol as WebSocket,
  WebSocketClose,
} from "./transport/websocket";

export { RPCActivity } from "./common/packet";

export type {
  Message,
  UnknownMessage
} from "./common/packet";

export type {
  HookFn,
  HookSignatures
} from "./common/protocol";

import type { ServerDetails as GDetails } from "./common/server";
import type { Server as WS } from "ws";
type WSServerDetails = GDetails<WS>;

/* For non-breaking compatibility with old WebSocket-only API. */
export type { WSServerDetails as ServerDetails };