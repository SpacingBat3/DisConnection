/*
 * TODO: Implement class somewhere in this file that bundles multiple transport
 *       implementation into single `Protocol` implementation. This should be
 *       worked on once there will be multiple transports, currently there's
 *       only a WebSocket.
 */
export {
  WebSocketProtocol as WebSocket,
  WebSocketClose,
} from "#T/websocket";

export {
  IpcProtocol as IPC
} from "#T/ipc";

export { RPCActivity } from "#C/packet";

export type {
  Message,
  UnknownMessage
} from "#C/packet";

export type {
  HookFn,
  HookSignatures
} from "#C/protocol";

import type { ServerDetails as GDetails } from "#C/server";
import type { WebSocketServer as WS } from "ws";
import type { Server as IPC } from "node:net";

type WSServerDetails = GDetails<WS>;
type IPCServerDetails = GDetails<IPC>;

export type { WSServerDetails, IPCServerDetails };

/* For non-breaking compatibility with old WebSocket-only API. */
export type { WSServerDetails as ServerDetails };