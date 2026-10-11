using System;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using Lively.Common.Helpers;
using Lively.Models.Message;
using Newtonsoft.Json;
namespace Lively.Player.WebView2
{
    public partial class Form1
    {
        private System.Windows.Forms.Timer editPointerTimer;
        private DextNativePointerPacket editPointer;
        private bool editPointerBusy;
        [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
        [DllImport("user32.dll")] private static extern bool GetCursorPos(out EditPoint point);
        [StructLayout(LayoutKind.Sequential)] private struct EditPoint { public int X; public int Y; }
        private async Task ObserveEditDownAsync(LivelyMessageRoomNativePointer message)
        {
            if(message.Kind=="up"&&editPointer is DextNativePointerPacket held&&held.GestureId==message.GestureId){
                editPointer=null;editPointerTimer?.Stop();
                await SendEditPointerAsync(held,"up",message.X,message.Y);return;
            }
            if(startArgs.DextDock || message.Key!=0 || message.Kind!="down")return;
            DextNativePointerPacket packet;
            try{packet=new DextNativePointerPacket(message);}catch(ArgumentException){return;}
            if(!CurrentNativePointer(packet)||!IsOfficialDextDocument(webView.CoreWebView2.Source))return;
            editPointerTimer?.Stop();editPointer=packet;
            var accepted=await SendEditPointerAsync(packet,"down",packet.X,packet.Y);
            SendToParent(new LivelyMessageConsole{Category=ConsoleMessageType.log,Message="Desktop edit down accepted="+accepted+" gesture="+packet.GestureId});
            if(editPointer!=packet||accepted!="true"){if(editPointer==packet)editPointer=null;return;}
            if(editPointerTimer==null){editPointerTimer=new System.Windows.Forms.Timer{Interval=16};editPointerTimer.Tick+=async(sender,args)=>await PollEditPointerAsync();}
            editPointerTimer.Start();
        }
        private async Task<string> SendEditPointerAsync(DextNativePointerPacket packet,string kind,int x,int y)
        {
            if(IsDisposed||Disposing||webView?.CoreWebView2==null)return "false";
            var value=JsonConvert.SerializeObject(new{runtimeGeneration=packet.RuntimeGeneration,sessionId=packet.SessionId,
                revision=packet.Revision,gestureId=packet.GestureId,kind,x=(x-packet.OriginX)*96.0/packet.Dpi,y=(y-packet.OriginY)*96.0/packet.Dpi});
            return await webView.CoreWebView2.ExecuteScriptAsync("this.dextNativeEditPointer?this.dextNativeEditPointer("+value+"):false");
        }
        private async Task PollEditPointerAsync()
        {
            if(editPointerBusy||editPointer==null)return;editPointerBusy=true;var own=editPointer;
            try{
                EditPoint point=new EditPoint{X=own.X,Y=own.Y};
                var valid=CurrentNativePointer(own)&&IsOfficialDextDocument(webView.CoreWebView2.Source)&&GetCursorPos(out point);
                if(!valid)point=new EditPoint{X=own.X,Y=own.Y};
                var kind=!valid||(GetAsyncKeyState(0x1B)&0x8000)!=0?"cancel":(GetAsyncKeyState(1)&0x8000)==0?"up":"move";
                var result=await SendEditPointerAsync(own,kind,point.X,point.Y);
                if(editPointer==own&&(kind!="move"||result!="true")){
                    SendToParent(new LivelyMessageConsole{Category=ConsoleMessageType.log,Message="Desktop edit end kind="+kind+" accepted="+result+" gesture="+own.GestureId});editPointer=null;editPointerTimer.Stop();}
            }catch(Exception){if(editPointer==own){editPointer=null;editPointerTimer?.Stop();}}
            finally{editPointerBusy=false;}
        }
    }
}
