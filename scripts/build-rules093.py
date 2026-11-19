#!/usr/bin/env python3
"""Build factual reference indexes from a local, reviewed website snapshot.
Usage: python3 scripts/build-rules093.py /path/to/rules093
The research HTML and rule prose are deliberately not distributed.
"""
import json, re, sys
from rules093_reference import level_summary, mechanic_summary, reference_effects, talent_categories
from pathlib import Path
root = Path(sys.argv[1]); target = Path(__file__).resolve().parents[1] / 'module/rules/catalogs-v093.mjs'
read = lambda name: json.loads((root / name).read_text())
old = read('old-catalogs.json'); nav = read('navigation.json')
norm = lambda s: re.sub('[^a-z0-9]', '', str(s).lower())
key = lambda s: re.sub('[^a-z0-9]+', '_', str(s).lower()).strip('_')
url = lambda slug: 'https://dbu-rpg.com/' + slug + '/'
def equivalent(a, b):
 return [(e.get('level'), norm(e.get('keyword')), norm(e.get('text'))) for e in a] == [(e.get('level'), norm(e.get('keyword')), norm(e.get('text'))) for e in b]
def mechanic(e):
 if e['keyword'].lower()!='passive': return None
 text=e['text'].strip()
 # Exact, unconditional clauses only. Conditional and compound rules remain manual.
 match=re.fullmatch(r'(Increase|Reduce) (?:your |the )?(Strike Rolls|Wound Rolls|Dodge Rolls|Defense Value|Soak Value|Might|Stress Bonus|Saving Throws|Initiative|Awareness|Haste) by (\d+)(?:\((T|bT)\))?\.',text)
 if match:
  targets={'Strike Rolls':'strikeBuffTotal','Wound Rolls':'woundBuffTotal','Dodge Rolls':'dodgeBuffTotal','Defense Value':'defenseValue','Soak Value':'soak','Might':'might','Stress Bonus':'stressBonus','Saving Throws':'allSaves','Initiative':'initiative','Awareness':'awareness','Haste':'haste'}
  return dict(target=targets[match[2]],amount=int(match[3])*(1 if match[1]=='Increase' else -1),scale=match[4] or 'flat')
 match=re.fullmatch(r'Reduce the Critical Target of your (Strike|Wound|Dodge) Rolls by (\d+)\.',text)
 if match:return dict(target=match[1].lower()+'CTBonus',amount=int(match[2]),scale='flat')
 return None
def effect(e, source):
 kw = e['keyword']; match = re.search(r'(\d+)\s*/\s*(Round|Encounter)', kw, re.I)
 rule=mechanic(e)
 summary=(str(rule['target'])+': '+str(rule['amount'])+' × '+rule['scale']+'.') if rule else 'Referência 0.9.3: resolver este efeito na fonte oficial; sem automação herdada.'
 return dict(level=e['level'], keyword=kw, activationType='limited' if match else 'option' if 'Option' in kw else 'triggered' if 'Triggered' in kw else 'passive', usageLimit=match[2].lower() if match else None, maxUses=int(match[1]) if match else None, text=summary, source=source, mechanic=rule)
def catalog_effects(row, source, legacy_effects=None):
 effects = reference_effects(row)
 if legacy_effects is not None:
  return [dict(legacy, summary=level_summary(row, current)) for legacy,current in zip(legacy_effects,effects,strict=True)]
 result = []
 for current in effects:
  entry = effect(current, source)
  if not row['effects']:
   # Recover display blocks without opting the previously unparsed row into automation.
   entry['mechanic'] = None
  entry['summary'] = level_summary(row, current)
  result.append(entry)
 return result

race_slugs = {'android':'androids','angel':'angels','arcosian':'arcosians','bioAndroid':'bio-android','cerealian':'cerealians','demon':'demons','earthling':'earthlings','glassTribe':'glass-tribe','heran':'herans','konatsian':'konatsians','majin':'majins','namekian':'namekians','nekoMajin':'neko-majins','neoTuffle':'neo-tuffles','saiyan':'saiyans','shadowDragon':'shadow-dragons','shinjin':'shinjin','yardrat':'yardrats','customSpecies':'custom-species'}
by_title = {next(e['title'] for e in nav['Races'] if e['slug']==slug):race for race,slug in race_slugs.items()}
old_traits = [t for ts in old['races'].values() for t in ts]
traits = {}; racial_map = {}; factor_options = {}; subrace_options = {}
for slug, rows in read('parsed-racial.json').items():
 entry = next(e for e in nav['Races'] if e['slug']==slug)
 path = entry['path']; race = by_title.get(path[1] if len(path)>1 else '', 'factors')
 if race != 'factors' and len(path)>2:
  subrace_options.setdefault(race, []).append(dict(id=slug, name=entry['title']))
 for row in rows:
  candidates = [t for t in old_traits if norm(t['name'])==norm(row['name']) and (t['race']==race or race=='factors')]
  same = [t for t in candidates if equivalent(t.get('effects',[]),row['effects'])]
  reviewed = False
  ident = same[0]['id'] if reviewed else 'r093_'+key(slug+'_'+row['name'])
  item = dict(id=ident, name=row['name'], race=race, category=row['category'], traitCategory=row['traitCategory'], subrace=slug if len(path)>2 else '', source=url(slug), rulesVersion='0.9.3', automation='legacy-reviewed' if reviewed else 'manual', description=mechanic_summary(row), effects=catalog_effects(row,url(slug),same[0]['effects'] if reviewed else None), isSelectable=True)
  traits.setdefault(race, []).append(item)
  for t in candidates: racial_map.setdefault(t['id'],[]).append(ident)
