// OpenAI: standalone process shim; native Buzz owns the enclosing Windows Job Object.
using System;
using System.Diagnostics;
using System.IO;
public static class Launcher {
    private static void Pump(Stream source, Stream target) {
        var buffer = new byte[8192]; int size;
        while ((size = source.Read(buffer, 0, buffer.Length)) > 0) { target.Write(buffer, 0, size); target.Flush(); }
    }
    public static int Main(string[] args) {
        if (args.Length > 1 || (args.Length == 1 && args[0] != "--guard")) return 64;
        var node = Environment.GetEnvironmentVariable("LD_BUZZ_NODE");
        if (String.IsNullOrEmpty(node) || !File.Exists(node)) return 65;
        var runtime = Environment.GetEnvironmentVariable("LD_BUZZ_RUNTIME") ?? AppDomain.CurrentDomain.BaseDirectory;
        var script = Path.Combine(runtime, "adapter.mjs");
        var info = new ProcessStartInfo(node, "\"" + script + "\" " + (args.Length == 1 ? "guard" : "harness"));
        info.UseShellExecute = false;
        info.CreateNoWindow = true;
        info.RedirectStandardInput = true;
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        using (var child = Process.Start(info)) {
            System.Threading.Tasks.Task.Run(() => { try { Pump(Console.OpenStandardInput(), child.StandardInput.BaseStream); child.StandardInput.Close(); } catch { } });
            var output = System.Threading.Tasks.Task.Run(() => Pump(child.StandardOutput.BaseStream, Console.OpenStandardOutput()));
            var error = System.Threading.Tasks.Task.Run(() => Pump(child.StandardError.BaseStream, Console.OpenStandardError()));
            child.WaitForExit();
            System.Threading.Tasks.Task.WaitAll(output, error);
            return child.ExitCode;
        }
    }
}
