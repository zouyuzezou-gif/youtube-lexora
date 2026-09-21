const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/sidepanel.js'),'utf8');
const fn=source.slice(source.indexOf('async function translateVisible(){'),source.indexOf('function loadDoc('));
function setup(call){
  const elements=new Map();
  const context={doc:{id:'video',rows:Array.from({length:75},(_,i)=>({id:String(i)})),translations:{'0':'cached'}},busy:false,generation:0,batchSize:30,parallelBatches:5,C:{retryDelayMs(){return 0;}},render(){},setTimeout(fn){fn();},call,$(id){if(!elements.has(id))elements.set(id,{classList:{remove(){},add(){}}});return elements.get(id);}};
  vm.createContext(context);vm.runInContext(fn,context);return context;
}
test('prefetch translates the entire video including unseen pages and skips cache',async()=>{
  const ids=[];let paused=false;
  const context=setup(async(action,data)=>{if(action==='pause'){paused=true;return;}ids.push(...data.rowIds);return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  await context.translateVisible();assert.equal(paused,true);assert.equal(ids.length,74);assert.equal(ids.includes('0'),false);assert.equal(context.doc.translations['74'],'中文');assert.equal(context.busy,false);
});
test('stopping prefetch does not start more than the active worker batches',async()=>{
  let calls=0;const context=setup(async(action,data)=>{if(action==='pause')return;calls++;context.generation++;return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  await context.translateVisible();assert.ok(calls>=1&&calls<=5);assert.equal(Object.keys(context.doc.translations).length,1);assert.equal(context.busy,false);
});
test('new panel automatically falls back when an older worker only accepts ten rows',async()=>{
  let rejected=0;const context=setup(async(action,data)=>{if(action==='pause')return;if(data.rowIds.length>10){rejected++;throw new Error('每批字幕需为 1 至 10 条。');}return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  await context.translateVisible();assert.ok(rejected>0);assert.equal(context.batchSize,10);assert.equal(Object.keys(context.doc.translations).length,75);
});
test('a permanently failed worker does not prevent other batches from finishing and caching',async()=>{
  const context=setup(async(action,data)=>{if(action==='pause')return;if(data.rowIds.includes('1'))throw new Error('DeepSeek 密钥无效。');return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  context.doc.rows=Array.from({length:155},(_,i)=>({id:String(i)}));context.doc.translations={'0':'cached'};
  await context.translateVisible();assert.equal(Object.keys(context.doc.translations).length,125);assert.equal(context.busy,false);assert.match(context.$('status').textContent,/准备中断/);
});
test('temporary failures retry automatically without requiring another click',async()=>{
  let failures=0;const context=setup(async(action,data)=>{if(action==='pause')return;if(data.rowIds.includes('1')&&failures++<2)throw new Error('temporary failure');return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  await context.translateVisible();assert.equal(failures,3);assert.equal(Object.keys(context.doc.translations).length,75);assert.match(context.$('status').textContent,/已准备好/);
});
