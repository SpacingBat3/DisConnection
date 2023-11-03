/**
 * The type of the activity displayed as a status message with its name (e.g.
 * *Playing \<game\>* or *Listening to \<music\>*).
 */
export const enum RPCActivity {
  Game,
  Listening,
  Streaming,
  Watching,
  Custom,
  Competing
}

/** Static, hard-coded event objects sent by transports at certain conditions.*/
export const staticEvents = Object.freeze({
  /**
   * A fake, hard-coded Discord event to spoof the presence of
   * official Discord client (which makes browser to actually start a
   * communication with the DisConnection).
   */
  ready: {
    cmd:"DISPATCH",
    data: {
      v: 1,
      config: null,
      user: null
    },
    evt: "READY",
    nonce: null
  } satisfies EventDispatch<"READY">
} as const);

/**
 * Known *identifiers* of packets, which tends to be either a `code` of
 * `cmd`, `events` (`evt`) or `type` (for `DEEP_LINK`).
 */
export const knownPacketID = Object.freeze({
  codes: Object.freeze(["INVITE_BROWSER","GUILD_TEMPLATE_BROWSER","AUTHORIZE","DEEP_LINK","SET_ACTIVITY"] as const),
  types: Object.freeze(["CHANNEL"] as const),
  events: Object.freeze(["READY", "ERROR"] as const)
});

/** Alias type for single element of `knownMsgEl.codes`. */
export type code = typeof knownPacketID.codes[number];
/** Alias type for single element of `knownMsgEl.types`. */
export type type = typeof knownPacketID.types[number];
/** Alias type for single element of `knownMsgEl.events`. */
type event = typeof knownPacketID.events[number];
/** Single digit */
type digit = 0|1|2|3|4|5|6|7|8|9;


interface UnknownPacket {
  /** Message type/command. */
  cmd: string;
  /** Nonce identifying the communication. */
  nonce: string|null;
}

/** A generic non-precise type of Discord's incoming messages. */
export interface UnknownMessage extends UnknownPacket {
  /** Message arguments. */
  args: Record<string,unknown>;
}

/*export*/ interface UnknownMessageResponse extends UnknownPacket {
  /** Message response data. */
  data: null|Record<string,unknown>;
}

/*export*/ interface UnknownEvent extends UnknownMessageResponse {
  /** Event name. */
  evt: string;
}

/** An object type of known Discord's incoming messages. */
export interface Message<C extends code, T extends string> extends UnknownMessage {
  cmd: C;
  args: C extends `${"INVITE"|"GUILD_TEMPLATE"}_BROWSER` ? {
    /** An invitation code. */
    code: string;
  } : C extends "AUTHORIZE" ? {
    /** An array of OAuth2 scopes. */
    scopes: (
      `applications.${
        `builds.${"read"|"upload"}` |
        `commands.${""|"permissions."}update` |
        "entitlements" | "store.update"
      }`|"bot"|"connections"|"dm_channels.read"|"email"|"gdm.join"|"guilds"|
      `guilds.${"join"|"members.read"}`|"identify"|`${
        "activities"|"messages"|"relationships"|`rpc.${"notifications"|"voice"}`
      }.read`|`${"activities"|`rpc.${"activities"|"voice"}`}.write`|"voice"|
      "webhook.incoming"
    )[];
    /** An application's client_id. */
    client_id: string;
    /** One-time use RPC token. */
    rpc_token?: string;
    /** A username of guest account to create if the user does not have Discord. */
    username?: string;
  } : C extends "DEEP_LINK" ? {
    type: T extends string ? T : string;
    params: T extends "CHANNEL" ? {
      guildId: string;
      channelId?: string;
      search: string;
      fingerprint: string;
    } : Record<string,unknown>;
  } : C extends "SET_ACTIVITY" ? {
    /** The application's process id. */
    pid: number;
    activity: {
      /** The activity name. */
      name: string;
      /** The activity type, one of {@link RPCActivity}. */
      type: RPCActivity;
      /** A stream URL, validated only when `type` is {@link RPCActivity.Listening}. */
      url?: string;
      /** A unix timestamp (in milliseconds) of when the activity was added to the user's session. */
      created_at: number;
      /** Unix timestamps for start and/or end of the activity. */
      timestamps?: Partial<Record<"start"|"end", number>>;
      /** Application ID for the activity. */
      application_id?: number;
      /** What the user is currently doing as a part of given activity. */
      details: string;
      /** The user's current party status. */
      state?: string;
      /** An emoji used for a custom status. */
      emoji?: { name?: string; id?: number; animated?: string };
      /** An information about the current party participating in the user's activity. */
      party?: { id?: number; size?: [ current_size: number, max_size: number ] };
      /** Images for the presence and their hover texts. */
      assets?: Partial<Record<`${"large"|"small"}_${"image"|"text"}`, string>>;
      /** Secrets for Rich Presence joining and spectating. */
      secrets?: Partial<Record<"join"|"spectate"|"match", string>>;
      /** Whether or not the activity is an instanced game session. */
      instance?: boolean;
      /**
       * An integer in range 0-511 (unsigned, 9 bits) which identifies flags.
       *
       * @summary
       *
       * Bits in number has specified flag as seen in below table:
       *
       * |  BIT | FLAG                        |
       * | ---- | --------------------------- |
       * | 1    |`INSTANCE`                   |
       * | 2    |`JOIN`                       |
       * | 3    |`SPECTATE`                   |
       * | 4    |`JOIN_REQUEST`               |
       * | 5    |`SYNC`                       |
       * | 6    |`PLAY`                       |
       * | 7    |`PARTY_PRIVACY_FRIENDS`      |
       * | 8    |`PARTY_PRIVACY_VOICE_CHANNEL`|
       * | 9    |`EMBEDDED`                   |
       */
      flags?: number;
      /** An array of buttons shown in the Rich Presence. */
      buttons?: { label:string; url: string }[] & { length: 0|1|2 };
    };
  } : never;
}

