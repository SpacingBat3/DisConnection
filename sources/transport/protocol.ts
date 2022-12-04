import kolor from "@spacingbat3/kolor";
import type { colors } from "@spacingbat3/kolor";
import { format, debug } from "util";

export const enum RPCActivity {
  Game,
  Listening,
  Streaming,
  Watching,
  Custom,
  Competing
}

/** Generic type for Discord's incoming messages format. */
interface Message<C extends string, T extends string|never> {
  /** Message type/command. */
  cmd: C;
  /** Message arguments. */
  args: messageArgs<C, T>;
  /** Nonce indentifying the communication. */
  nonce: string;
}

type messageArgs<C extends string, T extends string|never> =
C extends "INVITE_BROWSER"|"GUILD_TEMPLATE_BROWSER" ? {
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
} : C extends "DEEP_LINK" ? T extends string ? {
  type: T;
  params: messageParams<T>;
} : {
  type: string;
  params: Record<string,unknown>;
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
     * Bits in number has specified flag as seen in below table:
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

type messageParams<T extends string> = T extends "CHANNEL" ? {
  guildId: string;
  channelId?: string;
  search: string;
  fingerprint: string;
} : Record<string,unknown>;

/**
 * Generic response checker, assumes Discord will do requests of certain type
 * based on `cmd` and `argsType` values.
 */
export function isMessage<C extends string,T>(data:unknown, cmd?: C|C[], argsType?: T&string): data is Message<C,T extends string ? T : never> {
  type typeofResult = "string" | "number" | "bigint" | "boolean" | "object" |
  "function" | "undefined";
  type typeofResolved<T extends typeofResult> =  T extends "string" ? string :
    T extends "number" ? number : T extends "bigint" ? bigint :
      T extends "boolean" ? boolean : T extends "object" ? object|null :
        T extends "function" ? (...args:unknown[])=>unknown :
          T extends "undefined" ? undefined : unknown;
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

export const knownMsgEl = Object.freeze({
  codes: Object.freeze(["INVITE_BROWSER","GUILD_TEMPLATE_BROWSER","AUTHORIZE","DEEP_LINK","SET_ACTIVITY"] as const),
  types: Object.freeze(["CHANNEL"] as const)
});

const hookNames = knownMsgEl.codes
  .flatMap(code => code === "DEEP_LINK" ? knownMsgEl.types.map(type => `${code}_${type}` as const) : code);

type code = typeof knownMsgEl.codes[number];
type type = typeof knownMsgEl.types[number];
type hookName = typeof hookNames[number];

type HookSignatures = {
  [P in hookName]: P extends `${infer C extends "DEEP_LINK"}_${infer T extends type}`
    ? [request: Message<C,T>, origin: string|null] : P extends infer C extends code ? [request: Message<C,never>, origin: string|null] : never;
};
export type HookFn<T extends hookName> = (...args:HookSignatures[T]) => Promise<undefined|number>;
export type fgColor = Exclude<keyof typeof colors,`bg${Capitalize<keyof typeof colors>}`>;
type HookMap = {
  [P in hookName]: {
    list: Set<HookFn<P>>;
    active: boolean;
  };
};

/**
 * A specification which defines Discord communication protocol used within
 * DisConnection. It is used for implemending various *transports*, like
 * WebSocket server or 
 * 
 */
export abstract class Protocol {
  public abstract readonly name: string;
  protected abstract stopServer(): void;
  #destroyed = false;
  #hooks = hookNames.reduce<Partial<HookMap>>((prev,cur) => ({
    ...prev,
    [cur]: {
      list: new Set<HookFn<typeof cur>>(),
      active: true
    } satisfies Partial<HookMap>[typeof cur]
  }), {}) as HookMap;
  #console?: Console;
  #color?: fgColor;
  public log(...args:unknown[]) {
    if(this.#console === undefined) return;
    const badge = this.#color === undefined
      ? kolor.bold(`[${this.name}]`)+" %s"
      : kolor.bold(kolor[this.#color](`[${this.name}]`))+" %s";
    this.#console.log(badge, format(...args));
  }
  protected error(...args:unknown[]) {
    this.#console?.error(kolor.red(kolor.bold(`[${this.name}]`)+" %s"),format(...args));
  }
  protected debug(...args:unknown[]) {
    this.debug = debug(`dc-${this.name}`);
    this.debug(...args);
  }
  public isDestroyed() {
    return this.#destroyed;
  }
  public destroy() {
    const destroyError = new Error("Object has been destroyed!");
    if(this.#destroyed)
      throw destroyError;
    const destroyFunc = () => { throw destroyError; };
    this.stopServer();
    this.addHook = this.anyHooksActive = this.getHooks = destroyFunc;
    this.removeAllHooks = this.removeHook = this.toggleHooks = destroyFunc;
    this.stopServer = this.log = this.debug = destroyFunc;
    (Object.keys(this.#hooks) as hookName[]).forEach(key => this.removeAllHooks(key));
    this.#hooks = Object.freeze(this.#hooks);
    if(this.#console !== undefined)
      this.#console = Object.freeze(this.#console);
    this.#destroyed = true;
  }
  /**
   * Adds a hook to the given hook list if it doesn't exist in it.
   * 
   * @param name A name of hook list.
   * @param value A function that will be added to hook list.
   * 
   * @returns number of hooks of given key or `false` if value were added before
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
   * @param name A name of hook list.
   * 
   * @returns whenever hook has been deleted
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
   * @param name A name of hook list.
   * 
   * @returns if hook list wasn't empty before removing — values from it
   * @since v1.0.0
   */
  public removeAllHooks<T extends hookName>(name: T) {
    if(!(name in this.#hooks))
      throw new TypeError("Invalid parameters type!");
    const returnValue = [...this.#hooks[name].list].length > 0;
    this.#hooks[name].list.clear();
    return returnValue;
  }
  /**
   * Lists all hooks from the given hook list.
   * 
   * @param name A name of hook list.
   * 
   * @returns `Array` of hooks
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
   * @param name A name of hook list.
   * 
   * @returns whenever hooks are *active*
   * @since v1.0.0
   */
  public anyHooksActive<T extends hookName>(name:T) {
    if([...this.#hooks[name].list].length === 0)
      return false;
    return this.#hooks[name].active;
  }
  /**
   * Switches state of a given hook list, which can either disable it or not.
   * 
   * @param name A name of hook list.
   * @param active New state of hooks. Defaults to negation of previous state.
   * 
   * @returns current state of given hook (i.e if it is active or not)
   * @since v1.0.0
   */
  public toggleHooks<T extends hookName>(name: T, active = !this.#hooks[name].active) {
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
   * @param message Incomming message from transports
   * 
   * @returns Outgoing message that can be send as a response.
   * 
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