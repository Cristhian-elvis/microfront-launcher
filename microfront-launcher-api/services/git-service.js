import { execFile } from 'node:child_process';

export function createGitService() {
  function runGit(args, cwd) {
    return new Promise((resolve, reject) => {
      execFile(
        'git',
        ['-C', cwd, ...args],
        { encoding: 'utf8', windowsHide: true },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(String(stderr || error.message).trim()));
          resolve(String(stdout || '').trim());
        },
      );
    });
  }

  return { runGit };
}
