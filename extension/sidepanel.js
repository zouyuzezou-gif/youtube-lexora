const $=id=>document.getElementById(id),C=LexoraCore,pageSize=30;
let doc=null,page=0,playingId='',lastTime=0,busy=false,generation=0,selected=null,notes=[],batchSize=10,parallelBatches=3;
const call=async(action,data={})=>{const result=await chrome.runtime.sendMessage({action,data});if(!result?.ok)throw new Error(result?.error||'扩展服务没有响应。');return result.value;};
const stamp=value=>`${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;
function showTab(name){document.querySelectorAll('.tab').forEach(x=>x.hidden=x.id!==`${name}-tab`);document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));}
document.querySelectorAll('nav button').forEach(button=>button.onclick=()=>showTab(button.dataset.tab));
function rows(){const q=$('search').value.trim().toLocaleLowerCase();return(doc?.rows||[]).filter(row=>!q||`${row.text} ${doc.translations[row.id]||''}`.toLocaleLowerCase().includes(q));}
function visible(){return rows().slice(page*pageSize,(page+1)*pageSize);}
function selectRow(row,phrase=''){selected=row;$('selected').textContent=row.text;$('focus').value=phrase;$('answer').textContent=row.explanation||'AI 会结合前面的字幕解释语境。';$('tutor').hidden=false;$('tutor').scrollIntoView({block:'nearest'});}
function render(){
  if(!doc)return;const all=rows(),pages=Math.max(1,Math.ceil(all.length/pageSize));page=Math.min(page,pages-1);$('page').textContent=`${page+1} / ${pages} · ${all.length} 条`;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;
  const mode=$('language').value;
  $('rows').replaceChildren(...visible().map(row=>{const card=document.createElement('article');card.className='row'+(row.id===playingId?' playing':'');card.dataset.id=row.id;const time=document.createElement('button');time.className='time';time.textContent=stamp(row.time);time.onclick=()=>call('seek',{time:row.time});card.append(time);const en=document.createElement('p');en.className='english';en.textContent=row.text;if(mode!=='chinese')card.append(en);if(mode!=='original'){const zh=document.createElement('p');zh.className='translation';zh.textContent=doc.translations[row.id]||'正在自动翻译…';card.append(zh);}const actions=document.createElement('div');actions.className='row-actions';const explain=document.createElement('button');explain.textContent='解释';explain.onclick=()=>{const s=getSelection();const phrase=s&&en.contains(s.anchorNode)&&en.contains(s.focusNode)?s.toString().trim().slice(0,400):'';selectRow(row,phrase);};const save=document.createElement('button');save.textContent='保存笔记';save.onclick=()=>saveNote(row);actions.append(explain,save);card.append(actions);return card;}));
  if(playingId&&$('follow').checked)requestAnimationFrame(()=>$('rows').querySelector(`[data-id="${CSS.escape(playingId)}"]`)?.scrollIntoView({block:'center',behavior:'smooth'}));
}
async function translateVisible(){
  if(!doc||busy)return;
  const target=doc,version=generation,pending=target.rows.filter(row=>!target.translations[row.id]);
  if(!pending.length){$('status').textContent='整段中英字幕已准备好，播放视频即可自动跟随。';return;}
  busy=true;$('stop').disabled=false;$('resume-translation').hidden=true;$('status').classList.remove('error');
  let done=target.rows.length-pending.length;
  const progress=()=>{$('status').textContent=`正在准备整段中英字幕：${done} / ${target.rows.length} 条（${Math.round(done/target.rows.length*100)}%）`;};
  try{
    progress();await call('pause');
    const requestBatch=async batch=>{
      try{return await call('translateBatch',{videoId:target.id,rowIds:batch.map(row=>row.id)});}
      catch(error){
        if(batch.length<=10||!/1\s*至\s*10/.test(error.message))throw error;
        batchSize=10;const translated={};
        for(let i=0;i<batch.length;i+=10)Object.assign(translated,await call('translateBatch',{videoId:target.id,rowIds:batch.slice(i,i+10).map(row=>row.id)}));
        return translated;
      }
    };
    const batches=[];for(let i=0;i<pending.length;i+=batchSize)batches.push(pending.slice(i,i+batchSize));
    let cursor=0;
    const worker=async()=>{while(cursor<batches.length){
      if(version!==generation||doc!==target)return;
      const batch=batches[cursor++];let translated,lastError;
      for(let attempt=0;attempt<6;attempt++){
        try{translated=await requestBatch(batch);lastError=null;break;}
        catch(error){
          lastError=error;
          if(/密钥无效|额度不足|请先在设置|仅连接 DeepSeek|每批字幕需/.test(error.message)||attempt===5)break;
          const delay=C.retryDelayMs(attempt);$('status').textContent=`网络或 AI 服务暂时不稳定，${Math.ceil(delay/1000)} 秒后自动继续（第 ${attempt+1}/6 次重试）…`;
          await new Promise(resolve=>setTimeout(resolve,delay));
          if(version!==generation||doc!==target)return;
        }
      }
      if(lastError)throw lastError;
      if(version!==generation||doc!==target)return;
      Object.assign(target.translations,translated);done+=batch.length;render();progress();
    }};
    const outcomes=await Promise.allSettled(Array.from({length:Math.min(parallelBatches,batches.length)},worker)),failure=outcomes.find(result=>result.status==='rejected');
    if(failure)throw failure.reason;
    $('status').textContent='整段中英字幕已准备好，播放视频即可自动跟随。';
  }catch(error){if(version===generation&&doc===target){$('status').textContent=`准备中断：${error.message} 已完成的译文已缓存。`;$('status').classList.add('error');$('resume-translation').hidden=false;}}
  finally{busy=false;$('stop').disabled=true;if(doc&&doc!==target)translateVisible();}
}
function loadDoc(value){doc=value;page=0;playingId='';generation++;$('empty').hidden=true;$('reader').hidden=false;$('title').textContent=doc.title;$('status').textContent=`${doc.cached?'已读取缓存':'字幕已获取'} · ${doc.rows.length} 条 · ${doc.lang}`;$('search').value='';render();translateVisible();renderOverview();}
$('load').onclick=async()=>{const button=$('load');button.disabled=true;button.textContent='正在获取字幕…';try{loadDoc(await call('transcript'));}catch(error){button.insertAdjacentElement('afterend',Object.assign(document.createElement('p'),{className:'status error',textContent:error.message}));}finally{button.disabled=false;button.textContent='获取当前视频完整字幕';}};
$('search').oninput=()=>{page=0;if($('search').value)$('follow').checked=false;render();};$('language').onchange=render;
$('prev').onclick=()=>{page--;$('follow').checked=false;render();};$('next').onclick=()=>{page++;$('follow').checked=false;render();};
$('stop').onclick=()=>{generation++;$('stop').disabled=true;$('resume-translation').hidden=false;$('status').textContent='已停止后续翻译；当前批次完成后会缓存。';};
$('resume-translation').onclick=()=>{if(busy){$('status').textContent='当前批次正在收尾，请稍后继续。';return;}translateVisible();};
$('follow').onchange=()=>{if($('follow').checked){$('search').value='';follow(lastTime,true);}};
function follow(time,force=false){lastTime=Number(time)||0;if(!doc||busy||!$('follow').checked||$('search').value)return;const index=C.playbackIndex(doc.rows,lastTime),row=doc.rows[index];if(!row||(!force&&row.id===playingId))return;playingId=row.id;page=Math.floor(index/pageSize);render();if(doc.rows.every(row=>doc.translations[row.id]))$('status').textContent=`跟随视频 · ${stamp(lastTime)} · 第 ${index+1}/${doc.rows.length} 条`;}
chrome.runtime.onMessage.addListener(message=>{if(message?.type==='lexora-playback'){const value=message.value;$('video-state').textContent=value.title||'YouTube 视频';if(doc&&value.id!==doc.id){doc=null;generation++;$('empty').hidden=false;$('reader').hidden=true;$('overview').replaceChildren();checkCached();}else follow(value.time);}});
async function checkCached(){try{const value=await call('cachedTranscript');if(value)loadDoc({...value,cached:true});}catch{} }
async function saveNote(row){notes=await call('saveNote',{...row,id:`${doc.id}:${row.id}`,videoId:doc.id,url:doc.url,title:doc.title,translation:doc.translations[row.id]||'',explanation:row.explanation||''});renderNotes();}
$('explain').onclick=async()=>{if(!selected||busy)return;busy=true;$('answer').textContent='正在结合语境解释…';try{await call('pause');const index=doc.rows.indexOf(selected);selected.explanation=await call('explain',{text:selected.text,title:doc.title,context:doc.rows.slice(Math.max(0,index-8),index).map(row=>row.text),focus:$('focus').value});$('answer').textContent=selected.explanation;}catch(error){$('answer').textContent=error.message;}finally{busy=false;}};
$('save-note').onclick=()=>selected&&saveNote(selected);
function renderOverview(){const nodes=[];for(const [i,part] of Object.entries(doc?.overviews||{})){const box=document.createElement('section');box.className='overview-part';const heading=document.createElement('h2'),summary=document.createElement('p');heading.textContent=`第 ${Number(i)+1} 部分`;summary.textContent=part.summary;box.append(heading,summary);for(const chapter of part.chapters){const p=document.createElement('p');p.className='quote';p.textContent=`${stamp(chapter.time)} · ${chapter.title} — ${chapter.text}`;p.onclick=()=>call('seek',{time:chapter.time});box.append(p);}nodes.push(box);}$('overview').replaceChildren(...nodes);}
$('generate').onclick=async()=>{if(!doc){$('overview-status').textContent='请先获取完整字幕。';return;}if(busy)return;busy=true;$('overview-status').textContent='正在生成概览…';try{doc.overviews=await call('overview',{videoId:doc.id});renderOverview();$('overview-status').textContent='概览已生成并缓存。';}catch(error){$('overview-status').textContent=error.message;}finally{busy=false;}};
function renderNotes(){const q=$('note-search').value.trim().toLocaleLowerCase(),matches=notes.filter(note=>JSON.stringify(note).toLocaleLowerCase().includes(q));$('note-count').textContent=notes.length;$('notes').replaceChildren(...matches.map(note=>{const box=document.createElement('article');box.className='note';box.innerHTML=`<small>${note.title||''}</small><p class="english"></p><p class="translation"></p>`;box.querySelector('.english').textContent=note.text;box.querySelector('.translation').textContent=note.translation||'尚无译文';const del=document.createElement('button');del.textContent='删除';del.onclick=async()=>{notes=await call('deleteNote',{id:note.id});renderNotes();};box.append(del);return box;}));}
$('note-search').oninput=renderNotes;
async function loadSettings(){const settings=await call('getSettings');$('settings-status').textContent=`DeepSeek：${settings.keySaved?'已保存':'未配置'} · Supadata：${settings.supadataSaved?'已保存':'未配置'}`;}
$('save-settings').onclick=async()=>{try{const saved=await call('saveSettings',{key:$('deepseek-key').value,supadataKey:$('supadata-key').value,clearKey:$('clear-deepseek').checked,clearSupadata:$('clear-supadata').checked});$('deepseek-key').value='';$('supadata-key').value='';$('clear-deepseek').checked=false;$('clear-supadata').checked=false;$('settings-status').textContent=`已保存 · DeepSeek：${saved.keySaved?'是':'否'} · Supadata：${saved.supadataSaved?'是':'否'}`;}catch(error){$('settings-status').textContent=error.message;}};
$('test-ai').onclick=async()=>{try{$('settings-status').textContent='正在测试…';$('settings-status').textContent=`连接成功：${await call('testAI')}`;}catch(error){$('settings-status').textContent=error.message;}};
(async()=>{try{notes=await call('notes');renderNotes();await loadSettings();try{const capabilities=await call('capabilities');batchSize=Math.max(1,Math.min(30,Number(capabilities.maxBatch)||10));parallelBatches=Math.max(1,Math.min(5,Number(capabilities.parallelBatches)||1));}catch{}const state=await call('state');$('video-state').textContent=state.title||'YouTube 视频';await checkCached();}catch(error){$('video-state').textContent='请打开 YouTube 视频';}})();
