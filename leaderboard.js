'use strict';
let lastSnapshot='';
let loading=false;
let lastSuccess=null;
const statusBadge=document.getElementById('connection-status');
async function refreshLeaderboard(){
  if(loading)return;
  loading=true;
  try{
    const response=await fetch('/api/leaderboard',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('Server tidak tersedia');
    const data=await response.json();
    const pageVersion=document.querySelector('meta[name="display-version"]')?.content;
    if(/^[a-f0-9]{16}$/.test(pageVersion||'')&&/^[a-f0-9]{16}$/.test(data.displayVersion||'')&&pageVersion!==data.displayVersion){
      const url=new URL(location.href);url.searchParams.set('v',data.displayVersion);if(document.body.classList.contains('screen-mode'))url.searchParams.set('display','screen');if(document.body.classList.contains('paused'))url.searchParams.set('motion','paused');location.replace(url.href);return;
    }
    if(!Array.isArray(data.customers)||data.customers.some(customer=>!customer||typeof customer.firstName!=='string'||typeof customer.memberCode!=='string'||!Number.isSafeInteger(customer.points)||customer.points<0)){
      const error=new Error('Data poin belum sesuai. Muat ulang aplikasi dan pastikan server sudah diperbarui.');error.dataError=true;throw error;
    }
    syncCollection(data.collection);
    const snapshot=JSON.stringify(data.customers);
    if(snapshot!==lastSnapshot){renderCustomers(data.customers);lastSnapshot=snapshot;}
    lastSuccess=new Date();
    statusBadge.textContent='● LIVE';statusBadge.style.color='#16664e';statusBadge.style.background='#e0f8ec';
    document.getElementById('last-update').textContent='Sinkron '+lastSuccess.toLocaleTimeString('id-ID')+' · otomatis tiap 3 detik';
  }catch(error){
    collectionConnected=false;renderCountdown();
    statusBadge.textContent=error.dataError?'DATA POIN BELUM SESUAI':'KONEKSI TERPUTUS';statusBadge.style.color='#a21934';statusBadge.style.background='#fff0f3';
    document.getElementById('last-update').textContent=error.dataError?error.message:lastSuccess?'Data terakhir '+lastSuccess.toLocaleTimeString('id-ID')+' · mencoba kembali…':'Belum terhubung ke server · mencoba kembali…';
  }finally{loading=false;}
}
let collectionDeadline=null;
let syncedServerTime=0;
let syncedAt=0;
let collectionConnected=false;
function syncCollection(state){
  if(!state || !Number.isFinite(Date.parse(state.serverNow)) || (state.deadline!==null && !Number.isFinite(Date.parse(state.deadline))))throw new Error('Batas waktu tidak valid');
  collectionDeadline=state.deadline===null?null:Date.parse(state.deadline);
  syncedServerTime=Date.parse(state.serverNow);syncedAt=performance.now();collectionConnected=true;
  renderCountdown();
}
function renderCountdown(){
  const panel=document.getElementById('collection-timer');
  panel.hidden=collectionDeadline===null;
  if(panel.hidden)return;
  const remaining=Math.max(0,Math.ceil((collectionDeadline-(syncedServerTime+performance.now()-syncedAt))/1000));
  const closed=remaining===0;
  const units={days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
  for(const [key,value] of Object.entries(units))document.getElementById('timer-'+key).textContent=String(value).padStart(2,'0');
  document.getElementById('collection-clock').setAttribute('aria-label',`${units.days} hari ${units.hours} jam ${units.minutes} menit ${units.seconds} detik`);
  panel.classList.toggle('closed',closed);panel.classList.toggle('urgent',!closed&&remaining<=300);panel.classList.toggle('unsynced',!collectionConnected);
  document.getElementById('timer-title').textContent=closed?'Pengumpulan struk ditutup':remaining<=300?'Segera kumpulkan struk Anda!':'Sisa waktu pengumpulan struk';
  document.getElementById('timer-deadline').textContent='Batas: '+new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(collectionDeadline))+' (WIB)';
  document.getElementById('timer-note').textContent=collectionConnected?(closed?'Terima kasih telah berpartisipasi.':'Kumpulkan struk sebelum waktu berakhir.'):'Koneksi terputus · timer memakai batas terakhir; menunggu sinkronisasi.';
}
setInterval(renderCountdown,250);
refreshLeaderboard();
setInterval(refreshLeaderboard,3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLeaderboard();});
window.addEventListener('online',refreshLeaderboard);
