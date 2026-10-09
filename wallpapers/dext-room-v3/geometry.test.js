const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { rectPolygon, clipPolygon, subtractPolygon, visiblePolygons, containsPoint, polygonBounds } = require('./geometry.js');

const rect = (x,y,width,height) => ({x,y,width,height});
const square = (x,y,width,height) => [{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}];
const area = polygon => Math.abs(polygon.reduce((sum,p,i) => {
  const next=polygon[(i+1)%polygon.length]; return sum+p.x*next.y-next.x*p.y;
},0))/2;
const sumArea = polygons => polygons.reduce((sum,p) => sum+area(p),0);
const near = (actual,expected,epsilon=1e-9) => assert.ok(Math.abs(actual-expected)<=epsilon, actual+' != '+expected);
function freezeDeep(value) {
  if(value&&typeof value==='object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}
function convex(polygon) {
  let sign=0;
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],c=polygon[(i+2)%polygon.length];
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(Math.abs(cross)<1e-10)continue;
    const current=Math.sign(cross);
    if(sign&&sign!==current)return false;
    sign=current;
  }
  return sign!==0;
}

test('identity rectangle retains four actual corners and bounds', () => {
  const points=rectPolygon(rect(3,4,20,10));
  assert.deepEqual(points,square(3,4,20,10));
  assert.deepEqual(polygonBounds(points),rect(3,4,20,10));
});

test('rotated rectangle excludes a bounding-box corner from its hit region', () => {
  const s=Math.SQRT1_2;
  const points=rectPolygon(rect(0,0,2,2),[s,s,-s,s,0,0]);
  near(area(points),4);
  assert.equal(containsPoint(points,{x:0,y:Math.SQRT2}),true);
  assert.equal(containsPoint(points,{x:1.3,y:0.1}),false);
  const bounds=polygonBounds(points);
  near(bounds.x,-Math.SQRT2); near(bounds.width,2*Math.SQRT2);
});

test('shear and negative-determinant reflection preserve actual winding and hits', () => {
  const points=rectPolygon(rect(2,3,4,2),[-1,0,0.5,1,10,-2]);
  assert.deepEqual(points,[{x:9.5,y:1},{x:5.5,y:1},{x:6.5,y:3},{x:10.5,y:3}]);
  near(area(points),8);
  assert.equal(containsPoint(points,{x:8,y:2}),true);
  assert.equal(containsPoint(points,{x:10.4,y:1.1}),false);
});

test('clips a partly off-canvas polygon to actual canvas edges', () => {
  const clipped=clipPolygon(square(-2,-1,10,10),square(0,0,5,5));
  near(area(clipped),25);
  assert.deepEqual(polygonBounds(clipped),rect(0,0,5,5));
  assert.ok(clipped.every(p=>containsPoint(square(0,0,5,5),p)));
});

test('convex clipping supports a non-axis-aligned clip without substituting its bounds', () => {
  const diamond=[{x:5,y:0},{x:10,y:5},{x:5,y:10},{x:0,y:5}];
  const clipped=clipPolygon(square(0,0,10,10),diamond);
  near(area(clipped),50);
  assert.equal(containsPoint(clipped,{x:1,y:1}),false);
  assert.equal(containsPoint(clipped,{x:5,y:5}),true);
});

test('complete coverage removes the entire polygon, disjoint coverage preserves it', () => {
  const subject=square(0,0,10,10);
  assert.deepEqual(subtractPolygon(subject,square(-1,-1,12,12)),[]);
  const disjoint=subtractPolygon(subject,square(20,20,5,5));
  assert.equal(disjoint.length,1);
  near(sumArea(disjoint),100);
  assert.notEqual(disjoint[0],subject);
});

test('central coverage creates convex visible pieces and preserves exact remaining area', () => {
  const subject=square(0,0,10,10),cover=square(3,3,4,4);
  const pieces=subtractPolygon(subject,cover);
  assert.equal(pieces.length,4);
  assert.ok(pieces.every(convex));
  near(sumArea(pieces),84);
  assert.equal(pieces.some(p=>containsPoint(p,{x:5,y:5})),false);
  for(const point of [{x:1,y:5},{x:9,y:5},{x:5,y:1},{x:5,y:9}])
    assert.equal(pieces.some(p=>containsPoint(p,point)),true);
  for(const piece of pieces) assert.deepEqual(clipPolygon(piece,cover),[]);
});

