import { PROFILES_093 } from './profiles-v093.mjs';
export const SUPER_PROFILE_SOURCE = 'https://dbu-rpg.com/super-profiles/';
export const SUPER_PROFILES_093 = Object.freeze({
  'All Out': { kpCost: 2, summary: 'Abaixo de Injured; wager especial, Capacity zerada e Steadfast alterado: resolução manual.' },
  'Cataclysmic Attack': { kpCost: 4, summary: 'Exige AoE; área cobre o Battlefield.' },
  'Combo Attack': { kpCost: 2, summary: 'Exige duas Signatures sem AoE; ataque sequencial OoS: resolução manual.' },
  'Complete Annihilation': { kpCost: 2, summary: 'Exige 3+ charges; Damage Attribute adicional e efeitos contra Undying/Defeated: resolução manual.' },
  Genki: { kpCost: 0, summary: 'Exige Energy Gathering; Lifeforce e Empower especiais: resolução manual.' },
  'Giga Flare': { kpPerAction: 2, requiresProfile: 'Mega Flare', summary: 'Até 2 Actions adicionais; cada Action concede 2 charges. Pagar Actions e aplicar charges manualmente.' },
  Karmic: { kpCost: 2, summary: 'Z-Soul não neutro; Damage Category varia conforme o alinhamento do alvo.' },
  'Multi-Profile': { variable: true, summary: 'Adiciona outro Profile. Custo adicional: 1(T) se base ≤4; 2(T) se 5–7; 3(T) se ≥8.' },
  'Super Beam': { kpCost: 2, requiresProfile: 'Beam', summary: 'Line AoE ampliada pelas charges; Dice Category das charges +1. Aplicar manualmente.' },
  'Super Combination': { kpCost: 2, requiresProfile: 'Combination', summary: 'Actions adicionais concedem vantagens e charges; resolver seus custos e efeitos manualmente.' },
  'Super Launch': { kpCost: 2, requiresProfile: 'Launching', summary: 'Knockback automático; perda adicional de LP conforme deslocamento.' },
  'Weather Maximizer': { kpCost: 4, summary: 'Exige Weather Calling; Battle Weather torna-se Cataclysmic.' }
});
export function superProfileKiUnits093(technique) {
  if (!technique.superProfile) return 0;
  const definition = SUPER_PROFILES_093[technique.superProfile];
  if (!definition) return null;
  if (definition.variable) {
    const chosen = PROFILES_093[technique.secondaryProfile];
    if (!chosen || technique.secondaryProfile === technique.profile) return null;
    return chosen.kpCost <= 4 ? 1 : chosen.kpCost <= 7 ? 2 : 3;
  }
  if (definition.kpPerAction) {
    const actions = Number(technique.superProfileActions || 0);
    return Number.isInteger(actions) && actions >= 0 && actions <= 2 ? definition.kpPerAction * actions : null;
  }
  return definition.kpCost;
}
