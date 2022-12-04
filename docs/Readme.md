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
itself is currently a CommonJS module, ~~however project itself will be adopted
for ESM projects as well~~ actually it sems to be functional without having to
develop a code specifically for ESM (that's because there's no `default` module
export – if there will be a such I will prepare my code for ESM as well).

## Checklist

Most information about the events and commands is taken from official Discord
documentation. It may or may not represent the actual implementation within
official RPC server / protocol. However, in my opinion, DisConnection should
examine these as a source of server / socket compilance with their APIs.

Not all of the requests might be implemented; DisConnection currently focuses on
those requests which are possible to be a part of the WebCord, however I might
consider adding data about other requests in the future if the one used in
WebCord will be done.

### Transports:
  - [ ] WebSocket
    - [X] Basic server (without `GET`/`POST` requests handling support)
    - [ ] HTTP-based server (I might consider to implement it in the future)
  - [ ] IPC

### Commands:
  - [X] `DISPATCH` (outgoing packets)
  - [X] `DEEP_LINK` (channel only)
  - [X] `GUILD_TEMPLATE_BROWSER`
  - [X] `INVITE_LINK`
  - [X] `AUTHORIZE`
  - [X] `SET_ACTIVITY` (experimental)
  - [ ] `GET_GUILDS`
  - [ ] `GET_CHANNELS`
  - [ ] `AUTHENTICATE`

### Events (basically *todo*):
  - [X] `READY` (part of `DISPATCH`)
  - [ ] `ERROR` (DisConnection uses status codes as an alternative)
  - [ ] `GUILD_STATUS`
  - [ ] `GUILD_CREATE`
  - [ ] `CHANNEL_CREATE`
