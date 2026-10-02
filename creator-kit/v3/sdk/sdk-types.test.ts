/// <reference path="./dext-sdk.v1.d.ts" />
void Dext.ready().then(session => session.snapshot.currentDeskId);
const unsubscribe: DextUnsubscribe = Dext.desk.subscribe(snapshot => {
  if (snapshot.transitionId) void Dext.scene.completeTransition(snapshot.transitionId);
});
void Dext.desk.navigate({ type: 'desk.go', deskId: 'overview' });
void Dext.actions.list().then(result => result.buttons?.map(button => button.isBound));
void Dext.storage.set('values', { note: 'local', count: 1 });
void Dext.scene.publishGeometry({ buttons: [{ buttonId: 'open', x: 1, y: 2, width: 30, height: 30 }] });
Dext.data.bindReadout('time.read', document.createElement('span'), (value, element) => { element.textContent = String(value); });
unsubscribe();
// @ts-expect-error private paths are not a launch API
void Dext.actions.activate({ target: 'C:/private.exe' });
// @ts-expect-error arbitrary capability names are not public sources
Dext.data.subscribe('file.read', () => {});
// @ts-expect-error arbitrary DOM or CSS is not accepted geometry
void Dext.scene.publishGeometry({ selector: '#official-icons' });
// @ts-expect-error authored content cannot mint host input
void Dext.issueHostInput('open');
