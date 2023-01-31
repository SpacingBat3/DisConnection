import kolor, { type colors } from "@spacingbat3/kolor";
import { format, debug } from "util";

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

/** Generic type for Discord's incoming messages format. */
export interface Message<C extends string, T extends string|never> {
  /** Message type/command. */
  cmd: C;
  /** Nonce indentifying the communication. */
  nonce: string;
  /** Message arguments. */
  args: C extends "INVITE_BROWSER"|"GUILD_TEMPLATE_BROWSER" ? {
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
      /** Secrets for Rich Presence joining and specating. */
      secrets?: Partial<Record<"join"|"specate"|"match", string>>;
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
       * | 3    |`SPECATE`                    |
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
  } : Record<string,unknown>;
}

/**
 * Generic response checker, assumes Discord will do requests of certain type
 * based on `cmd` and `argsType` values.
 */
export function isMessage<C extends string,T>(data:unknown, cmd?: C|C[], argsType?: T&string): data is Message<C,T extends string ? T : never> {
  type typeofResult = "string" | "number" | "bigint" | "boolean" | "object" |
  "function" | "undefined";
  /** Maps the result of `typeof` to the actual TypeScript type. */
  type typeofResolved<T extends typeofResult> =  T extends "string" ? string :
    T extends "number" ? number : T extends "bigint" ? bigint :
      T extends "boolean" ? boolean : T extends "object" ? object|null :
        T extends "function" ? (...args:unknown[])=>unknown :
          T extends "undefined" ? undefined : unknown;
  /** Verifies if given value satisfies record of the given type. */
  function checkRecord<T extends (string|number|symbol)[], X extends typeofResult>(record:Record<string|number|symbol, unknown>,keys:T,arg:X): record is Record<T[number],typeofResolved<X>> {
    for(const key of keys)
      if(typeof record[key] !== arg)
        return false;
    return true;
  }
  if(typeof (data as Message<string,never>).cmd !== "string")
    return false;
  if(!(data instanceof Object))
    return false;
  if(typeof cmd === "string") {
    if((data as Message<string,never>).cmd !== cmd)
      return false;
  } else if(Array.isArray(cmd)) {
    if(!cmd.includes((data as Message<string,never>).cmd as C&string))
      return false;
  }
  if(typeof(data as Message<string,never>).args !== "object")
    return false;
  if(argsType !== undefined && typeof (data as Message<"DEEP_LINK",typeof argsType>).args.params === "object")
    switch(argsType) {
      case "CHANNEL":
        if(!checkRecord(
          (data as Message<"DEEP_LINK","CHANNEL">).args.params,
          ["guildId", "channelId", "search", "fingerprint"], "string"
        ) && (data as Message<"DEEP_LINK","CHANNEL">).args.params.channelId !== undefined)
          return false;
    }
  if(typeof (data as Message<string,never>).nonce !== "string")
    return false;
  return true;
}

