// DBU Automation — Signature Aura shared state/constants



import { SYSTEM_ID as MODULE_ID } from "../../package.mjs";
export { MODULE_ID };

export const AURA_MAINTENANCE_FLAG = "auraMaintenanceKey";

export const auraRuntime = globalThis.DBU_SIGNATURE_AURA_RUNTIME || {
  pending: new Set()
};

auraRuntime.pending ??= new Set();
globalThis.DBU_SIGNATURE_AURA_RUNTIME = auraRuntime;
