const {chromium}=require('playwright'),fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const section=fs.readFileSync('index.html','utf8').match(/<section class="card quick-download">[\s\S]*?<\/section>/)[0];
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync('assets/downloads/'+file)).digest('hex');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 for(const [os,platform,ua,width,touch]of [['windows','Win32','Windows NT 10.0',1440,false],['macos','MacIntel','Macintosh; Intel Mac OS X 14_0',1440,false],['other','Linux x86_64','Linux',390,false],['other','MacIntel','iPad; CPU OS 18_0 like Mac OS X',320,true]]){
  const p=await b.newPage({viewport:{width,height:800},userAgent:ua,hasTouch:touch,isMobile:touch}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(({platform,touch})=>{Object.defineProperty(navigator,'platform',{value:platform});Object.defineProperty(navigator,'userAgentData',{value:undefined});Object.defineProperty(navigator,'maxTouchPoints',{value:touch?5:0});},{platform,touch});
  await p.route('http://127.0.0.1:4173/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><aside class="sidebar" style="width:300px;max-width:100%;margin:60px auto">'+section+'</aside></body></html>'}));
  await p.goto('http://127.0.0.1:4173/');for(const name of ['portal.css','portal-icons.css'])await p.addStyleTag({content:fs.readFileSync(name,'utf8')});await p.addScriptTag({content:fs.readFileSync('updater-download.js','utf8')});
  const button=p.locator('.updater-info-trigger'),tip=p.locator('.updater-info-popover');
  if(touch)await button.tap();else await button.hover();await p.locator('.updater-info-popover:popover-open').waitFor();
  const text=await tip.textContent();if(os==='windows'){assert(text.includes('Chrome'));assert(text.includes('detecții antivirus'));assert(!text.includes('Confidențialitate'));assert(text.includes('administrator'));}else if(os==='macos'){assert(text.includes('Deschide oricum'));assert(!text.includes('Chrome'));}else assert(!text.includes('Chrome')&&!text.includes('Deschide oricum'));
  const links=tip.locator('a');assert.equal(await links.count(),os==='other'?2:1);
  for(const target of os==='other'?['windows','macos']:[os]){const expected=target==='windows'?hash('BG3RO-Updater.exe'):'952583b60d6d73e7ed968c968d3a19133a68d1425dffbca7a131bf60a3f363a1';assert.equal(await tip.locator('a[href$="'+expected+'?nocache=1"]').count(),1);}
  if(os!=='windows')assert(text.includes('alt hash decât arhiva distribuită acum'));
  const rect=await tip.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width+1&&rect.y>=0&&rect.y+rect.height<=800);
  if(!touch){await links.first().hover();await p.waitForTimeout(250);assert(await tip.evaluate(el=>el.matches(':popover-open')),'Links remain reachable when moving from the info icon');}
  await tip.screenshot({path:'.qa/updater-info-'+os+'-'+width+'.png'});await p.keyboard.press('Escape');assert.equal(await tip.evaluate(el=>el.matches(':popover-open')),false);
  await button.click();assert(await tip.evaluate(el=>el.matches(':popover-open')));await p.mouse.click(1,1);assert.equal(await tip.evaluate(el=>el.matches(':popover-open')),false);
  assert.equal(await p.locator('.updater-download').getAttribute('download'),os==='macos'?'BG3RO-Updater-macOS.zip':'BG3RO-Updater.exe');assert.deepEqual(errors,[]);await p.close();
 }
 console.log('PASS OS-specific first-run help, exact file hashes, hover/link reachability, tap, Escape, outside click and viewport fit');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
