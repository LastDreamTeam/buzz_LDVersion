// OpenAI: native Windows lifecycle and existing Buzz credential access, not a message bridge.
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class HeadlessNative {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    private struct Credential {
        public uint Flags, Type; public string TargetName, Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint BlobSize; public IntPtr Blob; public uint Persist, AttributeCount;
        public IntPtr Attributes; public string TargetAlias, UserName;
    }
    [StructLayout(LayoutKind.Sequential)] private struct BasicLimits {
        public long ProcessTime, JobTime; public uint Flags; public UIntPtr MinWorkingSet, MaxWorkingSet;
        public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct ExtendedLimits {
        public BasicLimits Basic; public IoCounters Io;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern bool CredRead(string target,uint type,uint flags,out IntPtr value);
    [DllImport("advapi32.dll")] private static extern void CredFree(IntPtr value);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] private static extern IntPtr CreateJobObject(IntPtr attributes,string name);
    [DllImport("kernel32.dll")] private static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimits info,uint size);
    [DllImport("kernel32.dll")] private static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll")] private static extern IntPtr GetCurrentProcess();
    // OpenAI: keep this handle alive; closing the host kills only its own process tree.
    private static IntPtr job;
    public static void ContainCurrentHost() {
        job=CreateJobObject(IntPtr.Zero,null);
        var limits=new ExtendedLimits(); limits.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE
        if(job==IntPtr.Zero || !SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf<ExtendedLimits>())
            || !AssignProcessToJobObject(job,GetCurrentProcess())) throw new Exception("Cannot contain host process tree");
    }
    public static string ReadCredentials() {
        IntPtr ptr;
        if(!CredRead("secrets.buzz-desktop",1,0,out ptr)) throw new Exception("Saved Buzz identity unavailable in this Windows logon context");
        byte[] bytes=null;
        try {
            var c=Marshal.PtrToStructure<Credential>(ptr);
            if(c.BlobSize==0 || c.BlobSize>1048576) throw new Exception("Invalid credential size");
            bytes=new byte[c.BlobSize]; Marshal.Copy(c.Blob,bytes,0,bytes.Length);
            return Encoding.Unicode.GetString(bytes);
        } finally { if(bytes!=null) Array.Clear(bytes,0,bytes.Length); CredFree(ptr); }
    }
}
