import { Server, WebSocketServer } from "ws";
//import kolor from "@spacingbat3/kolor";
import {Protocol, isMessage, staticMessages, isJSONParsable, knownMsgEl } from "./protocol";

/**
 * A list of standard status codes used within WebSocket communication at
 * connection close. Currently, not all are documented there, althrough all were
 * listed, with some additional ones took from MDN.
 * 
 * Reference: [MDN], [RFC 6455].
 * 
 * [MDN]: https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code "CloseEvent.close – Web APIs | MDN"
 * [RFC 6455]: https://www.rfc-editor.org/rfc/rfc6455.html#section-7.4.1  "RFC 6455: The WebSocket protocol."
 */
export const enum WebSocketClose {
  /** Emmited on normal server closure. */
  Ok = 1000,
  /** Emmited when endpoint is going away, e.g. on navigation or server failure. */
  GoingAway,
  ProtocolError,
  UnsupportedData,
  /** **Reserved**. It currently has no meaning, but that might change in the future. */
  Reserved,
  /** **Reserved**. Indicates lack of the status/code, althrough it was expected. */
  NoStatusReveived,
  /** **Reserved**. Emmited when connection was closed abnormally, where status code was expected. */
  AbnormalClosure,
  InvalidPayload,
  PolicyViolation,
  MessageTooBig,
  MandatoryExtension,
  InternalError,
  ServiceRestart,
  /** Emmited when server is terminating connection due to the temporarily condition, e.g. server overload. */
  TryAgainLater,
  BadGateway
}

type serverDetails = {server: Server, port: number};

function getServer(start:number,end:number) {
  function tryServer(port: number) {
    return new Promise<serverDetails>(resolve => {
      if(port > end)
        throw new Error("All ports from given range are busy!");
      const wss = new WebSocketServer({host: "127.0.0.1", port: port++});
      wss.once("listening", () => {
        resolve({
          server: wss,
          port: port-1
        });
        wss.removeAllListeners("error");
      });
      wss.once("error", () => {
        resolve(tryServer(port));
        wss.close();
      });
    });
  }
  return tryServer(start);
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
export class WebSocketProtocol extends Protocol {
  name = "WebSocket";
  stopServer() {
    this.details?.then(({server}) => {
      server.close();
      delete this.details;
    });
  }
  public details?: Promise<serverDetails>;
  constructor(validOrigins:(RegExp|string)[]) {
    super();
    const details = getServer(6463, 6472);
    this.details = details;
    details
      .then(v => v.port)
      .then(port => this.log("Opened at port: %s",port));
    // Async block
    (async() => (await details).server.on("connection", (client, req) => {
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
        console.debug(`[${this.name}] Blocked request from origin '${req.headers.origin??"UNKNOWN"}'. (not trusted)`);
        client.close(WebSocketClose.PolicyViolation,"Client is not trusted.");
        return;
      }
      // Check if clients are supported
      if(unsupportedOrigins.find(passingRule) !== undefined) {
        console.debug(`[${this.name}] Blocked request from origin '${req.headers.origin??"UNKNOWN"}'. (not supported)`);
        client.close(WebSocketClose.PolicyViolation,"Client is not supported.");
        return;
      }
      // Send "DISPATCH" event
      client.send(JSON.stringify(staticMessages.dispatch));
      client.on("message", (packet,isBinary) => {
        let parsedData:unknown = packet;
        if(!isBinary) {
          const packetString = parsedData = packet.toString();
          if(!isBinary && isJSONParsable(packetString))
            parsedData = JSON.parse(packetString);
        }
        const hookParsed = knownMsgEl.codes.find(code => {
          if(code === "DEEP_LINK")
            return knownMsgEl.types.find(type => {
              if(isMessage(parsedData,code,type)) {
                const message = Object.freeze(parsedData);
                const [hooks,isActive] = [
                  this.getHooks(`${code}_${type}`),
                  this.anyHooksActive(`${code}_${type}`)
                ]
                if(isActive)
                  Promise.all(hooks.map(hook => hook(message)))
                    .then(() => client.send(
                      JSON.stringify(Protocol.messageResponse(message))
                    )
                  );
                else
                  client.send(JSON.stringify(Protocol.messageResponse(message)))
                return true;
              }
              return false;
            }) !== undefined;
          else if(isMessage(parsedData,code)) {
            const message = Object.freeze(parsedData);
            const [hooks,isActive] = [
              this.getHooks(code),
              this.anyHooksActive(code)
            ]
            if(isActive)
              Promise.all(hooks.map(hook => (hook as (v: typeof message)=>Promise<void>)(message)))
                .then(() => client.send(
                  JSON.stringify(Protocol.messageResponse(message))
                ));
            else
              client.send(JSON.stringify(Protocol.messageResponse(message)))
            return true;
          }
          return false;
        }) !== undefined;
        if(!hookParsed)
          // Unknown response error
          if(isMessage(parsedData)) {
            const type = typeof parsedData.args["type"] === "string" ?
              parsedData.cmd+":"+parsedData.args["type"] : parsedData.cmd;
            const msg = `Request of type: '${type}' is currently not supported.`;
            console.error(`[${this.name}] %s`, msg);
            console.debug(`[${this.name}] Request %s`, JSON.stringify(parsedData,undefined,4));
            client.close(WebSocketClose.InvalidPayload, msg);
          }
          // Unknown text message error
          else if(!isBinary) {
            const msg = `Could not handle the packed text data: '${packet.toString()}'.`;
            console.error(`[${this.name}] %s`, msg);
            client.close(WebSocketClose.InvalidPayload, msg);
          }
          // Unknown binary data transfer error
          else {
            console.error(`[${this.name}] Unknown data transfer (not text).`);
            client.close(WebSocketClose.UnsupportedData, "Unknown data transfer");
          }
      });
    }))().catch(reason => {
      if(reason instanceof Error) 
        throw reason;
      else if(typeof reason === "string" || reason === undefined)
        throw new Error(reason);
      else
        console.error(reason);
    });
  }
}