importScripts('lib.js');
const C=LexoraCore;
chrome.runtime.onInstalled.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{}));
chrome.runtime.onStartup.addListener(()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{}));
const getStore=keys=>chrome.storage.local.get(keys);
const setStore=value=>chrome.storage.local.set(value);
async function settings(){return(await getStore(['settings'])).settings||{endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-flash'};}
async function complete(kind,data){
  const config=await settings();if(!config.key)throw new Error('请先在设置中保存 DeepSeek API 密钥。');
  const endpoint=new URL(config.endpoint||'https://api.deepseek.com/chat/completions');if(endpoint.protocol!=='https:'||endpoint.hostname!=='api.deepseek.com')throw new Error('扩展版仅连接 DeepSeek 官方接口。');
  const response=await fetch(endpoint.href,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${config.key}`},body:JSON.stringify({model:config.model||'deepseek-flash',messages:C.messagesFor(kind,data),thinking:{type:'disabled'},max_tokens:kind==='translateBatch'||kind==='overview'?4096:kind==='explain'?2048:1024})});
  if(response.status===401)throw new Error('DeepSeek 密钥无效。');if(response.status===402||response.status===429)throw new Error('DeepSeek 额度不足或请求频繁。');if(!response.ok)throw new Error(`DeepSeek 暂时不可用（${response.status}）。`);
  const body=await response.json();const text=body?.choices?.[0]?.message?.content;if(typeof text!=='string'||!text.trim())throw new Error('DeepSeek 没有返回文本。');return text.trim();
}
async function getLibrary(){return(await getStore(['library'])).library||{};}
async function saveLibrary(library){const entries=Object.entries(library).sort((a,b)=>(b[1].accessed||0)-(a[1].accessed||0)).slice(0,12);await setStore({library:Object.fromEntries(entries)});}
async function transcript(info){
  const identity=C.videoIdentity(info.url),library=await getLibrary();
  if(library[identity.id]){library[identity.id].accessed=Date.now();await saveLibrary(library);return{...library[identity.id],cached:true};}
  const config=await settings();if(!config.supadataKey)throw new Error('请先在设置中保存 Supadata API 密钥。');
  const url=new URL('https://api.supadata.ai/v1/transcript');url.search=new URLSearchParams({url:identity.url,lang:'en',text:'false',mode:'native'});
  let response=await fetch(url,{headers:{'x-api-key':config.supadataKey}}),result=await response.json().catch(()=>({}));
  if(response.status===202&&result.jobId){for(let i=0;i<45;i++){await new Promise(r=>setTimeout(r,1000));response=await fetch(`https://api.supadata.ai/v1/transcript/${encodeURIComponent(result.jobId)}`,{headers:{'x-api-key':config.supadataKey}});result=await response.json();if(result.status==='failed')throw new Error('原生字幕获取失败。');if(result.status==='completed'){result=result.result||result;break;}}}
  if(response.status===206)throw new Error('该视频没有可用的原生字幕。');if(!response.ok)throw new Error(`Supadata 字幕服务不可用（${response.status}）。`);
  const doc={...identity,...C.normalizeTranscript(result),title:C.normalize(info.title).slice(0,400),translations:{},overviews:{},accessed:Date.now()};library[doc.id]=doc;await saveLibrary(library);return doc;
}
async function updateDoc(id,fn){const library=await getLibrary(),doc=library[id];if(!doc)throw new Error('请先获取完整字幕。');const value=await fn(doc);doc.accessed=Date.now();await saveLibrary(library);return value;}
async function activeState(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id||!tab.url?.startsWith('https://www.youtube.com/'))throw new Error('请先在当前窗口打开 YouTube 视频。');const result=await chrome.tabs.sendMessage(tab.id,{type:'lexora-state'});if(!result?.ok)throw new Error(result?.error||'无法读取当前视频。');return{...result.value,tabId:tab.id};}
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type==='lexora-playback')return;
  (async()=>{
    const action=message?.action,data=message?.data||{};
    if(action==='state')return activeState();
    if(action==='getSettings'){const value=await settings();return{...value,keySaved:!!value.key,supadataSaved:!!value.supadataKey,key:'',supadataKey:''};}
    if(action==='saveSettings'){const old=await settings(),next={...old,endpoint:'https://api.deepseek.com/chat/completions',model:'deepseek-flash'};if(data.key)next.key=String(data.key).trim();if(data.supadataKey)next.supadataKey=String(data.supadataKey).trim();if(data.clearKey)delete next.key;if(data.clearSupadata)delete next.supadataKey;await setStore({settings:next});return{keySaved:!!next.key,supadataSaved:!!next.supadataKey};}
    if(action==='testAI')return complete('translate',{text:'Learning begins with curiosity.',context:[]});
    if(action==='cachedTranscript'){const state=await activeState(),library=await getLibrary();return library[state.id]||null;}
    if(action==='transcript')return transcript(await activeState());
    if(action==='translateBatch')return updateDoc(data.videoId,async doc=>{const rows=data.rowIds.map(id=>doc.rows.find(row=>row.id===String(id))).filter(Boolean),pending=rows.filter(row=>!doc.translations[row.id]);if(pending.length){const first=doc.rows.indexOf(pending[0]),raw=await complete('translateBatch',{title:doc.title,rows:pending,context:doc.rows.slice(Math.max(0,first-8),first).map(r=>r.text)});Object.assign(doc.translations,C.parseTranslations(raw,pending));}return Object.fromEntries(rows.map(row=>[row.id,doc.translations[row.id]]));});
    if(action==='explain')return complete('explain',data);
    if(action==='overview')return updateDoc(data.videoId,async doc=>{const parts=C.chunksFor(doc.rows);for(let i=0;i<parts.length;i++)if(!doc.overviews[i])doc.overviews[i]=C.parseOverview(await complete('overview',{title:doc.title,rows:parts[i]}),parts[i]);return doc.overviews;});
    if(action==='notes'){return(await getStore(['notes'])).notes||[];}
    if(action==='saveNote'){const notes=(await getStore(['notes'])).notes||[],index=notes.findIndex(note=>note.id===data.id);if(index>=0)notes[index]=data;else notes.unshift(data);await setStore({notes:notes.slice(0,500)});return notes;}
    if(action==='deleteNote'){const notes=((await getStore(['notes'])).notes||[]).filter(note=>note.id!==data.id);await setStore({notes});return notes;}
    if(action==='seek'){const state=await activeState();return chrome.tabs.sendMessage(state.tabId,{type:'lexora-seek',time:data.time});}
    if(action==='pause'){const state=await activeState();return chrome.tabs.sendMessage(state.tabId,{type:'lexora-pause'});}
    throw new Error('未知操作。');
  })().then(value=>sendResponse({ok:true,value})).catch(error=>sendResponse({ok:false,error:error.message}));
  return true;
});
