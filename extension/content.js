function state(){
  const video=document.querySelector('video'),url=location.href;
  let id='';try{id=new URL(url).searchParams.get('v')||'';}catch{}
  return{url,id,title:(document.querySelector('h1.ytd-watch-metadata')?.textContent||document.title).trim(),time:Number(video?.currentTime)||0,paused:video?.paused??true};
}
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{
  if(message?.type==='lexora-state'){sendResponse({ok:true,value:state()});return;}
  if(message?.type==='lexora-seek'){const video=document.querySelector('video');if(video){video.currentTime=Math.max(0,Number(message.time)||0);video.play().catch(()=>{});sendResponse({ok:true});}else sendResponse({ok:false,error:'未找到视频播放器。'});return;}
  if(message?.type==='lexora-pause'){document.querySelector('video')?.pause();sendResponse({ok:true});}
});
setInterval(()=>{const value=state();if(value.id)chrome.runtime.sendMessage({type:'lexora-playback',value}).catch(()=>{});},700);
