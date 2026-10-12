// Contrato HTTP estável entre o GitHub Pages e o servidor independente no Render.
// Contrato para migração futura; a partida local atual não acessa esta API.
// NUNCA usar resultado/HP calculado pelo navegador como verdade numa partida online.
const configuredUrl=(import.meta.env.PUBLIC_POKEARENA_API_URL||'').replace(/\/+$/,'');
export const API_URL=configuredUrl||(
  typeof location!=='undefined' && ['localhost','127.0.0.1'].includes(location.hostname)
    ? 'http://localhost:10000' : ''
);

async function request(path,{method='GET',payload,token}={}) {
  if(!API_URL) throw Error('Servidor competitivo não configurado. Defina PUBLIC_POKEARENA_API_URL no build do site.');
  const headers = {};
  if(payload !== undefined) headers['Content-Type'] = 'application/json';
  if(token) headers.Authorization = `Bearer ${token}`;
  const options = {method,headers,cache:'no-store'};
  if(payload !== undefined) options.body = JSON.stringify(payload);
  const response = await fetch(`${API_URL}/api/v1${path}`,options);
  const body = await response.json().catch(()=>({error:'Resposta inválida da API.'}));
  if(!response.ok) throw Error(body.error || `HTTP ${response.status}`);
  return body;
}
export const getHealth=()=>request('/health');
export const createRemoteMatch=players=>request('/matches',{method:'POST',payload:{players}});
export const getRemoteMatch=(id,token)=>request(`/matches/${encodeURIComponent(id)}`,{token});
export const submitRemoteAction=(id,token,action)=>request(`/matches/${encodeURIComponent(id)}/actions`,{method:'POST',token,payload:action});
