import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

async function api({configured = true, session = {access_token:'test-token'}, response, database} = {}) {
  let requests = 0;
  const context = vm.createContext({Headers, FormData, URLSearchParams, fetch: async () => {
    requests++;
    if (response instanceof Error) throw response;
    return response ?? {ok:true,json:async()=>({saved:true})};
  }});
  const supabase = {auth:{getSession:async()=>({data:{session},error:null})},from:database ?? (()=>{throw new Error('Unexpected direct database call');})};
  const stub = new vm.SyntheticModule(['supabase','isSupabaseConfigured'], function() {
    this.setExport('supabase',supabase); this.setExport('isSupabaseConfigured',configured);
  },{context});
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    const source = await readFile(new URL(`../src/${file}`,import.meta.url),'utf8');
    const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
    const mod = new vm.SourceTextModule(code,{context,initializeImportMeta(meta){meta.env={};}});
    modules.set(file,mod);
    await mod.link(specifier => {
      if (specifier.endsWith('supabase')) return stub;
      if (specifier.endsWith('/api')) return load('lib/api.ts');
      throw new Error(`Unexpected import: ${specifier}`);
    });
    return mod;
  }
  const mod = await load('services/reviewApi.ts');
  await mod.evaluate();
  return {review:mod.namespace.reviewApi,request:modules.get('lib/api.ts').namespace.requestApi,requests:()=>requests};
}

for (const [label, options, expected] of [
  ['missing configuration',{configured:false},/not configured/],
  ['expired session',{session:null},/expired/],
  ['server rejection',{response:{ok:false,status:403,json:async()=>({detail:'Forbidden'})}},/Forbidden/],
  ['network failure',{response:new Error('Network unavailable')},/Network unavailable/],
]) {
  test(`${label} cannot become a successful mutation`,async()=>{
    const client = await api(options);
    await assert.rejects(client.request('/api/save',{method:'POST',body:'{}'}),expected);
    if (options.configured === false || options.session === null) assert.equal(client.requests(),0);
  });
}

test('approval failure has no database fallback',async()=>{
  const client = await api({response:{ok:false,status:500,json:async()=>({detail:'Transaction failed'})}});
  await assert.rejects(client.review.approveActionItems('11111111-1111-4111-8111-111111111111',[
    {id:'22222222-2222-4222-8222-222222222222',title:'Fix login',assignee_id:null},
  ]),/Transaction failed/);
  assert.equal(client.requests(),1);
});

test('invalid meeting IDs cannot approve locally',async()=>{
  const client = await api();
  await assert.rejects(client.review.approveActionItems('sample-meeting',[]),/valid meeting/);
  assert.equal(client.requests(),0);
});

test('send failure is propagated',async()=>{
  const client = await api({response:new Error('Offline')});
  await assert.rejects(client.review.sendFollowUp('11111111-1111-4111-8111-111111111111',{}),/Offline/);
});

test('successful empty transcript stays empty',async()=>{
  const client = await api({database:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})});
  const result = await client.review.fetchTranscript('11111111-1111-4111-8111-111111111111');
  assert.equal(result.length,0);
});

test('malformed successful response cannot count as a saved mutation',async()=>{
  const client = await api({response:{ok:true,status:200,json:async()=>{throw new Error('Not JSON');}}});
  await assert.rejects(client.request('/api/save',{method:'POST',body:'{}'}),/unreadable response/);
});
