'use strict';
// Shared, deterministic exercise generation and grading; no browser dependencies.
(function(root){
 const units=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
 const tens={twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
 const scales={thousand:1000,million:1e6,billion:1e9,trillion:1e12};
 const normalize=text=>String(text).normalize('NFC').replace(/\p{P}/gu,'').trim().replace(/\s+/gu,' ');
 function small(words){
  if(!words.length)return null;
  if(words.length===1){const n=units.indexOf(words[0]);return n>=0?n:(words[0]==='hundred'?100:(tens[words[0]]??null));}
  if(words[1]==='hundred'&&units.indexOf(words[0])>=1&&units.indexOf(words[0])<=9){const tail=words.slice(2);if(tail[0]==='and')tail.shift();if(!tail.length)return words.length===2?units.indexOf(words[0])*100:null;const rest=small(tail);return rest!==null&&rest<100?units.indexOf(words[0])*100+rest:null;}
  return words.length===2&&tens[words[0]]&&units.indexOf(words[1])>=1&&units.indexOf(words[1])<=9?tens[words[0]]+units.indexOf(words[1]):null;
 }
 function number(text){
  let raw=String(text).normalize('NFC').trim().toLowerCase();
  while(raw&&/\p{P}/u.test(raw[0])&&raw[0]!=='-')raw=raw.slice(1);
  raw=raw.replace(/\p{P}+$/gu,'').trim();
  if(/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw))raw=raw.replaceAll(',','');
  const canonical=value=>{const negative=value.startsWith('-');const [whole,decimal='']=value.replace(/^-/, '').split('.');const integer=whole.replace(/^0+(?=\d)/,'');const fraction=decimal.replace(/0+$/,'');return (negative&&(integer!=='0'||fraction)?'-':'')+integer+(fraction?'.'+fraction:'');};
  if(/^-?\d+(?:\.\d+)?$/.test(raw))return canonical(raw);
  let words=raw.replace(/[-\u2010-\u2015]/gu,' ').replace(/\p{P}/gu,'').split(/\s+/u);let sign=1;
  if(words[0]==='minus'){sign=-1;words.shift();}
  const point=words.indexOf('point');let fraction='';
  if(point>=0){const digits=words.slice(point+1);if(!digits.length||digits.some(w=>units.indexOf(w)<0||units.indexOf(w)>9))return null;fraction='.'+digits.map(w=>units.indexOf(w)).join('');words=words.slice(0,point);}
  if(!words.length)return null;
  if(words.length===1&&Object.hasOwn(scales,words[0]))return String(sign*scales[words[0]]);
  let total=0,group=[],previous=Infinity;
  for(const word of words){
   if(Object.hasOwn(scales,word)){const n=small(group);if(n===null||n===0||scales[word]>=previous)return null;total+=n*scales[word];previous=scales[word];group=[];}else group.push(word);
  }
  if(group[0]==='and'&&total)group.shift();
  const rest=group.length?small(group):0;if(rest===null||(!group.length&&!total))return null;
  return Number.isSafeInteger(total+rest)?canonical((sign<0?'-':'')+String(total+rest)+fraction):null;
 }
 function grade(answer,expected){
  const a=normalize(answer),e=normalize(expected),an=number(answer),en=number(expected);
  const sameText=a.toLowerCase()===e.toLowerCase();
  const correct=Boolean(a)&&(an!==null&&en!==null?an===en:sameText);
  return {correct,unanswered:!String(answer).trim(),caseWarning:correct&&sameText&&a!==e};
 }
 function generate(transcript){
  const candidates=[];let serial=0;
  const paragraphs=transcript.map(paragraph=>{
   const parts=[];let offset=0;
   const labelRanges=[...paragraph.matchAll(/^[ \t]*[\p{L}\p{N}][\p{L}\p{N} .’'()\-]{0,49}:[ \t]*/gmu)].map(m=>[m.index,m.index+m[0].length]);
   const pattern=/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’‘\u2010-\u2015-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu;
   for(const match of paragraph.matchAll(pattern)){
    if(match.index>offset)parts.push({text:paragraph.slice(offset,match.index)});
    const part={text:match[0]};parts.push(part);
    if(!labelRanges.some(([start,end])=>match.index>=start&&match.index<end)){part.candidate=serial++;candidates.push(part);}
    offset=match.index+match[0].length;
   }
   if(offset<paragraph.length)parts.push({text:paragraph.slice(offset)});return parts;
  });
  const chosen=candidates.filter(p=>p.candidate%3===2);if(!chosen.length&&candidates.length)chosen.push(candidates.at(-1));
  const answers=[];chosen.forEach(part=>{part.blank=answers.length;answers.push(part.text);});
  return {paragraphs,answers,signature:'1:'+JSON.stringify(transcript)};
 }
 const api={normalize,number,grade,generate};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TeumCloze=api;
})(globalThis);
