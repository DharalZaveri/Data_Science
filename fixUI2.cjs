const fs = require('fs');
const file = 'src/components/CatalogStudio.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const padding = 20;\s*let startY = 40;/g, 
`const padding = Math.max(20, img.width * 0.02);
        let startY = padding * 2;
        const nameFontSize = Math.max(32, img.width * 0.035);
        const codeFontSize = Math.max(42, img.width * 0.05);`);

code = code.replace(/ctx.font = "bold 32px Arial";/g, 'ctx.font = `bold ${nameFontSize}px Arial`;');
code = code.replace(/ctx.font = "bold 42px Arial";/g, 'ctx.font = `bold ${codeFontSize}px Arial`;');
code = code.replace(/ctx.lineWidth = 5;/g, 'ctx.lineWidth = Math.max(5, codeFontSize * 0.12);');

code = code.replace(/startY \+ 50/g, 'startY + codeFontSize * 1.2');
code = code.replace(/padding \+ 10/g, 'padding + nameFontSize * 0.5');

fs.writeFileSync(file, code);
console.log('Watermark responsive sizing fixed');
