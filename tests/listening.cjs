'use strict';
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parse}=require('../scripts/sync-listening.cjs');
const base=process.env.TEST_URL||'http://127.0.0.1:8000';
const levels=['A1','A2','B1','B2','C1'];
const fixture={lessons:levels.flatMap(level=>[1,2].map(i=>({id:`${level.toLowerCase()}-fixture-${i}`,level,title:`${level} Test recording ${i}`,source:`https://learnenglishteens.britishcouncil.org/skills/listening/${level.toLowerCase()}-listening/test-${i}`,audio:'https://learnenglishteens.britishcouncil.org/sites/teens/files/test.wav',transcript:['Test fixture transcript.','Speaker: This is synthetic test content, not a British Council lesson.']})))};
// Local synthetic audio, intercepted at the remote URL. No audio is downloaded.
function wav(){const data=Buffer.alloc(44+16000*2*12);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(16000,24);data.writeUInt32LE(32000,28);data.writeUInt16LE(2,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(data.length-44,40);return data;}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/data/listening.json',r=>r.fulfill({json:fixture}));
  await context.route('https://learnenglishteens.britishcouncil.org/**',r=>{const body=wav(),range=r.request().headers()['range'];if(range){const m=/bytes=(\d+)-(\d*)/.exec(range),start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),body.length-1):body.length-1;return r.fulfill({status:206,contentType:'audio/wav',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`},body:body.subarray(start,end+1)});}return r.fulfill({contentType:'audio/wav',headers:{'Accept-Ranges':'bytes'},body});});
  await page.goto(base+'/#listening');await page.waitForSelector('.lesson-row');
  assert.equal(await page.locator('.lesson-row').count(),2);
  for(const level of levels){await page.locator(`.listening-levels a[href="#listening/${level}"]`).click();await page.waitForFunction(level=>document.querySelector('.lesson-row')?.textContent.includes(level),level);assert.match(await page.locator('.lesson-row').first().innerText(),new RegExp(level));}
  await page.fill('#lesson-search','recording 2');assert.equal(await page.locator('.lesson-row:visible').count(),1);
  await page.fill('#lesson-search','missing');assert.equal(await page.locator('.lesson-row:visible').count(),0);assert.equal(await page.locator('#lesson-no-results').isVisible(),true);
  await page.fill('#lesson-search','');await page.locator('.lesson-row').first().click();await page.waitForSelector('#dictation-text');
  assert.equal(await page.locator('#dictation-transcript').isVisible(),false);
  await page.fill('#dictation-text','My own <script>draft</script> & notes');
  await page.click('#transcript-toggle');assert.equal(await page.locator('#dictation-transcript').isVisible(),true);assert.match(await page.locator('#dictation-transcript').innerText(),/synthetic test content/);
  await page.reload();await page.waitForSelector('#dictation-text');assert.equal(await page.locator('#dictation-text').inputValue(),'My own <script>draft</script> & notes');assert.equal(await page.locator('#dictation-transcript').isVisible(),false);
  await page.locator('[data-nav="words"]').click();await page.waitForSelector('.word-row');await page.goto(base+'/#listening/C1/c1-fixture-1');await page.waitForSelector('#dictation-text');assert.match(await page.locator('#dictation-text').inputValue(),/My own/);
  await page.locator('#dictation-audio').evaluate(a=>a.play());await page.waitForFunction(()=>document.querySelector('audio').duration===12);
  await page.selectOption('#audio-speed','0.75');assert.equal(await page.locator('audio').evaluate(a=>a.playbackRate),.75);
  await page.locator('audio').evaluate(a=>{a.pause();a.currentTime=3;});await page.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-3)<.1);await page.click('#loop-start');await page.locator('audio').evaluate(a=>a.currentTime=6);await page.waitForFunction(()=>Math.abs(document.querySelector('audio').currentTime-6)<.1);await page.click('#loop-end');await page.click('#loop-toggle');assert.equal(await page.locator('#loop-toggle').getAttribute('aria-pressed'),'true');
  await page.locator('audio').evaluate(a=>{a.pause();a.currentTime=7;a.dispatchEvent(new Event('timeupdate'));});assert.ok(await page.locator('audio').evaluate(a=>a.currentTime<3.5));
  await page.click('#loop-reset');assert.equal(await page.locator('#loop-toggle').isDisabled(),true);
  await page.locator('audio').evaluate(a=>a.currentTime=9);await page.click('#back-five');assert.ok(await page.locator('audio').evaluate(a=>Math.abs(a.currentTime-4)<.1));
  await page.locator('audio').evaluate(a=>a.dispatchEvent(new Event('error')));assert.equal(await page.locator('#audio-error').isVisible(),true);
  await page.click('#draft-clear');await page.click('#clear-cancel');assert.match(await page.locator('#dictation-text').inputValue(),/My own/);
  const downloadPromise=page.waitForEvent('download');await page.click('#draft-download');const download=await downloadPromise;await download.saveAs('/tmp/teum-dictation-test.txt');assert.match(fs.readFileSync('/tmp/teum-dictation-test.txt','utf8'),/My own/);
  await page.locator('audio').evaluate(a=>a.dispatchEvent(new Event('playing')));assert.equal(await page.locator('#audio-error').isVisible(),false);await page.click('#transcript-toggle');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/teum-review/listening-desktop.png',fullPage:true});
  for(const width of [390,320]){await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);await page.screenshot({path:`/tmp/teum-review/listening-${width}.png`,fullPage:true});}
  await page.click('#draft-clear');await page.click('#clear-yes');assert.equal(await page.locator('#dictation-text').inputValue(),'');
  await page.goto(base+'/#listening/A1/a1-fixture-1');await page.waitForSelector('#dictation-text');assert.equal(await page.locator('#dictation-text').inputValue(),'');
  const denied=await browser.newContext();await denied.route('**/data/listening.json',r=>r.fulfill({json:fixture}));await denied.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('denied','SecurityError');};});const dp=await denied.newPage();await dp.goto(base+'/#listening/A1/a1-fixture-1');await dp.waitForSelector('#dictation-text');await dp.fill('#dictation-text','retained in memory');assert.match(await dp.locator('#draft-status').innerText(),/저장할 수 없어요/);
  const failed=await browser.newContext();await failed.route('**/data/listening.json',r=>r.fulfill({status:503,body:'unavailable'}));const fp=await failed.newPage();await fp.goto(base+'/#listening');await fp.waitForSelector('#listening-retry');await failed.unroute('**/data/listening.json');await failed.route('**/data/listening.json',r=>r.fulfill({json:fixture}));await fp.click('#listening-retry');await fp.waitForSelector('.lesson-row');
  const empty=await browser.newContext();await empty.route('**/data/listening.json',r=>r.fulfill({json:{lessons:[],levelStatus:{C1:'not-listed'}}}));const ep=await empty.newPage();await ep.goto(base+'/#listening/C1');await ep.waitForSelector('.dictation-status h3');assert.match(await ep.locator('.dictation-status').innerText(),/原本|원본 사이트에 C1 목록이 없어요/);await ep.locator('.listening-levels a').first().click();await ep.waitForSelector('.dictation-status h3');assert.match(await ep.locator('.dictation-status').innerText(),/아직 연결된 A1 자료가 없어요/);
  const parsed=await parse(page,'<h1>Fixture title</h1><audio><source src="/test.mp3"></audio><details><summary>Transcript</summary><p>Fixture text.<br>Second speaker.</p></details>',base);assert.deepEqual(parsed.transcript,['Fixture text.\nSecond speaker.']);
  assert.deepEqual(errors,[]);
  console.log('PASS fixture UI: five levels, search, hidden transcript, per-lesson drafts, reload/navigation, speed, A/B loop, rewind, media failure, clear confirmation, download, 390/320px layouts, storage denial, catalog retry, source-parser fixture; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
