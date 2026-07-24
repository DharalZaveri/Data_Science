const fs = require('fs');
let content = fs.readFileSync('./src/components/CatalogStudio.tsx', 'utf8');

// Compact POSES Setup
// 1. Find <Card className="p-6 border-2 border-slate-100 transition-all"> 
// Oh wait, `content = content.replace(/<Card className="p-6 border-2 border-slate-100 transition-all">/, ...)`
content = content.replace(
  /<Card className="p-6 border-2 border-slate-100 transition-all">/g,
  '<Card className="p-4 border transition-all bg-white shadow-sm rounded-2xl">'
);

// 2. Reduce the gap-2 grid-cols-2 to a smaller grid with height limit
content = content.replace(
  /<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 custom-scrollbar">/g,
  '<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 custom-scrollbar max-h-[140px] overflow-y-auto pr-2">'
);

// Compact Brand Settings
// Wrap inside <details>
content = content.replace(
  /<h4 className="text-\[10px\] font-black text-gray-900 uppercase tracking-widest font-sans">Brand Settings & Overlays<\/h4>/g,
  '<details className="group"><summary className="text-[10px] font-black text-gray-900 uppercase tracking-widest font-sans cursor-pointer flex justify-between items-center outline-none list-none">Brand Settings & Overlays <span className="text-[14px] leading-none group-open:rotate-45 transition-transform">+</span></summary><div className="pt-4">'
);
content = content.replace(
  /<\/Card>\s*\{\/\* FOOTER & SUBMIT \*\/\}/g,
  '</div></details></Card>\n\n              {/* FOOTER & SUBMIT */}'
);

// We need to be careful with the exact match for `</Card>`. It's better to just use string index replacement if ambiguous.
// The Brand Settings block ends right before `{/* FOOTER & SUBMIT */}` if I added it, or just before `</div>` -> `</div>` -> `{/* RIGHT SIDE END */}`. Wait, let's just make sure it's closed.

fs.writeFileSync('./src/components/CatalogStudio.tsx.fixed', content, 'utf8');
