import kolor, { type colors } from "@spacingbat3/kolor";
import sanitize from "@spacingbat3/lss";
import { format, debug } from "util";
import { knownPacketID, Message, code, type } from "./packet";

import { getServer, type GenericServer, type ServerDetails } from "./server";

/**
 * Flattened combination of `codes` and `types` from {@link knownMsgEl} used as
 * an array of hook names.
 */
const hookNames = Object.freeze(
  knownPacketID.codes.flatMap(
    code => code === "DEEP_LINK" ? knownPacketID.types.map(
      type => `${code}_${type}` as const
    ) : code
  )
);

/** Alias type for single hook name. */
type hookName = typeof hookNames[number];

/** An object that maps given hook names to their respective function argument tuple. */
export type HookSignatures = {
  [P in hookName]: P extends `${infer C extends "DEEP_LINK"}_${infer T extends type}`
    ? [request: Message<C,T>, origin: string|null] : P extends infer C extends code ? [request: Message<C,never>, origin: string|null] : never;
};

/** An alias which generates a function type from its signatures based on hook name. */
export type HookFn<T extends hookName> = (...args:HookSignatures[T]) => Promise<undefined|number>;

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
 * An alias to list of the colors allowed to be used with `@spacingbat3/kolor`
 * library. Used for tag color in the log message.
 */
export type fgColor = Exclude<keyof typeof colors,`bg${Capitalize<keyof typeof colors>}`>;


/**
 * A specification which defines Discord communication protocol used within
 * DisConnection. It is used for implementing various *transports*, like
 * WebSocket server or UNIX socket (IPC). This class is not designed to be used
 * directly, but is meant to be extended by given transport implementation.
 */
export abstract class Protocol<S extends GenericServer,T extends string=string> {
  /**
   * A name which indicates the given implementation of the protocol.
   */
  public abstract readonly name: T;
  public details?: Promise<ServerDetails<S>>;
  /**
   * A name variant which contains only English lowercase letters with
   * other incompatible characters replaced with underscore (`_`).
   */
  public get safeName() {
    return sanitize(this.name,"a-z","_","both");
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
   * memory after dereferencing all of the objects, the goal is to prevent API
   * consumers from using class method that no longer make sense than implement
   * any kind of the memory cleanup logic.
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
    }) as Readonly<Record<"list"|"active", never>>;
    // Clear lists of hooks and remove references to them.
    (Object.keys(this.#hooks) as hookName[]).forEach(key => {
      this.removeAllHooks(key);
      this.#hooks[key] = destroyHook;
    });
    // Make hooks immutable
    this.#hooks = Object.freeze(this.#hooks);
    const methods = new Set<string & keyof this>;
    // Get list of methods from all object prototypes.
    {
      let currentProto:unknown = Object.getPrototypeOf(this);
      while(currentProto !== Object.getPrototypeOf(Object)) {
        if(currentProto === null || currentProto === undefined)
          break;
        Object.getOwnPropertyNames(currentProto)
          .filter(key => key !== "isDestroyed" && typeof this[key as keyof this] === "function")
          .forEach(key => methods.add(key as string & keyof this));
        currentProto = Object.getPrototypeOf(currentProto);
      }
    }
    // Make class methods throw an Error when used.
    for(const key of methods.keys())
      (this[key] as unknown) = destroyFunc;
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
   * Removes given hook function from the given hook list.
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
  public removeAllHooks(name: hookName) {
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
  public anyHooksActive(name:hookName) {
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
  public toggleHooks(name: hookName, active = !this.#hooks[name].active) {
    if(!(name in this.#hooks) || typeof active !== "boolean")
      throw new TypeError("Invalid parameters type!");
    this.#hooks[name].active = active;
    return this.anyHooksActive(name);
  }
  constructor (serverGetter?: [start:number,end:number,getter:(port:number) => S], cConsole:Console|null = console, color?: fgColor) {
    if(cConsole !== null) this.#console = cConsole;
    if(color !== undefined) this.#color = color;
    if(serverGetter !== undefined) this.details = getServer(...serverGetter);
  }
}