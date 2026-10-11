using System.Runtime.InteropServices;
using System.Text;
using Lively.Services.DesktopSync;

internal static class ClipboardChecks
{
    internal static void Run()
    {
        void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS "+label);}
        var files=new[]{@"C:\桌面\测试 文件.txt",@"D:\Apps\程序.lnk",@"\\server\share\folder"};
        var bytes=DesktopShellClipboardData.EncodeFiles(files);
        var memory=GlobalAlloc(0x42,(nuint)bytes.Length);
        if(memory==IntPtr.Zero)throw new Exception("HGLOBAL allocation failed");
        try{
            var pointer=GlobalLock(memory);if(pointer==IntPtr.Zero)throw new Exception("HGLOBAL lock failed");
            try{Marshal.Copy(bytes,0,pointer,bytes.Length);}finally{GlobalUnlock(memory);}
            Check(DragQueryFile(memory,uint.MaxValue,null,0)==3,"native Shell sees all Unicode clipboard file paths");
            for(uint i=0;i<files.Length;i++){
                var length=DragQueryFile(memory,i,null,0);var text=new StringBuilder((int)length+1);
                DragQueryFile(memory,i,text,(uint)text.Capacity);Check(text.ToString()==files[i],"native Shell preserves path "+i);
            }
        }finally{GlobalFree(memory);}
        Check(DesktopShellClipboardData.DecodeEffect(null)==DesktopDropEffect.Copy,"missing preferred effect defaults to copy");
        Check(DesktopShellClipboardData.DecodeEffect(DesktopShellClipboardData.EncodeEffect(true))==DesktopDropEffect.Move,"cut uses native MOVE effect");
        Check(DesktopShellClipboardData.DecodeEffect(DesktopShellClipboardData.EncodeEffect(false))==DesktopDropEffect.Copy,"copy uses native COPY effect");
        var snapshot=new DesktopClipboardSnapshot(12,Array.AsReadOnly(files),DesktopDropEffect.Move);
        var partial=new DesktopTransferResult(new[]{new DesktopTransferItem(files[0],@"D:\target\one.txt","completed",0),new DesktopTransferItem(files[1],null,"failed",-1)},true,-1);
        Check(DesktopShellClipboardData.RemainingAfterMove(snapshot,partial).SequenceEqual(files.Skip(1)),"partial move retains failed and unprocessed clipboard paths");
        Check(DesktopShellClipboardData.RemainingAfterMove(snapshot with{Effect=DesktopDropEffect.Copy},partial).SequenceEqual(files),"copy never removes source paths from clipboard");
        var invalid=false;try{DesktopShellClipboardData.EncodeFiles(new[]{"relative.txt"});}catch(ArgumentException){invalid=true;}
        Check(invalid,"relative paths cannot become native file clipboard data");
        Console.WriteLine("10/10 clipboard data checks passed; system clipboard untouched");
    }
    [DllImport("kernel32.dll")] private static extern IntPtr GlobalAlloc(uint flags,nuint bytes);
    [DllImport("kernel32.dll")] private static extern IntPtr GlobalLock(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern bool GlobalUnlock(IntPtr memory);
    [DllImport("kernel32.dll")] private static extern IntPtr GlobalFree(IntPtr memory);
    [DllImport("shell32.dll",CharSet=CharSet.Unicode)] private static extern uint DragQueryFile(IntPtr memory,uint index,StringBuilder? text,uint length);
}
