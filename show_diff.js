const { execSync } = require('child_process');
const fs = require('fs');
const out = execSync('git diff -- index.html app.js styles.css sw.js', { cwd: process.cwd() }).toString();
fs.writeFileSync('last_diff.tmp', out);
console.log('lines:', out.split('\n').length);

