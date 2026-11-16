'use strict';
// Apply reviewed proper-name annotations locally without fetching media or transcripts.
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'../data/listening.json');
const names=require('../data/proper-nouns.json');
const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
for(const lesson of catalog.lessons){
 if(!Object.hasOwn(names,lesson.id)||!Array.isArray(names[lesson.id]))throw Error(`Missing proper-name review: ${lesson.id}`);
 const text=lesson.transcript.join('\n');
 if(!names[lesson.id].every(name=>typeof name==='string'&&name.length&&text.includes(name)))throw Error(`Name absent from source: ${lesson.id}`);
 lesson.properNouns=names[lesson.id];
}
fs.writeFileSync(file+'.tmp',JSON.stringify(catalog,null,2)+'\n');fs.renameSync(file+'.tmp',file);
console.log(`Applied reviewed proper names for ${catalog.lessons.length} lessons`);
