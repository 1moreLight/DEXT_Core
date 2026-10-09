(function(root,factory) {
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DextGeometry=api;
})(globalThis,function() {
  'use strict';
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const requireValue=(value,message)=>{if(!value)throw new TypeError('Dext geometry: '+message);};
  const copyPoint=value=>{
    requireValue(value!==null&&typeof value==='object'&&finite(value.x)&&finite(value.y),'finite point required');
    return {x:value.x,y:value.y};
  };
  const samePoint=(a,b)=>a.x===b.x&&a.y===b.y;

  // This is a relative arithmetic error bound, not a CSS pixel hit padding.
  // Keep the same cross-product rule in the native verifier.
  function cross(a,b,p) {
    const dx=b.x-a.x,dy=b.y-a.y,px=p.x-a.x,py=p.y-a.y;
    const left=dx*py,right=dy*px,value=left-right;
    requireValue(finite(dx)&&finite(dy)&&finite(px)&&finite(py)&&finite(left)&&finite(right)&&finite(value),'geometry arithmetic overflow');
    const tolerance=32*Number.EPSILON*(Math.abs(left)+Math.abs(right)
      +Math.abs(dx)*(Math.abs(p.y)+Math.abs(a.y))
      +Math.abs(py)*(Math.abs(b.x)+Math.abs(a.x))
      +Math.abs(dy)*(Math.abs(p.x)+Math.abs(a.x))
      +Math.abs(px)*(Math.abs(b.y)+Math.abs(a.y)));
    requireValue(finite(tolerance),'geometry arithmetic overflow');
    return {value,tolerance};
  }
  function side(a,b,p) {
    const {value,tolerance}=cross(a,b,p);
    return value>tolerance?1:value<-tolerance?-1:0;
  }
  function polygon(value) {
    requireValue(Array.isArray(value),'polygon array required');
    const points=[];
    for(const input of value) {
      const point=copyPoint(input);
      if(!points.length||!samePoint(point,points[points.length-1]))points.push(point);
    }
    if(points.length>1&&samePoint(points[0],points[points.length-1]))points.pop();
    if(points.length<3)return {points:[],winding:0};

    let winding=0;
    for(let i=0;i<points.length&&!winding;i++)
      winding=side(points[i],points[(i+1)%points.length],points[(i+2)%points.length]);
    if(!winding)return {points:[],winding:0};

    // Every vertex must lie on the same side of every edge. Turn signs alone
    // also accept some self-crossing stars, so they are insufficient here.
    for(let i=0;i<points.length;i++) {
      const a=points[i],b=points[(i+1)%points.length];
      for(const point of points)
        requireValue(side(a,b,point)*winding>=0,'convex non-self-crossing polygon required');
    }
    const seen=new Set();
    for(const point of points) {
      const key=point.x+':'+point.y;
      requireValue(!seen.has(key),'repeated non-adjacent vertex');
      seen.add(key);
    }
    let changed=true;
    while(changed&&points.length>=3) {
      changed=false;
      for(let i=0;i<points.length;i++) {
        const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length];
        if(side(a,b,c)===0) {
          points.splice(i,1); changed=true; break;
        }
      }
    }
    return points.length<3?{points:[],winding:0}:{points,winding};
  }
  function intersection(start,end,a,b) {
    const startCross=cross(a,b,start).value,endCross=cross(a,b,end).value;
    const scale=Math.max(Math.abs(startCross),Math.abs(endCross));
    requireValue(scale>0,'indeterminate clipping edge');
    // Normalizing first also avoids overflow in the denominator.
    const left=Math.abs(startCross)/scale,right=Math.abs(endCross)/scale;
    const t=left/(left+right);
    const point={x:(1-t)*start.x+t*end.x,y:(1-t)*start.y+t*end.y};
    const dx=b.x-a.x,dy=b.y-a.y;
    // Preserve the clipping line after interpolation; canvas edges in particular
    // must stay exact instead of producing negative rounding slivers.
    if(dx===0)point.x=a.x;
    else if(dy===0)point.y=a.y;
    else if(Math.abs(dx)>=Math.abs(dy))point.y=a.y+dy*((point.x-a.x)/dx);
    else point.x=a.x+dx*((point.y-a.y)/dy);
    return copyPoint(point);
  }
  function halfPlane(subject,a,b,winding,inside) {
    if(!subject.length)return [];
    const result=[];
    let start=subject[subject.length-1];
    let startIn=side(a,b,start)*winding*(inside?1:-1)>=0;
    for(const end of subject) {
      const endIn=side(a,b,end)*winding*(inside?1:-1)>=0;
      if(startIn!==endIn)result.push(intersection(start,end,a,b));
      if(endIn)result.push(copyPoint(end));
      start=end; startIn=endIn;
    }
    return polygon(result).points;
  }
  function clip(subject,cover) {
    let result=subject.points;
    if(!result.length||!cover.points.length)return [];
    for(let i=0;i<cover.points.length&&result.length;i++)
      result=halfPlane(result,cover.points[i],cover.points[(i+1)%cover.points.length],cover.winding,true);
    return result;
  }
  function subtract(subject,cover) {
    if(!subject.points.length)return [];
    if(!cover.points.length||!clip(subject,cover).length)return [subject.points.map(copyPoint)];
    const pieces=[];
    let remaining=subject.points;
    // At each cover edge, emit the outside half and keep clipping the inside
    // half. These convex pieces have disjoint interiors and cover the difference.
    for(let i=0;i<cover.points.length&&remaining.length;i++) {
      const a=cover.points[i],b=cover.points[(i+1)%cover.points.length];
      const outside=halfPlane(remaining,a,b,cover.winding,false);
      if(outside.length)pieces.push(outside);
      remaining=halfPlane(remaining,a,b,cover.winding,true);
    }
    return pieces;
  }
  function rectPolygon(rect,matrix=[1,0,0,1,0,0]) {
    requireValue(rect!==null&&typeof rect==='object'&&finite(rect.x)&&finite(rect.y)&&finite(rect.width)&&finite(rect.height)&&rect.width>=0&&rect.height>=0,'finite nonnegative rectangle required');
    requireValue(Array.isArray(matrix)&&matrix.length===6&&matrix.every(finite),'six finite matrix values required');
    const right=rect.x+rect.width,bottom=rect.y+rect.height;
    requireValue(finite(right)&&finite(bottom),'rectangle arithmetic overflow');
    if(rect.width===0||rect.height===0)return [];
    const [a,b,c,d,e,f]=matrix;
    return polygon([
      {x:rect.x,y:rect.y},{x:right,y:rect.y},{x:right,y:bottom},{x:rect.x,y:bottom}
    ].map(point=>copyPoint({x:a*point.x+c*point.y+e,y:b*point.x+d*point.y+f}))).points;
  }
  function clipPolygon(subject,convexClip) {
    return clip(polygon(subject),polygon(convexClip));
  }
  function subtractPolygon(subject,convexCover) {
    return subtract(polygon(subject),polygon(convexCover));
  }
  function visiblePolygons(value,{bounds,occluders=[]}={}) {
    requireValue(Array.isArray(occluders),'occluder array required');
    const subject=polygon(value),canvas=polygon(rectPolygon(bounds));
    const covers=occluders.map(polygon);
    const clipped=clip(subject,canvas);
    let pieces=clipped.length?[clipped]:[];
    for(const cover of covers) {
      const next=[];
      for(const piece of pieces)next.push(...subtract(polygon(piece),cover));
      pieces=next;
    }
    return pieces;
  }
  function containsPoint(value,point,{includeBoundary=true}={}) {
    requireValue(typeof includeBoundary==='boolean','boolean boundary policy required');
    const target=copyPoint(point),shape=polygon(value);
    if(!shape.points.length)return false;
    for(let i=0;i<shape.points.length;i++) {
      const position=side(shape.points[i],shape.points[(i+1)%shape.points.length],target)*shape.winding;
      if(position<0||(!includeBoundary&&position===0))return false;
    }
    return true;
  }
  function polygonBounds(value) {
    const shape=polygon(value);
    if(!shape.points.length)return null;
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const point of shape.points) {
      minX=Math.min(minX,point.x); minY=Math.min(minY,point.y);
      maxX=Math.max(maxX,point.x); maxY=Math.max(maxY,point.y);
    }
    const width=maxX-minX,height=maxY-minY;
    requireValue(finite(width)&&finite(height),'bounds arithmetic overflow');
    return {x:minX,y:minY,width,height};
  }
  return Object.freeze({rectPolygon,clipPolygon,subtractPolygon,visiblePolygons,containsPoint,polygonBounds});
});
