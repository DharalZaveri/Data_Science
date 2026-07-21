const fs = require('fs');
let content = fs.readFileSync('./src/components/CatalogStudio.tsx', 'utf8');

// 1. Change the wrapper for RIGHT SIDE
content = content.replace(
  '{/* RIGHT SIDE: CONTROLS & MODEL SIDEBAR */}\n            <div className="space-y-6">',
  '{/* RIGHT SIDE: CONTROLS & MODEL SIDEBAR */}\n            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 xl:gap-6">'
);

// 2. Remove the Model Prompt Descriptions
const modelPromptStart = content.indexOf('{/* Character Guidelines Prompt */}');
const globalBackgroundStart = content.indexOf('{/* Global Background */}');
if (modelPromptStart !== -1 && globalBackgroundStart !== -1) {
  content = content.substring(0, modelPromptStart) + content.substring(globalBackgroundStart);
}

// 3. Remove dropdown for angles
content = content.replace(
  /<details className="group">[\s\n]*<summary className="[^"]*">[\s\n]*Select Default Shoot Angles <span className="[^"]*">\+<\/span>[\s\n]*<\/summary>[\s\n]*<div className="pt-4">/m,
  '<div className="flex items-center justify-between mb-4"><h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest font-sans">Select Default Shoot Angles</h4></div><div>'
);

content = content.replace(/<\/div>[\s\n]*<\/details>[\s\n]*<\/Card>[\s\n]*\{\/\* Brand Overlays & Material Swatches \*\/\}/, '</div></Card>\n\n                    {/* Brand Overlays & Material Swatches */}');

// 4. Remove dropdown for Brand Settings
content = content.replace(
  /<details className="group">[\s\n]*<summary className="[^"]*">[\s\n]*Brand Settings & Overlays <span className="[^"]*">\+<\/span>[\s\n]*<\/summary>[\s\n]*<div className="space-y-4 font-sans pt-4">/m,
  '<div className="flex items-center justify-between mb-4"><h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest font-sans">Brand Settings & Overlays</h4></div><div className="space-y-4 font-sans">'
);

content = content.replace(/<\/div>[\s\n]*<\/details>[\s\n]*<\/Card>[\s\n]*<\/div>[\s\n]*<\/div>[\s\n]*\{\/\* RIGHT SIDE END \*\/\}/m, '</div></Card>\n                </div>\n              </div>\n\n              {/* RIGHT SIDE END */}');

// Just in case that regex above didn't match the end of Brand overlays:
content = content.replace(/<\/div>\s*<\/details>\s*<\/Card>\s*<\/div>\s*<\/div>/, '</div></Card></div></div>')

fs.writeFileSync('./src/components/CatalogStudio.tsx', content, 'utf8');
