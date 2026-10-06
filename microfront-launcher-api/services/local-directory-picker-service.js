import { execFile } from 'node:child_process';

export function createLocalDirectoryPicker() {
  return function selectLocalDirectory(description) {
    if (process.platform !== 'win32') {
      throw new Error('El selector de carpetas solo está disponible en Windows.');
    }

    const script = [
      'Add-Type -AssemblyName System.Windows.Forms',
      'Add-Type -AssemblyName System.Drawing',
      '$owner = New-Object System.Windows.Forms.Form',
      '$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual',
      '$owner.Location = New-Object System.Drawing.Point(-32000, -32000)',
      '$owner.Size = New-Object System.Drawing.Size(1, 1)',
      '$owner.ShowInTaskbar = $false',
      '$owner.Opacity = 0',
      '$owner.TopMost = $true',
      '$owner.Show()',
      '$owner.Activate()',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      `$dialog.Description = '${description}'`,
      '$dialog.ShowNewFolderButton = $false',
      'try { if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) } } finally { $dialog.Dispose(); $owner.Close(); $owner.Dispose() }',
    ].join('; ');

    return new Promise((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-STA', '-Command', script],
        { windowsHide: false },
        (error, stdout) => {
          if (error) return reject(error);
          resolve(stdout.trim());
        },
      );
    });
  };
}
