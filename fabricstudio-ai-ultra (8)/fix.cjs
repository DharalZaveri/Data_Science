const fs = require('fs');
const file = 'src/components/CatalogStudio.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
/const addBatchItem = \(\) => \{\n    setBatchItems\(prev => \[\.\.\.prev, \{ \n      id: `batch-\$\{Date.now\(\)\}-\$\{prev\.length\}`, \n      images: \[\], \n      modelId: allAvailableModels\[0\]\?\.id \|\| '',\n      name: `Garment \$\{prev\.length \+ 1\}`\n    \}\]\);\n  \};/g,
`  const addBatchItem = () => {
    setBatchItems(prev => [...prev, { 
      id: \`batch-\${Date.now()}-\${prev.length}\`, 
      images: [], 
      modelId: allAvailableModels[0]?.id || '',
      name: \`Garment \${prev.length + 1}\`,
      designNumber: ''
    }]);
  };`);

code = code.replace(
/setBatchItems\(prev => \[\.\.\.prev, \{\n          id: `batch-\$\{Date\.now\(\)\}-\$\{prev\.length\}-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`, \n          images: \[result\], \n          modelId: selectedModelId,\n          name: file\.name\.split\('\.'\)\[0\] \|\| `Garment \$\{prev\.length \+ 1\}`\n        \}\]\);/g,
`        setBatchItems(prev => [...prev, {
          id: \`batch-\${Date.now()}-\${prev.length}-\${Math.random().toString(36).substr(2, 9)}\`,
          images: [result],
          modelId: selectedModelId,
          name: file.name.split('.')[0] || \`Garment \${prev.length + 1}\`,
          designNumber: ''
        }]);`);

// Fix Aspect ratio rendering block
code = code.replace(
`{['1:1', '3:4', '9:16'].map(ratio => (
                   <button
                     key={ratio}
                     onClick={() => setSelectedAspectRatio(ratio)}
                     className={cn(
                       "px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all h-full flex items-center justify-center min-w-[48px]",
                       selectedAspectRatio === ratio ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-500 font-semibold"
                     )}
                   >
                     {ratio}
                   </button>
                 ))}`,
`{[ {label: '12x12 in', value: '1:1'}, {label: '8x12 in', value: '3:4'}, {label: '12x9 in', value: '4:3'} ].map(ratio => (
                   <button
                     key={ratio.value}
                     onClick={() => setSelectedAspectRatio(ratio.value)}
                     className={cn(
                       "px-3.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all h-full flex items-center justify-center min-w-[48px] whitespace-nowrap",
                       selectedAspectRatio === ratio.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-500 font-semibold"
                     )}
                   >
                     {ratio.label}
                   </button>
                 ))}`);

fs.writeFileSync(file, code);
console.log('Fixed aspect ratios and missing designNumbers on initialize');
