import { createServer, type Server } from "node:net";
import { existsSync } from "node:fs";

import {
  Protocol,
  fgColor
} from "../common/protocol";

import {
  staticEvents,
  isBinary,
  messageDefaultResponse,
  knownPacketID,
  isMessage
} from "../common/packet";

const uid = process.getuid?.()??process.env["UID"]??1000;

const socketPath = process.platform === "win32" ? "\\\\pipe\\?" : process.env["XDG_RUNTIME_DIR"] ?? (
  existsSync(`/run/user/${uid}`) ? `/run/user/${uid}` : "/tmp/"
);

interface RawMessage {
  readonly size:number;
  readonly kind:number;
  readonly data:Buffer;
}

function parsePacket(packet:Buffer):RawMessage[] {
  const msgCollection:RawMessage[] = [];
  while(packet.length>0) {
    const kind=packet.readUInt32LE(0),
      size=packet.readUInt32LE(4),
      data=packet.subarray(8,8+size);
    
    msgCollection.push({kind,size,data});
    packet=packet.subarray(8+size);
  }
  return msgCollection;
}

function toMsg(json:unknown,kind:number):Buffer {
  const string = JSON.stringify(json);
  return Buffer.concat([
    // Data prefix
    Buffer.from([
      // Data kind, LE, uint32_t
      kind,
      kind>>>8,
      kind>>>16,
      kind>>>24,
      // Data size, LE, uint32_t
      string.length,
      string.length>>>8,
      string.length>>>16,
      string.length>>>24
    ]),
    // Data buffer
    Buffer.from(string)
  ]);
}

/**
 * @experimental
 */
export class IpcProtocol extends Protocol<Server,"IPC"> {
  name = "IPC" as const;
  stopServer() {
    void this.details?.then(({server}) => {
      server.close();
      delete this.details;
    });
  }
  constructor(cConsole: Console, color:fgColor = "yellow") {
    super([0,9,port => createServer().listen(`${socketPath}/discord-${port}`)],cConsole,color);
    (async() => void (await this.details)
      ?.server.on("connection", socket => {
        socket.write(JSON.stringify(staticEvents.ready));
        const pacCollect:Buffer[] = [];
        socket
          .on("data", packet => void pacCollect.push(packet))
          .on("drain", () => {
            for(const message of parsePacket(Buffer.concat(pacCollect))) {
              const binary = isBinary(message.data);
              let { data }:{data:unknown} = message;
              if(!binary) {
                const dataString=message.data.toString();
                try {
                  data = JSON.parse(dataString);
                } catch {
                  data = dataString;
                }
              }
              /*
              * TODO: Find proper `kind` for response messages (data mining).
              *       Currently code reuses `kind` from original message.
              * TODO: Modularize code, to share it between Protocol
              *       implementations and eliminate duplicate code (possibly made
              *       yet another file in common for that purpose).
              * TODO: Errors emitting.
              */
              const hookParsed = knownPacketID.codes.find(code => {
                if(code === "DEEP_LINK")
                  return knownPacketID.types.find(type => {
                    if(isMessage(data,code,type)) {
                      const msg = Object.freeze(data);
                      const [hooks,isActive] = [
                        this.getHooks(`${code}_${type}`),
                        this.anyHooksActive(`${code}_${type}`)
                      ];
                      if(isActive)
                        void Promise.all(hooks.map(hook => hook(msg,null)))
                          .then(result => {
                            const code = result.find(code => typeof code === "number" && code > 0);
                            if(code === undefined)
                              socket.write(toMsg(messageDefaultResponse(msg),message.kind));
                            else {
                              this.debug("Connection with client closed by hook with code: %d",code);
                              socket.destroy();
                            }
                          });
                      else
                        socket.write(toMsg(messageDefaultResponse(msg),message.kind));
                      return true;
                    }
                    return false;
                  }) !== undefined;
                else if(isMessage(data,code)) {
                  const msg = Object.freeze(data);
                  const [hooks,isActive] = [
                    this.getHooks(code),
                    this.anyHooksActive(code)
                  ];
                  if(isActive)
                    void Promise.all(hooks.map(hook => (hook)(msg as never,null)))
                      .then(result => {
                        const code = result.find(code => typeof code === "number" && code > 0);
                        if(code === undefined)
                          socket.write(toMsg(messageDefaultResponse(msg),message.kind));
                        else {
                          this.debug("Connection with client closed by hook with code: %d",code);
                          socket.destroy();
                        }
                      });
                  else
                    socket.write(toMsg(messageDefaultResponse(msg),message.kind));
                  return true;
                }
                return false;
              }) !== undefined;
              if(!hookParsed)
                // Unknown response error
                if(isMessage(data)) {
                  const type = typeof data.args["type"] === "string" ?
                    data.cmd+":"+data.args["type"] : data.cmd;
                  const msg = `Request of type: '${type}' is currently not supported.`;
                  this.error(msg);
                  this.debug("Request %s", JSON.stringify(data,undefined,4));
                  socket.destroy();
                }
                // Unknown text message error
                else if(!binary) {
                  const msg = `Could not handle the packed text data: '${data as string}'.`;
                  this.error(msg);
                  socket.destroy();
                }
                // Unknown binary data transfer error
                else {
                  this.error("Unknown data transfer (not text).");
                  socket.destroy();
                }
            }
            pacCollect.length=0;
          });
      })
    )().catch(reason => {
      if(reason instanceof Error)
        throw reason;
      else if(typeof reason === "string" || reason === undefined)
        throw new Error(reason as string|undefined);
      else
        this.error(reason);
    });
  }
}