test('multiple occluders subtract their union and retain convex pieces', () => {
  const pieces=visiblePolygons(square(-2,-2,14,14),{
    bounds:rect(0,0,10,10),occluders:[square(2,0,2,10),square(0,6,10,2)]
  });
  near(sumArea(pieces),64);
  assert.ok(pieces.every(convex));
  assert.equal(pieces.some(p=>containsPoint(p,{x:3,y:3})),false);
  assert.equal(pieces.some(p=>containsPoint(p,{x:7,y:7})),false);
  assert.equal(pieces.some(p=>containsPoint(p,{x:7,y:3})),true);
});

test('CW and CCW subject and clip orders produce the same clipping and difference areas', () => {
  const subject=square(0,0,10,10),cover=square(3,-2,4,14);
  for(const a of [subject,[...subject].reverse()]) for(const b of [cover,[...cover].reverse()]) {
    near(area(clipPolygon(a,b)),40);
    const pieces=subtractPolygon(a,b);
    near(sumArea(pieces),60);
    assert.ok(pieces.every(convex));
    assert.equal(pieces.some(p=>containsPoint(p,{x:5,y:5})),false);
  }
});

test('touching edges produce no overlap area and do not erase adjacent visible content', () => {
  const subject=square(0,0,10,10),cover=square(10,2,4,6);
  assert.deepEqual(clipPolygon(subject,cover),[]);
  near(sumArea(subtractPolygon(subject,cover)),100);
  assert.deepEqual(clipPolygon(subject,square(10,10,4,4)),[]);
});

test('point containment has an explicit boundary policy, independent of winding', () => {
  for(const points of [square(0,0,10,10),square(0,0,10,10).reverse()]) {
    assert.equal(containsPoint(points,{x:0,y:5}),true);
    assert.equal(containsPoint(points,{x:0,y:5},{includeBoundary:false}),false);
    assert.equal(containsPoint(points,{x:10,y:10}),true);
    assert.equal(containsPoint(points,{x:10,y:10},{includeBoundary:false}),false);
    assert.equal(containsPoint(points,{x:0.001,y:5},{includeBoundary:false}),true);
    assert.equal(containsPoint(points,{x:-0.001,y:5}),false);
  }
});

test('input polygons, rectangles, matrices and options remain immutable', () => {
  const subject=freezeDeep(square(0,0,10,10)),cover=freezeDeep(square(3,3,4,4));
  const bounds=freezeDeep(rect(0,0,10,10)),matrix=freezeDeep([1,0,0.3,-1,2,8]);
  const before=JSON.stringify({subject,cover,bounds,matrix});
  rectPolygon(bounds,matrix); clipPolygon(subject,cover); subtractPolygon(subject,cover);
  const pieces=visiblePolygons(subject,freezeDeep({bounds,occluders:[cover]}));
  containsPoint(subject,freezeDeep({x:2,y:2})); polygonBounds(subject);
  assert.equal(JSON.stringify({subject,cover,bounds,matrix}),before);
  pieces[0][0].x=999;
  assert.equal(subject[0].x,0);
  assert.equal(cover[0].x,3);
});

test('zero-area geometry consistently produces no visible area or hit', () => {
  const line=[{x:0,y:0},{x:5,y:0},{x:10,y:0}];
  assert.deepEqual(rectPolygon(rect(0,0,0,10)),[]);
  assert.deepEqual(rectPolygon(rect(0,0,10,10),[1,0,2,0,0,0]),[]);
  assert.deepEqual(clipPolygon(line,square(0,0,10,10)),[]);
  assert.deepEqual(clipPolygon(square(0,0,10,10),line),[]);
  assert.deepEqual(subtractPolygon(line,square(0,0,10,10)),[]);
  near(sumArea(subtractPolygon(square(0,0,10,10),line)),100);
  assert.equal(containsPoint(line,{x:5,y:0}),false);
  assert.equal(polygonBounds(line),null);
});

test('small positive geometry is not discarded by a fixed pixel epsilon', () => {
  const tiny=rectPolygon(rect(0,0,1e-8,1e-8));
  assert.equal(tiny.length,4);
  assert.equal(containsPoint(tiny,{x:5e-9,y:5e-9},{includeBoundary:false}),true);
  near(area(tiny),1e-16,1e-30);
});

