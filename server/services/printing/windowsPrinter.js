const { execFile } = require('child_process');

// Talks to the printers connected to this Windows computer. The Windows print queue is read
// with PowerShell's print management commands, and files are printed with pdf-to-printer,
// which bundles the SumatraPDF print engine. Names are passed in environment variables so
// they are never pasted into a script.
const runPowerShell = (script, env = {}) => new Promise((resolve, reject) => {
  execFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { env: { ...process.env, ...env }, timeout: 30000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    (error, stdout, stderr) => (error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout))
  );
});

const SNAPSHOT_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$default = (Get-CimInstance Win32_Printer -Filter 'Default=true' | Select-Object -First 1).Name
$printers = @(Get-Printer | ForEach-Object {
  [pscustomobject]@{ name = $_.Name; status = $_.PrinterStatus.ToString(); isDefault = ($_.Name -eq $default); port = $_.PortName; driver = $_.DriverName }
})
$jobs = @(foreach ($p in $printers) {
  Get-PrintJob -PrinterName $p.name -ErrorAction SilentlyContinue | ForEach-Object {
    [pscustomobject]@{ printer = $p.name; document = $_.DocumentName; status = $_.JobStatus.ToString(); pagesPrinted = $_.PagesPrinted; totalPages = $_.TotalPages }
  }
})
ConvertTo-Json -Depth 4 -Compress -InputObject ([pscustomobject]@{ printers = $printers; jobs = $jobs })
`;

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

// The printers Windows knows about, and every job waiting in their queues
const snapshot = async () => {
  const output = await runPowerShell(SNAPSHOT_SCRIPT);
  const data = JSON.parse(output.trim() || '{}');
  return { printers: asArray(data.printers), jobs: asArray(data.jobs) };
};

// Removes queued copies of a job, so a reprint doesn't also release an older stuck copy
const removeJobs = (printer, documentPrefix) => runPowerShell(
  `Get-PrintJob -PrinterName $env:PD_PRINTER -ErrorAction SilentlyContinue |
     Where-Object { $_.DocumentName -like "*$($env:PD_DOCUMENT)*" } |
     Remove-PrintJob -ErrorAction SilentlyContinue`,
  { PD_PRINTER: printer, PD_DOCUMENT: documentPrefix }
);

// Hands the file to the printer. Resolves once Windows has the job in its queue.
const printFile = (file, options) => require('pdf-to-printer').print(file, options);

module.exports = { snapshot, removeJobs, printFile };
