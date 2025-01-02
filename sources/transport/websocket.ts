import {
  Server,
  WebSocketServer
} from "ws";

import {
  Protocol,
  fgColor
} from "#C/protocol";

import {
  isMessage,
  staticEvents,
  knownPacketID,
  messageDefaultResponse
} from "#C/packet";

/**
 * A list of standard status codes used within WebSocket communication at
 * connection close. Currently, not all are documented there, although all were
 * listed, with some additional ones took from MDN.
 *
 * Reference: [MDN], [RFC 6455].
 *
 * [MDN]: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code "CloseEvent.close – Web APIs | MDN"
 * [RFC 6455]: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1  "RFC 6455: The WebSocket protocol."
 */
export const enum WebSocketClose {
  /**
   * Indicates that connection went successfully.
   */
  Ok = 1000,
  /**
   * Emitted when endpoint is going away, e.g. on navigation or server failure.
   */
  GoingAway,
  /**
   * Emitted once a protocol error occurs.
   */
  ProtocolError,
  /**
   * Emitted once server received a kind of data it couldn't accept, e.g. binary
   * message on endpoints supporting only UTF-8 encoded data.
   */
  UnsupportedData,
  /**
   * **Reserved**. It currently has no meaning, but that might change in the
   * future.
   */
  Reserved,
  /**
   * **Reserved**. Indicates lack of the status/code, although it was expected.
   */
  NoStatusReceived,
  /**
   * **Reserved**. Emitted when connection was closed abnormally, where status
   * code was expected.
   */
  AbnormalClosure,
  /**
   * Indicates that server received a message with inconsistent data structure,
   * e.g. a mixed UTF-8 encoded message that also includes the unrecognizable
   * binary data.
   */
  InvalidPayload,
  /**
   * Indicates that sent message violates the server's policy. This code is
   * meant to be a generic status code that can be used if there's no suitable
   * more suitable status codes (like {@link UnsupportedData} or {@link MessageTooBig}).
   * It could also be used if details about the policy should be hidden.
   */
  PolicyViolation,
  /**
   * Indicates that received payload by the server is too large to be processed.
   */
  MessageTooBig,
  MandatoryExtension,
  InternalError,
  ServiceRestart,
  /**
   * Emitted when server is terminating connection due to the temporarily
   * condition, e.g. server overload.
   */
  TryAgainLater,
  BadGateway
}

/** A hard-coded blocklist of origins. */
const unsupportedOrigins = [
  // Discord services are currently unsupported:
  /^https:\/\/(?!canary|ptb)(?:[a-z]+)\.discord\.com$/,
  // Loopback clients are currently unsupported / should be ignored:
  "127.0.0.1"
];

/**
 * Implements Discord client communication {@link Protocol} (between Discord
 * browser or any software with Discord integrations) via WebSocket server.
 */
export class WebSocketProtocol extends Protocol<Server,"WebSocket"> {
  name = "WebSocket" as const;
  stopServer() {
    void this.details?.then(({server}) => {
      server.close();
      delete this.details;
    });
  }
  /** Creates new instance of {@link WebSocketProtocol} class.
   *
   * @param validOrigins - Whitelist of client origins as {@link RegExp} patterns or strings.
   * @param console - [`Console`](https://nodejs.org/api/console.html#console) instance used within class (defaults to {@link global.console}).
   *
   * @throws - {@link Error} if server couldn't be created within a given port range.
   */
  constructor(validOrigins:(RegExp|string)[], console?:Console|null, color: fgColor = "magenta") {
    super(
      [6463, 6472, port => new WebSocketServer({host: "127.0.0.1", port})],
      console,
      color
    );
    // Async block
    void (async() => (await this.details)
      ?.server.on("connection", (client, req) => {
        /** Whenever origin passes given rule. */
        function passingRule(rule:unknown):boolean {
          if(typeof rule === "string" && rule === req.headers.origin)
            return true;
          if(rule instanceof RegExp && rule.test(req.headers.origin??""))
            return true;
          return false;
        }
        // Verify client trust.
        if(validOrigins.find(passingRule) === undefined) {
          this.debug(`Blocked request from origin '${req.headers.origin??"UNKNOWN"}'. (not trusted)`);
          client.close(WebSocketClose.PolicyViolation,"Client is not trusted.");
          return;
        }
        // Check if clients are supported
        if(unsupportedOrigins.find(passingRule) !== undefined) {
          this.debug(`Blocked request from origin '${req.headers.origin??"UNKNOWN"}'. (not supported)`);
          client.close(WebSocketClose.PolicyViolation,"Client is not supported.");
          return;
        }
        // Send "READY" event
        client.send(JSON.stringify(staticEvents.ready));
        client.on("message", (packet,isBinary) => {
          let parsedData:unknown = packet;
          if(!isBinary) {
            const packetString = Buffer.isBuffer(packet) || Array.isArray(packet) ?
              packet.toString() :
              String.fromCharCode(...new Uint8Array(packet));
            try {
              parsedData = JSON.parse(packetString);
            } catch {
              parsedData = packetString;
            }
          }
          const hookParsed = knownPacketID.codes.some(code => {
            if(code === "DEEP_LINK")
              return knownPacketID.types.some(type => {
                if(isMessage(parsedData,code,type)) {
                  const message = Object.freeze(parsedData);
                  const [hooks,isActive] = [
                    this.getHooks(`${code}_${type}`),
                    this.anyHooksActive(`${code}_${type}`)
                  ];
                  if(isActive)
                    void Promise.all(hooks.map(hook => hook(message,req.headers.origin??null)))
                      .then(result => {
                        const code = result.find(code => typeof code === "number" && code > 0);
                        if(code === undefined)
                          client.send(JSON.stringify(messageDefaultResponse(message)));
                        else {
                          this.debug("Connection with client closed by hook with code: %d",code);
                          client.close(code);
                        }
                      });
                  else
                    client.send(JSON.stringify(messageDefaultResponse(message)));
                  return true;
                }
                return false;
              });
            else if(isMessage(parsedData,code)) {
              const message = Object.freeze(parsedData);
              const [hooks,isActive] = [
                this.getHooks(code),
                this.anyHooksActive(code)
              ];
              if(isActive)
                void Promise.all(hooks.map(hook => (hook)(message as never,req.headers.origin??null)))
                  .then(result => {
                    const code = result.find(code => typeof code === "number" && code > 0);
                    if(code === undefined)
                      client.send(JSON.stringify(messageDefaultResponse(message)));
                    else {
                      this.debug("Connection with client closed by hook with code: %d",code);
                      client.close(code);
                    }
                  });
              else
                client.send(JSON.stringify(messageDefaultResponse(message)));
              return true;
            }
            return false;
          });
          if(!hookParsed)
            // Unknown response error
            if(isMessage(parsedData)) {
              const type = typeof parsedData.args["type"] === "string" ?
                parsedData.cmd+"_"+parsedData.args["type"] : parsedData.cmd;
              const msg = `Request of type: '${type}' is currently not supported.`;
              this.error(msg);
              this.debug("Request %s", JSON.stringify(parsedData,undefined,4));
              client.close(WebSocketClose.InvalidPayload, msg);
            }
            // Unknown text message error
            else if(!isBinary) {
              const msg = `Could not handle the packed text data: '${parsedData as string}'.`;
              this.error(msg);
              client.close(WebSocketClose.InvalidPayload, msg);
            }
            // Unknown binary data transfer error
            else {
              this.error("Unknown data transfer (not text).");
              client.close(WebSocketClose.UnsupportedData, "Unknown data transfer");
            }
        });
      })
    )();
  }
}