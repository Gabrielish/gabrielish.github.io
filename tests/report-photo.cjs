// Browser image processing and attachment lifecycle with synthetic Storage.
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('http://localhost:4173/photo-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}));await page.goto('http://localhost:4173/photo-fixture');
  await page.setContent('<form id="report-form"><input name="title" value="Test"><div id="report-photo-drop"><strong id="report-photo-label"></strong><input id="report-photo" type="file"><img id="report-photo-preview" hidden><button type="button" id="report-photo-remove" hidden>Remove</button><p id="report-photo-status"></p><button type="submit">Send</button></div></form><article id="report"><form></form></article>');
  await page.addScriptTag({content:fs.readFileSync(require('node:path').join(__dirname,'../portal-report-photo.js'),'utf8')});
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=32;c.getContext('2d').fillRect(0,0,64,32);return c.toDataURL('image/png').split(',')[1]});
  await page.route('https://test.supabase.co/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));
  await page.locator('#report-photo').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"/>')});
  await page.waitForFunction(()=>document.querySelector('#report-photo-status').textContent.includes('validă'));
  assert.equal(await page.locator('#report-photo').inputValue(),'');
  await page.locator('#report-photo').setInputFiles({name:'capture.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForSelector('#report-photo-preview',{state:'visible'});
  await page.locator('#report-photo-remove').click();
  assert.equal(await page.locator('#report-photo').inputValue(),'');
  await page.locator('#report-photo').setInputFiles({name:'capture.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForSelector('#report-photo-preview',{state:'visible'});
  await page.evaluate(()=>{const input=document.querySelector('#report-photo'),dt=new DataTransfer();dt.items.add(input.files[0]);document.querySelector('#report-photo-drop').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));});
  await page.waitForFunction(()=>document.querySelectorAll('.report-photo-preview:not([hidden])').length===2);assert.equal(await page.locator('#report-photo-label').textContent(),'Capturi de ecran (opțional, max. 5 MB în total)');
  const results=await page.evaluate(async()=>{
   const calls={inserts:0,uploads:0,attaches:0,removes:0},id='11111111-1111-1111-1111-111111111111';
   let failUpload=true,failAttach=true;
   window.BG3RO_CONFIG={supabaseUrl:'https://test.supabase.co'};
   const client={
    from:()=>({insert(){calls.inserts++;return{select:()=>({maybeSingle:async()=>({data:{id},error:null})})}}}),
    storage:{from:()=>({
     upload:async(path,blob,opts)=>{calls.uploads++;if(blob.type!=='image/jpeg'||opts.upsert||blob.size>5242880)throw Error('Unsafe upload');if(failUpload){failUpload=false;return{error:new Error('Offline')}}return{error:null}},
     createSignedUrl:async()=>({data:{signedUrl:'https://test.supabase.co/storage/v1/object/sign/bg3ro-report-images/'+id+'/screenshot.jpg?token=test'},error:null}),
     remove:async()=>{calls.removes++;return{error:null}}
    })},
    rpc:async()=>{calls.attaches++;if(failAttach){failAttach=false;return{error:new Error('Offline')}}return{error:null}}
   };
   const api=window.BG3RO_REPORT_PHOTO;
   for(let i=0;i<2;i++){try{await api.publish(client,{title:'Test'});throw Error('Expected failure')}catch(e){if(e.code!=='REPORT_PHOTO')throw e}}
   await api.publish(client,{});
   if(document.querySelector('[name=title]').disabled)throw Error('Fields not restored');
   await api.show(client,{id,screenshot_path:id+'/screenshot.jpg'},document.querySelector('article'));
   const beforeForm=document.querySelector('article').firstElementChild.className==='report-photos';
   await api.cleanup(client,id+'/screenshot.jpg');
   document.querySelector('form').reset();
   return{...calls,beforeForm,reset:document.querySelector('#report-photo-preview').hidden&&!document.querySelector('#report-photo').disabled};
  });
  assert.deepEqual(results,{inserts:1,uploads:3,attaches:2,removes:1,beforeForm:true,reset:true});
  const beforeURL=page.url(),popups=[];page.on('popup',popup=>popups.push(popup));
  const thumbnail=page.locator('.report-photo-link');
  assert.equal(await thumbnail.evaluate(el=>el.tagName),'BUTTON');
  // Synthetic signed URL serves a local generated PNG, never real user content.
  await page.route('https://test.supabase.co/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(png,'base64')}));
  await thumbnail.click();await page.waitForSelector('.report-photo-viewer[open]');
  await page.getByRole('button',{name:'Închide fotografia'}).click();
  assert.equal(await page.locator('.report-photo-viewer').evaluate(el=>el.open),false);
  await thumbnail.focus();await page.keyboard.press('Enter');await page.waitForSelector('.report-photo-viewer[open]');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.report-photo-viewer').evaluate(el=>el.open),false);
  await thumbnail.click();await page.waitForSelector('.report-photo-viewer[open]');
  await page.mouse.click(1,1);assert.equal(await page.locator('.report-photo-viewer').evaluate(el=>el.open),false);
  assert.equal(page.url(),beforeURL);assert.equal(popups.length,0);
  console.log('PASS: valid screenshot preview/removal, invalid image rejection, JPEG conversion, upload and RPC retries without duplicate reports, signed image display, cleanup and reset.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
