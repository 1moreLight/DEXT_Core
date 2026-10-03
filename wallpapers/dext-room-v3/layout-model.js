(function(root,factory) {
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DextLayoutModel=api;
})(globalThis,function() {
  'use strict';
  const WIDTH=1920,HEIGHT=1080;
  const own=(value,key)=>Object.hasOwn(value,key);
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const number=value=>typeof value==='number'&&Number.isFinite(value);
  const positive=value=>number(value)&&value>0;
  const rectangle=value=>object(value)&&number(value.x)&&number(value.y)&&positive(value.width)&&positive(value.height);
  const size=value=>object(value)&&positive(value.width)&&positive(value.height);
  const copyRect=value=>({x:value.x,y:value.y,width:value.width,height:value.height});
  const copySize=value=>({width:value.width,height:value.height});
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const overlap=(a,b)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
  const inside=(value,bounds)=>value.x>=bounds.x&&value.y>=bounds.y&&value.x+value.width<=bounds.x+bounds.width&&value.y+value.height<=bounds.y+bounds.height;
  const requireValue=(value,message)=>{if(!value)throw new TypeError('Dext layout: '+message);};
  const stableOrder=(a,b)=>(a.kind==='widget'?0:1)-(b.kind==='widget'?0:1)||(a.key<b.key?-1:a.key>b.key?1:0);
  function copyItem(value) {
    return {key:value.key,kind:value.kind,id:value.id,...(value.deskId===undefined?{}:{deskId:value.deskId}),
      savedRect:copyRect(value.savedRect),logicalSize:copySize(value.logicalSize)};
  }
  function projectDeskItems({manifest,layout,deskId}) {
    requireValue(object(manifest)&&Array.isArray(manifest.desks)&&typeof deskId==='string','manifest and Desk required');
    const desk=manifest.desks.find(value=>value.id===deskId);
    requireValue(desk,'unknown Desk');
    const personal=layout===undefined?{icons:{},components:{}}:layout;
    requireValue(object(personal)&&object(personal.icons)&&object(personal.components),'personal layout required');
    const icons=own(personal.icons,deskId)?personal.icons[deskId]:{};
    requireValue(object(icons),'icon positions required');
    const result=[];
    for(const icon of desk.icons||[]) {
      const position=own(icons,icon.id)?icons[icon.id]:{x:32+icon.x*112,y:32+icon.y*120};
      requireValue(object(position)&&number(position.x)&&number(position.y),'icon position required');
      result.push({key:'icon:'+deskId+'/'+icon.id,kind:'icon',id:icon.id,deskId,
        savedRect:{x:position.x,y:position.y,width:96,height:104},logicalSize:{width:96,height:104}});
    }
    const components=new Map((manifest.components||[]).map(value=>[value.id,value]));
    for(const id of desk.components||[]) {
      const component=components.get(id);
      if(!component||component.role!=='widget')continue;
      const placement=own(personal.components,id)?personal.components[id]:component.placement;
      requireValue(rectangle(placement)&&size(component.placement),'Widget placement required');
      result.push({key:'widget:'+id,kind:'widget',id,savedRect:copyRect(placement),logicalSize:copySize(component.placement)});
    }
    return result;
  }
  function scopedOccupied(values,deskId) {
    requireValue(Array.isArray(values),'occupied array required');
    return values.filter(value=>deskId===undefined||value.deskId===undefined||value.deskId===deskId).map(value=>{
      requireValue(rectangle(value),'occupied rectangle required');return copyRect(value);
    });
  }
  function fits(value,bounds,blocked) {
    return inside(value,bounds)&&!blocked.some(other=>overlap(value,other));
  }
  // The free X intervals change only when a candidate touches an obstacle's Y edge.
  // These are axis-aligned packing rectangles, not precise rotated hit regions.
  function nearestPlacement(width,height,desired,bounds,blocked) {
    if(width>bounds.width||height>bounds.height)return null;
    const maxX=bounds.width-width,maxY=bounds.height-height;
    const ys=new Set([0,maxY,clamp(desired.y,0,maxY)]);
    for(const obstacle of blocked) {
      ys.add(clamp(obstacle.y-height,0,maxY));
      ys.add(clamp(obstacle.y+obstacle.height,0,maxY));
    }
    const orderedYs=[...ys].sort((a,b)=>Math.abs(a-desired.y)-Math.abs(b-desired.y)||a-b);
    let best=null,bestDistance=Infinity;
    for(const y of orderedYs) {
      const verticalDistance=(y-desired.y)*(y-desired.y);
      if(verticalDistance>bestDistance)break;
      const intervals=blocked.filter(value=>y<value.y+value.height&&value.y<y+height)
        .map(value=>({start:value.x-width,end:value.x+value.width})).sort((a,b)=>a.start-b.start||a.end-b.end);
      const merged=[];
      for(const interval of intervals) {
        const last=merged[merged.length-1];
        // Exact touching endpoints are legal; do not merge away that point.
        if(last&&interval.start<last.end)last.end=Math.max(last.end,interval.end);
        else merged.push({...interval});
      }
      const desiredX=clamp(desired.x,0,maxX);
      const obstruction=merged.find(value=>desiredX>value.start&&desiredX<value.end);
      const xs=obstruction?[obstruction.start,obstruction.end].filter(x=>x>=0&&x<=maxX):[desiredX];
      xs.sort((a,b)=>Math.abs(a-desired.x)-Math.abs(b-desired.x)||a-b);
      for(const x of xs) {
        const candidate={x,y,width,height};
        if(!fits(candidate,bounds,blocked))continue;
        const distance=(x-desired.x)*(x-desired.x)+verticalDistance;
        if(distance<bestDistance||distance===bestDistance&&(!best||y<best.y||y===best.y&&x<best.x)) {
          best=candidate;bestDistance=distance;
        }
      }
    }
    return best;
  }
  // Find a positive lower bound from an actually empty rectangle. This avoids
  // imposing an arbitrary minimum display size when callers specify none.
  function positiveScaleSeed(width,height,desired,bounds,blocked) {
    const ys=new Set([0,bounds.height]);
    for(const obstacle of blocked) {
      ys.add(clamp(obstacle.y,0,bounds.height));
      ys.add(clamp(obstacle.y+obstacle.height,0,bounds.height));
    }
    const edges=[...ys].sort((a,b)=>a-b);
    let best=null;
    for(let index=1;index<edges.length;index++) {
      const top=edges[index-1],bottom=edges[index];
      if(bottom<=top)continue;
      const intervals=blocked.filter(value=>top<value.y+value.height&&value.y<bottom)
        .map(value=>({start:clamp(value.x,0,bounds.width),end:clamp(value.x+value.width,0,bounds.width)}))
        .filter(value=>value.end>value.start).sort((a,b)=>a.start-b.start||a.end-b.end);
      let left=0;
      const gaps=[];
      for(const interval of intervals) {
        if(interval.start>left)gaps.push({left,right:interval.start});
        left=Math.max(left,interval.end);
      }
      if(left<bounds.width)gaps.push({left,right:bounds.width});
      for(const gap of gaps) {
        const scale=Math.min(1,(gap.right-gap.left)/width,(bottom-top)/height);
        if(scale<=0||!Number.isFinite(scale)||best&&scale<=best.scale)continue;
        const candidate={x:clamp(desired.x,gap.left,gap.right-width*scale),
          y:clamp(desired.y,top,bottom-height*scale),width:width*scale,height:height*scale};
        if(fits(candidate,bounds,blocked))best={scale,rect:candidate};
      }
    }
    return best;
  }
  function resizedPlacement(width,height,desired,bounds,blocked,minimumScale) {
    if(minimumScale===1)return null;
    let low,placement;
    if(minimumScale>0) {
      low=minimumScale;placement=nearestPlacement(width*low,height*low,desired,bounds,blocked);
      if(!placement)return null;
    } else {
      const seed=positiveScaleSeed(width,height,desired,bounds,blocked);
      if(!seed)return null;
      low=seed.scale;placement=nearestPlacement(width*low,height*low,desired,bounds,blocked)||seed.rect;
    }
    let high=Math.min(1,bounds.width/width,bounds.height/height);
    if(high<low)return null;
    const atUpper=nearestPlacement(width*high,height*high,desired,bounds,blocked);
    if(atUpper)return {rect:atUpper,scale:high};
    // Feasibility is monotonic as both dimensions shrink. Keep the last
    // verified feasible rectangle so a numerical approximation cannot overlap.
    for(let attempt=0;attempt<48;attempt++) {
      const middle=(low+high)/2;
      if(middle===low||middle===high)break;
      const candidate=nearestPlacement(width*middle,height*middle,desired,bounds,blocked);
      if(candidate){low=middle;placement=candidate;}else high=middle;
    }
    return {rect:placement,scale:low};
  }
  function resolveDeskLayout({items,viewport,occupied=[],deskId,minimumScale=0}) {
    requireValue(Array.isArray(items)&&size(viewport),'items and CSS viewport required');
    requireValue(number(minimumScale)&&minimumScale>=0&&minimumScale<=1,'minimumScale must be between zero and one');
    const seen=new Set(),copies=items.map(value=>{
      requireValue(object(value)&&typeof value.key==='string'&&value.key.length>0&&!seen.has(value.key)&&
        ['widget','icon'].includes(value.kind)&&rectangle(value.savedRect)&&size(value.logicalSize),'unique layout items required');
      seen.add(value.key);return copyItem(value);
    });
    const sx=viewport.width/WIDTH,sy=viewport.height/HEIGHT,bounds={x:0,y:0,width:viewport.width,height:viewport.height};
    const blocked=scopedOccupied(occupied,deskId).map(value=>({x:value.x*sx,y:value.y*sy,width:value.width*sx,height:value.height*sy}));
    const sorted=[...copies].sort(stableOrder),results=new Map(),pending=[];
    const desiredFor=value=>({x:value.savedRect.x*sx,y:value.savedRect.y*sy,width:value.savedRect.width,height:value.savedRect.height});
    function accept(value,cssRect,scale) {
      blocked.push(copyRect(cssRect));
      results.set(value.key,{...value,effectiveRect:{x:cssRect.x/sx,y:cssRect.y/sy,width:cssRect.width/sx,height:cssRect.height/sy},scale,placeable:true});
    }
    // Reserve all legal saved locations before any relocation searches for space.
    for(const value of sorted) {
      const desired=desiredFor(value);
      if(fits(desired,bounds,blocked))accept(value,desired,1);else pending.push(value);
    }
    for(const value of pending) {
      const desired=desiredFor(value);
      const full=nearestPlacement(desired.width,desired.height,desired,bounds,blocked);
      if(full){accept(value,full,1);continue;}
      const smaller=resizedPlacement(desired.width,desired.height,desired,bounds,blocked,minimumScale);
      if(smaller)accept(value,smaller.rect,smaller.scale);
      else results.set(value.key,{...value,effectiveRect:null,scale:0,placeable:false});
    }
    return copies.map(value=>results.get(value.key));
  }
  function validateDrop({candidate,itemKey,bounds={x:0,y:0,width:WIDTH,height:HEIGHT},occupied=[],otherItems=[],deskId}) {
    if(!rectangle(candidate))return {accepted:false,reason:'invalidRectangle'};
    requireValue(rectangle(bounds)&&Array.isArray(otherItems),'bounds and otherItems required');
    if(!inside(candidate,bounds))return {accepted:false,reason:'outOfBounds'};
    if(scopedOccupied(occupied,deskId).some(value=>overlap(candidate,value)))return {accepted:false,reason:'occupied'};
    for(const value of otherItems) {
      if(value.placeable===false||itemKey!==undefined&&value.key===itemKey)continue;
      const region=own(value,'effectiveRect')?value.effectiveRect:value;
      requireValue(rectangle(region),'other effective rectangle required');
      if(overlap(candidate,region))return {accepted:false,reason:'overlap'};
    }
    return {accepted:true,reason:null};
  }
  function mapLocalRect({localRect,logicalSize,effectiveRect}) {
    requireValue(rectangle(localRect)&&size(logicalSize)&&rectangle(effectiveRect)&&
      inside(localRect,{x:0,y:0,width:logicalSize.width,height:logicalSize.height}),'local button and placement required');
    const sx=effectiveRect.width/logicalSize.width,sy=effectiveRect.height/logicalSize.height;
    return {x:effectiveRect.x+localRect.x*sx,y:effectiveRect.y+localRect.y*sy,width:localRect.width*sx,height:localRect.height*sy};
  }
  function clientPointToLocal({clientPoint,viewport,groupMatrix=[1,0,0,1,0,0],placement,logicalSize}) {
    if(!object(clientPoint)||!number(clientPoint.x)||!number(clientPoint.y)||!size(viewport)||
      !Array.isArray(groupMatrix)||groupMatrix.length!==6||!groupMatrix.every(number))return null;
    const left=viewport.left===undefined?0:viewport.left,top=viewport.top===undefined?0:viewport.top;
    if(!number(left)||!number(top))return null;
    const [a,b,c,d,e,f]=groupMatrix,determinant=a*d-b*c;
    if(!number(determinant)||determinant===0)return null;
    const px=(clientPoint.x-left)*WIDTH/viewport.width-e,py=(clientPoint.y-top)*HEIGHT/viewport.height-f;
    let x=(d*px-c*py)/determinant,y=(-b*px+a*py)/determinant;
    if(placement!==undefined) {
      if(!rectangle(placement)||logicalSize!==undefined&&!size(logicalSize))return null;
      x-=placement.x;y-=placement.y;
      if(logicalSize!==undefined){x*=logicalSize.width/placement.width;y*=logicalSize.height/placement.height;}
    }
    return number(x)&&number(y)?{x,y}:null;
  }
  return Object.freeze({projectDeskItems,resolveDeskLayout,validateDrop,mapLocalRect,clientPointToLocal});
});