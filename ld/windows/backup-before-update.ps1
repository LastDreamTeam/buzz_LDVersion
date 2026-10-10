# OpenAI: explicit, local-only Buzz backup. Never clears data or changes the OS keyring.
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$BackupDirectory,
  [string]$InstallDirectory = 'E:\app\Buzz',
  [switch]$CredentialFingerprintOnly
)
$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This helper requires PowerShell 7 on Windows.' }

Add-Type -ReferencedAssemblies @(
  [System.Security.Cryptography.ProtectedData].Assembly.Location,
  [System.Security.Cryptography.SHA256].Assembly.Location
) -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
public static class LdBuzzCredentialBackup {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  private struct Credential {
    public uint Flags, Type;
    public string TargetName, Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint BlobSize;
    public IntPtr Blob;
    public uint Persist, AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  private static extern bool CredRead(string target, uint type, uint flags, out IntPtr value);
  [DllImport("advapi32.dll")] private static extern void CredFree(IntPtr value);
  public static string Save(string path) {
    IntPtr value;
    if (!CredRead("secrets.buzz-desktop", 1, 0, out value))
      throw new InvalidOperationException("Buzz credential unavailable: " + Marshal.GetLastWin32Error());
    byte[] blob = null;
    try {
      var credential = Marshal.PtrToStructure<Credential>(value);
      if (credential.BlobSize == 0 || credential.BlobSize > 1024*1024)
        throw new InvalidOperationException("Unexpected Buzz credential size");
      blob = new byte[credential.BlobSize];
      Marshal.Copy(credential.Blob, blob, 0, blob.Length);
      var fingerprint = Convert.ToHexString(SHA256.HashData(blob)).ToLowerInvariant();
      if (!String.IsNullOrEmpty(path)) {
        var entropy = Encoding.UTF8.GetBytes("LD Buzz update backup v1");
        var encrypted = ProtectedData.Protect(blob, entropy, DataProtectionScope.CurrentUser);
        System.IO.File.WriteAllBytes(path, encrypted);
        var verified = ProtectedData.Unprotect(System.IO.File.ReadAllBytes(path), entropy, DataProtectionScope.CurrentUser);
        try {
          if (!CryptographicOperations.FixedTimeEquals(blob, verified))
            throw new InvalidOperationException("Encrypted credential backup verification failed");
        } finally { CryptographicOperations.ZeroMemory(verified); }
      }
      return fingerprint;
    } finally {
      if (blob != null) CryptographicOperations.ZeroMemory(blob);
      CredFree(value);
    }
  }
}
'@

if ($CredentialFingerprintOnly) {
  [pscustomobject]@{target='secrets.buzz-desktop';sha256=[LdBuzzCredentialBackup]::Save($null)} | ConvertTo-Json
  exit
}

if (Get-Process buzz-desktop,buzz-agent,buzz-acp -ErrorAction SilentlyContinue) {
  throw 'Quit Buzz and its local agents first. This helper will not kill processes.'
}
$destination = [IO.Path]::GetFullPath($BackupDirectory)
if (Test-Path -LiteralPath $destination) { throw 'Backup destination already exists; refusing to overwrite.' }
$install = (Resolve-Path -LiteralPath $InstallDirectory).Path
if (-not (Test-Path -LiteralPath (Join-Path $install 'buzz-desktop.exe'))) { throw 'Buzz executable not found.' }
$roaming = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'xyz.block.buzz.app'
$local = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'xyz.block.buzz.app'
$workspace = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.buzz'
$sources = [ordered]@{ program=$install; roaming=$roaming; local=$local; workspace=$workspace }
foreach ($source in $sources.Values) {
  $resolvedSource = [IO.Path]::GetFullPath($source).TrimEnd('\')
  if ($destination.Equals($resolvedSource,[StringComparison]::OrdinalIgnoreCase) -or
      $destination.StartsWith($resolvedSource+'\',[StringComparison]::OrdinalIgnoreCase)) {
    throw 'Backup destination must be outside every source directory.'
  }
}
$null = New-Item -ItemType Directory -Path $destination
# OpenAI: keep backups, including WebView storage, accessible only to this user and SYSTEM.
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $destination /inheritance:r /grant:r "*${sid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not protect backup ACL.' }
$keyHash = [LdBuzzCredentialBackup]::Save((Join-Path $destination 'buzz-secrets.dpapi'))
$records = [Collections.Generic.List[object]]::new()
foreach ($pair in $sources.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $pair.Value)) { continue }
  $source = (Resolve-Path -LiteralPath $pair.Value).Path
  $reparse = @(Get-ChildItem -LiteralPath $source -Force -Recurse -Attributes ReparsePoint)
  if ($reparse.Count) { throw "Reparse points found in $($pair.Key); review before backup." }
  $target = Join-Path $destination $pair.Key
  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
  foreach ($file in Get-ChildItem -LiteralPath $source -File -Force -Recurse) {
    $relative = [IO.Path]::GetRelativePath($source,$file.FullName)
    $savedFile = Join-Path $target $relative
    $sourceHash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne (Get-FileHash -LiteralPath $savedFile -Algorithm SHA256).Hash.ToLowerInvariant()) {
      throw "Backup read-back mismatch in $($pair.Key)."
    }
    $records.Add([pscustomobject]@{group=$pair.Key;path=$relative;bytes=$file.Length;sha256=$sourceHash})
  }
}
$receipt = [ordered]@{
  createdUtc=[DateTime]::UtcNow.ToString('o'); windowsUserSid=$sid;
  originalVersion=(Get-Item -LiteralPath (Join-Path $install 'buzz-desktop.exe')).VersionInfo.ProductVersion;
  sources=$sources; credentialTarget='secrets.buzz-desktop'; credentialSha256=$keyHash;
  credentialProtection='DPAPI CurrentUser; entropy UTF-8: LD Buzz update backup v1';
  files=$records
}
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $destination 'backup-manifest.json') -Encoding utf8NoBOM
[pscustomobject]@{backup=$destination;files=$records.Count;bytes=($records|Measure-Object bytes -Sum).Sum;credentialProtected=$true;originalVersion=$receipt.originalVersion} | ConvertTo-Json
