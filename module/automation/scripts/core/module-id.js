// The embedded automation uses Foundry's real system scope and socket channel.
import { SYSTEM_ID, AUTOMATION_SOCKET } from '../../package.mjs';
export function detectModuleId() { return SYSTEM_ID; }
export const MODULE_ID = SYSTEM_ID;
export const MODULE_SOCKET = AUTOMATION_SOCKET;
