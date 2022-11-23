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
   * communication with the WebCord).
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

export const knownMsgEl = {
  codes: Object.freeze(["INVITE_BROWSER","GUILD_TEMPLATE_BROWSER","AUTHORIZE","DEEP_LINK"] as const),
  types: Object.freeze(["CHANNEL"] as const)
}

type code = typeof knownMsgEl.codes[number];
type type = typeof knownMsgEl.types[number];

type HookName = code extends infer C ? C extends "DEEP_LINK" ? `${C}_${type}` : C : never;
type HookSignatures = {
  [P in HookName]: P extends `${infer C extends "DEEP_LINK"}_${infer T extends type}`
    ? [request: Message<C,T>] : P extends infer C extends code ? [request: Message<C,never>] : never;
}
export type HookFn<T extends HookName> = (...args:HookSignatures[T]) => Promise<void>;
type HookMap = {
  [P in HookName]: Set<HookFn<P>>;
}

export abstract class Protocol {
  public abstract name: string;
  #hooks: HookMap = {
    AUTHORIZE: new Set(),
    DEEP_LINK_CHANNEL: new Set(),
    GUILD_TEMPLATE_BROWSER: new Set(),
    INVITE_BROWSER: new Set()
  };
  public log(message:string, ...args:unknown[]) {
    console.log(kolor.bold(kolor.magentaBright(`[${this.name}]`)), message,...args);
  }
  /**
   * Adds given hook function to the hook list identified by `key`.
   * 
   * @returns number of hooks of given key or `false` if value were added before
   * @since v1.0.0
   */
  public addHook<T extends HookName>(key: T, value: HookFn<T>) {
    const wereAddedBefore = this.#hooks[key].has(value);
    this.#hooks[key].add(value);
    return wereAddedBefore ? false : [...this.#hooks[key]].length;
  }
  /**
   * Removes given hook function from the hook list identified by `key`.
   * 
   * @returns whenever hook has been deleted
   * @since v1.0.0
   */
  public removeHook<T extends HookName>(key: T, value: HookFn<T>) {
    return this.#hooks[key].delete(value);
  }
  /**
   * Removes **all** hooks from the hook list identified by `key`.
   * 
   * @returns if hook list wasn't empty before removing values from it
   * @since v1.0.0
   */
  public removeAllHooks<T extends HookName>(key: T) {
    const returnValue = [...this.#hooks[key]].length > 0;
    this.#hooks[key].clear();
    return returnValue;
  }
  /**
   * Lists all hooks from the hook list identified by `key` in `Array`.
   * 
   * @returns `Array` of hooks
   * @since v1.0.0
   */
  public getHooks<T extends HookName>(key:T) {
    return [...this.#hooks[key]];
  }
  static messageResponse(message: Message<string,string|never>) {
    switch(message.cmd) {
      case "INVITE_BROWSER":
      case "GUILD_TEMPLATE_BROWSER":
        return {
          cmd: message.cmd,
          data: {
            code: message.args["code"]??null,
            ...(message.cmd === "GUILD_TEMPLATE_BROWSER" ? {
              guildTemplate: {
                code: message.args["code"]??null
              }
            } : {})
          },
          nonce: message.nonce
        }
      default:
        return {
          cmd: message.cmd,
          data: null,
          evt: null,
          nonce: message.nonce
        };
    }
  }
}