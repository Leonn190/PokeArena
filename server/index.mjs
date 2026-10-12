import { createServer } from 'node:http';
import { createStore } from './store.mjs';
import { createMatch, authorize, publicMatch } from './match.mjs';

const PORT=Number(process.env.PORT||10000);
const origins=new Set([
  'https://leonn190.github.io',
  'http://localhost:4321',
  'http://127.0.0.1:4321',
  ...(process.env.CORS_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean)
]);
const store=await createStore(process.env.DATABASE_URL);
const respond=(res,status,data)=>{
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
};
async function bodyJson(req) {
  let data='';
  for await (const chunk of req) {
    data+=chunk.toString('utf8');
    if(Buffer.byteLength(data)>64*1024)throw Object.assign(Error('Corpo muito grande.'),{status:413});
  }
  try{return JSON.parse(data||'{}');}
  catch{throw Object.assign(Error('JSON inválido.'),{status:400});}
}
function authenticate(req, match) {
  const header=req.headers.authorization||'';
  const token=header.startsWith('Bearer ')?header.slice(7):null;
  return authorize(match,token);
}
const api=createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  }
  if(origin&&!origins.has(origin))return respond(res,403,{error:'Origem não autorizada.'});
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/v1/health'){
      return respond(res,200,{status:'ok',service:'pokearena',api:'v1',storage:store.provider,competitiveReady:false});
    }
    if(req.method==='POST'&&url.pathname==='/api/v1/matches'){
      const input=await bodyJson(req);
      const {state,token}=createMatch(input.players);
      await store.create(state);
      return respond(res,201,{match:publicMatch(state),playerId:state.ownerId,token});
    }
    const route=url.pathname.match(/^\/api\/v1\/matches\/([a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})(?:\/(actions))?$/i);
    if(route){
      const match=await store.get(route[1]);
      if(!match)return respond(res,404,{error:'Partida não encontrada.'});
      if(!authenticate(req,match))return respond(res,401,{error:'Sessão inválida.'});
      if(req.method==='GET'&&!route[2])return respond(res,200,{match:publicMatch(match)});
      if(req.method==='POST'&&route[2]==='actions'){
        // Ações nunca poderão informar vitória, HP ou resultados diretamente.
        // A etapa 02 substituirá este bloqueio por comandos validados no servidor.
        return respond(res,501,{error:'Comandos competitivos ainda não implementados. Veja o plano, etapa 02.'});
      }
    }
    return respond(res,404,{error:'Rota não encontrada.'});
  } catch(error) {
    const status=Number.isInteger(error.status)?error.status:500;
    if(status>=500)console.error('[PokeArena API]',error);
    return respond(res,status,{error:status>=500?'Erro interno da API.':error.message});
  }
});
api.listen(PORT,'0.0.0.0',()=>console.log(`PokeArena API em porta ${PORT} (${store.provider})`));
const shutdown=async()=>{api.close();await store.close();};
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
