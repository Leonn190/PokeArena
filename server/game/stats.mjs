import {NIVEIS} from '../../config/niveis.mjs';
import {ATRIBUTOS_DE_COMBATE} from '../../config/status-pokemon.mjs';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(value))?Number(value):min));
const decimals=(key,value)=>['energia','regeneracao'].includes(key)?Math.round(value*1000)/1000:Math.round(value);
export const normalizedLevel=value=>Math.round(clamp(value??NIVEIS.inicial,0,NIVEIS.maximo));
export const levelMultiplier=level=>1+normalizedLevel(level)*NIVEIS.atributoPorNivel;
export const ivMultiplier=iv=>.85+clamp(iv,0,100)*.003;
export function individualIVs(entry={}){
  // Unidades antigas usam o IV global como valor compatível dos oito atributos.
  const legacy=clamp(entry.iv??50,0,100);
  return Object.fromEntries(ATRIBUTOS_DE_COMBATE.map(key=>[key,clamp(entry.ivs?.[key]??legacy,0,100)]));
}
export function meanIV(entry){const values=Object.values(individualIVs(entry));return values.reduce((sum,x)=>sum+x,0)/values.length;}
export function mergedIVs(units){
  return Object.fromEntries(ATRIBUTOS_DE_COMBATE.map(key=>[key,Math.max(...units.map(unit=>individualIVs(unit)[key]))]));
}
export function perfectIVs(){return Object.fromEntries(ATRIBUTOS_DE_COMBATE.map(key=>[key,100]));}
export function effectiveUnitStats(pokemon,entry={}){
  const ivs=individualIVs(entry),level=levelMultiplier(entry.level);
  const boss=entry.bossIv>100?entry.bossIv:null;
  const output={};
  for(const key of ATRIBUTOS_DE_COMBATE){
    const base=pokemon.stats[key]??(key==='energia'?1:0);
    // Chefe >100 IV usa a mesma escala histórica para cada atributo.
    const multiplier=boss!==null ? (.85+.003*boss) : ivMultiplier(ivs[key]);
    let factor=level*multiplier;
    if(entry.pveModifiers){
      const mods=entry.pveModifiers;
      factor*=key==='vida'?mods.hp:['atk','spa'].includes(key)?mods.offense:mods.stats;
    }
    if(pokemon.name==='Zygarde'&&entry.zygardeProgress){
      const progress=Math.min(100,entry.zygardeProgress);
      factor*=1+progress*.0025+(progress>=50?.08:0)+(progress===100?.15:0);
    }
    output[key]=decimals(key,base*factor);
  }
  return output;
}
// Índice sem unidades: cada grandeza é normalizada contra um valor de referência
// de batalha. DPS (atk/spa/vel), tanque (vida/def/spd) e energia têm pesos
// explícitos. Regeneração normalizada separadamente; não se somam HP com HP/s.
export function combatPower(stats){
  const normalized=[
    [.20,(stats.vida??0)/120],[.17,(stats.atk??0)/105],
    [.14,(stats.spa??0)/105],[.14,(stats.def??0)/105],
    [.13,(stats.spd??0)/105],[.12,(stats.vel??0)/105],
    [.07,(stats.energia??0)/1],[.03,(stats.regeneracao??0)/5]
  ];
  return Math.max(0,Math.round(100*normalized.reduce((sum,[weight,value])=>sum+weight*Math.max(0,value),0)));
}
export function applyStructureStats(baseStats,modifiers={}){
  return Object.fromEntries(Object.entries(baseStats).map(([key,value])=>[
    key,decimals(key,value*(1+(modifiers[key]||0)))
  ]));
}
