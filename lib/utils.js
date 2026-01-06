const { spawn } = require('child_process');

// Safe command execution to prevent injection
function execCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
    
    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(`Command "${command}" not found. Please ensure it is installed and in your PATH.`));
      } else {
        reject(err);
      }
    });
  });
}

module.exports = {
  execCommand
};
