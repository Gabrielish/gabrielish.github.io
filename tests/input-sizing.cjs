const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const html=fs.readFileSync('index.html','utf8'),styles=[...html.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+)(?:\?[^" ]*)?"/g)].map(m=>fs.readFileSync(m[1],'utf8')).join('\n');
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:950}});await page.setContent(html.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,''));await page.addStyleTag({content:styles});
  const values=await page.evaluate(()=>[...document.querySelectorAll('input')].filter(el=>['text','email','url','tel','search','password','number','date','datetime-local','time'].includes(el.type)).map(el=>{const s=getComputedStyle(el);return{id:el.id||el.name,height:parseFloat(s.minHeight),padding:s.padding,font:s.fontSize,line:s.lineHeight};}));
  assert(values.length>6);for(const value of values){assert.equal(value.height,width<=600?40:38,value.id);assert.equal(value.padding,'7px 10px',value.id);assert.equal(value.font,width<=600?'16px':'13px',value.id);assert.equal(value.line,'22px',value.id);}
  await page.evaluate(()=>{for(const id of ['discussion-name','report-name'])for(let el=document.getElementById(id);el;el=el.parentElement){el.hidden=false;if(getComputedStyle(el).display==='none')el.style.display='block';}});
  const discussion=await page.locator('#discussion-name').boundingBox(),report=await page.locator('#report-name').boundingBox();assert(discussion&&report);assert.equal(discussion.height,report.height);assert.equal(discussion.height,width<=600?40:38);
  assert.equal(await page.locator('#report-photo').evaluate(el=>getComputedStyle(el).minHeight),'0px','Hidden upload input remains untouched');assert(await page.locator('#contact-form input[type=checkbox]').evaluate(el=>el.getBoundingClientRect().height<=24),'Checkbox stays smaller than text fields');await page.locator('#report-name').screenshot({path:`.qa/shared-report-input-${width}.png`});await page.close();
 }console.log('PASS: all single-line inputs share discussion dimensions at 320/390/1440px; file inputs, checkboxes and multiline fields stay separate.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
