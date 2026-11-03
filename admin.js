'use strict';
const $ = id => document.getElementById(id);
const rupiah = value => new Intl.NumberFormat('id-ID', {style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
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
      for(const text of [new Date(item.createdAt).toLocaleString('id-ID'),item.firstName,item.memberCode,rupiah(item.amount)]){
        const cell=document.createElement('td');cell.textContent=text;row.append(cell);
      }fragment.append(row);
    }
    $('history-body').replaceChildren(fragment);
    message('history-message',data.transactions.length?'':'Belum ada transaksi. Mulai dengan pembelanjaan pertama.');
  }catch(error){message('history-message',error.message,true);}
}
$('login-form').addEventListener('submit',async event=>{
  event.preventDefault();$('login-submit').disabled=true;
  try{await request('/api/login',{password:$('password').value});$('password').value='';message('login-message','');showWorkspace(true);await history();}
  catch(error){message('login-message',error.message,true);}finally{$('login-submit').disabled=false;}
});
$('amount').addEventListener('input',()=>{$('amount-preview').textContent=rupiah(Number($('amount').value)||0);});
$('purchase-form').addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  const data={firstName:$('first-name').value.trim(),memberCode:$('member-code').value.trim().toUpperCase(),amount:Number($('amount').value)};
  if(!/^\p{L}[\p{L}'-]*$/u.test(data.firstName)){message('save-message','Isi nama depan saja, tanpa spasi.',true);return;}
  if(!Number.isSafeInteger(data.amount)||data.amount<1||data.amount>999999999){message('save-message','Nominal harus rupiah bulat positif, maksimal Rp999.999.999.',true);return;}
  // Keep an idempotency key on ambiguous network failures, including across reloads.
  const signature=JSON.stringify(data);
  if(pending && pending.signature!==signature){message('save-message','Ada transaksi yang belum terkonfirmasi. Kirim ulang data sebelumnya terlebih dahulu agar tidak tercatat ganda.',true);return;}
  if(!pending)pending={signature,id:crypto.randomUUID()};
  sessionStorage.setItem('toy-pending',JSON.stringify(pending));
  saving=true;$('save-purchase').disabled=true;message('save-message','Menyimpan pembelanjaan…');
  try{
    await request('/api/transactions',{...data,id:pending.id});pending=null;sessionStorage.removeItem('toy-pending');
    message('save-message',`${rupiah(data.amount)} untuk ${data.firstName} (${data.memberCode}) tersimpan. Leaderboard akan diperbarui otomatis.`);
    $('purchase-form').reset();$('amount-preview').textContent=rupiah(0);await history();$('first-name').focus();
  }catch(error){if(error.status===400||error.status===409){pending=null;sessionStorage.removeItem('toy-pending');}message('save-message',`${error.message} Data tetap di formulir; Anda dapat mencoba menyimpan kembali.`,true);}
  finally{saving=false;$('save-purchase').disabled=false;}
});
$('logout').addEventListener('click',async()=>{if(saving)return;try{await request('/api/logout',{});showWorkspace(false);}catch(error){message('save-message',error.message,true);}});
$('refresh-history').addEventListener('click',history);
(async()=>{
  try{
    const saved=sessionStorage.getItem('toy-pending');
    if(saved){pending=JSON.parse(saved);const data=JSON.parse(pending.signature);$('first-name').value=data.firstName;$('member-code').value=data.memberCode;$('amount').value=data.amount;$('amount-preview').textContent=rupiah(data.amount);message('save-message','Transaksi sebelumnya belum terkonfirmasi. Simpan kembali untuk memeriksa hasil tanpa duplikasi.');}
    const state=await request('/api/session');showWorkspace(state.authenticated);if(state.authenticated)await history();
  }catch(error){message('login-message','Tidak dapat terhubung ke server. Muat ulang setelah koneksi pulih.',true);}
})();
