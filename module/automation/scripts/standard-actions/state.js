import { AUTOMATION_SOCKET } from "../../package.mjs";
// DBU Automation — Standard Actions shared state/constants


import { SYSTEM_ID as MODULE_ID } from "../../package.mjs";
export { MODULE_ID };

export const SYS_ID = "DBU-MRR-OLD";
export const FAVORITES_SETTING = "combatHudFavoriteActions";
export const POWER_BUFF_MARKER = "[DBU Automation] Power stacks";
export const RECOVERY_BUFF_MARKER = "[DBU Automation] Combat Recovery";
export const MIRACLE_BUFF_PREFIX = "[DBU Automation] Miracle Empowerment:";
export const STATE_FLAG = "standardManeuverState";
export const SOCKET = AUTOMATION_SOCKET;

export const state = globalThis.DBU_STANDARD_ACTIONS || {
  initialized: false,
  hooks: {},
  providers: [],
  socketHandler: null,
  renderTimers: new Map(),
  pendingRequests: new Map()
};
state.providers ??= [];
state.hooks ??= {};
state.renderTimers ??= new Map();
state.pendingRequests ??= new Map();
globalThis.DBU_STANDARD_ACTIONS = state;
