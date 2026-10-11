const test=require('node:test');
const assert=require('node:assert/strict');
const {createDesktopSelection}=require('./desktop-selection.js');
function fixture(){const state=createDesktopSelection();state.update('session/home',['a','b','c','d']);return state;}
test('single selection replaces previous item and tracks focus/anchor',()=>{
 const s=fixture();s.select('a');s.select('c');assert.deepEqual(s.read(),{selectedIds:['c'],focusedId:'c',anchorId:'c'});
});
test('Ctrl toggles individual items without losing the remaining selection',()=>{
 const s=fixture();s.select('a');s.select('c',{ctrl:true});s.select('a',{ctrl:true});
 assert.deepEqual(s.read(),{selectedIds:['c'],focusedId:'a',anchorId:'a'});
});
test('Shift range follows visible order and keeps the original anchor',()=>{
 const s=fixture();s.select('c');s.select('a',{shift:true});assert.deepEqual(s.read().selectedIds,['a','b','c']);
 s.select('d',{shift:true});assert.deepEqual(s.read(),{selectedIds:['c','d'],focusedId:'d',anchorId:'c'});
});
test('Ctrl Shift adds a range to existing selection',()=>{
 const s=fixture();s.select('a');s.select('c',{ctrl:true});s.select('d',{ctrl:true,shift:true});
 assert.deepEqual(s.read().selectedIds,['a','c','d']);
});
test('same scope refresh retains surviving IDs in the new visible order',()=>{
 const s=fixture();s.select('a');s.select('c',{ctrl:true});s.update('session/home',['d','c','a']);
 assert.deepEqual(s.read().selectedIds,['c','a']);s.update('session/home',['a','d']);
 assert.deepEqual(s.read(),{selectedIds:['a'],focusedId:null,anchorId:null});
 s.select('d',{shift:true});assert.deepEqual(s.read().selectedIds,['d']);
});
test('page or session scope change and explicit clear retire selection and focus',()=>{
 const s=fixture();s.select('a');s.update('session/other',['a','b']);
 assert.deepEqual(s.read(),{selectedIds:[],focusedId:null,anchorId:null});
 s.select('b');s.clear();assert.deepEqual(s.read(),{selectedIds:[],focusedId:null,anchorId:null});
});
test('unknown items cannot become selected and returned arrays cannot mutate state',()=>{
 const s=fixture();s.select('b');assert.equal(s.select('missing'),false);
 const view=s.read();view.selectedIds.push('a');view.focusedId='a';
 assert.deepEqual(s.read(),{selectedIds:['b'],focusedId:'b',anchorId:'b'});
});