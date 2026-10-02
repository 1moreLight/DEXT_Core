using System.Text.Json;
if (args.Length >= 2 && args[0] == "--capture")
    File.WriteAllText(args[1], JsonSerializer.Serialize(new { arguments = args, workingDirectory = Environment.CurrentDirectory }));
