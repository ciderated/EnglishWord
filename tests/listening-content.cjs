'use strict';
// Live content smoke test: no mocked catalog, media responses or transcripts.
// Requires the local server and access to learnenglishteens.britishcouncil.org.
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const catalog=require('../data/listening.json');
const levels=['A1','A2','B1','B2','C1'];
const base=process.env.TEST_URL||'http://127.0.0.1:8000';
const host='learnenglishteens.britishcouncil.org';
(async()=>{
 assert.ok(catalog.checkedAt,'Catalog must have been synchronized with the source');
 assert.ok(catalog.lessons.length>0,'Real catalog is empty');
 assert.equal(new Set(catalog.lessons.map(x=>x.id)).size,catalog.lessons.length);
 for(const lesson of catalog.lessons){
  assert.ok(levels.includes(lesson.level));
  assert.ok(lesson.title.trim());
  for(const value of [lesson.source,lesson.audio]){const u=new URL(value);assert.equal(u.protocol,'https:');assert.equal(u.hostname,host);}
  assert.ok(lesson.source.includes(`/skills/listening/${lesson.level.toLowerCase()}-listening/`));
  assert.ok(lesson.transcript.length>0);
  for(const paragraph of lesson.transcript){assert.equal(typeof paragraph,'string');assert.ok(paragraph.trim());assert.doesNotMatch(paragraph,/<(?:script|iframe|html|body)\b/i);}
 }
 const raw=process.env.HTTPS_PROXY||process.env.https_proxy;
 const p=raw?new URL(raw):null;
 const proxy=p?{server:p.origin,bypass:process.env.NO_PROXY||process.env.no_proxy||'127.0.0.1,localhost',...(p.username?{username:decodeURIComponent(p.username),password:decodeURIComponent(p.password)}:{})}:undefined;
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox'],...(proxy?{proxy}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const captures=path.join('/tmp','teum-real-content');fs.mkdirSync(captures,{recursive:true});
  for(const level of levels){
   const list=catalog.lessons.filter(x=>x.level===level);
   assert.ok(list.length>0,`${level} source lessons are missing`);
   await page.goto(`${base}/#listening/${level}`);await page.waitForFunction(count=>document.querySelectorAll('.lesson-row').length===count,list.length);
   assert.equal(await page.locator('#lesson-count').innerText(),`${list.length}개 자료`);
   const lesson=list[0];await page.locator('.lesson-row').first().click();await page.waitForFunction(src=>document.querySelector('#dictation-audio')?.src===src,lesson.audio);
   assert.equal(await page.locator('.listening-title h2').innerText(),lesson.title);
   assert.equal(await page.locator('#dictation-transcript').isVisible(),false);
   await page.locator('#dictation-audio').evaluate(async audio=>{await Promise.race([audio.play(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Original audio playback timed out')),30000))]);});
   await page.waitForFunction(()=>document.querySelector('audio').currentTime>0,null,{timeout:30000});
   const media=await page.locator('audio').evaluate(a=>({duration:a.duration,currentTime:a.currentTime,error:a.error?.code||null}));
   assert.ok(media.duration>0&&Number.isFinite(media.duration));assert.equal(media.error,null);
   await page.locator('audio').evaluate(a=>a.pause());
   await page.click('#transcript-toggle');
   const actual=await page.locator('#dictation-transcript>div>p').allTextContents();assert.deepEqual(actual,lesson.transcript);
   await page.fill('#dictation-text',`Dictation practice: ${lesson.title}`);
   if(level==='A1'){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(captures,'desktop.png'),fullPage:true});}
   console.log(`PASS ${level}: ${list.length} lessons; original audio plays (${Math.round(media.duration)}s); full transcript displayed`);
  }
  for(const width of [390,320]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>scrollTo(0,0));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}px`);
   await page.screenshot({path:path.join(captures,`mobile-${width}.png`),fullPage:false});
  }
  await page.locator('#dictation-transcript').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(captures,'mobile-transcript-320.png'),fullPage:false});
  assert.deepEqual(errors,[]);console.log(`PASS ${catalog.lessons.length} real lesson records, five source audio streams, matching transcripts, mobile layouts and no runtime errors`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
