using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;
using System.Threading;

namespace LYQUANT.Launcher
{
    class Program
    {
        private static Process backendProcess = null;
        private static Process frontendProcess = null;

        static void Main(string[] args)
        {
            Console.Title = "LYQUANT - Quantitative Trading System";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==================================================================");
            Console.WriteLine("             LYQUANT - QUANTITATIVE TRADING PLATFORM              ");
            Console.WriteLine("==================================================================");
            Console.ResetColor();

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            if (!Directory.Exists(Path.Combine(baseDir, "Server")) && Directory.Exists(Path.Combine(Directory.GetParent(baseDir).FullName, "Server")))
            {
                baseDir = Directory.GetParent(baseDir).FullName;
            }

            string serverDir = Path.Combine(baseDir, "Server");
            string clientDir = Path.Combine(baseDir, "Client");

            AppDomain.CurrentDomain.ProcessExit += (s, e) => CleanUp();
            Console.CancelKeyPress += (s, e) => { CleanUp(); Environment.Exit(0); };

            // 1. Check & Start Python Backend (Port 5000)
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[1/3] Checking MT5 Python Backend (Port 5000)...");
            Console.ResetColor();

            if (IsPortInUse(5000))
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("      [OK] Backend is already running on http://127.0.0.1:5000");
                Console.ResetColor();
            }
            else
            {
                string pythonExe = FindExecutable("python.exe", new string[] {
                    @"C:\Program Files\Python313\python.exe",
                    @"C:\Program Files\Python312\python.exe",
                    @"C:\Program Files\Python311\python.exe",
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\Python\Python313\python.exe")
                });

                Console.WriteLine("      -> Launching Python server: " + pythonExe + " app.py");
                ProcessStartInfo psiBackend = new ProcessStartInfo
                {
                    FileName = pythonExe,
                    Arguments = "app.py",
                    WorkingDirectory = serverDir,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                try
                {
                    backendProcess = Process.Start(psiBackend);
                    WaitForPort(5000, 8000);
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("      [OK] Backend started successfully on http://127.0.0.1:5000");
                    Console.ResetColor();
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("      [ERROR] Could not start backend: " + ex.Message);
                    Console.ResetColor();
                }
            }

            // 2. Check & Start Frontend (Port 5173)
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[2/3] Checking Vite Frontend (Port 5173)...");
            Console.ResetColor();

            if (IsPortInUse(5173))
            {
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("      [OK] Frontend is already running on http://localhost:5173");
                Console.ResetColor();
            }
            else
            {
                string npmCmd = FindExecutable("npm.cmd", new string[] {
                    @"C:\Program Files\nodejs\npm.cmd",
                    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"npm\npm.cmd")
                });

                Console.WriteLine("      -> Launching frontend: " + npmCmd + " run dev");
                ProcessStartInfo psiFrontend = new ProcessStartInfo
                {
                    FileName = npmCmd,
                    Arguments = "run dev -- --host",
                    WorkingDirectory = clientDir,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                try
                {
                    frontendProcess = Process.Start(psiFrontend);
                    WaitForPort(5173, 10000);
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.WriteLine("      [OK] Frontend started successfully on http://localhost:5173");
                    Console.ResetColor();
                }
                catch (Exception ex)
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.WriteLine("      [ERROR] Could not start frontend: " + ex.Message);
                    Console.ResetColor();
                }
            }

            // 3. Open Browser
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("\n[3/3] Opening LYQUANT in default web browser...");
            Console.ResetColor();

            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = "http://localhost:5173",
                    UseShellExecute = true
                });
                Console.ForegroundColor = ConsoleColor.Green;
                Console.WriteLine("      [OK] Browser launched at http://localhost:5173");
                Console.ResetColor();
            }
            catch (Exception ex)
            {
                Console.WriteLine("      [NOTE] Please open http://localhost:5173 in your browser: " + ex.Message);
            }

            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("==================================================================");
            Console.WriteLine("  LYQUANT IS RUNNING! DO NOT CLOSE THIS WINDOW WHILE TRADING.      ");
            Console.WriteLine("  Press CTRL+C or close this window to safely exit both servers.   ");
            Console.WriteLine("==================================================================");
            Console.ResetColor();

            while (true)
            {
                Thread.Sleep(2000);
            }
        }

        private static bool IsPortInUse(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = result.AsyncWaitHandle.WaitOne(600);
                    if (success)
                    {
                        client.EndConnect(result);
                        return true;
                    }
                    return false;
                }
            }
            catch
            {
                return false;
            }
        }

        private static void WaitForPort(int port, int timeoutMs)
        {
            int elapsed = 0;
            while (elapsed < timeoutMs)
            {
                if (IsPortInUse(port)) return;
                Thread.Sleep(500);
                elapsed += 500;
            }
        }

        private static string FindExecutable(string name, string[] fallbacks)
        {
            string pathEnv = Environment.GetEnvironmentVariable("PATH");
            if (!string.IsNullOrEmpty(pathEnv))
            {
                foreach (string p in pathEnv.Split(';'))
                {
                    try
                    {
                        string full = Path.Combine(p.Trim(), name);
                        if (File.Exists(full)) return full;
                    }
                    catch { }
                }
            }

            foreach (string fb in fallbacks)
            {
                if (File.Exists(fb)) return fb;
            }

            return name;
        }

        private static void KillProcessTree(Process p)
        {
            if (p == null) return;
            try
            {
                if (!p.HasExited)
                {
                    Process killProc = Process.Start(new ProcessStartInfo
                    {
                        FileName = "taskkill",
                        Arguments = string.Format("/F /T /PID {0}", p.Id),
                        CreateNoWindow = true,
                        UseShellExecute = false
                    });
                    if (killProc != null)
                    {
                        killProc.WaitForExit(2000);
                    }
                }
            }
            catch { }
        }

        private static void CleanUp()
        {
            Console.WriteLine("\n[SHUTDOWN] Stopping servers...");
            KillProcessTree(backendProcess);
            KillProcessTree(frontendProcess);
            Console.WriteLine("[SHUTDOWN] LYQUANT exited cleanly.");
        }
    }
}
