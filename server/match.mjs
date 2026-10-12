import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { RULES } from './game/rules.mjs';
import { createParticipant } from './game/roster.mjs';

// Somente o servidor cria e altera estado competitivo. Nunca aceitar HP,
// vencedor, ouro ou lineup final fornecidos pelo navegador como verdade.
export function createMatch(playerCount) {
  if (!Number.isInteger(playerCount) || playerCount<RULES.minPlayers || playerCount>RULES.maxPlayers) {
    throw Object.assign(new Error('A sala precisa de 3 a 8 participantes.'),{status:400});
  }
  const token = randomBytes(32).toString('hex');
  const matchId = randomUUID();
  const userId = randomUUID();
  const players = [createParticipant({id:userId,name:'Jogador',isBot:false})];
  for(let i=1;i<playerCount;i++)players.push(createParticipant({id:randomUUID(),name:`Bot ${i}`,isBot:true}));
  const state = {
    id:matchId, ownerId:userId, ownerTokenHash:hashToken(token),
    ruleset:RULES.version, revision:0, round:1,
    // Ainda não foi implementado o motor competitivo das etapas 02-07.
    // Não criar vencedores ou partidas fictícias por conveniência.
    phase:'awaiting-match-engine',
    createdAt:new Date().toISOString(), players,
    outcomes:[], championId:null, pool:{},pairings:[],phaseDeadline:null
  };
  return {state,token};
}
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function authorize(match, token) {
  if(typeof token !== 'string'||token.length!==64||!(/^[a-f\d]+$/i).test(token))return false;
  const supplied=Buffer.from(hashToken(token),'hex');
  const expected=Buffer.from(match.ownerTokenHash,'hex');
  return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}
export function publicMatch(match) {
  return {
    id:match.id,revision:match.revision,ruleset:match.ruleset,
    phase:match.phase,round:match.round,phaseDeadline:match.phaseDeadline,
    players:match.players.map(p => ({
      id:p.id,name:p.name,isBot:p.isBot,hp:p.hp,gold:p.id===match.ownerId?p.gold:undefined,
      eliminated:p.eliminated,board:p.id===match.ownerId?p.board:undefined,
      bench:p.id===match.ownerId?p.bench:undefined,
      shop:p.id===match.ownerId?p.shop:undefined
    })),
    pairings:match.pairings,outcomes:match.outcomes,championId:match.championId,
    capabilities:{competitiveActions:false,authoritativeVictory:true}
  };
}
