// Pure local UI behavior. Node executes the production TS directly; no app or compiler starts.
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),{pathToFileURL}=require("node:url");
const source=pathToFileURL(path.join(__dirname,"../../tauri-ui/src/features/room-editor/personal-editor.ts")).href;
const api=import(source);
const empty=()=>({action:null,deskId:null,targetId:null,skin:null});
const saved={action:"binding.launch",deskId:null,targetId:"saved-target",skin:"classic"};
const choice={action:"desk.go",deskId:"focus",targetId:"selected-target",skin:"glass"};
const snapshot={revision:3,buttons:[{id:"open",personal:saved},{id:"other",personal:null}],targets:[],skins:[]};
test("editing target metadata and locating a button preserve pending action Desk and skin",async()=>{
 const {settingsAfterPersonalEdit:update}=await api;
 for(const accepted of [true,false])for(const edit of [{operation:"upsertTarget",targetId:"selected-target",name:"Notes",kind:"application",target:"C:/Windows/notepad.exe",arguments:"",workingDirectory:""},{operation:"locateButton",buttonId:"open"}]){
  const next=update(choice,"open",edit,snapshot,accepted);assert.deepEqual(next,choice);assert.deepEqual(saved,snapshot.buttons[0].personal);
 }
});
test("confirmed target deletion clears only that pending reference and failure clears nothing",async()=>{
 const {settingsAfterPersonalEdit:update}=await api;
 const edit={operation:"removeTarget",targetId:"selected-target"};
 assert.deepEqual(update(choice,"open",edit,snapshot,true),{...choice,targetId:null});
 assert.deepEqual(update(choice,"open",edit,snapshot,false),choice);
 assert.deepEqual(update(choice,"open",{...edit,targetId:"other-target"},snapshot,true),choice);
});
test("explicit button save confirms or rolls back its own values, reset failure keeps the draft",async()=>{
 const {settingsAfterPersonalEdit:update}=await api;
 const edit={operation:"setButton",buttonId:"open",...choice};
 assert.deepEqual(update(choice,"open",edit,snapshot,false),saved);
 const confirmed={...snapshot,buttons:[{id:"open",personal:choice}]};
 assert.deepEqual(update(choice,"open",edit,confirmed,true),choice);
 assert.deepEqual(update(choice,"open",{operation:"resetButton",buttonId:"open"},{...snapshot,buttons:[{id:"open",personal:null}]},true),empty());
 assert.deepEqual(update(choice,"open",{operation:"resetButton",buttonId:"open"},snapshot,false),choice);
 assert.deepEqual(update(choice,"other",edit,snapshot,true),choice);
});

test("button discovery reflects the effective local action and missing targets",async()=>{
 const {buttonBindingLabel:label}=await api;
 const authored={id:"open",name:"Open",scope:"room",action:{type:"binding.launch"}};
 assert.equal(label(authored,{...snapshot.buttons[0],effectiveAction:"desk.go",isBound:false,personal:choice}),"本机动作");
 const navigation={...authored,action:{type:"desk.next"}};
 assert.equal(label(navigation,{...snapshot.buttons[0],effectiveAction:"binding.launch",isBound:false,personal:saved}),"未绑定");
 assert.equal(label(authored,{...snapshot.buttons[0],effectiveAction:"binding.launch",isBound:true}),"已绑定");
 assert.equal(label(navigation),"默认动作");
});

test("deleting an edited target closes its stale form and cannot offer to recreate it",async()=>{
 const {targetFormAfterPersonalEdit:update}=await api;
 const form={id:"notes",name:"Notes",kind:"application",target:"C:/Windows/notepad.exe",arguments:"draft args",workingDirectory:"",useCount:2};
 assert.equal(update(form,{operation:"removeTarget",targetId:"notes"},true),null);
 assert.deepEqual(update(form,{operation:"removeTarget",targetId:"notes"},false),form);
 assert.deepEqual(update(form,{operation:"removeTarget",targetId:"other"},true),form);
});
test("target save failure preserves the retry ID and typed fields; only its confirmed save closes it",async()=>{
 const {targetFormAfterPersonalEdit:update}=await api;
 const form={id:"stable-retry",name:"Notes draft",kind:"application",target:"C:/Windows/notepad.exe",arguments:"typed args",workingDirectory:"C:/Windows",useCount:0};
 const edit={operation:"upsertTarget",targetId:form.id,name:form.name,kind:form.kind,target:form.target,arguments:form.arguments,workingDirectory:form.workingDirectory};
 assert.deepEqual(update(form,edit,false),form);
 assert.equal(update(form,edit,true),null);
 assert.deepEqual(update(form,{operation:"locateButton",buttonId:"open"},true),form);
 assert.equal(update(null,{operation:"removeTarget",targetId:"notes"},true),null);
});
