'use strict';
const $ = id => document.getElementById(id);
const rupiah = value => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
const categories={fnb:['F&B',50000],fashion:['Fashion',50000],electronics:['Elektronik',500000],jewelry:['Perhiasan',500000]};
let pending = null;
let saving = false;
function message(id, text, error=false) { $(id).textContent=text; $(id).classList.toggle('error',error); }
function showWorkspace(auth) { $('login-panel').hidden=auth; $('workspace').hidden=!auth; }
async function request(path, data) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),
    ...(data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json','X-Toy-Admin':'1'},body:JSON.stringify(data)})});
  const result=await response.json();
  if(!response.ok){ if(response.status===401 && path!=='/api/login')showWorkspace(false); const error=new Error(result.error || 'Permintaan gagal.');error.status=response.status;throw error; }
  return result;
}
async function history() {
  try {
    const data=await request('/api/transactions');
    const fragment=document.createDocumentFragment();
    for(const item of data.transactions){
      const row=document.createElement('tr');
      for(const text of [new Date(item.createdAt).toLocaleString('id-ID'),item.firstName,item.memberCode,categories[item.category]?.[0]||'Belum dikategorikan',item.points===null?'Belum dihitung':item.points+' poin',rupiah(item.amount)]){
        const cell=document.createElement('td');cell.textContent=text;row.append(cell);
      }fragment.append(row);
    }
    $('history-body').replaceChildren(fragment);
    message('history-message',data.transactions.length?'':'Belum ada transaksi. Mulai dengan pembelanjaan pertama.');
  }catch(error){message('history-message',error.message,true);}
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();$('login-submit').disabled=true;
  try{await request('/api/login',{password:$('password').value});$('password').value='';message('login-message','');showWorkspace(true);await history();await loadCollection();await loadShare();await loadLegacy();}
  catch(error){message('login-message',error.message,true);}finally{$('login-submit').disabled=false;}
});
function updatePreview(){
  const amount=Number($('amount').value)||0;const rate=categories[$('category').value]?.[1];
  $('amount-preview').textContent=rupiah(amount);
  $('points-preview').textContent=rate?(amount<500000?'0 poin — minimum Rp500.000 per struk. Nominal tetap dicatat.':`${Math.floor(amount/rate)} poin dari struk ini. Sisa nominal tidak digabung antarstruk.`):'Pilih kategori untuk melihat estimasi poin.';
}
$('amount').addEventListener('input',updatePreview);
$('category').addEventListener('change',updatePreview);
$('purchase-form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  const data={firstName:$('first-name').value.trim(),memberCode:$('member-code').value.trim().toUpperCase(),amount:Number($('amount').value),category:$('category').value};
  if(!/^\p{L}[\p{L}'-]*$/u.test(data.firstName)){message('save-message','Isi nama depan saja, tanpa spasi.',true);return;}
  if(!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>999999999){message('save-message','Nominal harus rupiah bulat positif, maksimal Rp999.999.999.',true);return;}
  if(!categories[data.category]){message('save-message','Pilih kategori belanja.',true);return;}
  // Keep an idempotency key on ambiguous network failures, including across reloads.
  const signature=JSON.stringify(data);
  if(pending && !JSON.parse(pending.signature).category){const previous=JSON.parse(pending.signature);if(previous.firstName===data.firstName&&previous.memberCode===data.memberCode&&previous.amount===data.amount)pending.signature=signature;}
  if(pending && pending.signature!==signature){message('save-message','Ada transaksi yang belum terkonfirmasi. Kirim ulang data sebelumnya terlebih dahulu agar tidak tercatat ganda.',true);return;}
  if(!pending)pending={signature,id:crypto.randomUUID()};
  sessionStorage.setItem('toy-pending',JSON.stringify(pending));
  saving=true;$('save-purchase').disabled=true;message('save-message','Menyimpan pembelanjaan…');
  try{
    const result=await request('/api/transactions',{...data,id:pending.id});pending=null;sessionStorage.removeItem('toy-pending');
    message('save-message',`${rupiah(data.amount)} untuk ${data.firstName} (${data.memberCode}) tersimpan. Struk ini: ${result.transactionPoints} poin${result.eligible?'':' (di bawah minimum Rp500.000)'}. Total member: ${result.memberPoints} poin. Leaderboard diperbarui otomatis.`);
    $('purchase-form').reset();updatePreview();await history();$('first-name').focus();
  }catch(error){if(error.status===400||error.status===409||error.status===423){pending=null;sessionStorage.removeItem('toy-pending');}message('save-message',`${error.message} Data tetap di formulir; Anda dapat mencoba menyimpan kembali.`,true);}
  finally{saving=false;$('save-purchase').disabled=false;}
});
$('logout').addEventListener('click',async()=>{if(saving)return;try{await request('/api/logout',{});showWorkspace(false);}catch(error){message('save-message',error.message,true);}});
$('refresh-history').addEventListener('click',history);
(async()=>{
  try{
    const saved=sessionStorage.getItem('toy-pending');
    if(saved){pending=JSON.parse(saved);const data=JSON.parse(pending.signature);$('first-name').value=data.firstName;$('member-code').value=data.memberCode;$('amount').value=data.amount;$('category').value=data.category||'';updatePreview();message('save-message',data.category?'Transaksi sebelumnya belum terkonfirmasi. Simpan kembali untuk memeriksa hasil tanpa duplikasi.':'Permintaan versi lama belum terkonfirmasi. Pilih kategori sesuai struk lalu simpan kembali; ID lama tetap digunakan untuk mencegah duplikasi.');}
    const state=await request('/api/session');showWorkspace(state.authenticated);if(state.authenticated){await history();await loadCollection();await loadShare();await loadLegacy();}
  }catch(error){message('login-message','Tidak dapat terhubung ke server. Muat ulang setelah koneksi pulih.',true);}
})();

function updateCollectionStatus(state){
  $('collection-state').textContent=state.deadline===null?'Pengumpulan terbuka tanpa batas waktu.':state.closed?'Pengumpulan ditutup. Perpanjang waktu untuk menerima struk lagi.':'Pengumpulan terbuka sampai batas waktu yang ditentukan.';
}
async function loadCollection(){
  $('save-timer').disabled=true;
  try{
    const state=await request('/api/collection');
    $('timer-enabled').checked=state.deadline!==null;
    if(state.deadline){
      const offset=Number($('collection-zone').value.slice(1,3))*3600000;
      $('collection-deadline').value=new Date(Date.parse(state.deadline)+offset).toISOString().slice(0,16);
    }
    $('collection-deadline').required=$('timer-enabled').checked;
    updateCollectionStatus(state);$('save-timer').disabled=false;
  }catch(error){message('timer-message','Pengaturan belum dapat dimuat. Masuk kembali atau muat ulang halaman.',true);}
}
$('timer-enabled').addEventListener('change',()=>{$('collection-deadline').required=$('timer-enabled').checked;});
$('timer-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const enabled=$('timer-enabled').checked;
  const raw=$('collection-deadline').value;
  if(enabled&&!raw){message('timer-message','Pilih tanggal dan jam berakhir.',true);return;}
  const deadline=enabled?raw+':00'+$('collection-zone').value:null;
  $('save-timer').disabled=true;
  try{
    const state=await request('/api/collection',{deadline});updateCollectionStatus(state);
    message('timer-message',state.closed?'Batas waktu tersimpan. Pengumpulan ditutup.':'Pengaturan tersimpan. Leaderboard akan memperbarui timer otomatis.');
  }catch(error){message('timer-message',error.message,true);}
  finally{$('save-timer').disabled=false;}
});

