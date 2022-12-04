# DisConnection

A simple Discord protocol implementation for WebSocket/IPC.

It works by wrapping a WebSocket server and introducing a class to which *hooks*
are binded – functions executed on each message type (it might not be the same
as message command in some cases). That means, this project's goal is to
provide a generic, type-safe way of implementing a Discord protocol – it however
lacks any logic by itself, just to use the least dependencies possible.

## Origins

This is just a result of putting parts of WebCord's code into separate project,
in order to make it possible to be used in another software. The implementation
itself is currently a CommonJS module, however project itself will be adopted
for ESM projects as well.

## Checklist

- [ ] ***Transports***:
  - [ ] WebSocket
    - [X] Basic server (without `GET`/`POST` requests handling support)
    - [ ] HTTP-based server (I might consider to implement it in the future)
  - [ ] IPC
- [ ] **Commands**:
  - [X] `DISPATCH` (outgoing packets).
  - [X] `DEEP_LINK` (channel only)
  - [X] `GUILD_TEMPLATE_BROWSER`
  - [X] `INVITE_LINK`
  - [X] `AUTHORIZE`
  - [X] `SET_ACTIVITY` (experimental)
