using Lively.Models.Message;
using Microsoft.Win32.SafeHandles;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;

namespace Lively.Common.Helpers
{
    // Native v3 never maps a directory into WebView. Public content is copied
    // under source handle protection, then served from immutable owned bytes.
    public sealed class DextNativeResourceServer : IDisposable
    {
        private static readonly HashSet<string> OfficialFiles = new HashSet<string>(StringComparer.Ordinal)
        { "index.html", "main.js", "style.css", "layout-model.js","runtime-model.js", "dom-host.js", "frame-host.js", "media-host.js", "playback-host.js", "native-host.js", "geometry.js", "input-host.js" };
        private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".html"]="text/html; charset=utf-8",[".css"]="text/css; charset=utf-8",[".js"]="text/javascript; charset=utf-8",[".mjs"]="text/javascript; charset=utf-8",
            [".json"]="application/json; charset=utf-8",[".png"]="image/png",[".jpg"]="image/jpeg",[".jpeg"]="image/jpeg",[".webp"]="image/webp",[".svg"]="image/svg+xml",
            [".gif"]="image/gif",[".avif"]="image/avif",[".mp4"]="video/mp4",[".webm"]="video/webm",[".ogg"]="audio/ogg",[".mp3"]="audio/mpeg",[".wav"]="audio/wav",
            [".woff"]="font/woff",[".woff2"]="font/woff2",[".ttf"]="font/ttf",[".otf"]="font/otf"
        };
        private readonly object gate = new object();
        private readonly string root;
        private readonly ResourceCache official = new ResourceCache();
        private ResourceCache content;
        private Dictionary<string, LivelyRoomRuntimeResource> inventory;
        private long generation, epoch;
        private bool disposed;
        public string Origin { get; }
        public string EntryUrl => Origin + "/index.html";

        public DextNativeResourceServer(string indexPath)
        {
            indexPath = Path.GetFullPath(indexPath);
            if (!string.Equals(Path.GetFileName(indexPath), "index.html", StringComparison.Ordinal)) throw new ArgumentException("Native host entry must be index.html");
            root = Path.GetDirectoryName(indexPath);
            Origin = "https://" + LinkUtil.GetStableHostName(indexPath) + ".localhost";
        }

        public bool Activate(long nextGeneration, IEnumerable<LivelyRoomRuntimeResource> resources)
        {
            if (nextGeneration <= 0 || resources == null) return false;
            var next = new Dictionary<string, LivelyRoomRuntimeResource>(StringComparer.Ordinal);
            var folded = new HashSet<string>(StringComparer.OrdinalIgnoreCase); long size = 0;
            foreach (var item in resources)
            {
                if (item == null || next.Count >= 4096 || !SafeResourcePath(item.Path) || !folded.Add(item.Path) || item.Size < 0 || item.Size > 1024L*1024*1024 ||
                    item.Sha256 == null || item.Sha256.Length != 64 || item.Sha256.Any(c => !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f'))) return false;
                size += item.Size; if (size > 2L*1024*1024*1024) return false;
                next.Add(item.Path, new LivelyRoomRuntimeResource { Path=item.Path, Sha256=item.Sha256, Size=item.Size });
            }
            ResourceCache old;
            lock (gate)
            {
                if (disposed || nextGeneration <= generation) return false;
                old=content; content=new ResourceCache(); inventory=next; generation=nextGeneration; epoch++;
            }
            old?.Dispose(); return true;
        }
        public void Revoke()
        {
            ResourceCache old;
            lock (gate) { old=content; content=null; inventory=null; epoch++; }
            old?.Dispose();
        }
        public bool IsOfficialResource(string address)
        { lock(gate) return !disposed && TryPath(address,out var path) && OfficialFiles.Contains(path); }
        public bool CanNavigateFrame(string address)
        {
            if (address == "about:blank") return true;
            lock(gate)
            {
                if(disposed || content == null || !TryPath(address,out var path))return false;
                var prefix="content/"+generation.ToString(CultureInfo.InvariantCulture)+"/";
                return path.StartsWith(prefix,StringComparison.Ordinal) && inventory.ContainsKey(path.Substring(prefix.Length));
            }
        }
        public bool IsCurrent(DextResourceResponse response)
        { lock (gate) return !disposed && response.Owner == this && response.Epoch == epoch; }

        // Runs off the UI thread. The UI must recheck IsCurrent before publishing
        // the response; navigation/revocation may occur during hashing.
        public DextResourceResponse Prepare(string address, string method, string range)
        {
            long requestEpoch, requestGeneration; ResourceCache cache; LivelyRoomRuntimeResource item=null; string path;
            lock (gate)
            {
                requestEpoch=epoch; requestGeneration=generation;
                if (disposed || !TryPath(address, out path)) return Empty(403, requestEpoch);
                if (method != "GET" && method != "HEAD") return Empty(405, requestEpoch);
                if (OfficialFiles.Contains(path)) cache=official;
                else
                {
                    var prefix="content/"+generation.ToString(CultureInfo.InvariantCulture)+"/";
                    if (content == null || !path.StartsWith(prefix, StringComparison.Ordinal) || !inventory.TryGetValue(path.Substring(prefix.Length), out item)) return Empty(403, requestEpoch);
                    cache=content; path=item.Path;
                }
            }
            try
            {
                var sourceRoot=item == null ? root : Path.Combine(root,"content");
                var blob=cache.Get(path, () => CopyVerified(sourceRoot,path,item,cache.Token));
                cache.Token.ThrowIfCancellationRequested();
                var start=0L; var length=blob.Length; var partial=false;
                if (!string.IsNullOrEmpty(range))
                {
                    if (!RangeHeaderValue.TryParse(range,out var parsed) || parsed.Unit != "bytes") return Empty(416,requestEpoch,"Content-Range: bytes */"+blob.Length+"\r\n");
                    if (parsed.Ranges.Count == 1)
                    {
                        var selected=parsed.Ranges.Single(); var end=blob.Length-1;
                        if (selected.From.HasValue) { start=selected.From.Value; if(selected.To.HasValue) end=Math.Min(end,selected.To.Value); }
                        else if (selected.To.HasValue && selected.To.Value > 0) start=Math.Max(0,blob.Length-selected.To.Value);
                        else return Empty(416,requestEpoch,"Content-Range: bytes */"+blob.Length+"\r\n");
                        if (start >= blob.Length || end < start) return Empty(416,requestEpoch,"Content-Range: bytes */"+blob.Length+"\r\n");
                        length=end-start+1; partial=true;
                    }
                }
                var headers="Content-Type: "+MimeTypes[Path.GetExtension(path)]+"\r\nContent-Length: "+length.ToString(CultureInfo.InvariantCulture)+"\r\nAccept-Ranges: bytes\r\n"+
                    "Cache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nAccess-Control-Allow-Origin: *\r\n"+
                    "Connection-Allowlist: (response-origin); webrtc=block; redirects=block; report-to=dext-native-policy\r\n"+
                    "Content-Security-Policy: "+ContentPolicy(item != null,requestGeneration)+"\r\n";
                if(partial)headers+="Content-Range: bytes "+start+"-"+(start+length-1)+"/"+blob.Length+"\r\n";
                var response=new DextResourceResponse(this,requestEpoch,partial?206:200,headers,method=="HEAD"?Stream.Null:new SliceStream(blob,start,length,cache.Token));
                if(!IsCurrent(response)){response.Dispose();return Empty(403,requestEpoch);}
                return response;
            }
            catch(Exception error) when(error is IOException || error is UnauthorizedAccessException || error is OperationCanceledException || error is ObjectDisposedException)
            { return Empty(403,requestEpoch); }
        }
        private string ContentPolicy(bool authored,long version)
        {
            var source=authored?Origin+"/content/"+version.ToString(CultureInfo.InvariantCulture)+"/":Origin;
            return "default-src 'none'; script-src "+source+" 'unsafe-inline'; style-src "+source+" 'unsafe-inline'; img-src "+source+" data:; media-src "+source+
                "; font-src "+source+"; connect-src "+source+"; frame-src "+source+"; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"+
                (authored?"; sandbox allow-scripts":"");
        }
        private DextResourceResponse Empty(int status,long requestEpoch,string extra="") => new DextResourceResponse(this,requestEpoch,status,
            "Content-Length: 0\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\n"+extra,Stream.Null);
        private bool TryPath(string address,out string path)
        {
            path=null;
            if (address == null || !Uri.TryCreate(address,UriKind.Absolute,out var uri) || uri.Scheme != "https" || !uri.IsDefaultPort || uri.UserInfo.Length != 0 ||
                !string.Equals(uri.GetLeftPart(UriPartial.Authority),Origin,StringComparison.OrdinalIgnoreCase) || uri.Query.Length != 0 || uri.Fragment.Length != 0) return false;
            // Validate raw segments before System.Uri dot-segment normalization.
            var slash=address.IndexOf('/',address.IndexOf("://",StringComparison.Ordinal)+3);
            if (slash < 0) return false;
            var parts=address.Substring(slash+1).Split('/'); var decoded=new List<string>();
            foreach(var segment in parts)
            {
                var value=Uri.UnescapeDataString(segment);
                if(value.Contains("/") || !string.Equals(Uri.EscapeDataString(value),segment,StringComparison.OrdinalIgnoreCase))return false;
                decoded.Add(value);
            }
            path=string.Join("/",decoded); return SafeResourcePath(path,320);
        }
        private static bool SafeResourcePath(string path,int maximumBytes=240)
        {
            if(string.IsNullOrEmpty(path)||Encoding.UTF8.GetByteCount(path)>maximumBytes)return false;
            foreach(var part in path.Split('/'))
            {
                if(part.Length==0||part=="."||part==".."||part.EndsWith(".",StringComparison.Ordinal)||part.EndsWith(" ",StringComparison.Ordinal)||part.Any(c=>char.IsControl(c)||"\\:*?\"<>|%#".Contains(c)))return false;
                var stem=part.Split('.')[0].ToUpperInvariant();
                if(new[]{"CON","PRN","AUX","NUL"}.Contains(stem)||stem.Length==4&&(stem.StartsWith("COM",StringComparison.Ordinal)||stem.StartsWith("LPT",StringComparison.Ordinal))&&stem[3]>='1'&&stem[3]<='9')return false;
            }
            return MimeTypes.ContainsKey(Path.GetExtension(path))&&!new[]{"room.json","installation.json"}.Contains(path.ToLowerInvariant());
        }
        public void Dispose()
        {
            lock(gate){if(disposed)return;disposed=true;}
            Revoke();official.Dispose();
        }

        private static VerifiedBlob CopyVerified(string root,string path,LivelyRoomRuntimeResource expected,CancellationToken token)
        {
            var guards=new List<SafeFileHandle>(); FileStream source=null,copy=null;
            try
            {
                root=Path.GetFullPath(root);guards.Add(OpenHandle(root,true,root));var parts=path.Split('/');var parent=root;
                for(var i=0;i<parts.Length-1;i++){parent=Path.Combine(parent,parts[i]);guards.Add(OpenHandle(parent,true,root));}
                var handle=OpenHandle(Path.Combine(parent,parts[parts.Length-1]),false,root);
                try{source=new FileStream(handle,FileAccess.Read);}catch{handle.Dispose();throw;}
                var expectedSize=expected?.Size ?? source.Length;
                if(expectedSize<0||expectedSize>(expected==null?16L*1024*1024:1024L*1024*1024)||source.Length!=expectedSize)throw new IOException("Resource size mismatch");
                copy=new FileStream(Path.Combine(Path.GetTempPath(),"Dext-v3-resource-"+Guid.NewGuid().ToString("N")+".tmp"),FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None,65536,FileOptions.DeleteOnClose|FileOptions.RandomAccess);
                using(var hash=SHA256.Create())
                {
                    var buffer=new byte[65536];long count=0;int read;
                    while((read=source.Read(buffer,0,buffer.Length))>0)
                    {
                        token.ThrowIfCancellationRequested();count+=read;if(count>expectedSize)throw new IOException("Resource grew");
                        hash.TransformBlock(buffer,0,read,buffer,0);copy.Write(buffer,0,read);
                    }
                    hash.TransformFinalBlock(Array.Empty<byte>(),0,0);
                    if(count!=expectedSize||expected!=null&&BitConverter.ToString(hash.Hash).Replace("-","").ToLowerInvariant()!=expected.Sha256)throw new IOException("Resource hash mismatch");
                }
                copy.Flush();token.ThrowIfCancellationRequested();var blob=new VerifiedBlob(copy);copy=null;return blob;
            }
            finally{source?.Dispose();foreach(var guard in guards)guard.Dispose();copy?.Dispose();}
        }
        private sealed class ResourceCache : IDisposable
        {
            private readonly object sync=new object();
            private readonly CancellationTokenSource cancellation=new CancellationTokenSource();
            private readonly ConcurrentDictionary<string,Lazy<VerifiedBlob>> entries=new ConcurrentDictionary<string,Lazy<VerifiedBlob>>(StringComparer.Ordinal);
            private readonly List<VerifiedBlob> owned=new List<VerifiedBlob>();
            private bool disposed;
            public CancellationToken Token=>cancellation.Token;
            public VerifiedBlob Get(string key,Func<VerifiedBlob> create)=>entries.GetOrAdd(key,_=>new Lazy<VerifiedBlob>(()=>
            {
                cancellation.Token.ThrowIfCancellationRequested();var blob=create();
                lock(sync){if(disposed){blob.Dispose();throw new ObjectDisposedException(nameof(ResourceCache));}owned.Add(blob);}
                return blob;
            },LazyThreadSafetyMode.ExecutionAndPublication)).Value;
            public void Dispose()
            {
                VerifiedBlob[] blobs;
                lock(sync){if(disposed)return;disposed=true;cancellation.Cancel();blobs=owned.ToArray();owned.Clear();}
                foreach(var blob in blobs)blob.Dispose();
            }
        }
        private sealed class VerifiedBlob : IDisposable
        {
            private readonly object sync=new object();private readonly FileStream bytes;private bool disposed;
            public long Length {get;}
            public VerifiedBlob(FileStream bytes){this.bytes=bytes;Length=bytes.Length;}
            public int Read(long position,byte[] buffer,int offset,int count)
            {lock(sync){if(disposed)throw new ObjectDisposedException(nameof(VerifiedBlob));bytes.Position=position;return bytes.Read(buffer,offset,count);}}
            public void Dispose(){lock(sync){if(disposed)return;disposed=true;bytes.Dispose();}}
        }
        private sealed class SliceStream : Stream
        {
            private readonly VerifiedBlob blob;private readonly long start,length;private readonly CancellationToken token;private long position;private bool disposed;
            public SliceStream(VerifiedBlob blob,long start,long length,CancellationToken token){this.blob=blob;this.start=start;this.length=length;this.token=token;}
            private void Check(){if(disposed||token.IsCancellationRequested)throw new ObjectDisposedException(nameof(SliceStream));}
            public override bool CanRead=>!disposed&&!token.IsCancellationRequested;public override bool CanSeek=>CanRead;public override bool CanWrite=>false;
            public override long Length{get{Check();return length;}}public override long Position{get{Check();return position;}set{Seek(value,SeekOrigin.Begin);}}
            public override int Read(byte[] buffer,int offset,int count)
            {
                Check();if(buffer==null)throw new ArgumentNullException(nameof(buffer));if(offset<0||count<0||offset>buffer.Length-count)throw new ArgumentOutOfRangeException();
                if(count==0)return 0;if(position==length){Dispose();return 0;}
                var read=blob.Read(start+position,buffer,offset,(int)Math.Min(count,length-position));position+=read;return read;
            }
            public override long Seek(long offset,SeekOrigin origin)
            {
                Check();long value;try{value=checked((origin==SeekOrigin.Begin?0:origin==SeekOrigin.Current?position:origin==SeekOrigin.End?length:throw new ArgumentException(nameof(origin)))+offset);}catch(OverflowException){throw new IOException("Seek outside response");}
                if(value<0||value>length)throw new IOException("Seek outside response");position=value;return value;
            }
            protected override void Dispose(bool disposing){disposed=true;base.Dispose(disposing);}public override void Flush(){Check();}
            public override void SetLength(long value)=>throw new NotSupportedException();public override void Write(byte[] buffer,int offset,int count)=>throw new NotSupportedException();
        }
        [StructLayout(LayoutKind.Sequential)] private struct FileInformation
        {public uint Attributes;public System.Runtime.InteropServices.ComTypes.FILETIME Created,Accessed,Written;public uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
        [DllImport("kernel32.dll",SetLastError=true)]private static extern bool GetFileInformationByHandle(SafeFileHandle handle,out FileInformation information);
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle,StringBuilder path,uint length,uint flags);
        private static string Normalize(string path)
        {if(path.StartsWith("\\\\?\\UNC\\",StringComparison.OrdinalIgnoreCase))path="\\\\"+path.Substring(8);else if(path.StartsWith("\\\\?\\",StringComparison.Ordinal))path=path.Substring(4);return Path.GetFullPath(path).TrimEnd(Path.DirectorySeparatorChar);}
        private static SafeFileHandle OpenHandle(string path,bool directory,string root)
        {
            // Valid 240-byte relative resources can exceed MAX_PATH after the
            // official host root is prefixed; use an explicit native long path.
            var nativePath=path.StartsWith("\\\\?\\",StringComparison.Ordinal)?path:
                path.StartsWith("\\\\",StringComparison.Ordinal)?"\\\\?\\UNC\\"+path.Substring(2):"\\\\?\\"+path;
            var handle=CreateFileW(nativePath,0x80000000,directory?3u:1u,IntPtr.Zero,3,0x00200000|(directory?0x02000000u:0),IntPtr.Zero);
            try
            {
                if(handle.IsInvalid)throw new IOException("Resource open failed",new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()));
                if(!GetFileInformationByHandle(handle,out var info)||(info.Attributes&0x400)!=0||((info.Attributes&0x10)!=0)!=directory)throw new IOException("Resource type rejected");
                var final=new StringBuilder(32768);var count=GetFinalPathNameByHandleW(handle,final,(uint)final.Capacity,0);
                if(count==0||count>=final.Capacity)throw new IOException("Resource identity unavailable");
                var resolved=Normalize(final.ToString());root=Normalize(root);
                if(!resolved.Equals(root,StringComparison.OrdinalIgnoreCase)&&!resolved.StartsWith(root+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new IOException("Resource escaped root");
                return handle;
            }
            catch{handle.Dispose();throw;}
        }
    }
    public sealed class DextResourceResponse : IDisposable
    {
        internal DextNativeResourceServer Owner {get;} internal long Epoch {get;}
        public int StatusCode {get;} public string Headers {get;} public Stream Content {get;}
        public string ReasonPhrase=>StatusCode==200?"OK":StatusCode==206?"Partial Content":StatusCode==405?"Method Not Allowed":StatusCode==416?"Range Not Satisfiable":"Forbidden";
        internal DextResourceResponse(DextNativeResourceServer owner,long epoch,int status,string headers,Stream content)
        {Owner=owner;Epoch=epoch;StatusCode=status;Headers=headers;Content=content;}
        public void Dispose()=>Content.Dispose();
    }
}
