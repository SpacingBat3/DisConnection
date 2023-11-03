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

export {
  IpcProtocol as IPC
} from "./transport/ipc";

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
import type { Server as IPC } from "node:net";

type WSServerDetails = GDetails<WS>;
type IPCServerDetails = GDetails<IPC>;

export type { WSServerDetails, IPCServerDetails };

/* For non-breaking compatibility with old WebSocket-only API. */
export type { WSServerDetails as ServerDetails };