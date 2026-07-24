const fs = require("fs");
const path = require("path");
const traverseDirs = (dir, callback) => {
  fs.readdirSync(dir).forEach((file) => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDirs(fullPath, callback);
    } else {
      callback(fullPath);
    }
  });
};
traverseDirs("./src", (filePath) => {
  if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
    let content = fs.readFileSync(filePath, "utf8");
    let changed = false;
    const replacements = {
      "neutral-": "blue-",
      "emerald-": "yellow-",
      "amber-": "yellow-",
      "bg-[#070709]": "bg-blue-950",
      "bg-[#F7F7F8]": "bg-white",
      "bg-black": "bg-blue-900",
      "text-black": "text-blue-900",
      "border-black": "border-blue-900",
      "ring-black": "ring-blue-900"
    };
    for (const [key, value] of Object.entries(replacements)) {
      if (content.includes(key)) {
        content = content.split(key).join(value);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(filePath, content, "utf8");
    }
  }
});
