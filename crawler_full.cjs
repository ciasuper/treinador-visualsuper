const fs = require('fs');

function decodeHtml(html) {
  if (!html) return '';
  return html
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#215;/g, '×')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extrairMaterial(nome, desc, cat) {
  const combined = (nome + ' ' + desc + ' ' + cat).toLowerCase();
  if (combined.includes('petg')) return "PETG de alta transparência e flexibilidade (à prova d'água)";
  if (combined.includes('acm')) return 'ACM (Alumínio Composto) nobre e higienizável';
  if (combined.includes('inox')) return 'Aço Inox Alimentício/Cirúrgico sanitário';
  if (combined.includes('ps ') || combined.includes('poliestireno') || combined.includes('ps cristal')) return 'PS (Poliestireno) de alta resistência';
  if (combined.includes('polipropileno') || combined.includes(' pp ') || combined.includes('clip strip') || combined.includes('fita cross')) return 'Polipropileno PP flexível e reforçado';
  if (combined.includes('pvc')) return 'PVC cristal virgem com proteção anti-UV';
  if (combined.includes('acrilico') || combined.includes('acrílico')) return 'Acrílico cristal de alta transparência';
  if (combined.includes('aluminio') || combined.includes('alumínio')) return 'Alumínio anodizado resistente à corrosão';
  return 'Termoplástico de engenharia de alta durabilidade para PDV';
}

function categorizarSetor(categories, nome) {
  const cats = (categories || []).map(c => c.name.toLowerCase()).join(' ');
  const n = (nome || '').toLowerCase();
  if (cats.includes('flv') || cats.includes('hortifruti') || n.includes('hortifruti') || n.includes('flv') || n.includes('frutas')) return 'Hortifrúti / FLV';
  if (cats.includes('açougue') || cats.includes('acougue') || cats.includes('peixaria') || n.includes('açougue') || n.includes('acougue') || n.includes('peixe') || n.includes('carne')) return 'Açougue e Peixaria';
  if (cats.includes('padaria') || n.includes('pães') || n.includes('padaria') || n.includes('confeitaria')) return 'Padaria e Balcões';
  if (cats.includes('cross') || cats.includes('strip') || n.includes('clip strip') || n.includes('fita cross')) return 'Merchandising e Cross / Gôndolas';
  if (cats.includes('gondola') || cats.includes('gôndola') || n.includes('perfil') || n.includes('porta-etiqueta')) return 'Gôndolas e Prateleiras';
  if (cats.includes('pedestal') || n.includes('pedestal') || n.includes('ponta de gôndola')) return 'Pontas de Gôndola e Entrada';
  if (cats.includes('aereo') || cats.includes('aéreo') || n.includes('aéreo') || n.includes('teto') || n.includes('ilhós')) return 'Aéreo e Corredores';
  if (cats.includes('fixação') || cats.includes('fixacao') || n.includes('garra') || n.includes('presilha') || n.includes('suporte')) return 'Acessórios de Fixação';
  if (cats.includes('porta-cartaz') || n.includes('porta-cartaz') || n.includes('cartaz')) return 'Cartazes e Placas Reutilizáveis';
  return 'Precificação & PDV Visual Super';
}

function formatarPreco(prices) {
  if (!prices || !prices.price) return 'Sob consulta';
  const val = parseInt(prices.price, 10);
  if (isNaN(val) || val === 0) return 'Sob consulta';
  const minor = prices.currency_minor_unit || 2;
  const reais = (val / Math.pow(10, minor)).toFixed(2).replace('.', ',');
  return 'R$ ' + reais;
}

async function run() {
  let page = 1;
  const rawProducts = [];
  while (true) {
    const url = 'https://visualsuper.com.br/wp-json/wc/store/v1/products?per_page=100&page=' + page;
    console.log('Baixando página ' + page + '...');
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) {
      console.log('Fim das páginas ou erro HTTP:', res.status);
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    rawProducts.push(...data);
    console.log('Página ' + page + ': ' + data.length + ' produtos. Acumulado: ' + rawProducts.length);
    if (data.length < 100) break;
    page++;
  }

  console.log('Total baixados do site oficial:', rawProducts.length);

  const processados = rawProducts.map(p => {
    const nomeLimpo = decodeHtml(p.name);
    const shortDesc = decodeHtml(p.short_description);
    const fullDesc = decodeHtml(p.description);
    const catStr = (p.categories || []).map(c => c.name).join(', ');
    const descCombinada = shortDesc || fullDesc || (nomeLimpo + ' desenvolvido pela Visual Super para excelência em PDV.');
    const material = extrairMaterial(nomeLimpo, descCombinada, catStr);
    const setor = categorizarSetor(p.categories, nomeLimpo);
    const preco = formatarPreco(p.prices);
    const imgUrl = (p.images && p.images[0]) ? p.images[0].src : '';

    return {
      id: 'VS-' + p.id,
      wc_id: p.id,
      nome: nomeLimpo,
      sku: p.sku || ('VS-' + p.id),
      setor: setor,
      material: material,
      diferencial: descCombinada.slice(0, 300) + (descCombinada.length > 300 ? '...' : ''),
      preco_medio: preco,
      link_permanente: p.permalink,
      link: p.permalink,
      imagem: imgUrl,
      categorias: (p.categories || []).map(c => c.name)
    };
  });

  fs.writeFileSync('d:/teste/treinador-visualsuper/produtos_catalogo_completo.json', JSON.stringify(processados, null, 2), 'utf8');
  console.log('Salvo com sucesso em produtos_catalogo_completo.json! Total:', processados.length);
}

run();

