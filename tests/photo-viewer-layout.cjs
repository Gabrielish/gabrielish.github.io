const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{for(const width of [320,390,1440])for(const [w,h]of [[1600,900],[700,1500]]){
 const page=await browser.newPage({viewport:{width,height:950}});
 const src='data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#34505b"/></svg>`).toString('base64');
 await page.setContent(`<dialog class="report-photo-viewer"><button class="dialog-close" aria-label="Închide fotografia">×</button><img src="${src}" alt="Captură de test"></dialog>`);
 await page.addStyleTag({content:fs.readFileSync('portal.css','utf8')+'\n'+fs.readFileSync('portal-report-form.css','utf8')});
 await page.evaluate(()=>{const dialog=document.querySelector('dialog');dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal();});
 await page.locator('img').evaluate(image=>image.decode());
 const viewer=await page.locator('dialog').boundingBox(),photo=await page.locator('img').boundingBox(),close=await page.locator('button').boundingBox();
 assert(Math.abs(photo.x-viewer.x)<1&&Math.abs(photo.y-viewer.y)<1,'No padding around image');
 assert(Math.abs(photo.width-viewer.width)<1&&Math.abs(photo.height-viewer.height)<1,'Dialog hugs image');
 assert(close.x>=photo.x&&close.y>=photo.y&&close.x+close.width<=photo.x+photo.width&&close.y+close.height<=photo.y+photo.height,'X overlays photo');
 assert(Math.abs(photo.width/photo.height-w/h)<.01,'Aspect ratio stays unchanged');assert(viewer.x>=0&&viewer.x+viewer.width<=width);
 await page.screenshot({path:`.qa/photo-overlay-${width}-${w}.png`});
 await page.locator('button').click();assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);await page.close();
}console.log('PASS: edge-to-edge photo dialog, overlaid X, uncropped landscape/portrait images at 320/390/1440px.');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
