using System;
using System.Runtime.InteropServices;
using System.Threading;
namespace Lively.Services.DesktopSync;
internal sealed partial class DesktopShellContextMenu
{
 private bool background;
 internal static DesktopShellContextMenu CreateBackground(IntPtr owner=default)
 {
  if(Thread.CurrentThread.GetApartmentState()!=ApartmentState.STA)throw new InvalidOperationException("Shell menus require STA ownership.");
  var result=new DesktopShellContextMenu{background=true};
  try {
   Marshal.ThrowExceptionForHR(SHGetDesktopFolder(out result.desktop));
   // IShellFolder::CreateViewObject is slot 8 including the three IUnknown slots.
   var create=Marshal.GetDelegateForFunctionPointer<CreateView>(Marshal.ReadIntPtr(Marshal.ReadIntPtr(result.desktop),8*IntPtr.Size));
   var iid=typeof(IDesktopContextMenu).GUID;
   Marshal.ThrowExceptionForHR(create(result.desktop,owner,ref iid,out var context));
   try {result.handler=(IDesktopContextMenu)Marshal.GetObjectForIUnknown(context);}finally{Marshal.Release(context);}
   result.menu=CreatePopupMenu();if(result.menu==IntPtr.Zero)throw new System.ComponentModel.Win32Exception();
   var hr=result.handler.QueryContextMenu(result.menu,0,FirstCommand,LastCommand,0x90);Marshal.ThrowExceptionForHR(hr);
   result.commandCount=(uint)(hr&0xffff);return result;
  }catch{result.Dispose();throw;}
 }
 [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int CreateView(IntPtr self,IntPtr owner,ref Guid iid,out IntPtr result);
}
