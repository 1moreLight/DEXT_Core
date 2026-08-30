using Newtonsoft.Json;
using System;
using System.IO;
using System.Reflection;

namespace Lively.Common
{
    public sealed class DextRuntimeIdentity
    {
        private const string ResourceName = "Dext.RuntimeIdentity.json";
        private static readonly Lazy<DextRuntimeIdentity> LazyCurrent = new(Load);

        [JsonProperty("productName")]
        public string ProductName { get; private set; }

        [JsonProperty("runtimeIdentity")]
        public string RuntimeIdentity { get; private set; }

        [JsonProperty("grpcPipePrefix")]
        public string GrpcPipePrefix { get; private set; }

        [JsonProperty("localAppDataDirectory")]
        public string LocalAppDataDirectory { get; private set; }

        [JsonProperty("tempDirectory")]
        public string TempDirectory { get; private set; }

        [JsonProperty("startupEntryName")]
        public string StartupEntryName { get; private set; }

        [JsonProperty("configuratorProductName")]
        public string ConfiguratorProductName { get; private set; }

        public static DextRuntimeIdentity Current => LazyCurrent.Value;

        public string PipeServerName => RuntimeIdentity + Environment.UserName;
        public string GrpcPipeServerName => GrpcPipePrefix + PipeServerName;
        public string AppDataDirectory => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            LocalAppDataDirectory);
        public string TempRootDirectory => Path.Combine(Path.GetTempPath(), TempDirectory);

        private static DextRuntimeIdentity Load()
        {
            using Stream stream = typeof(DextRuntimeIdentity).GetTypeInfo().Assembly
                .GetManifestResourceStream(ResourceName)
                ?? throw new InvalidOperationException($"Embedded runtime identity {ResourceName} was not found.");
            using var reader = new StreamReader(stream);
            var identity = JsonConvert.DeserializeObject<DextRuntimeIdentity>(reader.ReadToEnd())
                ?? throw new InvalidOperationException("Dext runtime identity is invalid.");

            if (string.IsNullOrWhiteSpace(identity.ProductName)
                || string.IsNullOrWhiteSpace(identity.RuntimeIdentity)
                || string.IsNullOrWhiteSpace(identity.GrpcPipePrefix)
                || string.IsNullOrWhiteSpace(identity.LocalAppDataDirectory)
                || string.IsNullOrWhiteSpace(identity.TempDirectory)
                || string.IsNullOrWhiteSpace(identity.StartupEntryName))
            {
                throw new InvalidOperationException("Dext runtime identity contains an empty required value.");
            }

            return identity;
        }
    }
}
