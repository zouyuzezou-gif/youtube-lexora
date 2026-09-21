const $=id=>document.getElementById(id);
const stamp=value=>`${Math.floor(Number(value||0)/60)}:${String(Math.floor(Number(value||0)%60)).padStart(2,'0')}`;
const make=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const safeName=value=>String(value||'youtube-lexora').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,90)||'youtube-lexora';
const call=async(action,data={})=>{const result=await chrome.runtime.sendMessage({action,data});if(!result?.ok)throw new Error(result?.error||'扩展服务没有响应。');return result.value;};
let exportDoc=null;

function renderGuide(guide){
  const root=$('guide-parts'),parts=Object.entries(guide?.parts||{}).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(!parts.length){root.append(make('p','meta','尚未生成 AI 学习重点。'));return;}
  for(const [index,part] of parts){
    const section=make('section','guide-part'),heading=make('h3','',`第 ${Number(index)+1} 部分`),summary=make('p','',part.summary);section.append(heading,summary);
    if(part.keySentences?.length){section.append(make('h3','','重点语句'));for(const item of part.keySentences){const card=make('article','key-sentence');card.append(make('div','meta',stamp(item.time)),make('p','en',item.text),make('p','zh',item.translation),make('p','reason',item.reason));section.append(card);}}
    if(part.phrases?.length){section.append(make('h3','','重点词组'));const table=make('table','phrases'),head=document.createElement('thead'),headRow=document.createElement('tr');headRow.append(make('th','','词组'),make('th','','语境含义'),make('th','','时间'));head.append(headRow);table.append(head);const body=document.createElement('tbody');for(const item of part.phrases){const row=document.createElement('tr');row.append(make('td','',item.phrase),make('td','',item.meaning),make('td','',stamp(item.time)));body.append(row);}table.append(body);section.append(table);}
    root.append(section);
  }
}

function renderTranscript(doc){
  $('transcript-count').textContent=`共 ${doc.rows.length} 条字幕，按视频时间顺序排列。`;
  const fragment=document.createDocumentFragment();
  for(const row of doc.rows){const card=make('article','transcript-row'),time=make('time','',stamp(row.time)),text=make('div');text.append(make('p','en',row.text),make('p','zh',doc.translations[row.id]||'（暂无中文翻译）'));card.append(time,text);fragment.append(card);}
  $('transcript').append(fragment);
}

async function downloadHtml(){
  if(!exportDoc)return;
  const css=await fetch(chrome.runtime.getURL('export.css')).then(response=>response.text()),content=$('document').cloneNode(true);content.hidden=false;
  const title=document.createElement('title');title.textContent=`${exportDoc.title}｜YouTube Lexora 学习语料`;
  const html=document.implementation.createHTMLDocument('');html.documentElement.lang='zh-CN';html.head.replaceChildren(title);const meta=document.createElement('meta');meta.setAttribute('charset','utf-8');const style=document.createElement('style');style.textContent=css;html.head.prepend(meta);html.head.append(style);html.body.append(content);
  const blob=new Blob(['<!doctype html>\n',html.documentElement.outerHTML],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`${safeName(exportDoc.title)}-学习语料.html`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('print').onclick=()=>window.print();
$('save-html').onclick=()=>downloadHtml().catch(error=>$('export-status').textContent=error.message);
(async()=>{try{const id=new URLSearchParams(location.search).get('id');if(!/^[\w-]{11}$/.test(id||''))throw new Error('导出链接无效。');exportDoc=await call('exportData',{videoId:id});document.title=`${exportDoc.title}｜YouTube Lexora 学习语料`;$('title').textContent=exportDoc.title;$('source').href=exportDoc.url;$('created').textContent=`生成于 ${new Date().toLocaleString('zh-CN')}`;renderGuide(exportDoc.studyGuide);renderTranscript(exportDoc);$('document').hidden=false;$('export-status').textContent=`已载入 ${exportDoc.rows.length} 条完整对话`; }catch(error){$('export-status').textContent=`无法打开导出资料：${error.message}`;}})();
