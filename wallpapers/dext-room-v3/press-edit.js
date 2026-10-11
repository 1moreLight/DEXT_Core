(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DextPressEdit=api;})(globalThis,function(){
  'use strict';
  function createPressEdit(options){
    let gesture=null,timer=null,suppressed=null;
    const clear=()=>{if(timer!==null)options.clearTimeout(timer);timer=null;};
    function cancel(){clear();const old=gesture;gesture=null;if(old?.editing)options.cancel(old.item);}
    function point(value){return value&&Number.isFinite(value.x)&&Number.isFinite(value.y);}
    function down(value,item){
      cancel();suppressed=null;if(!point(value)||!item)return false;
      const own=gesture={id:value.id,item,start:{x:value.x,y:value.y},point:{x:value.x,y:value.y},editing:false};
      if(options.isEditing?.()){own.editing=true;suppressed=own.id;options.begin(own.item);return true;}
      timer=options.setTimeout(()=>{timer=null;if(gesture!==own||!options.eligible()){cancel();return;}
        own.editing=true;suppressed=own.id;options.begin(own.item);
      },500);return true;
    }
    function move(value){
      const own=gesture;if(!own||own.id!==value.id||!point(value))return false;
      if(!options.eligible()){cancel();return false;}
      const dx=value.x-own.start.x,dy=value.y-own.start.y;
      if(!own.editing&&Math.hypot(dx,dy)>8){cancel();return false;}
      own.point={x:value.x,y:value.y};if(own.editing)options.preview(own.item,dx,dy);return true;
    }
    function up(value){
      const own=gesture;if(!own||own.id!==value.id)return false;
      if(!move(value))return false;clear();gesture=null;
      if(own.editing)options.commit(own.item,own.point.x-own.start.x,own.point.y-own.start.y);
      return own.editing;
    }
    return{down,move,up,cancel,suppresses:id=>suppressed!==null&&id===suppressed,
      read:()=>({phase:gesture?(gesture.editing?'dragging':'holding'):'idle',id:gesture?.id??null})};
  }
  return{createPressEdit};
});
