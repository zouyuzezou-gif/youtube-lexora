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
test('retry backoff respects server guidance and remains bounded',()=>{
  assert.equal(C.retryDelayMs(0),700);assert.equal(C.retryDelayMs(2),2800);assert.equal(C.retryDelayMs(0,'3'),3000);assert.equal(C.retryDelayMs(0,'60'),8000);
});
test('study guide keeps key sentences and phrases grounded in transcript rows',()=>{
  const rows=[{id:'7',time:42,text:'We need to rule that out.',translation:'我们需要排除这种可能。'}];
  const messages=C.messagesFor('studyGuide',{title:'Lecture',rows});assert.match(messages[0].content,/重点句/);
  const guide=C.parseStudyGuide(JSON.stringify({summary:'排除一种可能',keySentences:[{id:'7',translation:'我们需要排除这种可能。',reason:'常用推理表达'}],phrases:[{id:'7',phrase:'rule out',meaning:'排除'}]}),rows);
  assert.equal(guide.keySentences[0].time,42);assert.equal(guide.phrases[0].phrase,'rule out');assert.throws(()=>C.parseStudyGuide(JSON.stringify({summary:'x',keySentences:[{id:'missing'}],phrases:[]}),rows),/无效字幕定位/);
});
