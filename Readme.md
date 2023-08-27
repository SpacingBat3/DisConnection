# DisConnection

A simple Discord protocol implementation for WebSocket/IPC.

It works by wrapping a WebSocket server and introducing a class to which *hooks*
are binded – functions executed on each message type (it might not be the same
as message command in some cases). That means, this project's goal is to
provide a generic, type-safe way of implementing a Discord protocol – it however
lacks any logic by itself, just to use the least dependencies possible.

## ⚙️ Origins

This is just a result of putting parts of WebCord's code into separate project,
in order to make it possible to be used in another software. The implementation
itself is currently a CommonJS module, ~~however project itself will be adopted
for ESM projects as well~~ actually it seems to be functional without having to
develop a code specifically for ESM (that's because there's no `default` module
export – if there will be a such I will prepare my code for ESM as well).

## 📋️ Checklist

Most information about the events and commands is taken from official Discord
documentation. It may or may not represent the actual implementation within
official RPC server / protocol. However, in my opinion, DisConnection should
examine these as a source of server / socket compliance with their APIs.

Not all of the requests might be implemented; DisConnection currently focuses on
those requests which are possible to be a part of the WebCord, however I might
consider adding data about other requests in the future if the one used in
WebCord will be done.

### 📨️ Transports:
  - [ ] WebSocket
    - [X] Basic server (without `GET`/`POST` requests handling support)
    - [ ] HTTP-based server (I might consider to implement it in the future)
  - [ ] IPC

### ⚡️ Commands:
  - [X] `DISPATCH` (outgoing packets)
  - [X] `DEEP_LINK` (channel only)
  - [X] `GUILD_TEMPLATE_BROWSER`
  - [X] `INVITE_LINK`
  - [X] `AUTHORIZE`
  - [X] `SET_ACTIVITY` (experimental)
  - [ ] `GET_GUILDS`
  - [ ] `GET_CHANNELS`
  - [ ] `AUTHENTICATE`
  - [ ] `SUBSCRIBE`/`UNSUBSCRIBE`

### 🎆️ Events (basically *todo*):
  - [X] `READY` (part of `DISPATCH`)
  - [ ] `ERROR` (DisConnection uses status codes as an alternative)
  - [ ] `GUILD_STATUS`
  - [ ] `GUILD_CREATE`
  - [ ] `CHANNEL_CREATE`
  - [ ] `ACTIVITY_JOIN`

## ⚔️ vs. arRPC

Both arRPC and Disconnection share one key goal: reimplement an inter-process
communication of Discord using WebSocket server and unix socket or named pipe.

However, there's still a lot of differences between both of these projects:

- Unlike to DisConnection, arRPC provides example implementations of API
  consumers, like `user.js` script or example Electron integration.

- Unlike to DisConnection, arRPC implements a separate WebSocket server to
  communicate with web browsers. This could also be done with Disconnection but
  it's out-of-the-scope to include this within this project repo for now.

- **arRPC implements both IPC and WebSocket**, Disconnection's IPC is WIP.

- **arRPC uses internally ESM loader**, Disconnection is currently based on CJS.
  
  - ESM is still relatively new, at least new enough to not be supported
    everywhere yet (see Electron software).
  
  - ESM is asynchronous, CJS is synchronous.
  
  - ESM is supported OOTB both by browsers and Node.js, CJS works OOTB mainly in
    Node.js.
  
  - **CJS is easier to interop by ESM** than the other way. On CJS, it would be
    tricky to load ESM modules in synchronous way, most likely you will end up
    with `Promise` that can be handled asynchronously.
  
  - Take note Disconnection still uses TypeScript's ESM syntax for modules
    (which is further transformed to CJS) and due to that switching to ESM might
    be effortless if I'm going to drop CJS support.

- arRPC API is based on Node.js `EventEmitter`. Disconnection is designed over
  EcmaScript async design and develops a concept of *hooks* instead.
  
- **arRPC currently lacks developer documentation**. Disconnection is
  extensively documented with the use of JSDoc/TSDoc comments and uses TypeDoc
  for generating online documentation from these comments.
  
- **Disconnection is written in TypeScript**. arRPC is purely written in
  JavaScript.

  - Disconnection uses some of TypeScript language features for its advantage,
    like enums and TypeScript's extended classes syntax (eg. abstract classes).
  
  - arRPC currently doesn't even provide the type definition files (`.d.ts`) for
    TypeScript API consumers and (currently) there's no DefinitelyTyped package
    that supplies these types (`@types/arrpc`).
  
  - TypeScript as of itself is believed to eliminate certain types of bugs in
    code without having the compiler to yell about it (that depends on compiler
    configuration though, as the one can always make it ignore certain issues
    or make it to behave stricter than usual). In certain scenarios, TypeScript
    can even predict what's going to happen in code at given point. Of course,
    using TypeScript doesn't make any software *bulletproof* and JavaScript by
    itself isn't considered to be *unsafe*, you can still write software in
    TypeScript that breaks at runtime.