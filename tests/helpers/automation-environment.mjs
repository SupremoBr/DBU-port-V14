export class Collection extends Map {
  get contents() { return [...this.values()]; }
  map(fn) { return this.contents.map(fn); }
  filter(fn) { return this.contents.filter(fn); }
  find(fn) { return this.contents.find(fn); }
}

export function automationEnvironment({ generation = 13, isGM = true } = {}) {
  const registered = new Map(), hooks = new Map(), channels = [], notices = [];
  const storage = new Map([['client', new Map()], ['world', new Map()]]);
  let id = 0;
  const user = { id: 'user', isGM, active: true };
  const users = new Collection([[user.id, user]]);
  if (isGM) users.activeGM = user;
  const game = {
    system: { id: 'DBU-MRR-OLD', version: 'test' }, release: { generation }, version: `${generation}.346`,
    user, users, modules: new Map(), ready: false, combat: null,
    actors: new Collection(), scenes: new Collection(), combats: new Collection(), messages: new Collection(), macros: new Collection(), items: new Collection(),
    settings: {
      settings: registered, storage,
      register: (scope, key, data) => registered.set(`${scope}.${key}`, data),
      get: (scope, key) => {
        const c = registered.get(`${scope}.${key}`), stored = storage.get(c?.scope ?? 'world').get(`${scope}.${key}`);
        return stored ? stored.value : c?.default;
      },
      set: async (scope, key, value) => { const c = registered.get(`${scope}.${key}`); storage.get(c?.scope ?? 'world').set(`${scope}.${key}`, { value }); return value; }
    },
    socket: { on: (channel, fn) => channels.push({ channel, fn }), off() {}, emit() {} },
    keybindings: { register() {} }, i18n: { localize: x => x }
  };
  const classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
  const elements = new Map();
  const document = {
    addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
    getElementById: id => elements.get(id) ?? null,
    createElement: () => ({ addEventListener() {}, remove() {}, classList, style: { setProperty() {} } }),
    body: { classList, appendChild: element => elements.set(element.id, element) },
    documentElement: { style: { setProperty() {} } }
  };
  function install() {
    Object.assign(globalThis, {
      game, document, window: globalThis,
      Hooks: {
        on: (event, fn) => { const n = ++id; hooks.set(n, { event, fn }); return n; },
        once: (event, fn) => { const n = ++id; hooks.set(n, { event, fn, once: true }); return n; },
        off: (_event, n) => hooks.delete(n), callAll() {}
      },
      canvas: { ready: false, tokens: { controlled: [], placeables: [] } },
      ui: { notifications: Object.fromEntries(['error', 'warn', 'info'].map(type => [type, (...args) => notices.push({ type, args })])), controls: { initialize: async () => {} } },
      foundry: { utils: { deepClone: structuredClone, hasProperty: (o, key) => key.split('.').every(k => { if (o == null || !(k in o)) return false; o = o[k]; return true; }) } },
      CONFIG: { Actor: { documentClass: class {} }, sounds: { dice: 'dice' } }
    });
  }
  return { game, registered, storage, hooks, channels, notices, elements, install };
}

export function documentWithFlags(flags, extra = {}) {
  return {
    flags: structuredClone(flags), updates: [], ...extra,
    async unsetFlag(scope, key) {
      const parts = key.split('.'); let obj = this.flags[scope];
      for (const part of parts.slice(0, -1)) obj = obj?.[part];
      if (obj) delete obj[parts.at(-1)];
    },
    async update(changes) {
      this.updates.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split('.'); let obj = this;
        for (const key of parts.slice(0, -1)) obj = obj[key] ??= {};
        obj[parts.at(-1)] = structuredClone(value);
      }
    }
  };
}