// export interface MessageResponse<C extends code> extends UnknownMessageResponse {
//   cmd: C;
//   data: C extends `${"INVITE"|"GUILD_TEMPLATE"}_BROWSER` ? {
//     /** An invitation code. */
//     code: string;
//     /** Guild template details. */
//     guildTemplate: C extends "GUILD_TEMPLATE_BROWSER" ? {
//       /** An invitation code. */
//       code: string;
//     } : never;
//   } : C extends "AUTHORIZE" ? {
//     /** An OAUTH2 authorization code. */
//     code: string;
//   } : null;
// }

// export interface MessageError<C extends code> extends UnknownEvent {
//   cmd: C;
//   data: {
//     /** Error code. */
//     code: number;
//     /** Human-readable error message. */
//     message: string;
//   };
//   evt: "ERROR";
// }

/*export*/ interface EventDispatch<C extends Exclude<event,"ERROR">> extends UnknownEvent {
  cmd: "DISPATCH";
  data: C extends "READY" ? {
    /** RPC scheme version. */
    v: 1;
    /** Server configuration. */
    config: {
      cdn_host: string;
      api_endpoint: string;
      environment: string;
    } | null;
    /** User details. */
    user: {
      id: string;
      username: string;
      discriminator: `${digit}${digit}${digit}${digit}`;
      avatar: null;
    } | null;
  } : never;
  evt: C;
}

/**
 * Generic response checker, assumes Discord will do requests of certain type
 * based on `cmd` and `argsType` values.
 */
export function isMessage<C extends code|undefined=undefined,T extends type|undefined=undefined>(data:unknown, cmd?: C|C[], argsType?: T): data is C extends string ? Message<C,T extends string ? T : never> : UnknownMessage {
  type typeofResult = "string" | "number" | "bigint" | "boolean" | "object" |
  "function" | "undefined";
  /** Maps the result of `typeof` to the actual TypeScript type. */
  type typeofResolved<T extends typeofResult> =  T extends "string" ? string :
    T extends "number" ? number : T extends "bigint" ? bigint :
      T extends "boolean" ? boolean : T extends "object" ? object|null :
        T extends "function" ? (...args:unknown[])=>unknown :
          T extends "undefined" ? undefined : unknown;

  /** Verifies if given value satisfies record of the given type. */
  function checkRecord<T extends readonly (string|number|symbol)[], X extends typeofResult>(record:object,keys:T,arg:X): record is Record<T[number],typeofResolved<X>> {
    for(const key of keys)
      if(typeof (record as Record<string|number|symbol,unknown>)[key] !== arg)
        return false;
    return true;
  }
  if(typeof data !== "object" || data === null || data.constructor !== Object)
    return false;

  // Check first if it is any kind of Discord message.
  if(!checkRecord(data, ["cmd","nonce"] as const, "string"))
    return false;
  if(typeof (data as UnknownMessage).args !== "object")
    return false;

  // Check "cmd" value
  if(typeof cmd === "string") {
    if(data.cmd !== cmd)
      return false;
  } else if(Array.isArray(cmd)) {
    if(!cmd.includes((data as UnknownMessage).cmd as C&string))
      return false;
  }

  // Check "args.type" value
  if(argsType !== undefined && typeof (data as Message<"DEEP_LINK",string>).args.params === "object")
    switch(argsType) {
      case "CHANNEL":
        if(!checkRecord(
          (data as Message<"DEEP_LINK",string>).args.params,
          ["guildId", "channelId", "search", "fingerprint"] as const,
          "string"
        ) || (data as Message<"DEEP_LINK","CHANNEL">).args.params.channelId !== undefined)
          return false;
    }
  
  // All is "good enough"
  return true;
}
export function messageDefaultResponse(message: UnknownMessage) {
  const browserReq = message.cmd.endsWith("_BROWSER");
  return Object.freeze({
    cmd: message.cmd,
    data: browserReq ? {
      code: message.args["code"]??null,
      ...(message.cmd === "GUILD_TEMPLATE_BROWSER" ? {
        guildTemplate: {
          code: message.args["code"]??null
        }
      } : {})
    } : null,
    ...(browserReq ? {} : {evt: null}),
    nonce: message.nonce
  } as const);
}