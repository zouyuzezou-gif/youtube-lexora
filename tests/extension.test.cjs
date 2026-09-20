const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../extension/lib.js');

test('Chrome extension validates YouTube watch pages and transcript rows',()=>{
  assert.deepEqual(C.videoIdentity('https://www.youtube.com/watch?v=abcdefghijk&list=private'),{id:'abcdefghijk',url:'https://www.youtube.com/watch?v=abcdefghijk'});
  assert.throws(()=>C.videoIdentity('https://accounts.google.com/'),/YouTube/);
  const doc=C.normalizeTranscript({lang:'en',content:[{text:' First idea ',offset:1000,duration:2000},{text:'Next idea',offset:4000,duration:1000}]});
  assert.equal(doc.rows[0].time,1);assert.equal(doc.rows[1].id,'1');
});
test('Chrome extension batches translations and follows playback position',()=>{
  const rows=Array.from({length:20},(_,i)=>({id:String(i),time:i*5,text:`Sentence ${i}`}));
  const messages=C.messagesFor('translateBatch',{title:'Lecture',context:['Earlier'],rows:rows.slice(0,10)});
  assert.equal(JSON.parse(messages[1].content).rows.length,10);
  assert.equal(C.messagesFor('translateBatch',{rows:Array.from({length:30},(_,i)=>({id:String(i),text:'x'}))}).length,2);
  assert.throws(()=>C.messagesFor('translateBatch',{rows:Array.from({length:31},(_,i)=>({id:String(i),text:'x'}))}),/1 至 30/);
  assert.equal(C.playbackIndex(rows,37),7);
  assert.deepEqual(C.parseTranslations(JSON.stringify({translations:[{id:'0',text:'第一句'},{id:'1',text:'第二句'}]}),rows.slice(0,2)),{'0':'第一句','1':'第二句'});
});
test('very long transcripts are compacted into readable rows and retain complete cached groups',()=>{
  const rows=Array.from({length:2100},(_,i)=>({id:String(i),time:i,duration:0.8,text:`word${i}${i%20===19?'.':''}`}));
  const translations=Object.fromEntries(rows.slice(0,20).map(row=>[row.id,`译${row.id}`]));
  const result=C.compactRows(rows,translations);
  assert.equal(result.changed,true);assert.ok(result.rows.length<500);assert.match(result.rows[0].text,/word0 word1/);assert.ok(result.translations['0']);
});
