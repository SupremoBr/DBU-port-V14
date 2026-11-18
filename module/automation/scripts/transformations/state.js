// DBU Automation — Transformation shared state/constants


import { SYSTEM_ID as MODULE_ID } from "../../package.mjs";
export { MODULE_ID };

export const KI_MULT_ENCOUNTER_FLAG = "kiMultiplierEncounter092";
export const BASE_TOKEN_FLAG = "transformationBaseToken";
export const LAST_VISUAL_FLAG = "transformationLastVisual";
export const VISUAL_EFFECT_PREFIX = "DBU-Automation-Transformation";

export const transformationRuntime = globalThis.DBU_TRANSFORMATION_RUNTIME || {
  visualSyncSuppressions: new Map(),
  queuedVisualSync: new Set()
};

transformationRuntime.visualSyncSuppressions ??= new Map();
transformationRuntime.queuedVisualSync ??= new Set();
globalThis.DBU_TRANSFORMATION_RUNTIME = transformationRuntime;
