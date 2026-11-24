'use strict';
// Presentation-only controller: never changes receipt data, ranking, points or timers.
window.JoyMotion=(()=>{
  const sources={bear:'joy-bear.svg',robot:'joy-robot.svg',train:'joy-train.svg',gift:'joy-gift.svg',tree:'joy-tree.svg',bauble:'joy-bauble.svg',globe:'joy-snowglobe.svg',clockwork:'joy-clockwork.svg',workshop:'joy-workshop.svg'};
  const templates=new Map();let loading=null,sequenceTimer=null,sequenceToken=0,openingPlayed=false,assetInstance=0;
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const canPlay=()=>!document.body.classList.contains('paused')&&!preference.matches&&!document.hidden;
  function paint(target,index){
    const key=typeof index==='string'&&Object.hasOwn(sources,index)?index:['bear','train','gift'][index]||'bear';
    target.dataset.motionToy=key;
    if(templates.has(key)){
      const svg=document.importNode(templates.get(key),true);svg.classList.add('articulated-toy');
      // Multiple trees/ornaments must keep independent gradient and clip IDs.
      const ids=new Map(),prefix='joy-'+(++assetInstance)+'-';
      for(const node of svg.querySelectorAll('[id]')){const id=node.id;ids.set(id,prefix+id);node.id=prefix+id;}
      for(const node of svg.querySelectorAll('*'))for(const attr of [...node.attributes]){
        const value=attr.value.replace(/url\(#([^)]+)\)/g,(match,id)=>ids.has(id)?'url(#'+ids.get(id)+')':match);
        if(value!==attr.value)node.setAttribute(attr.name,value);
      }
      svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');target.replaceChildren(svg);
    }else{
      const img=document.createElement('img');img.src='/assets/'+sources[key];img.alt='';img.width=100;img.height=100;target.replaceChildren(img);
    }
  }
  async function preload(){
    if(loading)return loading;
    const version=document.querySelector('meta[name="display-version"]')?.content||'';
    loading=Promise.allSettled(Object.entries(sources).filter(([key])=>!templates.has(key)).map(async([key,name])=>{
      const response=await fetch('/assets/'+name+'?v='+encodeURIComponent(version),{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error('Motion asset unavailable');
      const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');
      if(doc.querySelector('parsererror')||doc.documentElement.localName!=='svg')throw new Error('Invalid motion SVG');
      templates.set(key,doc.documentElement);
    })).then(()=>{
      for(const node of document.querySelectorAll('[data-motion-toy]')){
        if(node.firstElementChild?.localName!=='svg')paint(node,node.dataset.motionToy);
      }
    }).finally(()=>{loading=null;});return loading;
  }
  const durations={intro:2400,points:1400,champion:3400};
  function sequence(kind,force=false){
    if(!durations[kind]||!canPlay()||!document.querySelector('.winner'))return false;
    if(!force&&document.body.dataset.sequence==='champion'&&kind!=='champion')return false;
    clearTimeout(sequenceTimer);const token=++sequenceToken;
    // Restart the visual timeline without hiding or delaying any score.
    delete document.body.dataset.sequence;void document.body.offsetWidth;document.body.dataset.sequence=kind;
    sequenceTimer=setTimeout(()=>{if(token===sequenceToken)delete document.body.dataset.sequence;},durations[kind]);return true;
  }
  function opening(){if(!openingPlayed&&sequence('intro'))openingPlayed=true;}
  function stop(){clearTimeout(sequenceTimer);sequenceToken++;delete document.body.dataset.sequence;}
  function replay(){if(sequence('intro',true))openingPlayed=true;}
  return {paint,preload,opening,sequence,stop,replay,preference};
})();
