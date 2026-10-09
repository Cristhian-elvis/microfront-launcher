import { execFile } from 'node:child_process';

export function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      ['-C', cwd, ...args],
      { encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(String(stderr || error.message).trim()));
          return;
        }

        resolve(String(stdout || '').trim());
      },
    );
  });
}
