const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440])for(const [w,h]of [[1600,900],[700,1500]]){
 const page=await browser.newPage({viewport:{width,height:950},hasTouch:width<600,reducedMotion:'reduce'});
 const src='http://127.0.0.1:4173/photo-viewer-test.svg';await page.route(src,r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#34505b"/></svg>`}));
 await page.setContent('<button id="open">Deschide</button>');await page.addStyleTag({content:fs.readFileSync('portal.css','utf8')+'\n'+fs.readFileSync('portal-image-viewer.css','utf8')});await page.addScriptTag({content:fs.readFileSync('portal-image-viewer.js','utf8')});
 await page.evaluate(src=>document.querySelector('#open').onclick=()=>window.BG3RO_IMAGE_VIEWER.open([{src,alt:'Captură de test'},{src:src+'?second',alt:'A doua captură'}]),src);
 await page.route(src+'?second',r=>r.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#73505b"/></svg>`}));
 await page.locator('#open').click();await page.locator('dialog>img').evaluate(image=>image.decode());
 const viewer=await page.locator('dialog').boundingBox(),photo=await page.locator('dialog>img').boundingBox(),close=await page.locator('.image-viewer-close').boundingBox();
 assert.equal(viewer.x,0);assert.equal(viewer.y,0);assert.equal(viewer.width,width);assert.equal(viewer.height,950);
 assert(close.x>=width-64&&close.y<=20,'X stays in the top-right viewport corner');
 assert(Math.abs(photo.width/photo.height-w/h)<.01,'Landscape/portrait remains uncropped');assert(photo.x>=0&&photo.x+photo.width<=width&&photo.y>=0&&photo.y+photo.height<=950);
 assert.equal(await page.locator('.image-viewer-counter').textContent(),'1 / 2');await page.getByRole('button',{name:'Imaginea următoare'}).click();assert.equal(await page.locator('.image-viewer-counter').textContent(),'2 / 2');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.image-viewer-counter').textContent(),'1 / 2');await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('.image-viewer-counter').textContent(),'2 / 2');
 await page.screenshot({path:`.qa/photo-overlay-${width}-${w}.png`});await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);assert.equal(await page.locator(':focus').getAttribute('id'),'open');
 await page.evaluate(src=>window.BG3RO_IMAGE_VIEWER.open([{src}]),src);assert.equal(await page.locator('.image-viewer-next').isVisible(),false);await page.getByRole('button',{name:'Închide fotografia'}).click();await page.close();
}console.log('PASS: fullscreen shared viewer, top-right X, arrows/counter, keyboard cycling/Escape/focus and uncropped portrait/landscape at 320/390/1440px.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