/** Verifies if given string can be parsed to `object` with `JSON.parse`. */
export function isJSONParsable(text:string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Static response messages sent by transports. */
export const staticMessages = Object.freeze({
  /**
   * A fake, hard-coded Discord command to spoof the presence of
   * official Discord client (which makes browser to actually start a
   * communication with the DisConnection).
   */
  dispatch: {
    /** Message command. */
    cmd:"DISPATCH",
    /** Message data. */
    data: {
      /** Message scheme version. */
      v: 1,
      /** Client properties. */
      config: null
    },
    evt: "READY",
    nonce: null
  }
} as const);

/**
 * Known *elements* of message payloads, which tends to be either a `code` of
 * `cmd` or `type` (for `DEEP_LINK`).
 */
export const knownMsgEl = Object.freeze({
  codes: Object.freeze(["INVITE_BROWSER","GUILD_TEMPLATE_BROWSER","AUTHORIZE","DEEP_LINK","SET_ACTIVITY"] as const),
  types: Object.freeze(["CHANNEL"] as const)
});

/**
 * Flattened combination of `codes` and `types` from {@link knownMsgEl} used as
 * an array of hook names.
 */
const hookNames = Object.freeze(
  knownMsgEl.codes.flatMap(
    code => code === "DEEP_LINK" ? knownMsgEl.types.map(
      type => `${code}_${type}` as const
    ) : code
  )
);

/** Alias type for single element of `knownMsgEl.codes`. */
type code = typeof knownMsgEl.codes[number];
/** Alias type for single element of `knownMsgEl.types`. */
type type = typeof knownMsgEl.types[number];
/** Alias type for single hook name. */
type hookName = typeof hookNames[number];

/** An object that maps given hook names to their respective function argument truple. */
export type HookSignatures = {
  [P in hookName]: P extends `${infer C extends "DEEP_LINK"}_${infer T extends type}`
    ? [request: Message<C,T>, origin: string|null] : P extends infer C extends code ? [request: Message<C,never>, origin: string|null] : never;
};
/** An alias which generates a function type from its signatures based on hook name. */
export type HookFn<T extends hookName> = (...args:HookSignatures[T]) => Promise<undefined|number>;

/**
 * An alias to list of the colors allowed to be used with `@spacingbat3/kolor`
 * library. Used for tag color in the log message.
 */
export type fgColor = Exclude<keyof typeof colors,`bg${Capitalize<keyof typeof colors>}`>;

/**
 * Maps hook names to the final format of hook, used internally in the
 * {@link Protocol} class.
 */
type HookMap = {
  [P in hookName]: {
    list: Set<HookFn<P>>;
    active: boolean;
  };
};

/**
 * A specification which defines Discord communication protocol used within
 * DisConnection. It is used for implemending various *transports*, like
 * WebSocket server or UNIX socket (IPC). This class is not designed to be used
 * directly, but is meant to be extended by given transport implementation.
 */
export abstract class Protocol {
  /**
   * A name which indicates the given implementation of the protocol.
   */
  public abstract readonly name: string;
  /**
   * A {@link name} variant which contains all characters lowercase and contains
   * replaced whitespaces with underscore (`_`).
   */
  public get safeName() {
    return this.name.toLowerCase().replaceAll(/\s/g,"_");
  }
  /** A way to stop the server while {@link destroy}-ing the class structure. */
  protected abstract stopServer(): void;
  #destroyed = false;
  /**
   * An object that stores the information about all of the hooks assigned to
   * the given transport.
   */
  #hooks = hookNames.reduce<Partial<HookMap>>((prev,cur) => ({
    ...prev,
    [cur]: {
      list: new Set<HookFn<typeof cur>>(),
      active: true
    } satisfies Partial<HookMap>[typeof cur]
  }), {}) as HookMap;
  /** A [`Console`](https://nodejs.org/api/console.html) instance used for logging within this class. */
  #console?: Console|undefined;
  /** A {@link fgColor} used as a color of the badge within logged messages. */
  #color?: fgColor|undefined;
  /** Writes a regular message (`log`) in the console to `stdout`. */
  public log(...args:unknown[]) {
    if(this.#console === undefined) return;
    const badge = this.#color === undefined
      ? kolor.bold(`[${this.name}]`)+" %s"
      : kolor.bold(kolor[this.#color](`[${this.name}]`))+" %s";
    this.#console.log(badge, format(...args));
  }
  /** Writes an error message to `stderr`. */
  protected error(...args:unknown[]) {
    this.#console?.error(kolor.red(kolor.bold(`[${this.name}]`)+" %s"),format(...args));
  }
  /**
   * Writes a debug message, which will be visible whenever `NODE_DEBUG`
   * includes a `disconnection-{{@link #safeName}}`.
   */
  protected debug(...args:unknown[]) {
    this.debug = debug(`disconnection-${this.safeName}`);
    this.debug(...args);
  }
  /**
   * Whenever this class has been *destroyed*.
   * 
   * @see {@link destroy} for more details about this state.
   */
  public isDestroyed() {
    return this.#destroyed;
  }
  /**
   * Removes references in class properties and methods either by replacing
   * values with a reference to the function that throws an error (for methods
   * and some required properties using getters) or sets them to a nullish value
   * (for optional properties).
   * 
   * As it is hard to guarantee the Garbage Collector will ever deallocate
   * memory after dereferencing all of the objects, the main goal is to make
   * class no longer contain methods that may not make sense anymore to be used
   * rather than implement any kind of the memory cleanup logic.
   * 
   * **Note: This operation is designed to be irreversible!** You will have to
   * initialize the new class instance if you want to use given transport again.
   * 
   * @throws {@link Error} in case object has been already destroyed.
   * 
   * @since v1.1.0
   */
  public destroy() {
    const destroyError = new Error("Object has been destroyed!");
    if(this.#destroyed) throw destroyError;
    this.stopServer();
    const destroyFunc = () => { throw destroyError; };
    const destroyHook = Object.freeze({
      get list() { throw destroyError; },
      get active() { throw destroyError; }
    }) as unknown as Readonly<Record<"list"|"active", never>>;
    this.#hooks = Object.freeze(this.#hooks);
    // Clear lists of hooks and remove references to them.
    (Object.keys(this.#hooks) as hookName[]).forEach(key => {
      this.removeAllHooks(key);
      this.#hooks[key] = destroyHook;
      
    });
    // Make direct class methods throw an Error when used.
    (Object.keys(this) as (string&keyof typeof this)[])
      .filter(key => key !== "isDestroyed" && typeof this[key] === "function")
      .map(key => (this[key] as unknown) = destroyFunc);
    this.#console = this.#color = undefined;
    this.#destroyed = true;
  }
  /**
   * Adds a hook to the given hook list if it doesn't exist in it.
   * 
   * @param {T extends HookName} name - A name of hook list.
   * @param value - A function that will be added to hook list.
   * 
   * @returns number of hooks of given key or `false` if value were added before
   * @throws {@link TypeError} on invalid function parameter types.
   * @since v1.0.0
   */
  public addHook<T extends hookName>(name: T, value: HookFn<T>) {
    if(!(name in this.#hooks) || typeof value !== "function")
      throw new TypeError("Invalid parameters type!");
    const wereAddedBefore = this.#hooks[name].list.has(value);
    this.#hooks[name].list.add(value);
    return wereAddedBefore ? false : [...this.#hooks[name].list].length;
  }
  /**
   * Removes given hook function from give the hook list.
   * 
   * @param name - A name of hook list.
   * 
   * @returns whenever hook has been deleted
   * @throws {@link TypeError} on invalid function parameter types.
   * @since v1.0.0
   */
  public removeHook<T extends hookName>(name: T, value: HookFn<T>) {
    if(!(name in this.#hooks) || typeof value !== "function")
      throw new TypeError("Invalid parameters type!");
    return this.#hooks[name].list.delete(value);
  }
  /**
   * Removes **all** hooks from the given hook list.
   * 
   * @param name - A name of hook list.
   * 
   * @returns if hook list wasn't empty before removing — values from it
   * @throws {@link TypeError} on invalid hook list name.
   * @since v1.0.0
   */
  public removeAllHooks<T extends hookName>(name: T) {
    if(!(name in this.#hooks))
      throw new TypeError(`Hook list "${name}" is invalid!`);
    const returnValue = [...this.#hooks[name].list].length > 0;
    this.#hooks[name].list.clear();
    return returnValue;
  }
  /**
   * Lists all hooks from the given hook list.
   * 
   * @param name - A name of hook list.
   * 
   * @returns `Array` of hooks
   * @throws {@link TypeError} on invalid hook list name.
   * @since v1.0.0
   */
  public getHooks<T extends hookName>(name:T) {
    if(!(name in this.#hooks))
      throw new TypeError(`Hook list "${name}" is invalid!`);
    return [...this.#hooks[name].list];
  }
  /**
   * Whenever any of hooks will execute by server.
   * 
   * @param name - A name of hook list.
   * 
   * @returns whenever hooks are *active*
   * @throws {@link TypeError} on invalid hook list name.
   * @since v1.0.0
   */
  public anyHooksActive<T extends hookName>(name:T) {
    if(!(name in this.#hooks))
      throw new TypeError(`Hook list "${name}" is invalid!`);
    if([...this.#hooks[name].list].length === 0)
      return false;
    return this.#hooks[name].active;
  }
  /**
   * Switches state of a given hook list, which can either disable it or not.
   * 
   * @param name - A name of hook list.
   * @param active - New state of hooks. Defaults to negation of previous state.
   * 
   * @returns current state of given hook (i.e if it is active or not)
   * @throws {@link TypeError} on invalid function parameter types.
   * @since v1.0.0
   */
  public toggleHooks<T extends hookName>(name: T, active = !this.#hooks[name].active) {
    if(!(name in this.#hooks) || typeof active !== "boolean")
      throw new TypeError("Invalid parameters type!");
    this.#hooks[name].active = active;
    return this.anyHooksActive(name);
  }
  constructor (cConsole:Console|null = console, color?: fgColor) {
    if(cConsole !== null) this.#console = cConsole;
    if(color !== undefined) this.#color = color;
  }
  /**
   * This method maps incomming messages from transports to outgoing messages
   * with partially-filled data, i.e. nothing is being resolved as it takes
   * place in the official Discord client.
   * 
   * @param message - Incomming message from transports.
   * 
   * @returns Outgoing message that can be send as a response.
   * @since v1.0.0
   */
  static messageResponse(message: Message<string,string|never>) {
    const browserReq = /^(INVITE|GUILD_TEMPLATE)_BROWSER$/;
    return Object.freeze({
      cmd: message.cmd,
      data: browserReq.test(message.cmd) ? {
        code: message.args["code"]??null,
        ...(message.cmd === "GUILD_TEMPLATE_BROWSER" ? {
          guildTemplate: {
            code: message.args["code"]??null
          }
        } : {})
      } : null,
      ...(browserReq.test(message.cmd) ? {} : {evt: null}),
      nonce: message.nonce
    } as const);
  }
}