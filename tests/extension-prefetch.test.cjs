const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/sidepanel.js'),'utf8');
const fn=source.slice(source.indexOf('async function translateVisible(){'),source.indexOf('function loadDoc('));
function setup(call){
  const elements=new Map();
  const context={doc:{id:'video',rows:Array.from({length:75},(_,i)=>({id:String(i)})),translations:{'0':'cached'}},busy:false,generation:0,render(){},call,$(id){if(!elements.has(id))elements.set(id,{classList:{remove(){},add(){}}});return elements.get(id);}};
  vm.createContext(context);vm.runInContext(fn,context);return context;
}
test('prefetch translates the entire video including unseen pages and skips cache',async()=>{
  const ids=[];let paused=false;
  const context=setup(async(action,data)=>{if(action==='pause'){paused=true;return;}ids.push(...data.rowIds);return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  await context.translateVisible();assert.equal(paused,true);assert.equal(ids.length,74);assert.equal(ids.includes('0'),false);assert.equal(context.doc.translations['74'],'中文');assert.equal(context.busy,false);
});
test('stopping prefetch caches in-flight batch without starting the next batch',async()=>{
  let calls=0;const context=setup(async(action,data)=>{if(action==='pause')return;calls++;context.generation++;return Object.fromEntries(data.rowIds.map(id=>[id,'中文']));});
  await context.translateVisible();assert.equal(calls,1);assert.equal(Object.keys(context.doc.translations).length,11);assert.equal(context.busy,false);
});
