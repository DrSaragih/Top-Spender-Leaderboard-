// Optional: requires Playwright and an installed Chromium; see README.
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'joy-night-'));
 const port=process.env.TEST_PORT||'18590',base='http://127.0.0.1:'+port;
 const venv=path.join(root,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const python=process.env.PYTHON_BIN||(fs.existsSync(venv)?venv:'python3');let server,browser;
 try{
  const password=crypto.randomBytes(20).toString('hex');
  server=spawn(python,['server.py'],{cwd:root,env:{...process.env,PORT:port,HOST:'127.0.0.1',DATABASE_PATH:path.join(temp,'test.sqlite3'),ADMIN_PASSWORD:password,COOKIE_SECURE:'0',PUBLIC_URL:'https://joy-qa.example.test'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',()=>reject(Error('Test server exited before startup')));});
  const executablePath=process.env.BROWSER_EXECUTABLE||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({executablePath,headless:true});
  const context=await browser.newContext({acceptDownloads:true});
  const errors=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  const display=await context.newPage();await display.goto(base+'/?display=screen');await display.locator('#empty-state').waitFor({state:'visible'});
  if(await display.locator('h1').textContent()!=='LEADERBOARD')throw Error('Public title');
  if(await display.locator('button:visible').count()!==0)throw Error('Customer-facing controls not hidden');
  if(await display.locator('.hero,.ticker,footer').count()!==0)throw Error('Promotional copy remains');
  const admin=await context.newPage();await admin.goto(base+'/admin');await admin.fill('#password',password);await admin.click('#login-submit');await admin.locator('#workspace').waitFor({state:'visible'});
  if(await admin.locator('#tab-input').getAttribute('aria-selected')!=='true')throw Error('Input not default');
  if(await admin.locator('#panel-control').isVisible()||await admin.locator('#panel-export').isVisible())throw Error('Advanced panels clutter input');
  async function purchase(name,code,amount,category){
    await admin.fill('#first-name',name);await admin.fill('#member-code',code);
    await admin.check('input[name="jewelry-status"][value="'+(category==='jewelry'?'jewelry':'non-jewelry')+'"]');
    if(category!=='jewelry')await admin.selectOption('#category',category);
    await admin.fill('#amount',String(amount));await admin.click('#save-purchase');await admin.locator('#save-message').filter({hasText:'tersimpan.'}).waitFor();
  }
  await purchase('Nadia','TF-001',750000,'jewelry');await display.locator('.first .amount').filter({hasText:'1 poin'}).waitFor({timeout:6000});
  await display.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  await display.locator('.first .robot-wave').waitFor({state:'attached'});
  if(await display.locator('.festival-confetti').count()!==0)throw Error('Opening fabricated a score celebration');
  await display.setViewportSize({width:1920,height:1080});await display.screenshot({path:path.join(os.tmpdir(),'joy-single.png'),fullPage:true});
  await purchase('Bima','TF-002',500000,'fnb');await display.locator('.first .name').filter({hasText:'Bima'}).waitFor({timeout:6000});
  await purchase('Clara','TF-003',1000000,'electronics');await purchase('Dewi','TF-004',550000,'fashion');
  for(const [i,name] of ['Eka','Fajar','Gita','Hana','Intan','Joko'].entries()){
    const status=await admin.evaluate(async({i,name})=>{
      const r=await fetch('/api/transactions',{method:'POST',headers:{'Content-Type':'application/json','X-Toy-Admin':'1'},body:JSON.stringify({id:crypto.randomUUID(),firstName:name,memberCode:'TF-'+String(i+5).padStart(3,'0'),amount:500000,category:'fnb'})});return r.status;
    },{i,name});if(status!==201)throw Error('Fixture purchase failed');
  }
  await display.waitForFunction(()=>document.querySelectorAll('#rankings tr').length===7,{},{timeout:6000});
  await admin.click('#tab-control');await admin.check('#timer-enabled');await admin.fill('#collection-deadline',new Date(Date.now()+9*3600000).toISOString().slice(0,16));await admin.click('#save-timer');await admin.locator('#timer-message').filter({hasText:'tersimpan'}).waitFor();
  await display.locator('#collection-timer').waitFor({state:'visible',timeout:6000});
  await admin.click('#tab-export');await admin.locator('#share-ready').waitFor({state:'visible'});await admin.waitForFunction(()=>document.getElementById('public-qr').complete&&document.getElementById('public-qr').naturalWidth>0);
  for(const kind of ['transactions','members']){
    const waiting=admin.waitForEvent('download');await admin.click('[data-export="'+kind+'"]');
    const download=await waiting,dest=path.join(temp,kind+'.csv');await download.saveAs(dest);
    if(!fs.readFileSync(dest,'utf8').includes('Nadia'))throw Error('Export missing data');
  }
  await admin.click('#tab-input');await admin.locator('#tab-input').focus();await admin.keyboard.press('ArrowRight');
  if(await admin.locator('#tab-control').getAttribute('aria-selected')!=='true')throw Error('Tab keyboard navigation');await admin.click('#tab-input');
  for(const [width,height] of [[320,568],[390,844],[768,1024],[1280,720],[1920,1080],[3840,2160]]){
    await display.setViewportSize({width,height});await admin.setViewportSize({width,height});
    const a=await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    const d=await display.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,clipped:[...document.querySelectorAll('.amount,.code')].some(e=>e.scrollWidth>e.clientWidth+1)}));
    if(a||d.overflow||d.clipped)throw Error('Responsive layout failed '+width+' '+JSON.stringify({a,d}));
    if(width===1920||width===1280){if(await display.evaluate(()=>document.documentElement.scrollHeight>innerHeight))throw Error('Signage needs scrolling '+width);}
    console.log('PASS viewport',width,height);
  }
  await display.setViewportSize({width:1920,height:1080});await display.screenshot({path:path.join(os.tmpdir(),'joy-leaderboard.png'),fullPage:true});
  await display.setViewportSize({width:390,height:844});await display.screenshot({path:path.join(os.tmpdir(),'joy-phone.png'),fullPage:true});
  await admin.setViewportSize({width:1280,height:900});await admin.screenshot({path:path.join(os.tmpdir(),'joy-admin.png'),fullPage:true});
  await display.keyboard.press('m');if(!await display.locator('body').evaluate(e=>e.classList.contains('paused')))throw Error('Motion shortcut failed');
  await display.emulateMedia({reducedMotion:'reduce'});if(await display.locator('.festival-bulb').first().evaluate(e=>getComputedStyle(e).animationName)!=='none')throw Error('Reduced motion ignored');
  await context.setOffline(true);await display.locator('#display-alert').waitFor({state:'visible',timeout:12000});
  if(!await display.locator('.first .name').isVisible())throw Error('Offline lost podium');
  await context.setOffline(false);await display.locator('#display-alert').waitFor({state:'hidden',timeout:12000});
  const valid=await (await display.request.get(base+'/api/leaderboard')).json();let fixture=valid;
  await display.route('**/api/leaderboard',route=>route.fulfill({json:fixture}));
  await display.bringToFront();await display.emulateMedia({reducedMotion:'no-preference'});
  await display.evaluate(()=>{document.body.classList.remove('paused','celebrating');clearTimeout(celebrationTimer);clearTimeout(particleCleanup);document.getElementById('celebration-layer').replaceChildren();});
  await display.locator('.avatar .train-wheel').first().waitFor({state:'attached'});
  await display.locator('.avatar .gift-lid').waitFor({state:'attached'});
  await display.locator('.factory-courier .train-wheel').first().waitFor({state:'attached'});
  const wheelBefore=await display.locator('.avatar .train-wheel').first().evaluate(e=>getComputedStyle(e).rotate);
  await display.waitForTimeout(150);
  const wheelAfter=await display.locator('.avatar .train-wheel').first().evaluate(e=>getComputedStyle(e).rotate);
  if(wheelBefore===wheelAfter)throw Error('Wheel is not actually moving');
  const pointsBeforeReplay=await display.locator('.first .amount').textContent();
  await display.keyboard.press('r');
  if(await display.locator('body').getAttribute('data-sequence')!=='intro')throw Error('Replay shortcut failed');
  if(await display.locator('.first .amount').textContent()!==pointsBeforeReplay)throw Error('Replay changed points');
  await display.waitForFunction(()=>!document.body.dataset.sequence,{},{timeout:4000});
  const increased={...valid,customers:valid.customers.map((c,i)=>i===0?{...c,points:c.points+1}:c)};
  fixture=increased;await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('.festival-confetti').count()!==16)throw Error('Point increase did not celebrate');
  if(await display.locator('body').getAttribute('data-sequence')!=='points')throw Error('Point sequence not running');
  await display.evaluate(()=>document.querySelector('.festival-confetti').dataset.once='yes');
  await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('.festival-confetti').first().getAttribute('data-once')!=='yes')throw Error('Unchanged poll repeated celebration');
  await display.waitForFunction(()=>document.querySelectorAll('.festival-confetti').length===0,{},{timeout:6000});
  await display.evaluate(()=>document.body.classList.add('paused'));
  fixture={...valid,customers:valid.customers.map((c,i)=>i===0?{...c,points:c.points+2}:c)};
  await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('.festival-confetti').count()!==0)throw Error('Paused update emitted confetti');
  await display.evaluate(()=>document.body.classList.remove('paused'));await display.emulateMedia({reducedMotion:'reduce'});
  fixture={...valid,customers:valid.customers.map((c,i)=>i===0?{...c,points:c.points+3}:c)};
  await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('.festival-confetti').count()!==0)throw Error('Reduced-motion update emitted confetti');
  await display.emulateMedia({reducedMotion:'no-preference'});
  fixture={...valid,customers:[{...valid.customers.at(-1),points:100},...valid.customers.slice(0,-1)]};
  await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('.festival-confetti').count()!==28)throw Error('Leader change did not celebrate');
  if(await display.locator('body').getAttribute('data-sequence')!=='champion')throw Error('Champion sequence not running');
  fixture={...fixture,customers:fixture.customers.map((c,i)=>i===0?{...c,points:101}:c)};await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('body').getAttribute('data-sequence')!=='champion')throw Error('Minor update interrupted coronation');
  if(!(await display.locator('.first .amount').textContent()).includes('101'))throw Error('Sequence delayed live score');
  await display.keyboard.press('m');
  if(await display.locator('body').getAttribute('data-sequence'))throw Error('Pause left a sequence active');
  if(await display.locator('.festival-confetti').count()!==0)throw Error('Pause left confetti active');

  await display.evaluate(()=>{document.body.classList.add('paused');document.getElementById('celebration-layer').replaceChildren();});
  fixture=valid;await display.evaluate(()=>refreshLeaderboard());
  fixture={...valid,customers:[{firstName:'Invalid',memberCode:'TF-X',total:500000}]};
  await display.evaluate(()=>refreshLeaderboard());
  if(await display.locator('#connection-status').textContent()!=='DATA POIN BELUM SESUAI')throw Error('Invalid data marked live');
  if((await display.locator('.board-grid').textContent()).includes('NaN'))throw Error('NaN leaked');
  if(await display.locator('.first .name').textContent()!=='Dewi')throw Error('Invalid update replaced valid winner');
  fixture=valid;await display.evaluate(()=>refreshLeaderboard());
  const version=valid.displayVersion;
  await display.evaluate(()=>{document.querySelector('meta[name="display-version"]').content='0000000000000000';setTimeout(refreshLeaderboard,10);});
  await display.waitForURL(url=>url.searchParams.get('v')===version);await display.locator('.first .name').waitFor({state:'visible'});
  if(!await display.locator('body').evaluate(e=>e.classList.contains('paused')))throw Error('Version update lost paused state');
  await admin.click('#logout');await admin.locator('#login-panel').waitFor({state:'visible'});
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: articulated toys, opening replay, champion sequence priority, pause cancellation, celebration triggers, cleanup, pause/reduced motion, live points, Jewel input, admin tabs, timer, CSV, QR, motion, offline recovery and logout.');
 }finally{
  if(browser)await browser.close();
  if(server&&server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);server.kill();});
  fs.rmSync(temp,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exit(1)});
