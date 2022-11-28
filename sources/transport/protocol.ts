import kolor from "@spacingbat3/kolor";

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
  scopes: string[];
  /** An application's client_id. */
  client_id: string;
} : C extends "DEEP_LINK" ? T extends string ? {
  type: T;
  params: messageParams<T>;
} : {
  type: string;
  params: Record<string,unknown>;
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
export function isMessage<C,T>(data:unknown, cmd?: C&string|(C&string)[], argsType?: T&string): data is Message<C extends string ? C : string,T extends string ? T : never> {
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
  codes: Object.freeze(["INVITE_BROWSER","GUILD_TEMPLATE_BROWSER","AUTHORIZE","DEEP_LINK"] as const),
  types: Object.freeze(["CHANNEL"] as const)
});

const hookNames = knownMsgEl.codes
  .flatMap(code => code === "DEEP_LINK" ? knownMsgEl.types.map(type => `${code}_${type}` as const) : code);

type code = typeof knownMsgEl.codes[number];
type type = typeof knownMsgEl.types[number];
type hookName = typeof hookNames[number];

type HookSignatures = {
  [P in hookName]: P extends `${infer C extends "DEEP_LINK"}_${infer T extends type}`
    ? [request: Message<C,T>] : P extends infer C extends code ? [request: Message<C,never>] : never;
};
export type HookFn<T extends hookName> = (...args:HookSignatures[T]) => Promise<void>;
type HookMap = {
  [P in hookName]: {
    set: Set<HookFn<P>>;
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
    }
  } satisfies Partial<HookMap>), {}) as HookMap;
  public log(message:string, ...args:unknown[]) {
    console.log(kolor.bold(kolor.magentaBright(`[${this.name}]`)), message,...args);
  }
  public isDestroyed() {
    return this.#destroyed;
  }
  public destroy() {
    const destroyError = new Error("Class has been already destroyed!");
    if(this.#destroyed)
      throw destroyError;
    const destroyFunc = () => { throw destroyError; };
    this.stopServer();
    this.addHook = this.anyHooksActive = this.getHooks = destroyFunc;
    this.removeAllHooks = this.removeHook = this.toggleHooks = destroyFunc;
    this.stopServer = this.log = destroyFunc;
    (Object.keys(this.#hooks) as hookName[]).forEach(key => this.removeAllHooks(key));
    this.#hooks = Object.freeze(this.#hooks);
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
    const wereAddedBefore = this.#hooks[name].set.has(value);
    this.#hooks[name].set.add(value);
    return wereAddedBefore ? false : [...this.#hooks[name].set].length;
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
    return this.#hooks[name].set.delete(value);
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
    const returnValue = [...this.#hooks[name].set].length > 0;
    this.#hooks[name].set.clear();
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
    return [...this.#hooks[name].set];
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
    if([...this.#hooks[name].set].length === 0)
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
  /**
   * This method maps incomming messages from transports to outgoing messages
   * with partially-filled data, i.e. nothing is being resolved as it takes
   * place in the official Discord client.
   * 
   * @param message Incomming message from transports
   * @returns Outgoing message that can be send as a response.
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