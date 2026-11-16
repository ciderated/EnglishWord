// Refresh the verified British Council catalog. Audio is linked, never downloaded.
// Usage: node scripts/sync-listening.cjs [destination.json]
'use strict';
const {chromium}=require('@playwright/test');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const origin='https://learnenglishteens.britishcouncil.org';
const root=origin+'/skills/listening';
const levels=['A1','A2','B1','B2','C1'];
function allowed(url){const u=new URL(url);if(u.origin!==origin)throw Error(`Unexpected source host: ${u.hostname}`);return u.href;}
function get(url,head=false){return execFileSync('curl',['--fail','--silent','--show-error','--location','--max-time','45',...(head?['--head']:[]),allowed(url)],{encoding:'utf8',maxBuffer:8*1024*1024});}
async function parse(page,html,url){return page.evaluate(({html,url})=>{
 const doc=new DOMParser().parseFromString(html,'text/html');
 const absolute=value=>{try{return new URL(value,url).href;}catch{return '';}};
 const links=[...doc.querySelectorAll('a[href]')].map(a=>({url:absolute(a.getAttribute('href')),title:a.textContent.trim()}));
 const audio=[...doc.querySelectorAll('audio[src],audio source[src]')].map(a=>absolute(a.getAttribute('src'))).concat(links.filter(a=>/\.mp3(?:\?|$)/i.test(a.url)).map(a=>a.url));
 let transcript=doc.querySelector('.field--name-field-transcript .field__item, .field-name-field-transcript .field-item, .field--name-field-transcript, .field-name-field-transcript');
 if(!transcript){const title=[...doc.querySelectorAll('summary,h2,h3,h4')].find(x=>/^transcript(?:ion)?$/i.test(x.textContent.trim()));if(title)transcript=title.closest('details')||title.parentElement;}
 let paragraphs=[];
 if(transcript){transcript.querySelectorAll('script,style,summary,h2,h3,h4').forEach(x=>x.remove());transcript.querySelectorAll('br').forEach(x=>x.replaceWith(doc.createTextNode('\n')));paragraphs=[...transcript.querySelectorAll('p')].map(p=>p.innerText||p.textContent).map(p=>p.trim()).filter(Boolean);if(!paragraphs.length){const t=transcript.textContent.trim();if(t)paragraphs=[t];}}
 return {title:doc.querySelector('h1')?.textContent.trim(),links,audio:[...new Set(audio)],transcript:paragraphs};
 },{html,url});}
async function sync(destination){
 const browser=await chromium.launch(fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}:{});
 try{
  const page=await browser.newPage();const index=await parse(page,get(root),root);const lessons=[],levelStatus={};
  for(const level of levels){
   const match=index.links.find(a=>new URL(a.url).origin===origin&&new URL(a.url).pathname.startsWith('/skills/listening/')&&new RegExp(`(?:^|[/\\-])${level}(?:[/\\-]|$)`,'i').test(new URL(a.url).pathname));
   if(!match){levelStatus[level]='not-listed';console.log(`${level}: no source category listed on the verified index`);continue;}levelStatus[level]='listed';
   const levelURL=new URL(match.url);const pending=[levelURL.href],seen=new Set(),lessonURLs=new Set();
   while(pending.length){
    const url=pending.shift();if(seen.has(url))continue;seen.add(url);if(seen.size>30)throw Error('Unexpected pagination size');
    const listing=await parse(page,get(url),url);
    for(const link of listing.links){const u=new URL(link.url);if(u.origin!==origin)continue;if(u.pathname===levelURL.pathname&&u.searchParams.has('page')&&!seen.has(u.href))pending.push(u.href);if(u.pathname.startsWith(levelURL.pathname.replace(/\/$/,'')+'/')){u.search='';u.hash='';lessonURLs.add(u.href);}}
   }
   if(!lessonURLs.size)throw Error(`No ${level} lessons found; inspect source structure.`);
   for(const url of lessonURLs){
    const doc=await parse(page,get(url),url);const audio=doc.audio.find(a=>new URL(a).origin===origin);
    if(!doc.title||!audio||!doc.transcript.length)throw Error(`Missing title/audio/transcript: ${url}`);
    const headers=get(audio,true);if(!/^content-type:\s*audio\//im.test(headers))throw Error(`Unexpected audio response: ${audio}`);
    const id=level.toLowerCase()+'-'+new URL(url).pathname.split('/').filter(Boolean).at(-1);
    lessons.push({id,level,title:doc.title,source:url,audio,transcript:doc.transcript});console.log(`${level}: ${doc.title}`);
   }
  }
  if(!lessons.length)throw Error('No source categories found; catalog was not changed.');
  if(new Set(lessons.map(x=>x.id)).size!==lessons.length)throw Error('Duplicate lesson IDs');
  const output={source:root,checkedAt:new Date().toISOString(),levelStatus,lessons};
  fs.writeFileSync(destination+'.tmp',JSON.stringify(output,null,2)+'\n');fs.renameSync(destination+'.tmp',destination);
  console.log(`Saved ${lessons.length} verified lessons to ${destination}`);
 }finally{await browser.close();}
}
if(require.main===module)sync(path.resolve(process.argv[2]||path.join(__dirname,'../data/listening.json'))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={parse};
