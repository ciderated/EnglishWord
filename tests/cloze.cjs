'use strict';
const assert=require('node:assert/strict');
const {grade,number,generate}=require('../cloze.js');
const cases=[
 ['hello,','hello',true,false],['“Hello!”','hello',true,true],['dont',"don't",true,false],['wellbeing','well-being',true,false],
 ['Cat','cat',true,true],['CAT','cat',true,true],['cap','cat',false,false],['','one',false,false],['   ','one',false,false],['!!!','cat',false,false],
 ['1','one',true,false],['Two','2',true,false],['one,','1',true,false],['!2!','two',true,false],['ONE','one',true,true],['21','twenty-one',true,false],
 ['twenty one','21',true,false],['105','one hundred and five',true,false],['1,000','one thousand',true,false],['0','zero',true,false],
 ['1.5','one point five',true,false],['15','one point five',false,false],['one two','3',false,false],['eleven','12',false,false],
 ['£1','one',false,false],['cafe','café',false,false],['a','1',false,false],['9007199254740993','9007199254740992',false,false]
];
for(const [answer,expected,correct,caseWarning] of cases){const actual=grade(answer,expected);assert.equal(actual.correct,correct,`${answer} vs ${expected}`);assert.equal(actual.caseWarning,caseWarning,`${answer} case vs ${expected}`);}
assert.equal(number('one million two thousand and five'),'1002005');
assert.equal(number('one hundred and'),null);
assert.equal(number('hundred'),'100');
assert.equal(number('one thousand two thousand'),null);
const short=generate(['Host: Hi.']);assert.deepEqual(short.answers,['Hi']);
const fixture=['Host: We hear one and see Two.\nGuest: I prefer twenty-one.'];const exercise=generate(fixture);
assert.deepEqual(exercise.answers,['one','Two','twenty-one']);
assert.deepEqual(generate(fixture),exercise);
for(const lesson of require('../data/listening.json').lessons){const ex=generate(lesson.transcript);assert.ok(ex.answers.length>0);assert.deepEqual(ex.paragraphs.map(parts=>parts.map(p=>p.text).join('')),lesson.transcript);}
console.log(`PASS ${cases.length} grading cases, numeric grammar/precision, deterministic blanks, speaker exclusion and lossless text for all62 lessons`);