test('non-finite and malformed geometry is rejected rather than becoming a hit', () => {
  const good=square(0,0,10,10),bad=[{x:0,y:0},{x:Infinity,y:0},{x:0,y:1}];
  assert.throws(()=>rectPolygon(rect(0,0,Infinity,10)),TypeError);
  assert.throws(()=>rectPolygon(rect(0,0,-1,10)),TypeError);
  assert.throws(()=>rectPolygon(rect(0,0,10,10),[1,0,0,1,NaN,0]),TypeError);
  assert.throws(()=>rectPolygon(rect(1e308,0,1e308,10)),TypeError);
  assert.throws(()=>clipPolygon(good,bad),TypeError);
  assert.throws(()=>subtractPolygon(bad,good),TypeError);
  assert.throws(()=>containsPoint(good,{x:NaN,y:2}),TypeError);
  assert.throws(()=>containsPoint(good,{x:2,y:2},{includeBoundary:'yes'}),TypeError);
  assert.throws(()=>polygonBounds(bad),TypeError);
  assert.throws(()=>visiblePolygons(good,{bounds:rect(0,0,10,10),occluders:{}}),TypeError);
});

test('non-convex and self-crossing polygons are rejected by the convex API', () => {
  const good=square(0,0,10,10);
  const concave=[{x:0,y:0},{x:10,y:0},{x:5,y:3},{x:10,y:10},{x:0,y:10}];
  const crossing=[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}];
  assert.throws(()=>clipPolygon(good,concave),TypeError);
  assert.throws(()=>subtractPolygon(concave,good),TypeError);
  assert.throws(()=>containsPoint(crossing,{x:5,y:5}),TypeError);
});

test('duplicate closing and collinear vertices normalize without mutating input', () => {
  const input=[{x:0,y:0},{x:5,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10},{x:0,y:0}];
  const original=JSON.stringify(input);
  const clipped=clipPolygon(input,square(-1,-1,12,12));
  assert.equal(clipped.length,4);
  near(area(clipped),100);
  assert.equal(JSON.stringify(input),original);
});

test('browser UMD export uses the same pure API without requiring DOM globals', () => {
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('./geometry.js'),'utf8'),context);
  assert.equal(typeof context.DextGeometry.rectPolygon,'function');
  assert.equal(context.DextGeometry.containsPoint(context.DextGeometry.rectPolygon(rect(0,0,10,10)),{x:5,y:5}),true);
});
test('oblique transformed differences retain area and disjoint convex interiors', () => {
  const transforms=[
    [0.8,0.6,-0.6,0.8,25,31],
    [-1,0.4,0.3,1,100,20],
    [1,0.7,0.2,1,140,90]
  ];
  for(const matrix of transforms) {
    const subject=rectPolygon(rect(0,0,10,10),matrix);
    const cover=rectPolygon(rect(3,3,4,4),matrix);
    const pieces=subtractPolygon(subject,cover);
    const determinant=Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]);
    near(sumArea(pieces),84*determinant,1e-8);
    assert.ok(pieces.every(convex));
    for(let i=0;i<pieces.length;i++) {
      near(area(clipPolygon(pieces[i],cover)),0,1e-8);
      for(let j=i+1;j<pieces.length;j++)near(area(clipPolygon(pieces[i],pieces[j])),0,1e-8);
    }
  }
});

test('multiple oblique occluders preserve the complement of their overlapping union', () => {
  const matrix=[0.8,0.6,-0.6,0.8,25,31];
  const subject=rectPolygon(rect(0,0,10,10),matrix);
  const first=rectPolygon(rect(2,0,2,10),matrix);
  const second=rectPolygon(rect(0,6,10,2),matrix);
  const pieces=visiblePolygons(subject,{bounds:rect(0,0,100,100),occluders:[first,second]});
  near(sumArea(pieces),64,1e-8);
  assert.ok(pieces.every(convex));
  const map=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
  for(const [x,y,expected] of [[1,1,true],[7,3,true],[7,9,true],[3,3,false],[7,7,false]])
    assert.equal(pieces.some(p=>containsPoint(p,map(x,y))),expected);
});