async function downloadFile(url, fallback){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(60000)});
  if(!response.ok){
    if(response.status===401)showWorkspace(false);
    const result=await response.json();throw new Error(result.error||'Unduhan gagal.');
  }
  const blob=await response.blob();
  const filename=/filename="([^"]+)"/.exec(response.headers.get('Content-Disposition')||'')?.[1]||fallback;
  const objectURL=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=objectURL;link.download=filename;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(objectURL),30000);
}
for(const button of document.querySelectorAll('[data-export]')){
  button.addEventListener('click',async()=>{
    button.disabled=true;message('export-message','Menyiapkan unduhan seluruh data…');
    try{await downloadFile('/api/export/'+button.dataset.export+'.csv','toy-factory.csv');message('export-message','Unduhan CSV telah disiapkan. Simpan file untuk digunakan kembali.');}
    catch(error){message('export-message',error.message,true);}finally{button.disabled=false;}
  });
}
async function loadShare(){
  try{
    const data=await request('/api/share');$('share-ready').hidden=!data.publicUrl;
    if(!data.publicUrl){message('share-message','Alamat publik belum tersedia. Deploy ke Render atau tetapkan PUBLIC_URL dengan alamat HTTPS hosting. QR akan muncul setelah alamat publik tersedia.');return;}
    $('public-url').value=data.publicUrl;$('screen-link').href=data.screenUrl;$('public-qr').src='/api/share/qr.svg';
    message('share-message','QR mengarah ke leaderboard publik, bukan halaman admin. Uji scan dari HP sebelum dicetak.');
  }catch(error){message('share-message',error.message,true);}
}
$('copy-public').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText($('public-url').value);message('share-message','Tautan pelanggan berhasil disalin.');}
  catch{ $('public-url').select();message('share-message','Pilih dan salin tautan di kolom di atas.');}
});
$('download-qr').addEventListener('click',async()=>{
  try{await downloadFile('/api/share/qr.svg','toy-factory-qr.svg');}
  catch(error){message('share-message',error.message,true);}
});

async function loadLegacy(){
  try{
    const data=await request('/api/uncategorized');$('legacy-card').hidden=data.count===0;
    $('legacy-count').textContent=`${data.count} transaksi belum dikategorikan. Menampilkan ${data.transactions.length} transaksi terlama; daftar akan diperbarui setelah disimpan.`;
    $('legacy-list').replaceChildren();
    for(const item of data.transactions){
      const row=document.createElement('div');row.className='actions';
      const label=document.createElement('p');label.textContent=`${new Date(item.createdAt).toLocaleString('id-ID')} · ${item.firstName} · ${item.memberCode} · ${rupiah(item.amount)}`;
      const select=document.createElement('select');select.setAttribute('aria-label','Kategori transaksi '+item.id);select.style.cssText='padding:12px;max-width:100%;font:inherit;border:1px solid #b8cad5;border-radius:9px';
      select.append(new Option('Pilih kategori',''));
      for(const [key,[name,rate]] of Object.entries(categories))select.append(new Option(`${name} — ${rupiah(rate)} / poin`,key));
      const button=document.createElement('button');button.type='button';button.textContent='Simpan kategori';
      button.addEventListener('click',async()=>{
        if(!select.value){message('legacy-message','Pilih kategori sesuai struk.',true);return;}
        button.disabled=true;
        try{await request('/api/transactions/classify',{id:item.id,category:select.value});message('legacy-message','Kategori tersimpan dan poin dihitung ulang.');await loadLegacy();await history();}
        catch(error){message('legacy-message',error.message,true);button.disabled=false;}
      });row.append(label,select,button);$('legacy-list').append(row);
    }
  }catch(error){message('history-message','Transaksi lama belum dapat diperiksa: '+error.message,true);}
}
