using System;
using System.Linq;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Text.Json;
using Dext.Core.Rooms;
using Lively.Services.ApplicationDock;
internal static class DockNavigationTests
{
 public static void Run()
 {
  Exception failure=null;
  var thread=new Thread(()=>{
   ApplicationDockWindow window=null;
   try {
    Guid clicked=Guid.Empty; int direction=0, count=0;
    window=new ApplicationDockWindow((_,_)=>{},_=>{},_=>null,(session,step)=>{clicked=session;direction=step;count++;});
    using var doc=JsonDocument.Parse("""{"desks":[{"id":"a","name":"A"},{"id":"b","name":"B"}]}""");
    var id=Guid.NewGuid();
    var snap=new RoomSessionSnapshot(1,id,"r","a",null,null,null,1,true,null);
    window.UpdateNavigation(RoomDockNavigation.Create(snap,doc.RootElement));
    var next=(Button)window.FindName("NextDesk");
    next.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    Check(clicked==id && direction==1 && count==1,"one native click dispatches once");
    window.UpdateNavigation(RoomDockNavigation.Create(snap with {CurrentDeskId="b",Revision=2},doc.RootElement));
    Check(ReferenceEquals(next,window.FindName("NextDesk")),"snapshot updates preserve navigation controls");
    var current=(TextBlock)window.FindName("CurrentDesk");
    Check(current.Text=="B","committed name updates");
    var mouseDown=new System.Windows.Input.MouseButtonEventArgs(System.Windows.Input.Mouse.PrimaryDevice,0,System.Windows.Input.MouseButton.Left) { RoutedEvent=UIElement.PreviewMouseLeftButtonDownEvent };
    next.RaiseEvent(mouseDown);
    window.UpdateNavigation(RoomDockNavigation.Create(snap with {SessionId=Guid.NewGuid()},doc.RootElement));
    next.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    Check(count==1,"old mouse down cannot navigate a replacement Room session");
    window.UpdateNavigation(null);
    next.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    Check(count==1,"hidden navigation cannot dispatch a retained event");
    window.UpdateNavigation(RoomDockNavigation.Create(snap with {Lifecycle=new(RoomLifecycleStage.Desktop,false,true,2)},doc.RootElement));
    next.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
    Check(count==1 && !next.IsEnabled,"locked navigation cannot dispatch");    var pins=Enumerable.Range(0,20).Select(i=>new DockPin("App"+i,@"C:\App"+i+".exe","","")).ToArray();
    window.Update(DockModel.Group(pins,Array.Empty<DockTask>()),0,null);
    var root=(StackPanel)((Border)window.Content).Child;
    root.Measure(new Size(340,200));root.Arrange(new Rect(0,0,340,100));root.UpdateLayout();
    var row=(Panel)root.Children[0];
    var scroll=(ScrollViewer)row.Children[1];
    Check(scroll.ViewportWidth>0 && scroll.ViewportWidth<340 && scroll.ExtentWidth>scroll.ViewportWidth,"many apps keep a finite scrollable viewport beside navigation");
   } catch(Exception ex){failure=ex;} finally {window?.Close();}
  });
  thread.SetApartmentState(ApartmentState.STA);thread.Start();thread.Join();
  if(failure!=null)throw failure;
 }
 static void Check(bool pass,string label){if(!pass)throw new Exception(label);Console.WriteLine("PASS "+label);}
}
