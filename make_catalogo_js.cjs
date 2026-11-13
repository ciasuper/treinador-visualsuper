const fs = require('fs');

const json = fs.readFileSync('d:/teste/treinador-visualsuper/produtos_catalogo_completo.json', 'utf8');
const prods = JSON.parse(json);

const jsContent = `// Catálogo Completo Extraído Diretamente do Site Oficial da Visual Super (328 Produtos)
var VISUAL_SUPER_PRODUTOS_COMPLETO = ${JSON.stringify(prods, null, 2)};

if (typeof window !== 'undefined') {
  window.VISUAL_SUPER_PRODUTOS_COMPLETO = VISUAL_SUPER_PRODUTOS_COMPLETO;
}
if (typeof globalThis !== 'undefined') {
  globalThis.VISUAL_SUPER_PRODUTOS_COMPLETO = VISUAL_SUPER_PRODUTOS_COMPLETO;
}
`;

fs.writeFileSync('d:/teste/treinador-visualsuper/catalogo_produtos.js', jsContent, 'utf8');
console.log('catalogo_produtos.js atualizado com sucesso! Total:', prods.length);
