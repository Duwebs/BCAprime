const fs = require('fs');
for (const f of ['index.html', 'app.js', 'styles.css', 'DESIGN.md']) {
  const c = fs.readFileSync(f, 'utf8');
  console.log('---', f, '| Bricolage:', c.includes('Bricolage'), '| v42:', c.includes('styles.css?v=42'), '| IndexRegister:', c.includes('Index Register'), '| Geist:', (c.match(/Geist/g) || []).length, '| lines:', c.split('\n').length);
}
