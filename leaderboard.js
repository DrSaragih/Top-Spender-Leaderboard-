'use strict';
const $=id=>document.getElementById(id);
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const formatPoints=value=>Number.isSafeInteger(value)&&value>=0?new Intl.NumberFormat('id-ID').format(value)+' poin':'—';
let customers=[],lastSnapshot='',loading=false,lastSuccess=null;
let collectionDeadline=null,syncedServerTime=0,syncedAt=0,collectionConnected=false;
const statusBadge=$('connection-status');
function scoreNode(value,table=false){
  const node=element(table?'span':'div',table?'table-score':'amount');
  if(!Number.isSafeInteger(value)||value<0){node.textContent='—';return node;}
  node.append(element('b',table?'':'score-value',new Intl.NumberFormat('id-ID').format(value)),document.createTextNode(' '),element('span',table?'table-score-unit':'score-unit','poin'));
  return node;
}
function renderCustomers(next){
  const previousLeader=customers[0]?.memberCode;
  const previous=new Map(customers.map(c=>[c.memberCode,c.points]));customers=next.slice(0,10);
  const newLeader=previousLeader&&customers[0]&&customers[0].memberCode!==previousLeader;
  const pointIncrease=previous.size>0&&customers.some(c=>previous.has(c.memberCode)?c.points>previous.get(c.memberCode):c.points>0);
  $('podium').replaceChildren();$('rankings').replaceChildren();
  document.querySelector('.board-grid').classList.toggle('few',customers.length<=3);
  $('podium').classList.toggle('single',customers.length===1);$('podium').classList.toggle('double',customers.length===2);
  for(const index of (customers.length===2?[0,1]:[1,0,2])){
    const customer=customers[index];if(!customer)continue;
    const card=element('article','winner'+(index===0?' first':''));card.dataset.member=customer.memberCode;card.style.setProperty('--entry-order',String(index===0?1:index===1?0:2));
    card.setAttribute('aria-label','Peringkat '+(index+1)+', '+customer.firstName+', '+formatPoints(customer.points));
    if(previous.has(customer.memberCode)&&previous.get(customer.memberCode)!==customer.points)card.classList.add('updated');
    if(index===0){const medal=element('span','rank-medal'),crown=element('img');medal.setAttribute('aria-hidden','true');crown.src='/assets/joy-crown.svg';crown.alt='';crown.width=72;crown.height=65;medal.append(crown);card.append(medal);}
    card.append(element('div','rank',String(index+1).padStart(2,'0')));
    const avatar=element('div','avatar');JoyMotion.paint(avatar,index);
    card.append(avatar,element('div','name',customer.firstName),element('div','code',customer.memberCode),scoreNode(customer.points));$('podium').append(card);
  }
  customers.slice(3).forEach((customer,index)=>{
    const row=element('tr');row.dataset.member=customer.memberCode;row.style.setProperty('--row-order',index);
    if(previous.has(customer.memberCode)&&previous.get(customer.memberCode)!==customer.points)row.classList.add('updated');
    for(const text of [String(index+4).padStart(2,'0'),customer.firstName,customer.memberCode])row.append(element('td','',text));
    const cell=element('td');cell.append(scoreNode(customer.points,true));row.append(cell);$('rankings').append(row);
  });
  if(newLeader||pointIncrease)celebratePoints(Boolean(newLeader));
  $('empty-state').hidden=customers.length>0;document.querySelector('.table-wrap').hidden=customers.length<=3;
}
function showHealth(state,text){
  document.body.dataset.health=state;if(statusBadge.textContent!==text)statusBadge.textContent=text;
  $('connection-indicator').title=text;$('connection-indicator').setAttribute('aria-label',text);
}
function syncCollection(state){
  if(!state||!Number.isFinite(Date.parse(state.serverNow))||(state.deadline!==null&&!Number.isFinite(Date.parse(state.deadline))))throw new Error('Data timer tidak valid.');
  collectionDeadline=state.deadline===null?null:Date.parse(state.deadline);syncedServerTime=Date.parse(state.serverNow);syncedAt=performance.now();collectionConnected=true;renderCountdown();
}
function renderCountdown(){
  const panel=$('collection-timer');panel.hidden=collectionDeadline===null;if(panel.hidden)return;
  const remaining=Math.max(0,Math.ceil((collectionDeadline-(syncedServerTime+performance.now()-syncedAt))/1000));
  const units={days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
  for(const [key,value] of Object.entries(units))$('timer-'+key).textContent=String(value).padStart(2,'0');
  $('collection-clock').setAttribute('aria-label',units.days+' hari '+units.hours+' jam '+units.minutes+' menit '+units.seconds+' detik');
  panel.classList.toggle('closed',remaining===0);panel.classList.toggle('urgent',remaining>0&&remaining<=300);panel.classList.toggle('unsynced',!collectionConnected);
  $('timer-title').textContent=remaining===0?'Pengumpulan struk ditutup':'Sisa waktu pengumpulan struk';$('closed-label').hidden=remaining!==0;
  $('timer-deadline').textContent='Batas: '+new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(collectionDeadline))+' WIB';
  $('timer-note').textContent=collectionConnected?'':'Koneksi terputus; timer memakai batas terakhir.';
}
async function refreshLeaderboard(){
  if(loading)return;loading=true;
  try{
    const response=await fetch('/api/leaderboard',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Server tidak tersedia.');
    const data=await response.json(),pageVersion=document.querySelector('meta[name="display-version"]')?.content;
    if(/^[a-f0-9]{16}$/.test(pageVersion||'')&&/^[a-f0-9]{16}$/.test(data.displayVersion||'')&&pageVersion!==data.displayVersion){
      const url=new URL(location.href);url.searchParams.set('v',data.displayVersion);if(document.body.classList.contains('paused'))url.searchParams.set('motion','paused');location.replace(url.href);return;
    }
    if(!Array.isArray(data.customers)||data.customers.some(c=>!c||typeof c.firstName!=='string'||typeof c.memberCode!=='string'||!Number.isSafeInteger(c.points)||c.points<0)){
      const error=new Error('Data poin belum sesuai. Perbarui server dan muat ulang halaman.');error.dataError=true;throw error;
    }
    syncCollection(data.collection);const snapshot=JSON.stringify(data.customers);if(snapshot!==lastSnapshot){renderCustomers(data.customers);lastSnapshot=snapshot;}
    JoyMotion.opening();
    lastSuccess=new Date();showHealth('live','LIVE');$('connection-indicator').title='Sinkron '+lastSuccess.toLocaleTimeString('id-ID');
    $('display-alert').hidden=true;$('last-update').textContent='Sinkron '+lastSuccess.toLocaleTimeString('id-ID');
  }catch(error){
    collectionConnected=false;renderCountdown();showHealth('error',error.dataError?'DATA POIN BELUM SESUAI':'KONEKSI TERPUTUS');
    $('display-alert').hidden=false;$('display-alert').textContent=error.dataError?error.message:lastSuccess?'Koneksi terputus. Menampilkan data terakhir; mencoba kembali…':'Belum terhubung ke server; mencoba kembali…';
    $('last-update').textContent=$('display-alert').textContent;
  }finally{loading=false;}
}
let celebrationTimer=null,particleCleanup=null;
function setupFestival(){
  const garland=$('festival-garland'),stars=$('festival-stars');
  for(let i=0;i<22;i++){
    const bulb=element('i','festival-bulb');bulb.style.setProperty('--x',(2+i*96/21)+'%');
    bulb.style.setProperty('--drop',(10+Math.sin(i/21*Math.PI*2)**2*18)+'px');bulb.style.setProperty('--delay',(-i*.28)+'s');garland.append(bulb);
  }
  for(let i=0;i<14;i++){
    const star=element('img','festival-star');star.src='/assets/joy-sparkle.svg';star.alt='';
    star.style.setProperty('--x',((i*29)%98)+'%');star.style.setProperty('--y',((i*43)%95)+'%');
    star.style.setProperty('--size',(8+i%4*4)+'px');star.style.setProperty('--delay',(-i*.63)+'s');stars.append(star);
  }
}
function celebratePoints(championChanged=false){
  if(document.body.classList.contains('paused')||matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden)return;
  JoyMotion.sequence(championChanged?'champion':'points');
  clearTimeout(celebrationTimer);clearTimeout(particleCleanup);
  document.body.classList.add('celebrating');const layer=$('celebration-layer');layer.replaceChildren();
  const count=championChanged?28:16;
  for(let i=0;i<count;i++){
    const paper=element('i','festival-confetti');
    paper.style.setProperty('--x',(i%2?91+i%7:2+i%7)+'%');
    paper.style.setProperty('--delay',(i%7*.05)+'s');paper.style.setProperty('--turn',(i%2?540:-540)+'deg');
    paper.style.setProperty('--drift',((i%2?-1:1)*(10+i%4*6))+'px');layer.append(paper);
  }
  celebrationTimer=setTimeout(()=>document.body.classList.remove('celebrating'),3500);
  // Cleanup also runs when a user pauses animation halfway through a burst.
  particleCleanup=setTimeout(()=>layer.replaceChildren(),4200);
}
setupFestival();
const params=new URLSearchParams(location.search);
if(params.get('display')==='screen')document.body.classList.add('screen-mode');
if(params.get('motion')==='paused')document.body.classList.add('paused');
$('display-tools').hidden=params.get('controls')!=='1';
$('motion-toggle').setAttribute('aria-pressed',String(document.body.classList.contains('paused')));
$('motion-toggle').textContent=document.body.classList.contains('paused')?'Putar animasi':'Jeda animasi';
$('motion-toggle').addEventListener('click',()=>{const paused=document.body.classList.toggle('paused');$('motion-toggle').setAttribute('aria-pressed',String(paused));$('motion-toggle').textContent=paused?'Putar animasi':'Jeda animasi';if(paused)stopMotionSequences();});
$('screen-toggle').addEventListener('click',async()=>{
  document.body.classList.add('screen-mode');
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{$('screen-toggle').textContent='Gunakan F11';}
});
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  if(event.key.toLowerCase()==='r')JoyMotion.replay();
  if(event.key.toLowerCase()==='m')$('motion-toggle').click();
  if(event.key.toLowerCase()==='f')$('screen-toggle').click();
});
function stopMotionSequences(){
  JoyMotion.stop();clearTimeout(celebrationTimer);clearTimeout(particleCleanup);
  document.body.classList.remove('celebrating');$('celebration-layer').replaceChildren();
}
$('sequence-replay').addEventListener('click',()=>JoyMotion.replay());
JoyMotion.preference.addEventListener('change',event=>{if(event.matches)stopMotionSequences();});
JoyMotion.preload();
setInterval(renderCountdown,250);refreshLeaderboard();setInterval(refreshLeaderboard,3000);
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('motion-hidden',document.hidden);if(document.hidden)stopMotionSequences();else{refreshLeaderboard();JoyMotion.opening();}});window.addEventListener('online',()=>{refreshLeaderboard();JoyMotion.preload();});
