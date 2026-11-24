'use strict';
// Presentation-only controller: never changes receipt data, ranking, points or timers.
window.JoyMotion=(()=>{
  const sources={bear:'bears/bear-wave.png',jump:'bears/bear-jump.png',dance:'bears/bear-dance.png',cozy:'bears/bear-cozy.png',ornaments:'bears/festive-ornaments.png',candy:'bears/bear-candy.png',gift:'bears/bear-gift.png',clockwork:'joy-clockwork.svg',workshop:'joy-workshop.svg'};
  const templates=new Map(),bitmaps=new Map();let loading=null,sequenceTimer=null,sequenceToken=0,openingPlayed=false,assetInstance=0,retryTimer=null,retryAttempt=0;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const canPlay=()=>!document.body.classList.contains('paused')&&!preference.matches&&!document.hidden;
  function paint(target,index){
    const key=typeof index==='string'&&Object.hasOwn(sources,index)?index:['bear','jump','dance'][index]||'bear';
    target.dataset.motionToy=key;
    if(bitmaps.has(key)){
      const img=document.createElement('img');img.src=bitmaps.get(key);img.alt='';img.width=320;img.height=320;
      img.className='premium-figure';img.dataset.assetReady=key;target.replaceChildren(img);
    }else if(templates.has(key)){
      const svg=document.importNode(templates.get(key),true);svg.classList.add('articulated-toy');
      const ids=new Map(),prefix='joy-'+(++assetInstance)+'-';
      for(const node of svg.querySelectorAll('[id]')){const id=node.id;ids.set(id,prefix+id);node.id=prefix+id;}
      for(const node of svg.querySelectorAll('*'))for(const attr of [...node.attributes]){
        const value=attr.value.replace(/url\(#([^)]+)\)/g,(match,id)=>ids.has(id)?'url(#'+ids.get(id)+')':match);
        if(value!==attr.value)node.setAttribute(attr.name,value);
      }
      svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');target.replaceChildren(svg);
    }else{
      const placeholder=document.createElement('span');placeholder.className='figure-pending';placeholder.setAttribute('aria-hidden','true');target.replaceChildren(placeholder);
    }
  }
  function hydrate(key){
    for(const node of document.querySelectorAll('[data-motion-toy]')){
      if(node.dataset.motionToy===key&&node.firstElementChild?.dataset.assetReady!==key&&node.firstElementChild?.localName!=='svg')paint(node,key);
    }
  }
  async function preload(){
    if(loading)return loading;
    clearTimeout(retryTimer);
    const version=document.querySelector('meta[name="display-version"]')?.content||'';
    loading=Promise.allSettled(Object.entries(sources).filter(([key])=>!templates.has(key)&&!bitmaps.has(key)).map(async([key,name])=>{
      const response=await fetch('/assets/'+name+'?v='+encodeURIComponent(version),{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('Motion asset unavailable');
      if(name.endsWith('.png')){
        // One decoded source per page; data updates reuse the same object URL.
        const objectURL=URL.createObjectURL(await response.blob()),probe=new Image();probe.src=objectURL;
        try{await probe.decode();bitmaps.set(key,objectURL);}catch(error){URL.revokeObjectURL(objectURL);throw error;}
      }else{
        const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
        if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw new Error('Invalid motion SVG');
        templates.set(key,doc.documentElement);
      }
      hydrate(key);
    })).finally(()=>{
      loading=null;
      if(templates.size+bitmaps.size<Object.keys(sources).length)retryTimer=setTimeout(preload,Math.min(60000,15000*++retryAttempt));
      else retryAttempt=0;
    });return loading;
  }
  const durations={intro:2400,points:1400,champion:3400};
  function sequence(kind,force=false){
    if(!durations[kind]||!canPlay()||!document.querySelector('.winner'))return false;
    if(!force&&document.body.dataset.sequence==='champion'&&kind!=='champion')return false;
    clearTimeout(sequenceTimer);const token=++sequenceToken;
    delete document.body.dataset.sequence;void document.body.offsetWidth;document.body.dataset.sequence=kind;
    sequenceTimer=setTimeout(()=>{if(token===sequenceToken)delete document.body.dataset.sequence;},durations[kind]);return true;
  }
  function opening(){if(!openingPlayed&&sequence('intro'))openingPlayed=true;}
  function stop(){clearTimeout(sequenceTimer);sequenceToken++;delete document.body.dataset.sequence;}
  function replay(){if(sequence('intro',true))openingPlayed=true;}
  return {paint,preload,opening,sequence,stop,replay,preference};
})();
