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
    if(!Array.isArray(data.customers))throw new Error('Data tidak valid');
    const snapshot=JSON.stringify(data.customers);
    if(snapshot!==lastSnapshot){renderCustomers(data.customers);lastSnapshot=snapshot;}
    lastSuccess=new Date();
    statusBadge.textContent='● LIVE';statusBadge.style.color='#16664e';statusBadge.style.background='#e0f8ec';
    document.getElementById('last-update').textContent='Sinkron '+lastSuccess.toLocaleTimeString('id-ID')+' · otomatis tiap 3 detik';
  }catch(error){
    statusBadge.textContent='KONEKSI TERPUTUS';statusBadge.style.color='#a21934';statusBadge.style.background='#fff0f3';
    document.getElementById('last-update').textContent=lastSuccess?'Data terakhir '+lastSuccess.toLocaleTimeString('id-ID')+' · mencoba kembali…':'Belum terhubung ke server · mencoba kembali…';
  }finally{loading=false;}
}
refreshLeaderboard();
setInterval(refreshLeaderboard,3000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLeaderboard();});
window.addEventListener('online',refreshLeaderboard);
