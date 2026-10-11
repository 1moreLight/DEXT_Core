using Dext.Core.Rooms;
internal static class ForegroundReturnChecks
{
    internal static void Run()
    {
        foreach(var role in new[]{RoomClientRole.DesktopPlayer,RoomClientRole.Dock})
        foreach(var sampled in new[]{false,true})
        {
            var session=Guid.NewGuid();
            RoomSessionSnapshot snapshot=new(1,session,"room","home",null,null,null,1,true,null){InstallationStamp="stamp"};
            var viewport=new RoomNativeViewport(42,0,0,1000,500,6);
            RoomNativeButton[] regions=[new("scene","next",.1,.1,.2,.3,0)];
            var input=new RoomNativeInputAuthority(TimeProvider.System,role);input.Initialize(1,snapshot);
            Require(input.PublishGeometry(1,session,1,1,viewport,regions,sampled),"publish");
            void Pair()
            {
                input.MouseDown(viewport,200,100,true,3);
                var sequence=input.State?.Gesture?.Sequence??throw new Exception("fresh desktop DOWN missing after focus return");
                if(sampled)Require(input.SampleMouse(1,session,1,1,sequence,"down",viewport,regions,true),"DOWN sample");
                input.MouseUp(viewport,200,100,true);
                if(sampled)Require(input.SampleMouse(1,session,1,1,sequence,"up",viewport,regions,true),"UP sample");
                Require(input.State?.Completed!=null,"fresh desktop click missing after focus return");
                Require(input.State!.Completed!.Modifiers==3 && input.State.Completed.Key==0 && input.State.Completed.X==200 && input.State.Completed.Y==100,"click preserves down-edge modifiers and input kind");
            }
            Pair();
            input.CheckNativeViewport(viewport,false);
            Require(input.State?.Completed==null&&input.State?.Focus==null,"background retained input completion/focus");
            input.MouseMove(viewport,200,100,false);
            input.MouseDown(viewport,200,100,false);input.MouseUp(viewport,200,100,false);
            Require(input.State?.Completed==null,"background click completed");
            input.CheckNativeViewport(viewport,true);
            Pair(); // Same snapshot and viewport: returning must not need a new geometry publication.
            if(!sampled){
                input.Key(viewport,13,true,false,true,1);input.Key(viewport,13,false,false,true,0);
                Require(input.State?.Completed is{Key:13,Modifiers:1},"keyboard completion retains key and down-edge modifiers");
            }
            input.CheckNativeViewport(viewport with{Width=999},true);
            input.MouseDown(viewport,200,100,true,3);input.MouseUp(viewport,200,100,true);
            Require(input.State?.Completed==null,"changed viewport reused old region");
            Console.WriteLine($"PASS {role} sampled={sampled}: focus return restores fresh click, background completion canceled");
        }
    }
    private static void Require(bool ok,string detail){if(!ok)throw new Exception(detail);}
}