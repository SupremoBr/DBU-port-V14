import { progressionRowIsEarned, usesPathToPower } from './path-to-power-v093.mjs';
import { CATALOGS_093 } from './catalogs-v093.mjs';

const talentsByName = new Map(CATALOGS_093.talents.map(talent => [talent.name, talent]));
// These Skill talents require another Skill talent in the 0.9.3 catalog.
const dependentSkillTalents = new Set([
  'Dynamic Hype', 'Team Pose', 'Flexible Planning', 'Assassinate',
  'Master Assassin', 'Last Ditch Effort', 'Team Survivalist',
]);

export function progression093(system, rows, tpPerSkillImprovement = 0) {
  const initialSkillIndex = rows.findIndex(row =>
    Number(row.level) === 1 && row.perkType === 'skill_improvement' && !row.convertible
  );
  const martial = usesPathToPower(system);
  const skillRankSlots = rows.map((row, index) =>
    row.perkType === 'martial_rank' ? 1 : index === initialSkillIndex && !martial ? 6 : 4
  );
  let totalTP = Number(system.downtime?.gains?.tp) || 0;
  let skillImprovementCount = 0;
  const tpRows = rows.map((row, index) => {
    const isSkillImprovement = row.perkType === 'skill_improvement';
    const defaultTP = index === initialSkillIndex && !martial ? 25 : 15;
    // Older sheets could save the displayed 25 TP on a converted PL1 perk.
    const savedTP = isSkillImprovement && Number(row.level) === 1 && (row.convertible || (martial && index === initialSkillIndex)) && Number(row.tp) === 25
      ? null : row.tp;
    const tp = isSkillImprovement && (savedTP == null || savedTP === '') ? defaultTP : Number(savedTP) || 0;
    if (progressionRowIsEarned(system, row)) {
      totalTP += tp;
      if (isSkillImprovement) skillImprovementCount++;
    }
    return { savedTP, tp };
  });
  const bonus = (Number(system.aptitudes?.giftedStudentTPPerSI) || 0)
    + (Number(system.aptitudes?.rapidLearnerTPPerSI) || 0)
    + tpPerSkillImprovement;
  return { skillRankSlots, tpRows, skillImprovementCount, totalTP: totalTP + bonus * skillImprovementCount };
}

export function initialProgressionWarnings093(rows, martial = false) {
  const selected = rows
    .filter(row => Number(row.level) === 1 && row.perkType === 'talent_addition' && !row.convertible)
    .map(row => talentsByName.get(row.talent))
    .filter(Boolean);
  const categories = new Set();
  const repeats = new Set();
  const skillTalents = [];
  for (const talent of selected) {
    if (talent.category === 'Miscellaneous') continue;
    if (talent.category === 'Skill') {
      skillTalents.push(talent.name);
      continue;
    }
    if (categories.has(talent.category)) repeats.add(talent.category);
    categories.add(talent.category);
  }
  const warnings = [...repeats].map(category => `Escolha apenas um talento inicial da categoria ${category}.`);
  if (skillTalents.length > 1) {
    for (const name of skillTalents.filter(talent => dependentSkillTalents.has(talent))) {
      warnings.push(`${name} exige outro talento de Skill e não entra na exceção para escolher vários talentos dessa categoria.`);
    }
  }
  for (const row of rows) {
    if (Number(row.level) !== 1 || row.perkType !== 'skill_improvement') continue;
    const ranks = [row.skill0, row.skill1, row.skill2, row.skill3].filter(Boolean);
    if (new Set(ranks).size !== ranks.length) {
      warnings.push(row.convertible
        ? 'O Skill Improvement do perk convertido precisa de quatro perícias diferentes.'
        : martial ? 'Escolha quatro perícias diferentes no Skill Improvement do ML 1.'
          : 'Escolha quatro perícias diferentes nos primeiros campos do Skill Improvement inicial. Os dois ranks extras podem repetir uma perícia.');
    }
  }
  return warnings;
}
