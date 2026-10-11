using System;
using System.Runtime.InteropServices;
using System.Threading;
namespace Lively.Services.DesktopSync;
internal sealed partial class DesktopShellContextMenu
{
 private bool background;
 private const uint BackgroundPasteCommand=0x8001;
 internal static DesktopShellContextMenu CreateBackground(IntPtr owner=default,bool canPaste=false)
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
   result.commandCount=(uint)(hr&0xffff);
   if(!AppendMenu(result.menu,0x800,UIntPtr.Zero,null)||!AppendMenu(result.menu,canPaste?0u:3u,(UIntPtr)BackgroundPasteCommand,"粘贴"))
    throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
   return result;
  }catch{result.Dispose();throw;}
 }
 [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool AppendMenu(IntPtr menu,uint flags,UIntPtr id,string? label);
 [UnmanagedFunctionPointer(CallingConvention.StdCall)] private delegate int CreateView(IntPtr self,IntPtr owner,ref Guid iid,out IntPtr result);
}
