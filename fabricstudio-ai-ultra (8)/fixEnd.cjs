const fs = require('fs');
let code = fs.readFileSync('./src/components/CatalogStudio.tsx', 'utf8');

const target1 = `                          </div>
                        </div></Card></div></div>
              
            </div>
      )}

      {step === 2 && (`;

const replace1 = `                          </div>
                        </div>
                    </Card>
                </div>
              </div>
            </div>
      )}

      {step === 2 && (`;

code = code.replace(target1, replace1);
fs.writeFileSync('./src/components/CatalogStudio.tsx', code, 'utf8');
