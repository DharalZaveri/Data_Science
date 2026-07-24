const fs = require('fs');

let content = fs.readFileSync('./src/components/CatalogStudio.tsx', 'utf8');

content = content.replace(
  `{/* Dynamic Studio Timeline */}`,
  `{/* Actions */}\n        <div className="flex items-center justify-end w-full md:w-auto">\n           <Button \n             size="sm" \n             disabled={step === 1 && (productionMode === 'single' ? garmentImages.length === 0 : batchItems.every(b => b.images.length === 0))}\n             onClick={() => setStep(2)}\n             className="h-10 px-6 rounded-lg shadow-md bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold transition-all w-full md:w-auto"\n           >\n             Proceed to Production <ChevronRight className="ml-1 w-4 h-4" />\n           </Button>\n        </div>\n\n        {/* Dynamic Studio Timeline */}`
);

// We need to alter the grid layout to take up less vertical space.
// Right now it's col-span-8 and col-span-4. Let's make it col-span-5, col-span-4, col-span-3 (3 cols)?
// Actually, moving the proceed button to the top is HUGE for distance. Let's just remove the bottom button first.
const btnRegex = /<div className="flex justify-center">\s*<Button[\s\S]*?Proceed to Production[\s\S]*?<\/Button>\s*<\/div>/;
content = content.replace(btnRegex, "");

// Changing the big grid to a 3-column layout:
// Previous:
// <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
//   <div className="xl:col-span-8 space-y-8">
//     Left content...
//   </div>
//   <div className="xl:col-span-4 space-y-6">
//     Right content (Parameters, Model, Background, Poses, Brand)
//   </div>
// </div>

// We can put Model and Background in a new middle column!
// I'll leave the columns as they are but we can make it grid-cols-12 and adjust the widths:
// Col 1: Garment (4)
// Col 2: Model & Background (4)
// Col 3: Parameters, Posings, Brand (4)

// Since AST rewriting in string replacement is tricky, let's just make it a tighter 2-column with a masonry or just smaller elements.
// Or I'll use multi_edit_file explicitly for this later if needed.

content = content.replace(/text-blue-[0-9]+/g, "text-gray-500");
content = content.replace(/border-blue-[0-9]+/g, "border-gray-200");
content = content.replace(/bg-blue-[0-9]+/g, "bg-gray-100");
content = content.replace(/ring-blue-900/g, "ring-gray-900");

// Also changing the top header "Create AI-draped model try-on images" from blue to gray
content = content.replace(/text-gray-500 font-medium">Create AI-draped/g, 'text-gray-500 font-medium">Create AI-draped');

fs.writeFileSync('./src/components/CatalogStudio.tsx', content, 'utf8');
