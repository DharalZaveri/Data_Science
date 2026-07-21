const fs = require('fs');
let content = fs.readFileSync('./src/components/CatalogStudio.tsx', 'utf8');

// 1. Reduce drag-and-drop area for Garment
content = content.replace(/min-h-\[160px\]/g, "min-h-[100px]");
content = content.replace(/py-8/g, "py-3");
content = content.replace(/max-h-\[170px\]/g, "max-h-[110px]");

// Remove Director Parameters completely as it's not strictly necessary for a simple UI
const startDirector = content.indexOf('{/* System Configurations Sidebar Settings */}');
const endDirector = content.indexOf('{/* Model Casting Reference */}');
if (startDirector !== -1 && endDirector !== -1) {
    content = content.substring(0, startDirector) + content.substring(endDirector);
}

// Wrap Poses and Typography in a single Card or native <details> HTML elements to save space
content = content.replace(/<Card className="p-5 border bg-white shadow-sm rounded-3xl">/g, '<Card className="p-4 border bg-white shadow-sm rounded-2xl">');
content = content.replace(/<Card className="p-5 border-gray-200 bg-white shadow-sm rounded-3xl">/g, '<Card className="p-4 border border-gray-200 bg-white shadow-sm rounded-2xl">');

// We also change Model Casting Reference padding
content = content.replace(/<Card className=\{cn\("p-5 border transition-all bg-white shadow-sm rounded-3xl"/g, '<Card className={cn("p-4 border transition-all bg-white shadow-sm rounded-2xl"');

fs.writeFileSync('./src/components/CatalogStudio.tsx', content, 'utf8');
