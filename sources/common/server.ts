/** A generic type for multiple "server" providers implementations. */
export interface GenericServer extends NodeJS.EventEmitter {
  close: () => unknown;
}

/**
 * An information about the {@link Server}, like the reserved number of the port
 * and reference to the class.
 */
export interface ServerDetails<S extends GenericServer> { server: S; port: number }

interface GetServerEvt {
  listening?: string;
  error?: string;
}

/**
 * Reserves a server at given port range. Used by constructor of
 * {@link WebSocketProtocol}.
 * 
 * @summary
 * 
 * If first element of range is greater than last, port lookup will be done
 * downwards (e.g. `6472` → `6471`), else it will lookup ports upwards (e.g.
 * `6463` → `6464`).
 * 
 * @param start - first element of port range
 * @param end - last element of port range
 * @param getter - method to get the server somehow
 * 
 * @returns
 * 
 * A {@link Promise} that resolves to object with the negotiated port number and the {@link Server} reference.
 */
export async function getServer<S extends GenericServer>(start:number,end:number,getter:(port:number) => S,events?:GetServerEvt,...rest:[]) {
  function isInteger(...args:number[]) {
    return args
      .map(number => typeof number === "number" && number === parseInt(number.toString()))
      .reduce((b1,b2) => b1 && b2);
  }
  function tryServer(port: number) {
    return new Promise<ServerDetails<S>>(resolve => {
      if(start > end ? port < end : port > end)
        throw new Error("All ports from given range are busy!");
      const server = getter(port);
      server.once(events?.listening??"listening", () => {
        resolve({
          server: server,
          port
        });
        server.removeAllListeners(events?.error??"error");
      });
      server.once(events?.error??"error", () => {
        resolve(tryServer(start > end ? port-1 : port+1));
        server.close();
      });
    });
  }
  if(!isInteger(start,end))
    throw new TypeError("Invalid type of the arguments.");
  if((rest as unknown[]).length > 0)
    throw new TypeError("Too many function arguments.");
  return await tryServer(start);
}