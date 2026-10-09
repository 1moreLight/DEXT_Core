"use strict";
const test=require('node:test'),assert=require('node:assert/strict');
const {createPlaybackHost}=require('./playback-host.js');
const message=(sequence,paused,messages=[])=>({type:'dext:v3-playback',protocolVersion:1,sequence,paused,messages,runtimeGeneration:1});
test('pause is synchronous and resume applies last Core state before releasing retained consumers',()=>{
 const calls=[],host=createPlaybackHost({setSuspended:value=>calls.push(['paused',value]),onRuntimeMessage:value=>calls.push(['runtime',value.revision])});
 assert.equal(host.handle(message(1,true)),true);assert.deepEqual(calls,[['paused',true]]);
 calls.length=0;assert.equal(host.handle(message(2,false,[{type:'dext:v3-runtime'},{type:'dext:v3-session',revision:3}])),true);
 assert.deepEqual(calls,[['paused',true],['runtime',undefined],['runtime',3],['paused',false]]);assert.equal(host.readState().paused,false);
});
test('old repeated malformed and authored messages cannot resume private suspension',()=>{
 const calls=[],host=createPlaybackHost({setSuspended:value=>calls.push(value),onRuntimeMessage(){}});host.handle(message(4,true));
 for(const value of [message(3,false),message(4,false),{...message(5,false),protocolVersion:2},{...message(5,false),paused:'false'},message(5,false,[{type:'actions.activate'}]),{...message(5,false),consumer:'scene'},message(5,true,[{type:'dext:v3-session'}])])assert.equal(host.handle(value),false);
 assert.equal(host.readState().paused,true);assert.deepEqual(calls,[true]);
});
test('failed Core state replay keeps clocks suspended and diagnostics contain no private exception',()=>{
 const calls=[],host=createPlaybackHost({setSuspended:value=>calls.push(value),onRuntimeMessage(){throw Error('C:/private');}});
 assert.equal(host.handle(message(1,false,[{type:'dext:v3-runtime-revoked'}])),false);assert.deepEqual(calls,[true]);assert.equal(host.readState().paused,true);
 assert.equal(JSON.stringify(host.readState()).includes('private'),false);
});
test('newer reentrant pause wins over an older resume and disposal retains paused state',()=>{
 const calls=[];let host;host=createPlaybackHost({setSuspended:value=>calls.push(value),onRuntimeMessage:()=>host.handle(message(3,true))});
 assert.equal(host.handle(message(2,false,[{type:'dext:v3-session'}])),false);assert.equal(host.readState().paused,true);assert.deepEqual(calls,[true,true]);
 host.dispose();assert.equal(host.handle(message(4,false)),false);assert.equal(host.readState().disposed,true);
});

test('fixed current runtime rejects wrong-generation private playback before changing consumers',()=>{
 const calls=[],host=createPlaybackHost({matchesRuntime:generation=>generation===2,setSuspended:value=>calls.push(value),onRuntimeMessage(){}});
 assert.equal(host.handle(message(1,false)),false);assert.equal(calls.length,0);assert.equal(host.readState().sequence,0);
 assert.equal(host.handle({...message(2,true),runtimeGeneration:2}),true);assert.deepEqual(calls,[true]);
});