# Explicit rename verified on the Saiyan page. No approximate-name matching.
born = next(t for t in traits['saiyan'] if t['name']=='Born for Battle')
racial_map['908d85ede236e3ce'] = [born['id']]
heritage = next(t for t in traits['saiyan'] if t['name']=='Saiyan Heritage')
heritage['effects'][-1]['options']=[dict(name='Tailed',activationType='passive',keyword='Passive',text='Cauda: Stress +1; +2 a partir de bT 5.'),dict(name='Tailless',activationType='passive',keyword='Passive',text='Em Form ou Enhancement: Wound e Soak +1(T).')]
heritage['effects'][-1]['text']='Escolha a opção racial de cauda.'
heritage['effects'][-1]['summary']=heritage['effects'][-1]['text']
heritage['effects'][-1]['activationType']='option'
summaries={'Born for Battle':['Rodadas pares: 1 Battle Born; escolha Strike, Dodge ou Wound. Limite 2 por rolagem; bônus +1(T) por stack.','Ao cruzar limiar de vida: Ki Surge OoS; se usada, ganhe 1 Battle Born.','Após Heritage 2: pelo menos 3 Battle Born em cada rolagem, uma vez por encontro.','Critical ou Triggered/Defeated: Zenkai temporário de nível 1, uma vez por encontro.'], 'Warrior’s Pride':['Proficiência racial também em Cognitive.','Superior: ignorar penalidades de limiar, Impaired e Fatigued.','Raging/Power: Superior até o fim do próximo turno; uma vez por encontro.','Início do encontro: 1 Battle Born.'], 'Blood of the Warrior':['Cada limiar cruzado: Wound, Soak e Surgency +1(T).','Uma Healing Surge por encontro recebe o dobro de Surgency.','Início do turno: com 6 Battle Born ou abaixo de Injured, Breakthrough +1 T até o fim do turno; uma vez por encontro.'], 'Powerful Physique':['Soak adicional: teto(Force Modifier ÷ 4).','Com Power 2+: Force Modifier +1(T).','Uma Defend por rodada: dobre o bônus de Soak deste traço.','Após sofrer um acerto: Basic Attack OoS com Force adicional em Wound; uma vez por encontro.']}
for t in traits['saiyan']:
 if t['name'] in summaries:
  for e,text in zip(t['effects'],summaries[t['name']]):
   e['text']=text
   e['summary']=text
talents=[]; talent_map={}
talent_groups = talent_categories((root / 'sources/talents.html').read_text())
for row in read('parsed-talents.json'):
 candidates=[t for t in old['talents'] if norm(t['name'])==norm(row['name'])]
 reviewed=len(candidates)==1 and equivalent(candidates[0].get('effects',[]),row['effects'])
 ident=candidates[0]['id'] if reviewed else 'r093_'+key(row['name'])
 category = talent_groups[row['name']]
 t=dict(id=ident,name=row['name'],category=category,prerequisites='Ver fonte oficial.',source=url('talents'),rulesVersion='0.9.3',automation='legacy-reviewed' if reviewed else 'manual',description=mechanic_summary(row),effects=catalog_effects(row,url('talents'),candidates[0]['effects'] if reviewed else None))
 talents.append(t)
 for c in candidates: talent_map[c['id']]=ident
