const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {
  projectDeskItems, resolveDeskLayout, validateDrop, mapLocalRect, clientPointToLocal
} = require('./layout-model.js');

const canvas = {x:0,y:0,width:1920,height:1080};
const viewport = {width:1920,height:1080,dpr:1};
const rect = (x,y,width,height) => ({x,y,width,height});
const item = (key, savedRect, kind='widget') => ({key,kind,id:key,savedRect,logicalSize:{width:savedRect.width,height:savedRect.height}});
const resultFor = (items, options={}) => resolveDeskLayout({items,viewport,occupied:[],deskId:'home',...options});
const near = (actual, expected, epsilon=1e-8) => assert.ok(Math.abs(actual-expected)<=epsilon, actual+' != '+expected);
function freezeDeep(value) {
  if (value && typeof value==='object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}
function manifest() {
  return {version:3,apiVersion:1,id:'room',
    components:[
      {id:'shared',role:'widget',placement:rect(400,50,200,100)},
      {id:'dock',role:'dock',placement:rect(0,980,1920,100)},
      {id:'other',role:'widget',placement:rect(800,100,160,90)}
    ],
    desks:[
      {id:'home',icons:[{id:'one',x:2,y:3}],components:['shared','dock']},
      {id:'focus',icons:[],components:['shared','other']}
    ]};
}

test('projects current Desk icons and only Widgets, preserving shared identity and logical iframe dimensions', () => {
  const room=freezeDeep(manifest()),layout=freezeDeep({revision:4,icons:{home:{one:{x:60,y:70}},focus:{orphan:{x:9,y:9}}},components:{shared:rect(500,200,300,150),orphan:rect(1,2,3,4)}});
  const home=projectDeskItems({manifest:room,layout,deskId:'home'});
  const focus=projectDeskItems({manifest:room,layout,deskId:'focus'});
  assert.equal(home.length,2);
  assert.deepEqual(home.find(v=>v.kind==='icon').savedRect,rect(60,70,96,104));
  const shared=home.find(v=>v.kind==='widget');
  assert.deepEqual(shared.savedRect,rect(500,200,300,150));
  assert.deepEqual(shared.logicalSize,{width:200,height:100});
  assert.equal(focus.find(v=>v.id==='shared').key,shared.key);
  assert.equal(home.some(v=>v.id==='dock'||v.id==='orphan'),false);
  shared.savedRect.x=0;
  assert.equal(layout.components.shared.x,500);
});

test('defaults match existing official icon grid and author Widget placement without mutating manifest', () => {
  const room=freezeDeep(manifest());
  const values=projectDeskItems({manifest:room,deskId:'home'});
  assert.deepEqual(values.find(v=>v.kind==='icon').savedRect,rect(256,392,96,104));
  assert.deepEqual(values.find(v=>v.kind==='widget').savedRect,rect(400,50,200,100));
  assert.throws(()=>projectDeskItems({manifest:room,deskId:'missing'}),TypeError);
});

test('preserves every already legal placement before relocating a blocked earlier item', () => {
  const items=freezeDeep([item('blocked',rect(0,0,100,100)),item('legal',rect(100,0,100,100))]);
  const values=resultFor(items,{occupied:[{id:'reserved',...rect(0,0,100,100)}]});
  assert.deepEqual(values.find(v=>v.key==='legal').effectiveRect,rect(100,0,100,100));
  const moved=values.find(v=>v.key==='blocked');
  assert.equal(moved.placeable,true);
  assert.equal(moved.scale,1);
  assert.equal(validateDrop({candidate:moved.effectiveRect,bounds:canvas,occupied:[rect(0,0,100,100)],otherItems:[values.find(v=>v.key==='legal')]}).accepted,true);
});

test('moves at baseline size when a saved CSS position is outside a smaller viewport', () => {
  const saved=rect(1800,950,100,100),items=freezeDeep([item('edge',saved)]);
  const values=resultFor(items,{viewport:{width:960,height:540,dpr:2}});
  assert.equal(values[0].scale,1);
  assert.equal(values[0].placeable,true);
  assert.deepEqual(values[0].effectiveRect,rect(1720,880,200,200));
  assert.deepEqual(values[0].savedRect,saved);
});

test('does not shrink when full size fits elsewhere even if a smaller place is closer', () => {
  const values=resultFor([item('move',rect(0,0,200,100))],{
    viewport:{width:400,height:200,dpr:1},
    occupied:[{id:'reserve',...rect(240,0,720,1080)}]
  });
  assert.equal(values[0].scale,1);
  near(values[0].effectiveRect.x,960);
  near(values[0].effectiveRect.y,0);
  near(values[0].effectiveRect.width,960);
});

test('shrinks equally only when original dimensions fit nowhere and honours caller minimumScale', () => {
  const items=[item('large',rect(0,0,200,100))];
  const values=resultFor(items,{viewport:{width:100,height:100,dpr:1}});
  assert.equal(values[0].placeable,true);
  near(values[0].scale,.5);
  near(values[0].effectiveRect.width/values[0].effectiveRect.height, (100/(100/1920))/(50/(100/1080)));
  const unavailable=resultFor(items,{viewport:{width:100,height:100,dpr:1},minimumScale:.6})[0];
  assert.equal(unavailable.placeable,false);
  assert.equal(unavailable.effectiveRect,null);
});

test('restoring the original viewport recovers saved positions and baseline sizes without saving', () => {
  const items=freezeDeep([item('restore',rect(1800,950,100,100))]);
  resultFor(items,{viewport:{width:960,height:540,dpr:1.5}});
  const restored=resultFor(items)[0];
  assert.deepEqual(restored.effectiveRect,items[0].savedRect);
  assert.equal(restored.scale,1);
  assert.deepEqual(items[0].savedRect,rect(1800,950,100,100));
});

test('uses current Desk and global occupied regions and ignores another Desk region', () => {
  const value=resultFor([item('free',rect(100,100,100,100))],{
    occupied:[{id:'foreign',deskId:'focus',...rect(100,100,100,100)},{id:'global',...rect(0,0,100,100)}]
  })[0];
  assert.deepEqual(value.effectiveRect,rect(100,100,100,100));
  const blocked=resultFor([item('free',rect(100,100,100,100))],{
    occupied:[{id:'current',deskId:'home',...rect(100,100,100,100)}]
  })[0];
  assert.notDeepEqual(blocked.effectiveRect,rect(100,100,100,100));
});

test('resolves conflicts deterministically with Widget priority and stable keys', () => {
  const icon=item('icon.a',rect(0,0,96,104),'icon');
  const widget=item('widget.z',rect(0,0,100,100));
  const first=resultFor([icon,widget]);
  const second=resultFor([widget,icon]);
  assert.deepEqual(first.find(v=>v.key==='widget.z').effectiveRect,widget.savedRect);
  assert.deepEqual(Object.fromEntries(first.map(v=>[v.key,v.effectiveRect])),Object.fromEntries(second.map(v=>[v.key,v.effectiveRect])));
  const pair=resultFor([item('b',rect(0,0,100,100)),item('a',rect(0,0,100,100))]);
  assert.deepEqual(pair.find(v=>v.key==='a').effectiveRect,rect(0,0,100,100));
});

test('default shrinking supports any positive free area and reports completely covered viewport unplaceable', () => {
  const items=[item('tiny',rect(0,0,100,100))];
  const covered=resultFor(items,{occupied:[rect(0,0,1920,1080)]})[0];
  assert.equal(covered.placeable,false);
  assert.equal(covered.effectiveRect,null);
  const sliver=resultFor(items,{occupied:[rect(0,0,1919.999999,1080)]})[0];
  assert.equal(sliver.placeable,true);
  assert.ok(sliver.scale>0&&sliver.scale<1e-7);
  assert.equal(validateDrop({candidate:sliver.effectiveRect,bounds:canvas,occupied:[rect(0,0,1919.999999,1080)]}).accepted,true);
});

test('resolve never changes input saved values, occupied geometry, viewport or another output', () => {
  const items=freezeDeep([item('safe',rect(50,60,200,100))]);
  const occupied=freezeDeep([rect(500,0,100,1080)]);
  const vp=freezeDeep({width:960,height:540,dpr:1.5});
  const before=JSON.stringify({items,occupied,vp});
  const a=resultFor(items,{occupied,viewport:vp});
  a[0].savedRect.x=0;a[0].logicalSize.width=1;
  const b=resultFor(items,{occupied,viewport:vp});
  assert.equal(JSON.stringify({items,occupied,vp}),before);
  assert.equal(b[0].savedRect.x,50);
  assert.equal(b[0].logicalSize.width,200);
});

test('drop rejects invalid, out of bounds, occupied and other effective rectangles; touching edges is legal', () => {
  const options={bounds:canvas,occupied:[rect(0,0,100,100)],otherItems:[{key:'other',placeable:true,effectiveRect:rect(100,100,100,100)}],itemKey:'own'};
  assert.equal(validateDrop({...options,candidate:rect(100,0,100,100)}).accepted,true);
  assert.equal(validateDrop({...options,candidate:rect(99,0,100,100)}).reason,'occupied');
  assert.equal(validateDrop({...options,candidate:rect(150,150,100,100)}).reason,'overlap');
  assert.equal(validateDrop({...options,candidate:rect(1850,0,100,100)}).reason,'outOfBounds');
  for(const r of [rect(NaN,0,10,10),rect(0,0,-1,10),rect(0,0,0,10)]) assert.equal(validateDrop({...options,candidate:r}).reason,'invalidRectangle');
  assert.equal(validateDrop({candidate:rect(10,10,10,10),bounds:canvas,itemKey:'own',otherItems:[{key:'own',effectiveRect:rect(10,10,10,10)},{key:'missing',placeable:false,effectiveRect:null}]}).accepted,true);
});

test('drop filters occupied Desk scope without relaxing global regions', () => {
  const occupied=[{deskId:'focus',...rect(0,0,100,100)},rect(200,0,100,100)];
  assert.equal(validateDrop({candidate:rect(0,0,100,100),bounds:canvas,occupied,deskId:'home'}).accepted,true);
  assert.equal(validateDrop({candidate:rect(200,0,100,100),bounds:canvas,occupied,deskId:'home'}).reason,'occupied');
});

test('maps author local button rectangles through effective placement using original logical dimensions', () => {
  const local=freezeDeep(rect(10,20,30,40)),effective=freezeDeep(rect(500,200,100,50));
  assert.deepEqual(mapLocalRect({localRect:local,logicalSize:{width:200,height:100},effectiveRect:effective}),rect(505,210,15,20));
  assert.deepEqual(mapLocalRect({localRect:local,logicalSize:{width:200,height:100},effectiveRect:rect(600,300,300,150)}),rect(615,330,45,60));
  assert.deepEqual(local,rect(10,20,30,40));
  assert.throws(()=>mapLocalRect({localRect:rect(190,0,30,20),logicalSize:{width:200,height:100},effectiveRect:effective}),TypeError);
});

test('inverse pointer math removes CSS root and affine group transforms, independent of DPR', () => {
  const groupMatrix=[2,.5,.25,1.5,30,40],point={x:500,y:200};
  const transformed={x:groupMatrix[0]*point.x+groupMatrix[2]*point.y+groupMatrix[4],y:groupMatrix[1]*point.x+groupMatrix[3]*point.y+groupMatrix[5]};
  const clientPoint={x:17+transformed.x*.5,y:23+transformed.y*.5};
  for(const dpr of [1,2,3]) {
    const actual=clientPointToLocal({clientPoint,viewport:{width:960,height:540,left:17,top:23,dpr},groupMatrix});
    near(actual.x,500);near(actual.y,200);
  }
});

test('pointer local coordinates also undo effective wrapper scale and fail closed for singular transforms', () => {
  const actual=clientPointToLocal({clientPoint:{x:252.5,y:105},viewport:{width:960,height:540,dpr:2},groupMatrix:[1,0,0,1,0,0],placement:rect(500,200,100,50),logicalSize:{width:200,height:100}});
  assert.deepEqual(actual,{x:10,y:20});
  assert.equal(clientPointToLocal({clientPoint:{x:1,y:1},viewport,groupMatrix:[1,2,2,4,0,0]}),null);
  assert.equal(clientPointToLocal({clientPoint:{x:NaN,y:1},viewport,groupMatrix:[1,0,0,1,0,0]}),null);
});

test('browser UMD exports the same pure module without requiring DOM globals', () => {
  const sandbox={};
  vm.runInNewContext(fs.readFileSync(require.resolve('./layout-model.js'),'utf8'),sandbox);
  assert.equal(typeof sandbox.DextLayoutModel.resolveDeskLayout,'function');
  assert.equal(Object.isFrozen(sandbox.DextLayoutModel),true);
});
test('full-size exact gaps keep both touching edges legal', () => {
  const value=resultFor([item('gap',rect(0,0,100,100))],{
    viewport:{width:300,height:200,dpr:1},
    occupied:[rect(0,0,640,1080),rect(1280,0,640,1080)]
  })[0];
  assert.equal(value.scale,1);
  near(value.effectiveRect.x,640);
  near(value.effectiveRect.width,640);
  assert.equal(validateDrop({candidate:value.effectiveRect,bounds:canvas,occupied:[rect(0,0,640,1080),rect(1280,0,640,1080)]}).accepted,true);
});

test('resolution ignores DPR and relocates verified manifest grid positions outside the canvas', () => {
  const room=manifest();room.desks[0].icons[0].x=63;room.desks[0].icons[0].y=63;
  const items=projectDeskItems({manifest:freezeDeep(room),deskId:'home'});
  const a=resultFor(items,{viewport:{width:1280,height:720,dpr:1}});
  const b=resultFor(items,{viewport:{width:1280,height:720,dpr:3}});
  assert.deepEqual(a,b);
  const icon=a.find(v=>v.kind==='icon');
  assert.equal(icon.placeable,true);
  assert.ok(icon.savedRect.x>1920&&icon.savedRect.y>1080);
  assert.equal(validateDrop({candidate:icon.effectiveRect,bounds:canvas,otherItems:a,itemKey:icon.key}).accepted,true);
});

test('invalid resolver inputs cannot create nonfinite output or search forever', () => {
  for(const minimumScale of [-1,1.1,NaN]) assert.throws(()=>resultFor([item('a',rect(0,0,10,10))],{minimumScale}),TypeError);
  assert.throws(()=>resultFor([item('a',rect(0,0,10,10))],{viewport:{width:0,height:100}}),TypeError);
  assert.throws(()=>resultFor([item('a',rect(0,0,10,10)),item('a',rect(20,20,10,10))]),TypeError);
  assert.throws(()=>resultFor([item('a',rect(0,0,10,10))],{occupied:[rect(0,0,Infinity,10)]}),TypeError);
});
test('an explicit damaged saved icon position is rejected instead of silently using author defaults', () => {
  for(const position of [null,false,0]) {
    assert.throws(()=>projectDeskItems({manifest:manifest(),deskId:'home',layout:{icons:{home:{one:position}},components:{}}}),TypeError);
  }
});