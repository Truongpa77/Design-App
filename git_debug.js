const { execSync } = require('child_process');
const fs = require('fs');

console.log('=== DEBUG GIT STATUS & COMMITS ===');
try {
  const status = execSync('git status', { encoding: 'utf8' });
  console.log('\n--- git status ---');
  console.log(status);
} catch (e) {
  console.log('Error running git status:', e.message);
}

try {
  const log = execSync('git log -n 5 --oneline', { encoding: 'utf8' });
  console.log('\n--- git log ---');
  console.log(log);
} catch (e) {
  console.log('Error running git log:', e.message);
}

try {
  const diff = execSync('git diff', { encoding: 'utf8' });
  console.log('\n--- git diff ---');
  console.log(diff || '(no changes)');
} catch (e) {
  console.log('Error running git diff:', e.message);
}