transforms={}; trans_map={}
for i,row in enumerate(read('parsed-transformations.json')):
 m=row['metadata']; p=' '.join(row['navigationPath']).lower(); kind=m['Transformation Type'].lower()
 is_awake='awakening' in kind or 'awakenings' in p
 category='manifested_power' if is_awake else 'enhancement_power' if 'enhancement' in kind or 'enhancements' in p else 'form_legendary' if 'legendary' in p or 'legendary' in m.get('Form Type','').lower() else 'form_alternate'
 ident='r093_'+key(row['page']+'_'+row['name']); suffix=1
 while ident in transforms: suffix+=1; ident='r093_'+key(row['page']+'_'+row['name'])+'_'+str(suffix)
 attrs={k.lower():v for k,v in row['attributes'].items()}
 stress=m.get('Stress Test Requirement','0'); stack=m.get('Maximum No of Stacks','1')
 source=row['url']; aspects=[x.strip() for x in re.split(r',\s*(?![^()]*\))',m.get('Aspects','')) if x.strip()]
 transforms[ident]=dict(id=ident,name=row['name'],category=category,awakeningType=m.get('Awakening Type','Lesser' if is_awake else ''),awakeningOrigin=m.get('Awakening Origin',''),racialRequirement=m.get('Racial Requirement','Revisar pré-requisito da forma base'),tierRequirement=m.get('Tier of Power Requirement',''),stressTest=int(stress) if stress.isdigit() else 0,stressFormula=stress,maxStacks=int(stack) if stack.isdigit() else 1,attrBonuses=attrs,aspects=[],referenceAspects=aspects,transcended='transcendent' in m.get('Enhancement Type','').lower(),prerequisites=m.get('Prerequisite(s)',''),source=source,rulesVersion='0.9.3',automation='attributes-only',requiresReview=any(not re.fullmatch(r'(?:[-–—]|\+?\d+(?:\((?:T|bT)\))?|)',str(v).strip()) for v in attrs.values()) or not stress.isdigit(),traitGroups=[dict(name=g['name'],kind=g['kind'],effects=[effect(e,source) for e in g['effects']]) for g in row['traitGroups']])
for oldkey,t in old['transformations'].items():
 # Category disambiguates duplicate names such as Super Perfect Form.
 matches=[x['id'] for x in transforms.values() if norm(x['name'])==norm(t['name']) and x['category']==t['category']]
 if len(matches)==1:trans_map[oldkey]=matches[0]
# Canonical renamed entry on the unchanged official /unlock-potential/ page.
matches=[x['id'] for x in transforms.values() if x['name']=='Unlocked Potential' and x['category']=='manifested_power']
if len(matches)==1:trans_map['unlock_potential']=matches[0]
modifiers={}
for group,rows in read('parsed-signature.json').items():
 out={}
 for row in rows:
  costs=[int(n) for n in re.findall(r'(?<!\w)-?\d+',row['cost'])]
  if not costs:raise ValueError(row)
  out[row['name']]=dict(tpPerRank=costs if len(costs)>1 else costs[0],maxRanks=len(costs),hasNotes=True,requirement='Consultar requisitos 0.9.3 na fonte.',effect='Aplicar o efeito atual descrito na fonte oficial.',source=url('signature'))
 modifiers[group]=out
payload=dict(racialTraits=traits,talents=talents,transformations=transforms,advantages=modifiers['Advantages'],disadvantages=modifiers['Disadvantages'],raceSlugs=race_slugs, subraceOptions=subrace_options, migrationMaps=dict(racialTraits={k:list(dict.fromkeys(v)) for k,v in racial_map.items()},talents=talent_map,transformations=trans_map),unavailableSources=['https://dbu-rpg.com/?page_id=10503'])
data_dir=target.parent/'data';data_dir.mkdir(exist_ok=True)
header='// Generated factual index; full rules remain at the linked official sources.\n'
compact=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':'))
def write_object(filename, export, value):
 text=header+'export const '+export+' = {\n'+',\n'.join('  '+compact(k)+':'+compact(v) for k,v in value.items())+'\n};\n'
 (data_dir/filename).write_text(text)
write_object('racial-traits-v093.mjs','RACIAL_TRAITS_093',traits)
(data_dir/'talents-v093.mjs').write_text(header+'export const TALENTS_093 = [\n'+',\n'.join('  '+compact(t) for t in talents)+'\n];\n')
write_object('transformations-v093.mjs','TRANSFORMATIONS_093',transforms)
write_object('signature-modifiers-v093.mjs','SIGNATURE_MODIFIERS_093',modifiers)
write_object('migration-maps-v093.mjs','REFERENCE_METADATA_093',{k:v for k,v in payload.items() if k not in ['racialTraits','talents','transformations','advantages','disadvantages']})
target.write_text(header+"""import { RACIAL_TRAITS_093 } from './data/racial-traits-v093.mjs';
import { TALENTS_093 } from './data/talents-v093.mjs';
import { TRANSFORMATIONS_093 } from './data/transformations-v093.mjs';
import { SIGNATURE_MODIFIERS_093 } from './data/signature-modifiers-v093.mjs';
import { REFERENCE_METADATA_093 } from './data/migration-maps-v093.mjs';
export const CATALOGS_093 = {
  racialTraits: RACIAL_TRAITS_093, talents: TALENTS_093,
  transformations: TRANSFORMATIONS_093,
  advantages: SIGNATURE_MODIFIERS_093.Advantages,
  disadvantages: SIGNATURE_MODIFIERS_093.Disadvantages,
  ...REFERENCE_METADATA_093
};
""")
print('Wrote',target,len(talents),len(transforms),sum(map(len,traits.values())))
