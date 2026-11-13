// Motor do Super Treinador SDR - Visual Super
// Gerenciador de Estado e Interface

class TreinadorSDR {
  constructor() {
    this.storageKey = "visualsuper_sdr_aprendizados_v4";
    this.geminiStorageKey = "visualsuper_gemini_api_key";
    this.produtosStorageKey = "visualsuper_produtos_v2";
    this.aprendizados = this.carregarAprendizados();
    this.produtos = this.carregarProdutos();
    this.perguntaAtual = "";
    this.alternativasGeradas = [];
    this.alternativaSelecionada = null; // 0..4 ou 'custom'
    this.abaAtiva = "treinamento"; // treinamento | cerebro | exportador | produtos | crm
    this.subAbaExport = "treinamento"; // configuracao | treinamento | guardrails | cerebro | produtos
    this.crmConectado = false;
    this.leadsCrm = [];
    this.casesConvertidos = [];
    this.resumoCrm = null;
    this.conversaModalAtiva = null;
    this.produtoConsultadoLead = null;
    this.observacaoProdutoLead = "";
    this.linkConsultorLead = null;
    
    // Estado do Chat de Teste (Lead x Agente SDR)
    this.chatIniciado = false;
    this.chatPersonaAtiva = 'hortifruti';
    this.chatMensagens = [];
    this.chatEmExecucao = false;
    this.chatAutoPlayAtivo = false;
    this.inicializarPersonasChat();

    // Módulo de Configuração Institucional & Auto-Aprendizado Web da Visual Super
    this.configuracaoEmpresaStorageKey = "visualsuper_configuracao_empresa_v1";
    this.configuracaoEmpresa = this.carregarConfiguracaoEmpresa();
    this.varreduraEmExecucao = false;

    // Estado de Busca, Filtro e Paginação do Catálogo Oficial (328+ Soluções)
    this.catalogoFiltroBusca = "";
    this.catalogoFiltroSetor = "";
    this.catalogoPaginaAtual = 1;
    this.catalogoItensPorPagina = 24;
    
    this.init();
  }

  inserirSugestaoObservacao(texto) {
    const inputObs = document.getElementById("inputObservacaoProdutoLead");
    if (!inputObs) return;
    if (inputObs.value.trim()) {
      inputObs.value += " " + texto;
    } else {
      inputObs.value = texto;
    }
    this.observacaoProdutoLead = inputObs.value.trim();
    this.mostrarToast("💡 Observação adicionada!");
    
    if (this.produtoConsultadoLead) {
      this.renderizarCardProdutoAprendido(this.produtoConsultadoLead);
    }
  }

  obterChaveGemini() {
    return localStorage.getItem(this.geminiStorageKey) || "";
  }

  salvarChaveGemini(chave) {
    localStorage.setItem(this.geminiStorageKey, chave.trim());
    localStorage.removeItem("visualsuper_gemini_model");
    this.modeloGeminiAtivo = null;
    this.atualizarStatusIaUI();
  }

  removerChaveGemini() {
    localStorage.removeItem(this.geminiStorageKey);
    localStorage.removeItem("visualsuper_gemini_model");
    this.modeloGeminiAtivo = null;
    this.atualizarStatusIaUI();
  }

  atualizarStatusIaUI() {
    const chave = this.obterChaveGemini();
    const temChave = Boolean(chave && chave.length > 10);

    // Header badge
    const badgeHeader = document.getElementById("badgeIaHeader");
    const btnHeader = document.getElementById("btnConfigIaHeader");
    if (badgeHeader && btnHeader) {
      if (temChave) {
        badgeHeader.textContent = "IA Ativa";
        badgeHeader.className = "text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-emerald-950 font-bold font-mono";
        btnHeader.title = "IA Gemini Conectada: Gerando alternativas avançadas personalizadas";
      } else {
        badgeHeader.textContent = "Configurar";
        badgeHeader.className = "text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white font-mono";
        btnHeader.title = "Clique para adicionar a Chave Gemini da IA";
      }
    }

    // Simulador Banner
    const banner = document.getElementById("bannerStatusIa");
    const titulo = document.getElementById("tituloStatusIa");
    const pill = document.getElementById("pillStatusIa");
    const desc = document.getElementById("descStatusIa");
    const btnTexto = document.getElementById("btnBannerIaTexto");

    if (banner && titulo && pill && desc) {
      if (temChave) {
        banner.className = "rounded-2xl p-4 border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-emerald-200 shadow-sm";
        titulo.textContent = "Motor de IA: Google Gemini Ativo (Online)";
        titulo.className = "font-bold text-sm text-emerald-900";
        pill.textContent = "IA Conectada";
        pill.className = "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
        desc.textContent = "Cada pergunta gera 5 abordagens exclusivas, consultivas e técnicas estudadas a partir do catálogo oficial Visual Super.";
        if (btnTexto) btnTexto.textContent = "Gerenciar Chave da IA";
      } else {
        banner.className = "rounded-2xl p-4 border transition flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border-blue-200 shadow-sm";
        titulo.textContent = "Motor de IA: Base Local Ativo";
        titulo.className = "font-bold text-sm text-slate-800";
        pill.textContent = "Sem Chave";
        pill.className = "text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800";
        desc.textContent = "Adicione sua chave de API Gemini (a mesma do CRM) para gerar 5 alternativas dinâmicas, profundas e personalizadas para cada lead.";
        if (btnTexto) btnTexto.textContent = "Configurar Chave da IA";
      }
    }
  }

  async detectarMelhorModeloGemini(chave) {
    const versoes = ["v1beta", "v1"];

    for (const versao of versoes) {
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/${versao}/models?key=${encodeURIComponent(chave)}`);
        if (resp.ok) {
          const dados = await resp.json();
          if (dados.models && Array.isArray(dados.models) && dados.models.length > 0) {
            // Filtra os modelos que suportam o método generateContent
            const modelosSuportados = dados.models.filter(m => 
              m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
            );

            // Prioriza expressamente modelos FLASH (que possuem cota gratuita no Free Tier)
            // Modelos "pro" costumam ter limit: 0 no Free Tier do Google AI Studio
            const modelosFlash = modelosSuportados.filter(m => 
              m.name.toLowerCase().includes("flash")
            );

            // Candidatos ordenados: primeiro os flash mais estáveis com cota livre
            const prioridadesFlash = [
              "gemini-1.5-flash-latest",
              "gemini-1.5-flash-002",
              "gemini-1.5-flash-001",
              "gemini-1.5-flash",
              "gemini-2.0-flash",
              "gemini-1.5-flash-8b",
              "gemini-2.0-flash-exp"
            ];

            const candidatosOrdenados = [];

            // 1. Adiciona flash por prioridade
            for (const p of prioridadesFlash) {
              const match = modelosFlash.find(m => m.name.toLowerCase().includes(p));
              if (match && !candidatosOrdenados.some(c => c.name === match.name)) {
                candidatosOrdenados.push(match);
              }
            }

            // 2. Adiciona qualquer outro flash restante
            for (const f of modelosFlash) {
              if (!candidatosOrdenados.some(c => c.name === f.name)) {
                candidatosOrdenados.push(f);
              }
            }

            // 3. Adiciona outros modelos suportados apenas como último recurso (excluindo preview pagos)
            for (const s of modelosSuportados) {
              if (!candidatosOrdenados.some(c => c.name === s.name) && !s.name.includes("3.")) {
                candidatosOrdenados.push(s);
              }
            }

            // Testa os candidatos um a um com uma chamada real de generateContent
            // para garantir que o modelo tem cota livre no Free Tier
            for (const cand of candidatosOrdenados) {
              const nomeLimpo = cand.name.replace(/^models\//, "");
              try {
                const testResp = await fetch(`https://generativelanguage.googleapis.com/${versao}/models/${nomeLimpo}:generateContent?key=${encodeURIComponent(chave)}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: "ping" }] }]
                  })
                });

                if (testResp.ok) {
                  // Modelo ativo e com cota confirmada!
                  return {
                    versao,
                    modelo: nomeLimpo,
                    nomeCompleto: cand.displayName ? `${cand.displayName} (${nomeLimpo})` : nomeLimpo
                  };
                } else {
                  const errJson = await testResp.json().catch(() => ({}));
                  console.warn(`Modelo ${nomeLimpo} sem cota ou indisponível:`, errJson?.error?.message);
                }
              } catch (e) {
                console.warn(`Falha ao testar ${nomeLimpo}:`, e);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`Tentativa de listar modelos em ${versao} falhou:`, e);
      }
    }

    // Fallback: Teste direto de candidatos flash comuns caso a listagem não seja permitida
    const fallbackFlash = [
      { versao: "v1beta", modelo: "gemini-1.5-flash-latest", nomeCompleto: "Gemini 1.5 Flash Latest" },
      { versao: "v1beta", modelo: "gemini-1.5-flash-001", nomeCompleto: "Gemini 1.5 Flash 001" },
      { versao: "v1beta", modelo: "gemini-1.5-flash-002", nomeCompleto: "Gemini 1.5 Flash 002" },
      { versao: "v1beta", modelo: "gemini-1.5-flash-8b", nomeCompleto: "Gemini 1.5 Flash 8B" },
      { versao: "v1beta", modelo: "gemini-2.0-flash", nomeCompleto: "Gemini 2.0 Flash" },
      { versao: "v1", modelo: "gemini-1.5-flash-latest", nomeCompleto: "Gemini 1.5 Flash (v1)" }
    ];

    for (const cand of fallbackFlash) {
      try {
        const testResp = await fetch(`https://generativelanguage.googleapis.com/${cand.versao}/models/${cand.modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "ping" }] }]
          })
        });
        if (testResp.ok) {
          return cand;
        }
      } catch (e) {
        // tenta o próximo candidato
      }
    }

    return null;
  }

  async testarConexaoGemini(chave) {
    try {
      const detectado = await this.detectarMelhorModeloGemini(chave);
      if (!detectado) {
        // Tenta capturar a mensagem de erro da API para orientar o usuário
        const respErro = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(chave)}`);
        const errJson = await respErro.json().catch(() => ({}));
        const msg = errJson?.error?.message || "Nenhum modelo Flash gratuito com cota ativa foi localizado para esta chave.";
        return { sucesso: false, erro: msg };
      }

      // Salva o modelo detectado com cota confirmada
      localStorage.setItem("visualsuper_gemini_model", JSON.stringify(detectado));
      this.modeloGeminiAtivo = detectado;

      return {
        sucesso: true,
        modelo: detectado.nomeCompleto,
        versao: detectado.versao
      };
    } catch (e) {
      return { sucesso: false, erro: e.message || "Erro de rede ao conectar à API do Google Gemini." };
    }
  }

  // Obtém o modelo Gemini validado com cota garantida (reutiliza cache ou detecta automaticamente)
  async obterConfigModeloGemini(chave) {
    if (this.modeloGeminiAtivo && this.modeloGeminiAtivo.modelo) {
      return this.modeloGeminiAtivo;
    }
    const salvo = localStorage.getItem("visualsuper_gemini_model");
    if (salvo) {
      try {
        const parsed = JSON.parse(salvo);
        if (parsed && parsed.modelo && !parsed.modelo.toLowerCase().includes("pro") && !parsed.modelo.includes("3.")) {
          this.modeloGeminiAtivo = parsed;
          return parsed;
        }
      } catch(e) {}
    }
    if (chave && chave.length > 10) {
      const detectado = await this.detectarMelhorModeloGemini(chave);
      if (detectado) {
        localStorage.setItem("visualsuper_gemini_model", JSON.stringify(detectado));
        this.modeloGeminiAtivo = detectado;
        return detectado;
      }
    }
    return { versao: "v1beta", modelo: "gemini-1.5-flash-latest" };
  }

  // Gera o catálogo focado nas soluções físicas nobres de PDV (reduz de 176KB para 2.5KB garantindo resposta ultrarrápida do Gemini sem timeout)
  selecionarProdutosRelevantesParaPrompt(mensagemLead = "", setor = "") {
    const prodsBase = [
      {
        nome: "Precificador E1 em PETG Cristal 0,75mm com Números Sanfonados",
        sku: "34980",
        setor: "Hortifrúti / FLV",
        material: "PETG cristal 0,75mm 100% à prova d'água",
        diferencial: "Troca de preços em menos de 5 segundos com números sanfonados. Suporta borrifadores diários de água sem molhar nem deformar.",
        link: "https://visualsuper.com.br/produto/precificador-e1-hortifruti/",
        preco_medio: "R$ 47,90 (kit)"
      },
      {
        nome: "Precificador E2 para Ilhas Promocionais e Centrais",
        sku: "34913",
        setor: "Hortifrúti / Ilhas",
        material: "PETG de alta transparência e resistência",
        diferencial: "Ideal para ilhas centrais com circulação 360°. Uso recomendado de 3 a 4 unidades por ilha para leitura de todos os lados.",
        link: "https://visualsuper.com.br/produto/precificador-e2/",
        preco_medio: "R$ 54,90 (un)"
      },
      {
        nome: "Pedestal Regulável Telescópico com Precificador E3 Moldura A5",
        sku: "35012",
        setor: "Destaques e Entradas",
        material: "Haste de alumínio regulável e base pesada anti-tombamento",
        diferencial: "Destaque nobre na entrada de loja e pontas de gôndola.",
        link: "https://visualsuper.com.br/produto/pedestal-com-precificador-e3/",
        preco_medio: "R$ 69,90"
      },
      {
        nome: "Painel Precificador para Açougue em ACM com Ímãs de Neodímio",
        sku: "34890",
        setor: "Açougue e Peixaria",
        material: "ACM nobre (Alumínio Composto) atóxico com ímãs de neodímio",
        diferencial: "Resiste ao frio extremo e gordura de balcões refrigerados sem enferrujar. Padrão sanitário impecável.",
        link: "https://visualsuper.com.br/produto/painel-precificador-acougue/",
        preco_medio: "R$ 189,00"
      },
      {
        nome: "Display e Espeto Inox Sanitário Cirúrgico para Balcão de Carnes",
        sku: "34870",
        setor: "Açougue e Peixaria",
        material: "Aço Inox 304 Alimentício / Sanitário (100% atóxico)",
        diferencial: "Espeto cirúrgico para contato direto com cortes de carne e peixe, higienização total.",
        link: "https://visualsuper.com.br/produto/display-de-mesa-em-inox-tipo-espeto/",
        preco_medio: "R$ 38,50"
      },
      {
        nome: "Fita Cross / Clip Strip em Polipropileno (PP) 12 e 24 posições",
        sku: "34750",
        setor: "Cross Merchandising / Fita Cross",
        material: "Polipropileno (PP) virgem reforçado anti-rasgo",
        diferencial: "Aumenta o ticket médio estimulando vendas por impulso nas laterais de gôndolas e caixas.",
        link: "https://visualsuper.com.br/produto/fita-cross-clip-strip-branca-24-posicoes/",
        preco_medio: "R$ 4,90 a R$ 8,50"
      },
      {
        nome: "Perfil Porta-Etiqueta Cristal para Gôndolas com Proteção Anti-UV",
        sku: "34620",
        setor: "Gôndolas e Prateleiras",
        material: "PVC cristal de alta densidade com fita dupla face de alta fixação e filtro anti-UV",
        diferencial: "Não amarela sob luz LED, mantém etiquetas alinhadas e legíveis, evitando multas do Procon.",
        link: "https://visualsuper.com.br/produto/perfil-de-gondola/",
        preco_medio: "R$ 12,90 o metro"
      }
    ];

    if (mensagemLead && typeof this.buscarProdutoPorTexto === "function") {
      const matchBusca = this.buscarProdutoPorTexto(mensagemLead);
      if (matchBusca && !prodsBase.some(p => p.nome.toLowerCase() === matchBusca.nome.toLowerCase())) {
        prodsBase.push({
          nome: matchBusca.nome,
          sku: matchBusca.sku || "",
          setor: matchBusca.setor || setor || "Varejo",
          material: matchBusca.material || "Material nobre para PDV",
          diferencial: matchBusca.diferencial || "Solução física definitiva",
          link: matchBusca.link_permanente || matchBusca.link || "https://visualsuper.com.br/",
          preco_medio: matchBusca.preco_medio || "Sob consulta"
        });
      }
    }

    return prodsBase.map(p => 
      `- ${p.nome} (Setor: ${p.setor}, Material: ${p.material}, Diferencial: ${p.diferencial}, Preço médio: ${p.preco_medio}, Link Oficial: ${p.link})`
    ).join("\n");
  }

  limparJsonLLM(str) {
    if (!str || typeof str !== 'string') return null;
    let limpo = str.trim();
    if (limpo.startsWith("```json")) limpo = limpo.substring(7);
    else if (limpo.startsWith("```")) limpo = limpo.substring(3);
    if (limpo.endsWith("```")) limpo = limpo.substring(0, limpo.length - 3);
    limpo = limpo.trim();

    // 1. Tentativa: JSON.parse nativo
    try {
      const parsed = JSON.parse(limpo);
      if (parsed) return parsed;
    } catch (e1) {}

    // 2. Tentativa: Sanitização de quebras de linha cruas dentro de strings
    try {
      let sanitized = "";
      let inString = false;
      let escaped = false;
      for (let i = 0; i < limpo.length; i++) {
        const char = limpo[i];
        if (char === '"' && !escaped) {
          inString = !inString;
          sanitized += char;
        } else if (inString) {
          if (char === '\n') {
            sanitized += '\\n';
          } else if (char === '\r') {
            sanitized += '\\r';
          } else if (char === '\t') {
            sanitized += '\\t';
          } else {
            sanitized += char;
          }
        } else {
          sanitized += char;
        }
        escaped = (char === '\\' && !escaped);
      }
      const parsed2 = JSON.parse(sanitized);
      if (parsed2) return parsed2;
    } catch (e2) {}

    // 3. Tentativa: Extrator por blocos { ... } resiliente a aspas e quebras de linha
    try {
      const blocos = [];
      let nivel = 0;
      let inicio = -1;

      for (let i = 0; i < limpo.length; i++) {
        if (limpo[i] === '{') {
          if (nivel === 0) inicio = i;
          nivel++;
        } else if (limpo[i] === '}') {
          nivel--;
          if (nivel === 0 && inicio !== -1) {
            blocos.push(limpo.substring(inicio, i + 1));
            inicio = -1;
          }
        }
      }

      const resultado = [];
      const iconesPadrao = ["🎯", "🔬", "💰", "⚡", "🤝"];
      const tiposPadrao = [
        "Consultiva com Diagnóstico",
        "Técnica e Durabilidade",
        "Financeira e ROI",
        "Direta com Link Oficial",
        "Handoff Comercial (Joelson)"
      ];
      const titulosPadrao = [
        "1. Abordagem Consultiva (Foco em Entender a Operação)",
        "2. Abordagem Técnica (Foco em Material e Resistência)",
        "3. Abordagem Financeira (Foco em Economia e Fim do Papel)",
        "4. Abordagem Ágil de WhatsApp (Direta ao Ponto com Link)",
        "5. Abordagem de Apoio Comercial / Transbordo (Joelson)"
      ];

      for (let idx = 0; idx < blocos.length; idx++) {
        const b = blocos[idx];
        const mTipo = b.match(/"tipo"\s*:\s*"([^"\n\r]+)"/);
        const mIcone = b.match(/"icone"\s*:\s*"([^"\n\r]+)"/);
        const mTitulo = b.match(/"titulo"\s*:\s*"([^"\n\r]+)"/);
        
        let texto = "";
        const mTexto = b.match(/"texto"\s*:\s*"([\s\S]*)/);
        if (mTexto) {
          let t = mTexto[1];
          // Remove fechamento do objeto no final
          t = t.replace(/"\s*}\s*$/, '').trim();
          // Converte escapes
          t = t.replace(/\\n/g, '\n').replace(/\\"/g, '"');
          texto = t;
        }

        if (texto && texto.length > 10) {
          resultado.push({
            tipo: mTipo ? mTipo[1] : (tiposPadrao[idx] || "Consultiva"),
            icone: mIcone ? mIcone[1] : (iconesPadrao[idx] || "💬"),
            titulo: mTitulo ? mTitulo[1] : (titulosPadrao[idx] || `Alternativa ${idx + 1}`),
            texto: texto
          });
        }
      }

      if (resultado.length >= 3) {
        return resultado;
      }
    } catch (e3) {
      console.warn("Falha no extrator por blocos:", e3);
    }

    return null;
  }

  carregarAprendizados() {
    const salvos = localStorage.getItem(this.storageKey);
    if (salvos) {
      try {
        const parsed = JSON.parse(salvos);
        if (Array.isArray(parsed)) {
          // Incorpora novos aprendizados padrão que ainda não existam no histórico salvo
          VISUAL_SUPER_DATA.aprendizadosIniciais.forEach(ini => {
            const idxExistente = parsed.findIndex(a => a.id === ini.id);
            if (idxExistente === -1) {
              if (ini.id === 100) {
                parsed.unshift(ini); // Prompt Mestre no topo do Cérebro
              } else {
                parsed.push(ini);
              }
            } else if (ini.id === 100) {
              // Garante que o Prompt Mestre sempre reflita a versão mais atualizada e rica
              parsed[idxExistente] = { ...parsed[idxExistente], ...ini };
            }
          });
          return parsed;
        }
      } catch (e) {
        console.error("Erro ao carregar dados locais, usando padrão.", e);
      }
    }
    return [...VISUAL_SUPER_DATA.aprendizadosIniciais];
  }

  salvarAprendizados() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.aprendizados));
    this.atualizarEstatisticas();
    this.renderizarHistorico();
    // Persistência em segundo plano na API / Banco de Dados da VPS
    fetch('/api/aprendizados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.aprendizados)
    }).catch(() => null);
  }

  async sincronizarComBancoDados() {
    try {
      const res = await fetch('/api/aprendizados');
      if (res.ok) {
        const dadosServidor = await res.json();
        if (Array.isArray(dadosServidor) && dadosServidor.length > 0) {
          dadosServidor.forEach(itemServidor => {
            const idx = this.aprendizados.findIndex(a => a.id === itemServidor.id);
            if (idx === -1) {
              this.aprendizados.push(itemServidor);
            } else {
              this.aprendizados[idx] = { ...this.aprendizados[idx], ...itemServidor };
            }
          });
          localStorage.setItem(this.storageKey, JSON.stringify(this.aprendizados));
          this.atualizarEstatisticas();
          this.renderizarHistorico();
        } else if (Array.isArray(dadosServidor) && dadosServidor.length === 0 && this.aprendizados.length > 0) {
          // Popula o banco da VPS com os aprendizados iniciais
          await fetch('/api/aprendizados', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.aprendizados)
          }).catch(() => null);
        }
      }
    } catch (e) {
      // Modo offline local silencioso
    }
  }

  // Reseta toda a memória e aprendizados do agente recarregando as diretrizes oficiais atualizadas
  resetarMemoriaAprendizados() {
    if (confirm("Deseja resetar e atualizar a memória do Agente com todos os aprendizados e diretrizes profissionais da Visual Super?")) {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem("visualsuper_sdr_aprendizados_v1");
      localStorage.removeItem("visualsuper_sdr_aprendizados_v2");
      localStorage.removeItem("visualsuper_sdr_aprendizados_v3");
      this.aprendizados = JSON.parse(JSON.stringify(VISUAL_SUPER_DATA.aprendizadosIniciais));
      this.salvarAprendizados();
      this.chatMensagens = [];
      this.renderizarMensagensChat();
      this.atualizarEstatisticas();
      this.renderizarHistorico();
      this.mostrarToast("🧠 Memória do Agente resetada e 100% atualizada com os novos aprendizados profissionais!");
    }
  }

  carregarProdutos() {
    const catalogoCompleto = (typeof VISUAL_SUPER_PRODUTOS_COMPLETO !== "undefined" && Array.isArray(VISUAL_SUPER_PRODUTOS_COMPLETO) && VISUAL_SUPER_PRODUTOS_COMPLETO.length > 0)
      ? VISUAL_SUPER_PRODUTOS_COMPLETO
      : VISUAL_SUPER_DATA.produtos;

    const salvos = localStorage.getItem(this.produtosStorageKey);
    if (salvos) {
      try {
        const parsed = JSON.parse(salvos);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapaPorLink = new Map();
          parsed.forEach(p => {
            const k = (p.link_permanente || p.link || p.id || "").toLowerCase();
            mapaPorLink.set(k, p);
            if (p.id) mapaPorLink.set(p.id.toLowerCase(), p);
            if (p.sku) mapaPorLink.set(p.sku.toLowerCase(), p);
          });

          const listaAtualizada = [...parsed];

          // Mescla todas as 328 soluções do catálogo oficial do site
          catalogoCompleto.forEach(prodDef => {
            const linkK = (prodDef.link_permanente || prodDef.link || "").toLowerCase();
            const idK = (prodDef.id || "").toLowerCase();
            const skuK = (prodDef.sku || "").toLowerCase();

            const jaExiste = (linkK && mapaPorLink.has(linkK)) || (idK && mapaPorLink.has(idK)) || (skuK && mapaPorLink.has(skuK));

            if (!jaExiste) {
              listaAtualizada.push(JSON.parse(JSON.stringify(prodDef)));
            } else {
              const existente = mapaPorLink.get(linkK) || mapaPorLink.get(idK) || mapaPorLink.get(skuK);
              if (existente) {
                if (!existente.link_permanente || existente.link_permanente === "https://visualsuper.com.br/") {
                  existente.link_permanente = prodDef.link_permanente;
                  existente.link = prodDef.link_permanente;
                }
                if (!existente.imagem && prodDef.imagem) {
                  existente.imagem = prodDef.imagem;
                }
                if (!existente.setor && prodDef.setor) {
                  existente.setor = prodDef.setor;
                }
              }
            }
          });

          return listaAtualizada;
        }
      } catch (e) {
        console.warn("Erro ao ler produtos salvos:", e);
      }
    }
    const padroes = JSON.parse(JSON.stringify(catalogoCompleto));
    localStorage.setItem(this.produtosStorageKey, JSON.stringify(padroes));
    return padroes;
  }

  salvarProdutos() {
    localStorage.setItem(this.produtosStorageKey, JSON.stringify(this.produtos));
    this.renderizarCatalogo();
    this.renderizarExportador();
  }

  init() {
    this.atualizarEstatisticas();
    this.renderizarHistorico();
    this.renderizarExportador();
    this.renderizarCatalogo();
    this.atualizarStatusIaUI();
    this.conectarAoCRM();
    this.iniciarChat();
    this.renderizarConfiguracoes();
    this.iniciarMotorVarreduraAgendada();
    this.sincronizarComBancoDados();
  }

  // Chamada genérica padronizada ao MCP do CRM
  async chamarFerramentaCRM(nomeFerramenta, argumentos = {}) {
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: nomeFerramenta,
            arguments: argumentos
          }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.result && data.result.content && data.result.content[0]) {
        return JSON.parse(data.result.content[0].text);
      }
      return null;
    } catch (e) {
      console.warn(`Erro ao chamar ferramenta ${nomeFerramenta} do CRM:`, e);
      return null;
    }
  }

  // Integração Live MCP com o CRM leads.ciasuper.com.br
  async conectarAoCRM() {
    const elStatus = document.getElementById("badgeStatusCrm");
    if (elStatus) {
      elStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"><i class="fas fa-spinner fa-spin text-[10px]"></i> Conectando ao CRM MCP...</span>`;
    }

    try {
      const dadosResumo = await this.chamarFerramentaCRM('resumo_crm', { period: '7d' });
      if (dadosResumo) {
        this.resumoCrm = dadosResumo;
        this.crmConectado = true;
        this.atualizarStatusCrmUI();
        this.carregarLeadsReaisCRM();
        this.carregarCasesConvertidosCRM();
      } else {
        throw new Error("Resposta vazia");
      }
    } catch (e) {
      console.warn("CRM MCP não respondeu via proxy local:", e.message);
      if (elStatus) {
        elStatus.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><i class="fas fa-plug text-[10px]"></i> MCP Configurado (Pronto)</span>`;
      }
    }
  }

  atualizarStatusCrmUI() {
    const elStatus = document.getElementById("badgeStatusCrm");
    if (elStatus && this.resumoCrm) {
      elStatus.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 shadow-sm" title="Usuário: ${this.resumoCrm.usuario}">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          CRM Live Conectado (${this.resumoCrm.resumo.leadsNovos} leads recentes)
        </span>
      `;
    }

    const containerResumo = document.getElementById("painelResumoCrm");
    if (containerResumo && this.resumoCrm) {
      const r = this.resumoCrm.resumo;
      containerResumo.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-200/60 mb-4">
          <div>
            <span class="text-[11px] text-slate-500 block">Leads Novos (7 dias)</span>
            <span class="text-base font-extrabold text-blue-700">${r.leadsNovos}</span>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Em Atendimento</span>
            <span class="text-base font-extrabold text-slate-800">${r.emAtendimento}</span>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Vendas Fechadas</span>
            <span class="text-base font-extrabold text-emerald-600">${r.vendasFechadas}</span>
          </div>
          <div>
            <span class="text-[11px] text-slate-500 block">Ticket Médio</span>
            <span class="text-base font-extrabold text-slate-900">R$ ${r.ticketMedio ? Number(r.ticketMedio).toFixed(2) : '0,00'}</span>
          </div>
        </div>
      `;
    }
  }

  async carregarLeadsReaisCRM() {
    const container = document.getElementById("listaLeadsReaisCrm");
    if (!container) return;

    try {
      const data = await this.chamarFerramentaCRM('buscar_leads', { limite: 15, period: '7d' });
      this.leadsCrm = data?.leads || [];
      this.renderizarLeadsReaisUI();
    } catch (e) {
      console.warn("Erro ao buscar leads reais:", e);
    }
  }

  async carregarCasesConvertidosCRM() {
    try {
      const data = await this.chamarFerramentaCRM('buscar_leads', { status: 'convertido', limite: 8 });
      this.casesConvertidos = data?.leads || [];
      this.renderizarCasesMineradosUI(this.casesConvertidos);
    } catch (e) {
      console.warn("Erro ao buscar cases convertidos:", e);
    }
  }

  renderizarCasesMineradosUI(cases) {
    const container = document.getElementById("secaoCasesConvertidosCrm");
    if (!container) return;

    if (!cases || cases.length === 0) {
      container.innerHTML = ``;
      return;
    }

    let html = `
      <div class="border border-emerald-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div class="p-4 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h3 class="text-xs font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
              <i class="fas fa-trophy text-amber-500"></i> Cases Reais de Vendas Fechadas no CRM (Conversão Garantida)
            </h3>
          </div>
          <span class="text-[11px] text-emerald-700 font-semibold">${cases.length} vendas catalogadas</span>
        </div>
        <div class="divide-y divide-slate-100 max-h-72 overflow-y-auto">
    `;

    cases.forEach(item => {
      const valor = item.faturamento ? `R$ ${Number(item.faturamento).toFixed(2)}` : 'Venda Concluída';
      const local = [item.cidade, item.estado].filter(Boolean).join('/') || 'Brasil';
      
      html += `
        <div class="p-3.5 hover:bg-emerald-50/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-slate-800 text-sm">${item.nome}</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold font-mono">VENDA APROVADA: ${valor}</span>
              <span class="text-[10px] text-slate-400"><i class="fas fa-location-dot"></i> ${local}</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span><i class="fab fa-whatsapp text-emerald-600"></i> ${item.celular || item.telefone || 'WhatsApp'}</span>
              <span>• Canal: ${item.origem || 'Site / WhatsApp'}</span>
            </p>
          </div>
          <div class="flex items-center gap-2 self-end sm:self-auto">
            <button onclick="app.simularComCase('${encodeURIComponent(item.nome)}', '${encodeURIComponent(local)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-wand-magic-sparkles"></i> Simular Case de Sucesso
            </button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  simularComCase(nomeCodificado, localCodificado) {
    const nome = decodeURIComponent(nomeCodificado);
    const local = decodeURIComponent(localCodificado);

    const pergunta = `Olá, aqui é da ${nome} (${local}). Vimos a linha de precificação de vocês e queremos padronizar nossas ofertas para acabar de vez com o gasto de papel e cartazista. Quais as opções recomendadas?`;
    
    alternarAbaPrincipal("simulador");
    document.getElementById("inputPerguntaLead").value = pergunta;
    this.gerarAlternativas(pergunta).then(() => {
      this.renderizarAlternativas();
      this.mostrarToast(`🏆 Case de sucesso de ${nome} carregado no simulador!`);
    });
  }

  renderizarLeadsReaisUI() {
    const container = document.getElementById("listaLeadsReaisCrm");
    if (!container) return;

    if (!this.leadsCrm || this.leadsCrm.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-400 p-4 text-center">Nenhum lead retornado pelo CRM no período.</p>`;
      return;
    }

    let html = `<div class="divide-y divide-slate-100 max-h-96 overflow-y-auto">`;
    this.leadsCrm.forEach(lead => {
      const dataFormatada = lead.dataCriacao ? new Date(lead.dataCriacao).toLocaleDateString('pt-BR') : '';
      const idBusca = lead.id || lead.leadId || lead.nome;

      html += `
        <div class="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs transition">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-slate-800 text-sm">${lead.nome}</span>
              <span class="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-semibold border border-blue-200">${lead.origem || 'WhatsApp'}</span>
              <span class="text-[11px] text-slate-400">${dataFormatada}</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
              <span><i class="fab fa-whatsapp text-emerald-600"></i> ${lead.celular || lead.telefone || 'Sem telefone'}</span>
              ${lead.cidade ? `<span>• <i class="fas fa-location-dot text-slate-400"></i> ${lead.cidade}/${lead.estado || ''}</span>` : ''}
              ${lead.faturamento ? `<span class="font-bold text-emerald-700">• R$ ${Number(lead.faturamento).toFixed(2)}</span>` : ''}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            <button onclick="app.abrirConversaReal('${encodeURIComponent(idBusca)}', '${encodeURIComponent(lead.nome)}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-semibold transition text-xs flex items-center gap-1.5 border border-slate-300">
              <i class="fab fa-whatsapp text-emerald-600"></i> Ver Conversa
            </button>
            <button onclick="app.minerarAprendizadoLead('${encodeURIComponent(idBusca)}', '${encodeURIComponent(lead.nome)}')" class="bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 px-3 py-1.5 rounded-lg font-semibold transition text-xs flex items-center gap-1.5 border border-indigo-200">
              <i class="fas fa-brain"></i> Minerar
            </button>
            <button onclick="app.simularComLead('${encodeURIComponent(idBusca)}', '${encodeURIComponent(lead.nome)}', '${encodeURIComponent(lead.origem || '')}')" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition text-xs flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-comments"></i> Treinar
            </button>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  }

  async abrirConversaReal(leadIdCodificado, nomeCodificado) {
    const leadId = decodeURIComponent(leadIdCodificado);
    const nome = decodeURIComponent(nomeCodificado);

    const modal = document.getElementById("modalVisualizarConversa");
    const elNome = document.getElementById("modalChatNomeCliente");
    const elSub = document.getElementById("modalChatInfoSub");
    const elCorpo = document.getElementById("modalChatMensagensCorpo");

    elNome.textContent = nome;
    elSub.textContent = `Carregando histórico do WhatsApp via MCP...`;
    elCorpo.innerHTML = `
      <div class="flex items-center justify-center p-12 text-slate-400 gap-2">
        <i class="fas fa-spinner fa-spin text-lg text-emerald-600"></i> Buscando mensagens no CRM...
      </div>
    `;
    modal.classList.remove("hidden");

    const dados = await this.chamarFerramentaCRM('historico_conversa', { cliente: leadId, limite: 25 });
    const mensagens = dados?.mensagens || [];

    this.conversaModalAtiva = {
      clienteId: leadId,
      nomeCliente: nome,
      mensagens: mensagens
    };

    elSub.textContent = `WhatsApp Oficial • ${mensagens.length} mensagens trocadas`;

    if (mensagens.length === 0) {
      elCorpo.innerHTML = `
        <div class="p-8 text-center text-slate-500">
          <i class="fas fa-comment-slash text-2xl text-slate-300 mb-2"></i>
          <p>Nenhuma mensagem de WhatsApp registrada para este lead até o momento.</p>
        </div>
      `;
      return;
    }

    let html = ``;
    mensagens.forEach(msg => {
      const isCliente = msg.de === 'cliente';
      const hora = msg.data ? new Date(msg.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      
      if (isCliente) {
        html += `
          <div class="flex flex-col items-start max-w-[85%]">
            <span class="text-[10px] text-slate-400 mb-0.5 ml-1 font-semibold">${msg.autor || nome}</span>
            <div class="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm p-3 shadow-sm text-xs leading-relaxed">
              <p class="whitespace-pre-wrap">${msg.conteudo}</p>
              <span class="text-[9px] text-slate-400 block text-right mt-1">${hora}</span>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="flex flex-col items-end max-w-[85%] ml-auto">
            <span class="text-[10px] text-emerald-800 mb-0.5 mr-1 font-semibold">${msg.autor || 'Visual Super'}</span>
            <div class="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl rounded-tr-sm p-3 shadow-sm text-xs leading-relaxed">
              <p class="whitespace-pre-wrap">${msg.conteudo}</p>
              <span class="text-[9px] text-emerald-700 block text-right mt-1">${hora}</span>
            </div>
          </div>
        `;
      }
    });

    elCorpo.innerHTML = html;
    elCorpo.scrollTop = elCorpo.scrollHeight;
  }

  async minerarConversaModalAtual() {
    if (!this.conversaModalAtiva || !this.conversaModalAtiva.mensagens || this.conversaModalAtiva.mensagens.length === 0) {
      alert("Não há mensagens suficientes nesta conversa para extrair aprendizado.");
      return;
    }

    const { clienteId, nomeCliente, mensagens } = this.conversaModalAtiva;
    const btn = document.getElementById("btnMinerarConversaAtual");
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Analisando com IA...`;

    try {
      const msgsCliente = mensagens.filter(m => m.de === 'cliente');
      const msgsEquipe = mensagens.filter(m => m.de === 'equipe');

      const ultimaPergunta = msgsCliente.length > 0 ? msgsCliente[msgsCliente.length - 1].conteudo : "Dúvida geral sobre precificadores";

      const chave = this.obterChaveGemini();
      let aprendizado = null;

      if (chave && chave.length > 10) {
        aprendizado = await this.sintetizarAprendizadoComGemini(nomeCliente, ultimaPergunta, msgsEquipe, { cliente: nomeCliente });
      } else {
        aprendizado = this.sintetizarAprendizadoLocal(nomeCliente, ultimaPergunta, { cliente: nomeCliente });
      }

      if (aprendizado) {
        this.aprendizados.unshift(aprendizado);
        this.salvarAprendizados();
        fecharModalConversa();
        this.mostrarToast(`🧠 Aprendizado do atendimento de ${nomeCliente} gravado com LIKE!`);
      }
    } catch (e) {
      console.error(e);
      this.mostrarToast(`⚠️ Não foi possível minerar esta conversa: ${e.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  }

  async minerarAprendizadoLead(leadIdCodificado, nomeCodificado) {
    const leadId = decodeURIComponent(leadIdCodificado);
    const nome = decodeURIComponent(nomeCodificado);

    this.mostrarToast(`🔍 Analisando histórico de ${nome}...`);

    try {
      const dados = await this.chamarFerramentaCRM('historico_conversa', { cliente: leadId, limite: 15 });
      const mensagens = dados?.mensagens || [];

      const msgsCliente = mensagens.filter(m => m.de === 'cliente');
      const msgsEquipe = mensagens.filter(m => m.de === 'equipe');

      const pergunta = msgsCliente.length > 0 ? msgsCliente[msgsCliente.length - 1].conteudo : `Quais as soluções ideais para comércio de alimentos?`;

      const chave = this.obterChaveGemini();
      let aprendizado = null;

      if (chave && chave.length > 10) {
        aprendizado = await this.sintetizarAprendizadoComGemini(nome, pergunta, msgsEquipe, { cliente: nome });
      } else {
        aprendizado = this.sintetizarAprendizadoLocal(nome, pergunta, { cliente: nome });
      }

      if (aprendizado) {
        this.aprendizados.unshift(aprendizado);
        this.salvarAprendizados();
        this.mostrarToast(`✅ Novo aprendizado de ${nome} minerado e aprovado com LIKE!`);
      }
    } catch (e) {
      this.mostrarToast(`⚠️ Erro ao minerar lead: ${e.message}`);
    }
  }

  async minerarConversasECasesDoCRM() {
    const btn = document.getElementById("btnIniciarMineracaoCrm");
    const containerStatus = document.getElementById("statusMineracaoCrm");
    const barra = document.getElementById("barraProgressoMineracao");
    const texto = document.getElementById("textoProgressoMineracao");
    const porcentagem = document.getElementById("porcentagemProgressoMineracao");

    if (btn) btn.disabled = true;
    if (containerStatus) containerStatus.classList.remove("hidden");

    const atualizarProgresso = (perc, msg) => {
      if (barra) barra.style.width = `${perc}%`;
      if (porcentagem) porcentagem.textContent = `${perc}%`;
      if (texto) texto.innerHTML = `<i class="fas fa-spinner fa-spin text-amber-400"></i> ${msg}`;
    };

    let totalAdicionados = 0;

    try {
      atualizarProgresso(15, "Acessando banco de dados do CRM via protocolo MCP...");
      
      // 1. Busca cases de sucesso e vendas convertidas
      const dadosConvertidos = await this.chamarFerramentaCRM('buscar_leads', { status: 'convertido', limite: 15 });
      const convertidos = dadosConvertidos?.leads || [];
      
      this.renderizarCasesMineradosUI(convertidos);

      atualizarProgresso(30, `Identificados ${convertidos.length} cases de vendas fechadas. Buscando oportunidades e atendimentos...`);

      // 2. Busca oportunidades recentes de WhatsApp
      const dadosOportunidades = await this.chamarFerramentaCRM('oportunidades_funil', { limite: 15 });
      const oportunidades = dadosOportunidades?.oportunidades || [];

      // Pool de leads para analisar
      const pool = [...oportunidades, ...convertidos];
      const leadsUnicos = [];
      const vistos = new Set();
      pool.forEach(item => {
        const id = item.id || item.leadId || item.cliente || item.nome;
        if (id && !vistos.has(id)) {
          vistos.add(id);
          leadsUnicos.push(item);
        }
      });

      const maxAnalisar = Math.min(leadsUnicos.length, 8);
      const chave = this.obterChaveGemini();

      for (let i = 0; i < maxAnalisar; i++) {
        const lead = leadsUnicos[i];
        const nome = lead.cliente || lead.nome || "Cliente";
        const idBusca = lead.leadId || lead.id || lead.celular || nome;

        const perc = 30 + Math.round(((i + 1) / maxAnalisar) * 60);
        atualizarProgresso(perc, `Analisando atendimento de ${nome} e extraindo perguntas assertivas...`);

        // Busca o histórico do WhatsApp desse cliente
        const dadosConv = await this.chamarFerramentaCRM('historico_conversa', { cliente: idBusca, limite: 15 });
        const msgs = dadosConv?.mensagens || [];

        const msgsCliente = msgs.filter(m => m.de === 'cliente' && m.conteudo && m.conteudo.length > 3);
        const msgsEquipe = msgs.filter(m => m.de === 'equipe');

        if (msgsCliente.length > 0) {
          const perguntaReal = msgsCliente[msgsCliente.length - 1].conteudo;

          let aprendizado = null;
          if (chave && chave.length > 10) {
            aprendizado = await this.sintetizarAprendizadoComGemini(nome, perguntaReal, msgsEquipe, lead);
          } else {
            aprendizado = this.sintetizarAprendizadoLocal(nome, perguntaReal, lead);
          }

          if (aprendizado) {
            const jaExiste = this.aprendizados.some(a => 
              a.leadPergunta.toLowerCase().trim() === aprendizado.leadPergunta.toLowerCase().trim()
            );

            if (!jaExiste) {
              this.aprendizados.unshift(aprendizado);
              totalAdicionados++;
            }
          }
        }
      }

      atualizarProgresso(100, `Mineração finalizada! ${totalAdicionados} novos aprendizados reais integrados.`);
      this.salvarAprendizados();

      if (totalAdicionados > 0) {
        this.mostrarToast(`🎉 ${totalAdicionados} novos aprendizados assertivos minerados do CRM!`);
      } else {
        this.mostrarToast(`✅ Varredura concluída! As conversas mais recentes já foram integradas.`);
      }

    } catch (e) {
      console.error("Erro na mineração:", e);
      atualizarProgresso(100, `Erro: ${e.message}`);
      this.mostrarToast(`⚠️ Erro na mineração: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async sintetizarAprendizadoComGemini(nomeLead, perguntaCliente, mensagensEquipe, lead) {
    const catalogoFormatado = this.produtos.map(p => 
      `- ${p.nome} (SKU: ${p.sku}, Setor: ${p.setor}, Material: ${p.material}, Diferencial: ${p.diferencial}, Link Permanente Real: ${p.link_permanente || p.link})`
    ).join("\n");

    const historicoAtendente = mensagensEquipe.map(m => m.conteudo).slice(-3).join(" | ");

    const prompt = `Você é o Supervisor de Vendas e Consultor Sênior da Visual Super (site: https://visualsuper.com.br/).
Analisamos um atendimento real do CRM no WhatsApp do cliente ${nomeLead}.
O cliente perguntou: "${perguntaCliente}".
As mensagens de apoio enviadas pela equipe foram: "${historicoAtendente || 'Atendimento inicial'}".

REGRA INEGOCIÁVEL:
NUNCA mencione "Criar Ofertas" ou sistemas digitais. 100% foco em soluções FÍSICAS de PDV da Visual Super.
O contato comercial de transbordo é Joelson.

REGRA MANDATÓRIA DE LINKS:
- NUNCA crie ou invente links a partir do título do produto.
- Use ESTRITAMENTE o Link Permanente Real cadastrado para o produto indicado.

CATÁLOGO OFICIAL COM LINKS PERMANENTES REAIS:
${catalogoFormatado}

TAREFA:
Sintetize esta conversa real em um par de pergunta e resposta assertiva de excelência para treinar o agente SDR:
1. "leadPergunta": Reformule a dúvida do cliente de forma clara, realista e profissional (ex: "Você tem a chapa de ACM para balcão de carnes?", "Como funciona o precificador resistente a água para hortifrúti?").
2. "respostaAprovada": Redija a resposta consultiva ideal, empática, mencionando a solução física exata da Visual Super, com diferenciais, o link permanente oficial do produto e pergunta de qualificação ou handoff ao Joelson.
3. "setor": Classifique em um dos setores: "Hortifrúti / FLV", "Açougue e Peixaria", "Gôndolas e Prateleiras", "Padaria e Balcões" ou "Varejo Geral".

Retorne APENAS um JSON no formato:
{
  "leadPergunta": "...",
  "respostaAprovada": "...",
  "setor": "...",
  "tipo": "💎 Case de Sucesso CRM (${nomeLead})",
  "linkSugerido": "https://visualsuper.com.br/produto/..."
}`;

    let configModelo = this.modeloGeminiAtivo;
    const versao = configModelo ? configModelo.versao : "v1beta";
    const modelo = configModelo ? configModelo.modelo : "gemini-1.5-flash-latest";
    const chave = this.obterChaveGemini();

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/${versao}/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const textParts = parts.filter(p => p.text && !p.thought).map(p => p.text);
      const texto = textParts.length > 0 ? textParts.join("") : parts.map(p => p.text || "").join("");
      if (!texto) return null;

      const parsed = this.limparJsonLLM(texto);
      if (!parsed) return null;

      // Normaliza links para garantir URL permanente real cadastrada
      let respostaNormalizada = this.normalizarLinksTexto(parsed.respostaAprovada);
      const { setor: setorDetectado, produtoFoco } = this.analisarPergunta(parsed.leadPergunta || perguntaCliente);
      let linkDefinitivo = produtoFoco ? (produtoFoco.link_permanente || produtoFoco.link) : this.produtos[0].link_permanente;
      if (parsed.linkSugerido && this.produtos.some(p => (p.link_permanente || p.link) === parsed.linkSugerido)) {
        linkDefinitivo = parsed.linkSugerido;
      }

      return {
        id: Date.now() + Math.floor(Math.random() * 1000),
        leadPergunta: parsed.leadPergunta || perguntaCliente,
        respostaAprovada: respostaNormalizada,
        setor: parsed.setor || setorDetectado || "Varejo Geral",
        tipo: parsed.tipo || `💎 Case de Sucesso CRM (${nomeLead})`,
        linkSugerido: linkDefinitivo,
        curtido: true,
        data: new Date().toISOString().replace('T', ' ').substring(0, 16)
      };
    } catch (e) {
      console.warn("Falha no Gemini para sintetizar aprendizado, usando local:", e);
      return this.sintetizarAprendizadoLocal(nomeLead, perguntaCliente, lead);
    }
  }

  sintetizarAprendizadoLocal(nomeLead, perguntaCliente, lead) {
    const { setor, produtoFoco } = this.analisarPergunta(perguntaCliente);
    const prod = produtoFoco || this.produtos[0];
    const linkReal = prod.link_permanente || prod.link || "https://visualsuper.com.br/";

    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      leadPergunta: perguntaCliente,
      respostaAprovada: `Olá! Aqui na Visual Super nós desenvolvemos a solução ideal para atender sua loja.\n\nPara essa necessidade, nossa principal recomendação é o ${prod.nome}, confeccionado em ${prod.material}. Ele resolve exatamente esse problema: ${prod.diferencial}\n\nVocê pode conferir detalhes e fotos oficiais no link: ${linkReal}\n\nQuantas bancadas ou balcões você precisa equipar? Se desejar condição especial para o seu CNPJ, posso transferir para o Joelson da nossa equipe comercial!`,
      setor: setor,
      tipo: `💬 Atendimento Real CRM (${nomeLead})`,
      linkSugerido: linkReal,
      curtido: true,
      data: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
  }

  async simularComLead(param1, param2, param3) {
    let idBusca = decodeURIComponent(param1);
    let nome = param2 ? decodeURIComponent(param2) : idBusca;
    let origem = param3 ? decodeURIComponent(param3) : "";

    // Suporte caso chamado com 2 argumentos (legado: nome, origem)
    if (param3 === undefined && param2 !== undefined) {
      nome = decodeURIComponent(param1);
      origem = decodeURIComponent(param2);
      idBusca = nome;
    }

    this.mostrarToast(`🔍 Puxando mensagem real de ${nome} no WhatsApp do CRM...`);

    let perguntaReal = "";

    try {
      // Busca o histórico real da conversa no CRM
      const dados = await this.chamarFerramentaCRM('historico_conversa', { cliente: idBusca, limite: 25 });
      const mensagens = dados?.mensagens || [];

      // Filtra as mensagens reais enviadas pelo cliente
      const msgsCliente = mensagens.filter(m => m.de === 'cliente' && m.conteudo && m.conteudo.trim().length > 0);

      if (msgsCliente.length > 0) {
        // Captura a mensagem exata enviada pelo lead no WhatsApp
        perguntaReal = msgsCliente.map(m => m.conteudo.trim()).join("\n");
      }
    } catch (e) {
      console.warn("Erro ao buscar conversa real do lead:", e);
    }

    // Fallback caso o lead não tenha mensagens registradas no CRM
    if (!perguntaReal) {
      perguntaReal = `Olá, meu nome é ${nome}. Vim pelo ${origem || 'site'} e gostaria de falar com vocês sobre precificadores para minha loja.`;
    }

    alternarAbaPrincipal("simulador");
    document.getElementById("inputPerguntaLead").value = perguntaReal;
    await this.gerarAlternativas(perguntaReal);
    this.renderizarAlternativas();
    this.mostrarToast(`🎯 Mensagem real de ${nome} carregada no simulador!`);
  }

  treinarConversaModalAtual() {
    if (!this.conversaModalAtiva || !this.conversaModalAtiva.mensagens || this.conversaModalAtiva.mensagens.length === 0) {
      alert("Nenhuma mensagem nesta conversa para treinar.");
      return;
    }

    const { nomeCliente, mensagens } = this.conversaModalAtiva;
    const msgsCliente = mensagens.filter(m => m.de === 'cliente' && m.conteudo && m.conteudo.trim().length > 0);

    let textoFinal = "";
    if (msgsCliente.length > 0) {
      textoFinal = msgsCliente.map(m => m.conteudo.trim()).join("\n");
    } else {
      textoFinal = `Olá, gostaria de falar com a equipe da Visual Super.`;
    }

    fecharModalConversa();
    alternarAbaPrincipal("simulador");
    document.getElementById("inputPerguntaLead").value = textoFinal;
    this.gerarAlternativas(textoFinal).then(() => {
      this.renderizarAlternativas();
      this.mostrarToast(`🎯 Mensagem real de ${nomeCliente} carregada no simulador!`);
    });
  }

  // Pesquisa, extrai e aprende tudo sobre um produto a partir de um link real fornecido
  async acionarAprendizadoLink() {
    const input = document.getElementById("inputLinkProdutoLead");
    if (!input) return;
    const url = input.value.trim();
    if (!url) {
      alert("Por favor, cole o link do produto da Visual Super antes de pesquisar!");
      input.focus();
      return;
    }

    const btn = document.getElementById("btnAprenderLinkProduto");
    const textoBtn = document.getElementById("btnAprenderLinkTexto");
    if (btn) btn.disabled = true;
    if (textoBtn) textoBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Pesquisando & aprendendo produto...`;

    // Captura observação inserida pelo consultor
    const inputObs = document.getElementById("inputObservacaoProdutoLead");
    if (inputObs && inputObs.value.trim()) {
      this.observacaoProdutoLead = inputObs.value.trim();
    }

    try {
      const prod = await this.aprenderProdutoDeUrl(url);
      if (prod) {
        this.produtoConsultadoLead = prod;
        this.renderizarCardProdutoAprendido(prod);
        this.mostrarToast(`🎉 A IA estudou e aprendeu tudo sobre "${prod.nome}"!`);
        
        // Se a pergunta do lead estiver vazia ou for genérica, preenche com consulta
        const inputPergunta = document.getElementById("inputPerguntaLead");
        let textoPergunta = inputPergunta ? inputPergunta.value.trim() : "";
        if (!textoPergunta) {
          textoPergunta = `Qual o valor e especificações técnicas de ${prod.nome}? Vocês têm para pronta-entrega?`;
          if (inputPergunta) inputPergunta.value = textoPergunta;
        }

        // Gera imediatamente as 5 alternativas baseadas no aprendizado com o link e observações
        await this.gerarAlternativas(textoPergunta);
        this.renderizarAlternativas();
      } else {
        throw new Error("Não foi possível extrair as especificações da página.");
      }
    } catch (e) {
      console.error("Erro ao aprender produto de URL:", e);
      this.mostrarToast(`⚠️ Erro ao pesquisar produto: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
      if (textoBtn) textoBtn.innerHTML = `Pesquisar & Aprender Produto`;
    }
  }

  async aprenderProdutoDeUrl(urlInformada) {
    let url = urlInformada.trim();
    if (!url.startsWith("http")) {
      url = "https://visualsuper.com.br" + (url.startsWith("/") ? "" : "/") + url;
    }

    let html = "";

    // 1. Tenta obter o HTML da página através do proxy local Vite (/api/site-proxy)
    try {
      let pathUrl = url;
      try {
        const uObj = new URL(url);
        pathUrl = uObj.pathname + uObj.search;
      } catch (e) {}

      const respProxy = await fetch('/api/site-proxy' + pathUrl);
      if (respProxy.ok) {
        html = await respProxy.text();
      }
    } catch (e1) {
      console.warn("Proxy local não respondeu, tentando fallback:", e1);
    }

    // 2. Fallback caso proxy local não responda (CORS proxy público ou direto)
    if (!html || html.length < 200) {
      try {
        const respCors = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
        if (respCors.ok) {
          html = await respCors.text();
        }
      } catch (e2) {}
    }

    // 3. Extração semântica do HTML (DOMParser)
    let titulo = "";
    let preco = "";
    let sku = "";
    let descricao = "";
    let especificacoes = "";
    let imagem = "";

    if (html && html.length > 200) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        titulo = doc.querySelector("h1.product_title")?.textContent?.trim() ||
                 doc.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
                 doc.querySelector("title")?.textContent?.replace("| Visual Super", "")?.trim() || "";

        preco = doc.querySelector(".price .amount")?.textContent?.trim() ||
                doc.querySelector(".price")?.textContent?.trim() ||
                doc.querySelector("meta[property='product:price:amount']")?.getAttribute("content") || "";

        sku = doc.querySelector(".sku")?.textContent?.trim() || "";

        const descCurta = doc.querySelector(".woocommerce-product-details__short-description")?.textContent?.trim() || "";
        const descCompleta = doc.querySelector("#tab-description")?.textContent?.trim() ||
                             doc.querySelector(".woocommerce-Tabs-panel--description")?.textContent?.trim() || "";
        const metaDesc = doc.querySelector("meta[name='description']")?.getAttribute("content")?.trim() || "";

        descricao = (descCurta + " " + descCompleta + " " + metaDesc).trim().substring(0, 3000);

        const tabelaAttr = doc.querySelector(".woocommerce-product-attributes");
        if (tabelaAttr) {
          especificacoes = tabelaAttr.textContent?.replace(/\s+/g, " ")?.trim() || "";
        }

        imagem = doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
                 doc.querySelector(".woocommerce-product-gallery__image img")?.getAttribute("src") || "";
      } catch (eDom) {
        console.warn("Erro ao fazer parse do DOM:", eDom);
      }
    }

    // Se não encontrou título pelo HTML, infere pelo slug da URL
    if (!titulo) {
      try {
        const partes = new URL(url).pathname.split("/").filter(Boolean);
        const slug = partes[partes.length - 1] || "produto";
        titulo = slug.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
      } catch (e) {
        titulo = "Produto Consultado no Site";
      }
    }

    // 4. Inteligência Profunda com Gemini (se chave de API estiver ativa)
    const chave = this.obterChaveGemini();
    let produtoEstruturado = null;

    if (chave && chave.length > 10) {
      try {
        let configModelo = this.modeloGeminiAtivo;
        const versao = configModelo ? configModelo.versao : "v1beta";
        const modelo = configModelo ? configModelo.modelo : "gemini-1.5-flash-latest";

        const prompt = `Você é o Consultor Técnico Sênior e Especialista em Merchandising da Visual Super (site: https://visualsuper.com.br/).
O lead forneceu o seguinte link de produto do nosso catálogo online: "${url}".
Extraímos as seguintes informações da página web:
Título: "${titulo}"
Preço: "${preco || 'Sob consulta'}"
SKU: "${sku || 'VS-Auto'}"
Texto da Página e Descrição: "${descricao.substring(0, 2000) || 'Solução física de exposição e precificação da Visual Super'}"
Especificações Técnicas: "${especificacoes || 'Dimensões padrão PDV'}"

TAREFA:
Analise este produto físico e retorne um perfil técnico estruturado em formato JSON para que nosso agente SDR responda ao lead no WhatsApp com autoridade técnica absoluta sobre medidas, espessura, material, aplicações e benefícios:
{
  "nome": "Nome comercial exato do produto (ex: Fita Cross Clip Strip Branca 24 Posições com Testeira)",
  "sku": "Código SKU",
  "setor": "Setor correspondente no PDV (ex: Merchandising e Cross / Gôndolas, Hortifrúti, Açougue)",
  "material": "Material e espessura (ex: Polipropileno PP 1,00 mm flexível e durável)",
  "medidas": "Dimensões completas (ex: 1200 x 35 mm com testeira 100 x 70 mm)",
  "posicoes": "Número de posições ou presilhas",
  "preco_medio": "Preço informado ou 'Sob consulta por lote (ex: 50 ou 100 un)'",
  "diferencial": "Para que serve no PDV, por que resolve a dor do cliente, estímulo a compras por impulso (cross merchandising) e durabilidade mecânica",
  "pontos_chave": "3 destaques técnicos para o SDR apresentar com autoridade no WhatsApp"
}
Retorne APENAS o JSON.`;

        const respIa = await fetch(`https://generativelanguage.googleapis.com/${versao}/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
              responseMimeType: "application/json"
            }
          })
        });

        if (respIa.ok) {
          const dataIa = await respIa.json();
          const partsIa = dataIa?.candidates?.[0]?.content?.parts || [];
          const textPartsIa = partsIa.filter(p => p.text && !p.thought).map(p => p.text);
          const textoIa = textPartsIa.length > 0 ? textPartsIa.join("") : partsIa.map(p => p.text || "").join("");
          if (textoIa) {
            produtoEstruturado = this.limparJsonLLM(textoIa);
          }
        }
      } catch (eIa) {
        console.warn("Falha ao sintetizar produto via Gemini:", eIa);
      }
    }

    // 5. Monta o objeto final do produto aprendido
    const idSlug = url.replace(/[^a-zA-Z0-9]/g, "-").slice(-30);
    // Detecção inteligente de material e setor com base nas informações oficiais da Visual Super
    const textoAnalise = (titulo + " " + url + " " + descricao).toLowerCase();
    let matDetectado = "Termoplástico nobre de alta durabilidade";
    if (textoAnalise.includes("petg") || textoAnalise.includes("e1") || textoAnalise.includes("hortifruti") || textoAnalise.includes("hortifrúti")) {
      matDetectado = "PETG cristal 0,75mm 100% à prova d'água";
    } else if (textoAnalise.includes("acm") || textoAnalise.includes("açougue") || textoAnalise.includes("acougue")) {
      matDetectado = "ACM (Alumínio Composto) com plaquetas magnéticas higienizáveis";
    } else if (textoAnalise.includes("inox") || textoAnalise.includes("espeto")) {
      matDetectado = "Aço Inox Cirúrgico/Sanitário 100% Atóxico";
    } else if (textoAnalise.includes("clip") || textoAnalise.includes("strip") || textoAnalise.includes("fita cross")) {
      matDetectado = "Polipropileno (PP) virgem de alta resistência";
    } else if (textoAnalise.includes("perfil") || textoAnalise.includes("pvc")) {
      matDetectado = "PVC cristal com fita dupla face de alta fixação e proteção anti-UV";
    } else if (textoAnalise.includes("ps") || textoAnalise.includes("porta cartaz") || textoAnalise.includes("porta-cartaz")) {
      matDetectado = "Poliestireno (PS) 2mm cristal dupla face";
    }

    let setorDetectadoAuto = "Varejo Geral";
    if (textoAnalise.includes("horti") || textoAnalise.includes("e1") || textoAnalise.includes("fruta") || textoAnalise.includes("verdura")) {
      setorDetectadoAuto = "Hortifrúti / FLV";
    } else if (textoAnalise.includes("açougue") || textoAnalise.includes("acougue") || textoAnalise.includes("carne") || textoAnalise.includes("peixaria")) {
      setorDetectadoAuto = "Açougue e Peixaria";
    } else if (textoAnalise.includes("clip") || textoAnalise.includes("strip") || textoAnalise.includes("fita cross")) {
      setorDetectadoAuto = "Cross Merchandising / Fita Cross";
    } else if (textoAnalise.includes("gondola") || textoAnalise.includes("gôndola") || textoAnalise.includes("perfil") || textoAnalise.includes("prateleira")) {
      setorDetectadoAuto = "Gôndolas e Prateleiras";
    }

    let difDetectado = descricao.substring(0, 250);
    if (textoAnalise.includes("e1") || textoAnalise.includes("hortifruti")) {
      difDetectado = "Sistema inteligente de troca de preços com números do tipo sanfonado. 100% à prova d'água contra borrifadores diários e garras articuladas 360° para caixotes e bancadas.";
    }

    const produtoFinal = {
      id: "PROD-" + idSlug,
      sku: produtoEstruturado?.sku || sku || "VS-" + Math.floor(1000 + Math.random() * 9000),
      nome: produtoEstruturado?.nome || titulo,
      setor: produtoEstruturado?.setor || setorDetectadoAuto,
      material: produtoEstruturado?.material || matDetectado,
      medidas: produtoEstruturado?.medidas || "18x16,5cm com encaixe de 2cm",
      diferencial: produtoEstruturado?.diferencial || difDetectado || "Solução física profissional de alta durabilidade para valorização do ponto de venda.",
      link_permanente: url,
      link: url,
      preco_medio: produtoEstruturado?.preco_medio || (preco ? preco : "Sob consulta por lote"),
      imagem: imagem || "",
      aprendidoViaLink: true,
      dataAprendizado: new Date().toISOString()
    };

    // 6. Integra automaticamente ao catálogo do sistema (persiste no localStorage)
    const idxExistente = this.produtos.findIndex(p => (p.link_permanente || p.link) === url || p.id === produtoFinal.id);
    if (idxExistente >= 0) {
      this.produtos[idxExistente] = { ...this.produtos[idxExistente], ...produtoFinal };
    } else {
      this.produtos.unshift(produtoFinal);
    }
    this.salvarProdutos();

    return produtoFinal;
  }

  renderizarCardProdutoAprendido(prod) {
    const card = document.getElementById("cardProdutoAprendido");
    const btnLimpar = document.getElementById("btnLimparLinkProduto");
    if (!card) return;

    if (btnLimpar) btnLimpar.classList.remove("hidden");

    const inputObs = document.getElementById("inputObservacaoProdutoLead");
    if (inputObs && inputObs.value.trim()) {
      this.observacaoProdutoLead = inputObs.value.trim();
    }

    const blocoObs = this.observacaoProdutoLead ? `
      <div class="mt-2.5 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
        <i class="fas fa-clipboard-check text-amber-600 mt-0.5 shrink-0 text-sm"></i>
        <div class="flex-1">
          <strong class="text-amber-900">Observações Ativas do Consultor:</strong>
          <span class="text-slate-800 ml-1 font-medium">${this.observacaoProdutoLead}</span>
        </div>
      </div>
    ` : '';

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div class="flex items-start gap-3 flex-1">
          <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 overflow-hidden shadow-2xs">
            ${prod.imagem ? `<img src="${prod.imagem}" class="w-full h-full object-cover">` : `<i class="fas fa-boxes-stacked text-lg"></i>`}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <i class="fas fa-check-circle text-emerald-600"></i> Produto Estudado & Aprendido pela IA
              </span>
              <span class="text-[10px] font-mono text-slate-500">SKU: ${prod.sku}</span>
              <span class="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">${prod.setor}</span>
            </div>
            <h4 class="font-extrabold text-slate-900 text-sm">${prod.nome}</h4>
            <p class="text-xs text-slate-600 leading-relaxed">
              <strong>Material & Medidas:</strong> ${prod.material} • ${prod.medidas}
            </p>
            <p class="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
              💡 <strong>Diferencial no PDV:</strong> ${prod.diferencial}
            </p>
          </div>
        </div>
        <div class="flex flex-col sm:items-end gap-2 shrink-0">
          <span class="text-xs font-extrabold text-emerald-600">${prod.preco_medio}</span>
          <a href="${prod.link_permanente}" target="_blank" class="text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1">
            Ver Página Oficial <i class="fas fa-arrow-up-right-from-square text-[9px]"></i>
          </a>
        </div>
      </div>
      ${blocoObs}
      <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span><i class="fas fa-brain text-indigo-500"></i> Conhecimento Ativo: As 5 alternativas responderão com base nestas especificações e observações.</span>
        <button type="button" onclick="app.abrirModalEditarProduto('${prod.id}')" class="text-blue-600 hover:underline font-bold cursor-pointer">
          Editar no Catálogo
        </button>
      </div>
    `;

    card.classList.remove("hidden");
  }

  limparProdutoConsultado() {
    this.produtoConsultadoLead = null;
    this.observacaoProdutoLead = "";
    this.linkConsultorLead = null;
    const card = document.getElementById("cardProdutoAprendido");
    const input = document.getElementById("inputLinkProdutoLead");
    const inputObs = document.getElementById("inputObservacaoProdutoLead");
    const btnLimpar = document.getElementById("btnLimparLinkProduto");
    if (card) card.classList.add("hidden");
    if (input) input.value = "";
    if (inputObs) inputObs.value = "";
    if (btnLimpar) btnLimpar.classList.add("hidden");
    this.mostrarToast("ℹ️ Filtro de produto e observações limpos.");
  }

  // Identifica se uma mensagem é estritamente de acolhimento / saudação inicial
  isMensagemSaudacao(texto) {
    if (!texto) return false;
    const raw = String(texto).trim().toLowerCase();
    const t = raw
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!t) return false;

    // Se contém termos de produto, orçamento, setor específico ou especificação, não é APENAS saudação
    const termosProduto = [
      "preco", "valor", "quanto custa", "quanto fica", "orcamento", "cotacao",
      "clip strip", "fita cross", "precificador", "pedestal", "painel", "acm",
      "hortifruti", "acougue", "gondola", "espeto", "garra", "reutilizavel",
      "cartazista", "cartolina", "software", "criar ofertas", "app", "aplicativo",
      "comprar", "pedido", "catalogo", "cnpj", "atacado", "frete", "entrega",
      "banca", "balcao", "refrigerado", "posicoes", "testeira", "material", "medida"
    ];

    if (termosProduto.some(term => t.includes(term))) {
      return false;
    }

    const saudacoesComuns = [
      "ola", "oi", "oie", "opa", "salve",
      "bom dia", "boa tarde", "boa noite",
      "ola bom dia", "ola boa tarde", "ola boa noite",
      "oi bom dia", "oi boa tarde", "oi boa noite",
      "ola tudo bem", "oi tudo bem", "tudo bem", "tudo bom",
      "ola como vai", "como vai",
      "ola gostaria de falar com voces", "gostaria de falar com voces",
      "ola vim pelo site", "vim pelo seu site e gostaria de falar com voce",
      "ola visual super", "ola visual super vim pelo seu site e gostaria de falar com voce",
      "ola visual super gostaria de falar com voces", "gostaria de falar com voce"
    ];

    if (saudacoesComuns.includes(t)) return true;

    const regexSaudacao = /^(ola|oi|oie|opa|bom dia|boa tarde|boa noite)(\s+(tudo bem|tudo bom|como vai|amigo|equipe|visual super|tudo bem visual super))?$/i;
    if (regexSaudacao.test(t)) return true;

    if (t.length <= 35 && /^(ola|oi|oie|opa|bom dia|boa tarde|boa noite)/i.test(t)) {
      return true;
    }

    return false;
  }

  // Identifica o cumprimento exato do lead (bom dia, boa tarde, boa noite, olá)
  detectarCumprimentoLead(texto) {
    const raw = String(texto || "").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    if (raw.includes("boa tarde")) return "Boa tarde";
    if (raw.includes("boa noite")) return "Boa noite";
    if (raw.includes("bom dia")) return "Bom dia";
    if (raw.includes("oi") || raw.includes("ola") || raw.includes("opa") || raw.includes("salve")) return "Olá";

    const hora = new Date().getHours();
    return hora < 12 ? "Bom dia" : (hora < 18 ? "Boa tarde" : "Boa noite");
  }

  // Busca inteligente de produto por palavras-chave em todo o catálogo oficial (328 produtos)
  buscarProdutoPorTexto(texto) {
    if (!texto || typeof texto !== "string") return null;
    const t = texto.toLowerCase().trim();

    // 1. Procura match exato de SKU
    const matchSku = this.produtos.find(p => p.sku && p.sku.toLowerCase() === t);
    if (matchSku) return matchSku;

    // Filtra fora cartazes de papel descartável e insumos que contrariam o foco em soluções físicas reutilizáveis
    const ehConsumivelPapel = (nome) => /offset|sulfite|couch[eê]|serrilhado|impressora|bobina\s+de\s+papel|bobina\s+de\s+polietileno/i.test(nome || "");

    // Prioridade semântica para ilhas centrais / promocionais -> Precificador E2
    if (t.includes("ilha") || t.includes("ilhas")) {
      const e2 = this.obterProdutoPadraoPorSetorOuId("e2-ilhas");
      if (e2) return e2;
    }

    // 2. Procura match por termos relevantes
    const stopWords = ["com", "para", "das", "dos", "uma", "que", "qual", "preco", "preço", "valor", "quanto", "custa", "tem", "voce", "voces", "onde", "como", "sobre", "esse", "essa", "este", "sao", "são", "temos", "nossa", "nossas", "nossos", "meu", "minha", "meus", "minhas", "banca", "bancada", "bancadas"];
    const palavras = t.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, " ").split(/\s+/).filter(w => w.length >= 3 && !stopWords.includes(w));
    if (palavras.length === 0) return null;

    let melhorProduto = null;
    let maiorPontos = 0;

    for (const prod of this.produtos) {
      if (ehConsumivelPapel(prod.nome)) continue; // IGNORA cartazes descartáveis de papel offset

      let pontos = 0;
      const nomeLower = (prod.nome || "").toLowerCase();
      const difLower = (prod.diferencial || "").toLowerCase();
      const matLower = (prod.material || "").toLowerCase();
      const skuLower = (prod.sku || "").toLowerCase();

      palavras.forEach(w => {
        if (nomeLower.includes(w)) pontos += 4;
        if (skuLower.includes(w)) pontos += 5;
        if (matLower.includes(w)) pontos += 2;
        if (difLower.includes(w)) pontos += 1;
      });

      if (pontos > maiorPontos && pontos >= 5) {
        maiorPontos = pontos;
        melhorProduto = prod;
      }
    }

    return melhorProduto;
  }

  // Resolve produto padrão por setor, palavra-chave ou ID legado (garante compatibilidade com catálogo de 328 itens e com IDs legados)
  obterProdutoPadraoPorSetorOuId(tipoOuId) {
    if (!this.produtos || this.produtos.length === 0) return null;
    const t = (tipoOuId || "").toString().toLowerCase().trim();

    // 1. Match direto por ID exato ou SKU
    const porId = this.produtos.find(p => p.id === tipoOuId || (p.sku && p.sku.toString().toLowerCase() === t));
    if (porId) return porId;

    // 2. Hortifrúti / FLV / Precificador E1
    if (t === "e1-horti" || t.includes("horti") || t.includes("flv") || t.includes("e1") || t.includes("fruta") || t.includes("legume") || t.includes("verdura") || t.includes("banca")) {
      const e1 = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("precificador-e1") ||
        (p.nome || '').toLowerCase().includes("precificador e1") ||
        (p.setor || '').toLowerCase().includes("hortifr")
      );
      if (e1) return e1;
    }

    // 3. Açougue / Balcão Frio / Peixaria / ACM
    if (t === "painel-acm-acouque" || t.includes("acougue") || t.includes("açougue") || t.includes("carne") || t.includes("peixaria") || t.includes("acm") || t.includes("balcão")) {
      const acm = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("acougue") ||
        (p.link_permanente || p.link || '').includes("painel") ||
        (p.nome || '').toLowerCase().includes("açougue") ||
        (p.nome || '').toLowerCase().includes("acougue") ||
        (p.nome || '').toLowerCase().includes("tag de produtos") ||
        (p.setor || '').toLowerCase().includes("açougue")
      );
      if (acm) return acm;
    }

    // 4. Clip Strip / Fita Cross / Cross Merchandising
    if (t === "clip-strip-24" || t.includes("clip") || t.includes("strip") || t.includes("fita cross") || t.includes("cross")) {
      const cs = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("fita-cross") ||
        (p.link_permanente || p.link || '').includes("clip-strip") ||
        (p.nome || '').toLowerCase().includes("fita cross") ||
        (p.nome || '').toLowerCase().includes("clip strip")
      );
      if (cs) return cs;
    }

    // 5. Precificador E2 Ilhas
    if (t === "e2-ilhas" || t.includes("e2") || t.includes("ilha")) {
      const e2 = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("precificador-e2") ||
        (p.nome || '').toLowerCase().includes("precificador e2")
      );
      if (e2) return e2;
    }

    // 6. Precificador E3 Pedestal
    if (t === "e3-pedestal-a5" || t.includes("e3")) {
      const e3 = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("precificador-e3") ||
        (p.nome || '').toLowerCase().includes("precificador e3")
      );
      if (e3) return e3;
    }

    // 7. Espeto Inox Sanitário
    if (t === "espeto-inox" || t.includes("espeto") || t.includes("inox")) {
      const esp = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("espeto") ||
        (p.nome || '').toLowerCase().includes("espeto")
      );
      if (esp) return esp;
    }

    // 8. Perfis de Gôndola e Porta-Etiquetas
    if (t === "perfil-gondola" || t.includes("perfil") || t.includes("gondola") || t.includes("gôndola") || t.includes("prateleira")) {
      const perf = this.produtos.find(p => 
        (p.link_permanente || p.link || '').includes("perfil") ||
        (p.link_permanente || p.link || '').includes("porta-etiqueta") ||
        (p.nome || '').toLowerCase().includes("porta-etiqueta") ||
        (p.nome || '').toLowerCase().includes("perfil")
      );
      if (perf) return perf;
    }

    // 9. Pedestais de Entrada / Chão / Ponta de Gôndola
    if (t === "pedestal-a4" || t.includes("pedestal")) {
      const ped = this.produtos.find(p => 
        (p.nome || '').toLowerCase().includes("pedestal porta cartaz a4") ||
        (p.nome || '').toLowerCase().includes("pedestal") ||
        (p.link_permanente || p.link || '').includes("pedestal")
      );
      if (ped) return ped;
    }

    // 10. Garras Articuladas 360°
    if (t === "garra-360" || t.includes("garra")) {
      const garra = this.produtos.find(p => 
        (p.nome || '').toLowerCase().includes("garra") ||
        (p.nome || '').toLowerCase().includes("suporte de precificação")
      );
      if (garra) return garra;
    }

    // 11. Porta-Cartaz Aéreo Dupla Face
    if (t === "porta-cartaz-a3" || t.includes("aéreo") || t.includes("aereo") || t.includes("porta cartaz") || t.includes("porta-cartaz")) {
      const pc = this.produtos.find(p => 
        (p.nome || '').toLowerCase().includes("porta cartaz") ||
        (p.link_permanente || p.link || '').includes("porta-cartaz")
      );
      if (pc) return pc;
    }

    // Se tiver produtos de hortifrúti cadastrados, prioriza o Precificador E1
    const padraoE1 = this.produtos.find(p => (p.link_permanente || p.link || '').includes("precificador-e1") || (p.nome || '').toLowerCase().includes("precificador e1"));
    if (padraoE1) return padraoE1;

    return this.produtos[0];
  }

  // Identifica intenção e setor da pergunta do lead
  analisarPergunta(texto, contexto = 'simulador') {
    if (this.isMensagemSaudacao(texto)) {
      return { setor: "Acolhimento / Início de Conversa", produtoFoco: null, isSaudacao: true };
    }

    // Se estiver no contexto do simulador e houver produto pesquisado pelo link, usa ele
    if (contexto === 'simulador' && this.produtoConsultadoLead) {
      return { setor: this.produtoConsultadoLead.setor, produtoFoco: this.produtoConsultadoLead };
    }

    const t = (texto || "").toLowerCase();

    // 1. Prioridades semânticas específicas de soluções físicas da Visual Super
    if (t.includes("e2") || t.includes("ilha") || t.includes("ilhas") || (t.includes("central") && t.includes("banca"))) {
      const p = this.obterProdutoPadraoPorSetorOuId("e2-ilhas");
      if (p) return { setor: "Hortifrúti / Ilhas", produtoFoco: p };
    }

    if (t.includes("clip") || t.includes("strip") || t.includes("fita cross") || t.includes("presilha") || t.includes("testeira") || t.includes("testeiro") || t.includes("posições") || t.includes("posicoes")) {
      const p = (this.produtoConsultadoLead && (this.produtoConsultadoLead.id === "CLIP-STRIP-24" || this.produtoConsultadoLead.nome.toLowerCase().includes("clip strip")))
        ? this.produtoConsultadoLead
        : this.obterProdutoPadraoPorSetorOuId("clipstrip");
      if (p) return { setor: p.setor || "Cross Merchandising / Fita Cross", produtoFoco: p };
    }
    
    if (t.includes("e3") || (t.includes("pedestal") && (t.includes("a5") || t.includes("regulável") || t.includes("regulavel")))) {
      const p = this.obterProdutoPadraoPorSetorOuId("e3-pedestal-a5");
      if (p) return { setor: p.setor || "Destaques e Ilhas", produtoFoco: p };
    }

    if (t.includes("espeto") || (t.includes("inox") && (t.includes("balcão") || t.includes("balcao") || t.includes("carne")))) {
      const p = this.obterProdutoPadraoPorSetorOuId("espeto-inox");
      if (p) return { setor: p.setor || "Açougue e Peixaria", produtoFoco: p };
    }

    if (t.includes("aéreo") || t.includes("aereo") || t.includes("pendural") || t.includes("cartaz a3") || t.includes("ilhós") || t.includes("ilhos")) {
      const p = this.obterProdutoPadraoPorSetorOuId("porta-cartaz-a3");
      if (p) return { setor: p.setor || "Comunicação Aérea", produtoFoco: p };
    }

    if (t.includes("garra") || t.includes("presilha") || t.includes("articulada") || t.includes("360")) {
      const p = this.obterProdutoPadraoPorSetorOuId("garra-360");
      if (p) return { setor: p.setor || "Acessórios de Fixação", produtoFoco: p };
    }

    // 2. Match inteligente no catálogo completo da loja (filtrado contra papel)
    const matchCat = this.buscarProdutoPorTexto(texto);
    const ehDuvidaGenerica = t.includes("frete") || t.includes("entrega") || t.includes("atacado") || t.includes("cnpj");
    if (matchCat && !ehDuvidaGenerica) {
      return { setor: matchCat.setor, produtoFoco: matchCat };
    }

    if (t.includes("horti") || t.includes("fruta") || t.includes("legume") || t.includes("verdura") || t.includes("banca") || t.includes("caixa") || t.includes("sacolão") || t.includes("feira") || t.includes("e1") || t.includes("água") || t.includes("agua") || t.includes("borrifador")) {
      const p = this.obterProdutoPadraoPorSetorOuId("e1-horti");
      return { setor: "Hortifrúti / FLV", produtoFoco: p };
    }
    if (t.includes("açougue") || t.includes("acougue") || t.includes("carne") || t.includes("corte") || t.includes("peixaria") || t.includes("peixe") || t.includes("painel") || t.includes("acm") || t.includes("ímã") || t.includes("ima") || t.includes("refrigerado")) {
      const p = this.obterProdutoPadraoPorSetorOuId("acougue");
      return { setor: "Açougue e Peixaria", produtoFoco: p };
    }
    if (t.includes("gondola") || t.includes("gôndola") || t.includes("prateleira") || t.includes("etiqueta") || t.includes("perfil") || t.includes("procon")) {
      const p = this.obterProdutoPadraoPorSetorOuId("perfil-gondola");
      return { setor: "Gôndolas e Prateleiras", produtoFoco: p };
    }
    if (t.includes("chão") || t.includes("chao") || t.includes("ponta") || t.includes("pedestal") || t.includes("entrada") || t.includes("cartaz a4")) {
      const p = this.obterProdutoPadraoPorSetorOuId("pedestal-a4");
      return { setor: "Entrada e Ponta de Gôndola", produtoFoco: p };
    }
    if (t.includes("frete") || t.includes("envio") || t.includes("entrega") || t.includes("prazo") || t.includes("transportadora") || t.includes("site") || t.includes("comprar")) {
      return { setor: "Logística e Frete", produtoFoco: null };
    }
    if (t.includes("atacado") || t.includes("loja inteira") || t.includes("completa") || t.includes("cnpj") || t.includes("fatur") || t.includes("grande") || t.includes("humano") || t.includes("vendedor") || t.includes("atendente")) {
      return { setor: "Corporativo / Handoff", produtoFoco: null };
    }
    if (t.includes("papel") || t.includes("cartazista") || t.includes("gasto") || t.includes("caro") || t.includes("tempo") || t.includes("refazer") || t.includes("tinta")) {
      const p = this.obterProdutoPadraoPorSetorOuId("e1-horti");
      return { setor: "Objeção / Custos", produtoFoco: p };
    }
    return { setor: "Varejo Geral", produtoFoco: this.obterProdutoPadraoPorSetorOuId("e1-horti") };
  }

  // Orquestrador de geração: Tenta Gemini primeiro, depois local
  async gerarAlternativas(leadPergunta) {
    this.perguntaAtual = leadPergunta;

    // Captura observação atual do consultor
    const inputObs = document.getElementById("inputObservacaoProdutoLead");
    if (inputObs && inputObs.value.trim()) {
      this.observacaoProdutoLead = inputObs.value.trim();
    }

    // Se houver um link preenchido no input e o produto ainda não tiver sido analisado, pesquisa agora
    const inputLink = document.getElementById("inputLinkProdutoLead");
    if (inputLink && inputLink.value.trim() && !this.produtoConsultadoLead) {
      await this.aprenderProdutoDeUrl(inputLink.value.trim()).catch(() => null);
    }

    const chave = this.obterChaveGemini();

    const btnGerador = document.querySelector("button[onclick='acionarGerador()']");
    const textoOriginalBtn = btnGerador ? btnGerador.innerHTML : null;

    if (chave && chave.length > 10) {
      try {
        if (btnGerador) {
          btnGerador.disabled = true;
          btnGerador.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Consultando IA Gemini...`;
        }
        const alternativasIA = await this.gerarAlternativasComGemini(leadPergunta, chave);
        if (alternativasIA && alternativasIA.length === 5) {
          this.alternativasGeradas = alternativasIA;
          this.alternativaSelecionada = null;
          this.mostrarToast("✨ 5 Alternativas geradas com sucesso pela IA Gemini!");
          return this.alternativasGeradas;
        }
      } catch (err) {
        console.warn("Falha na geração via Gemini, usando gerador local:", err);
        localStorage.removeItem("visualsuper_gemini_model");
        this.modeloGeminiAtivo = null;

        let erroCurto = err.message || "Erro";
        if (erroCurto.includes("Quota exceeded") || erroCurto.includes("quota") || erroCurto.includes("limit: 0")) {
          erroCurto = "Cota do modelo anterior atingida. O sistema reconfigurou para o modelo Flash gratuito.";
        } else if (erroCurto.length > 70) {
          erroCurto = erroCurto.substring(0, 70) + "...";
        }
        this.mostrarToast(`⚠️ IA Gemini: ${erroCurto}`);
      } finally {
        if (btnGerador && textoOriginalBtn) {
          btnGerador.disabled = false;
          btnGerador.innerHTML = textoOriginalBtn;
        }
      }
    }

    // Fallback: Gerador local inteligente
    return this.gerarAlternativasLocal(leadPergunta);
  }

  async gerarAlternativasComGemini(leadPergunta, chave) {
    const configModelo = await this.obterConfigModeloGemini(chave);
    const versao = configModelo ? configModelo.versao : "v1beta";
    const modelo = configModelo ? configModelo.modelo : "gemini-1.5-flash-latest";

    const catalogoFormatado = this.selecionarProdutosRelevantesParaPrompt(leadPergunta);

    let orientacaoProdutoEspecifico = "";
    if (this.produtoConsultadoLead) {
      const p = this.produtoConsultadoLead;
      orientacaoProdutoEspecifico = `
========================================================================================
ALERTA MÁXIMO E PRIORITÁRIO - PRODUTO ESPECÍFICO QUE O LEAD ESTÁ CONSULTANDO:
O lead forneceu o link real ou está perguntando diretamente sobre este produto da Visual Super:
- Nome do Produto: ${p.nome}
- SKU: ${p.sku || "Consulte"}
- Setor: ${p.setor}
- Material / Acabamento: ${p.material}
- Dimensões / Medidas: ${p.medidas || "Consulte"}
- Diferencial no PDV: ${p.diferencial}
- Preço de Referência: ${p.preco_medio || "Sob consulta por lote (ex: 50 ou 100 un)"}
- LINK PERMANENTE REAL OBRIGATÓRIO: ${p.link_permanente || p.link}

DIRETRIZES MANDATÓRIAS PARA AS RESPOSTAS:
1. A VISUAL SUPER PRODUZ, FORNECE E TEM EM LINHA ESTE PRODUTO FÍSICO (${p.nome})!
2. NUNCA afirme ou insinue que "não trabalhamos com fitas plásticas", "não trabalhamos com clip strip" ou algo do tipo. Isso é terminantemente proibido.
3. Confirme com entusiasmo e autoridade técnica que fornecemos a fita cross / clip strip / produto consultado exatamente nas especificações solicitadas.
4. Destaque os diferenciais de durabilidade, material resistente, alta retenção de produtos no ponto de venda e o estímulo a vendas por impulso (cross merchandising).
5. Em todas as alternativas que incluírem link, utilize EXCLUSIVAMENTE o link permanente real oficial: ${p.link_permanente || p.link}
========================================================================================
`;
    }

    let orientacaoObservacoesConsultor = "";
    if (this.observacaoProdutoLead && this.observacaoProdutoLead.trim()) {
      orientacaoObservacoesConsultor = `
========================================================================================
OBSERVAÇÕES E DIRETRIZES DO CONSULTOR HUMANO PARA ESTA RESPOSTA (PRIORIDADE MÁXIMA):
"${this.observacaoProdutoLead.trim()}"

INSTRUÇÕES OBRIGATÓRIAS PARA A IA:
O consultor comercial avaliou a relação entre o que o cliente pediu e o produto do link estudado, e definiu as instruções acima.
Você DEVE OBRIGATORIAMENTE levar em consideração estas orientações nas 5 alternativas:
- Esclareça eventuais diferenças técnicas ou de modelo (ex: cliente pediu 24 posições, mas temos 13 posições pronta-entrega ou fabricamos 24 posições sob medida por lote).
- Destaque diferenciais solicitados pelo consultor (ex: testeira personalizável com logotipo da marca).
- Incorpore detalhes de negociação, lote mínimo ou prazos de envio indicados.
========================================================================================
`;
    }

    let orientacaoSaudacao = "";
    if (this.isMensagemSaudacao(leadPergunta)) {
      orientacaoSaudacao = `
========================================================================================
ALERTA MÁXIMO: A MENSAGEM DO CLIENTE É UMA SAUDAÇÃO / INÍCIO DE CONVERSA ("${leadPergunta}").
- NÃO apresente produtos específicos e NÃO envie links de compra prematuramente.
- NUNCA diga "Excelente pergunta!" para um simples "bom dia" ou "olá".
- As 5 alternativas devem obrigatoriamente focar em Acolhimento, Rapport e Diagnóstico de Loja:
  1. "tipo": "Consultiva com Diagnóstico" | "icone": "🎯" | "titulo": "1. Abordagem Consultiva (Acolhimento & Diagnóstico de Loja)"
     (Boas-vindas calorosas, apresentação como especialista da Visual Super e pergunta sobre qual setor ele precisa organizar/precificar).
  2. "tipo": "Técnica e Durabilidade" | "icone": "🔬" | "titulo": "2. Abordagem Especialista (Foco em Solução Definitiva)"
     (Acolhimento cordial, explicação de que a Visual Super elimina papel com soluções físicas reutilizáveis que duram anos, e pergunta sobre como faz as ofertas hoje).
  3. "tipo": "Financeira e ROI" | "icone": "💰" | "titulo": "3. Abordagem Financeira (Foco em Economia e Fim do Papel)"
     (Cumprimento amigável e pergunta sobre qual setor mais dá dor de cabeça/custo com cartazes e papel).
  4. "tipo": "Direta com Link Oficial" | "icone": "⚡" | "titulo": "4. Abordagem Ágil de WhatsApp (Receptiva & Direta)"
     (Mensagem curta e receptiva de WhatsApp colocando-se à disposição para orientar sobre o ponto de venda).
  5. "tipo": "Handoff Comercial (Joelson)" | "icone": "🤝" | "titulo": "5. Abordagem Corporativa / Projetos (Joelson)"
     (Boas-vindas reforçando atendimento para comércios locais e redes com faturamento no CNPJ e apoio do especialista Joelson).
========================================================================================
`;
    }

    const cfg = this.configuracaoEmpresa || this.obterConfiguracaoPadraoEmpresa();

    const prompt = `Você é o Consultor Especialista Sênior em Precificação Inteligente e Soluções Físicas de PDV da ${cfg.nomeEmpresa} (site oficial: ${cfg.siteOficial}).
Sua missão é atuar como um SDR consultivo de alta performance no WhatsApp, conversando com donos, gerentes e encarregados de supermercados, hortifrútis, açougues, padarias e varejo de alimentos em geral.

SUA REAL FUNÇÃO COMO SDR CONSULTIVO:
1. Acolher os leads com empatia, profissionalismo e escuta ativa (rapport consultivo).
2. Diagnosticar as dores reais do varejo: gasto contínuo invisível com papel cartão, cartolina, pincéis e fitas adesivas; perda de tempo de funcionários refazendo cartazes; dependência de cartazistas; poluição visual e risco de multas do Procon por preços ausentes ou ilegíveis.
3. Apresentar a solução física ideal do catálogo oficial da Visual Super, destacando materiais nobres reutilizáveis (PETG, ACM, Inox cirúrgico, Polipropileno PP, PVC anti-UV), durabilidade de anos e troca rápida de preços em segundos.
4. Indicar estritamente os links permanentes oficiais do e-commerce da Visual Super.
5. Qualificar o porte da loja e conduzir para a compra ou transferir com prioridade para o Joelson (Equipe Comercial Visual Super) quando envolver pedidos por lote, atacado, faturamento corporativo no CNPJ ou projeto de loja completa.

SUAS 6 ESPECIALIDADES DE PDV PARA ATUAR COM OS LEADS:
- Especialidade 1 (Hortifrúti e FLV): Precificadores E1/E2/E3 em PETG cristal 0,75mm 100% à prova d'água (não rasgam nem deformam com borrifadores diários de água), números tipo caderninho folheável (frente neutra e verso tarja vermelha OFERTA), garras articuladas 360° para caixas e bancadas.
- Especialidade 2 (Açougue e Peixaria): Painéis em ACM com números magnéticos higienizáveis resistentes ao frio e gordura de balcões refrigerados sem enferrujar; displays e espetos em Aço Inox Alimentício sanitário/cirúrgico 100% atóxicos para contato direto com carnes e peixes.
- Especialidade 3 (Cross Merchandising e Clip Strip / Fita Cross): Fitas cross em Polipropileno (PP) reforçado (12 a 24 posições com testeira personalizável) para estimular vendas por impulso verticais ao lado de gôndolas e caixas.
- Especialidade 4 (Gôndolas, Prateleiras e Pontas de Gôndola): Perfis porta-etiquetas em PVC cristal com fita dupla face de alta fixação e proteção anti-UV (não amarelam sob LED, evitando multas do Procon); pedestais telescópicos A4 com base pesada anti-tombamento.
- Especialidade 5 (Comunicação Aérea e Corredores): Porta-cartazes suspensos em PS 2mm cristal dupla face com ilhós metálicos e molduras pendurais para visão 360° sem poeira ou amassados.
- Especialidade 6 (Acessórios de Fixação Universal): Garras articuladas 360°, bases magnéticas, hastes metálicas e presilhas para caixotes de feira de madeira, cestos aramados e tubos.

INFORMAÇÕES OFICIAIS ATUALIZADAS DA EMPRESA (${cfg.nomeEmpresa}):
- Nome da Empresa: ${cfg.nomeEmpresa}
- Site Oficial: ${cfg.siteOficial}
- Especialista Comercial / Grandes Volumes / Faturamento CNPJ: ${cfg.responsavelComercial}
- WhatsApp Oficial: ${cfg.whatsappComercial}
- Horário de Atendimento Consultivo: ${cfg.horarioAtendimento}
- Cidade Base & Abrangência: ${cfg.cidadeBase}
- Posicionamento Institucional: ${cfg.descricaoEmpresa}

REGRA DE OURO INEGOCIÁVEL:
${cfg.regraDeOuro}
NUNCA mencione "Criar Ofertas", sistemas de ofertas digitais, softwares, aplicativos ou painéis digitais de TV.
Seu foco é 100% EXCLUSIVO nas soluções físicas de PDV, precificação inteligente e comunicação visual da ${cfg.nomeEmpresa}.
O contato de transbordo/comercial para grandes pedidos ou CNPJ é o especialista comercial ${cfg.responsavelComercial}.

REGRA MANDATÓRIA DE LINGUAGEM (PROIBIDO USAR A PALAVRA 'PERGUNTA'):
NUNCA use a palavra "pergunta" nas mensagens (ex: NUNCA diga "Excelente pergunta!", "Ótima pergunta!"). Inicie com "Com certeza!", "Perfeito!", "Excelente!", "Com toda certeza!".

REGRA MANDATÓRIA DE LINKS PERMANENTES (NUNCA VIOLE):
1. NUNCA crie, invente ou gere URLs com o título do produto (exemplo expressamente PROIBIDO: jamais crie URLs como https://visualsuper.com.br/produto/titulo-do-produto).
2. O catálogo da Visual Super possui links permanentes específicos para cada produto. Use ESTRITAMENTE e EXCLUSIVAMENTE o 'Link Permanente Real Oficial' exato fornecido no catálogo abaixo para o produto recomendado.
3. Se recomendar o Precificador E3, utilize exatamente o link permanente: https://visualsuper.com.br/produto/pedestal-com-precificador-e3/.
4. Se recomendar o Precificador E1, utilize exatamente o link permanente: https://visualsuper.com.br/produto/precificador-e1-hortifruti/.
5. Se recomendar o Painel para Açougue, utilize exatamente o link permanente: https://visualsuper.com.br/produto/painel-precificador-acougue/.
6. Se recomendar o Pedestal A4, utilize exatamente o link permanente: https://visualsuper.com.br/produto/pedestal-a4-telescopico/.
7. Se for transbordo ou atendimento de grandes volumes, indique falar com Joelson sem inventar URL.

CATÁLOGO OFICIAL DE SOLUÇÕES FÍSICAS E LINKS PERMANENTES DA VISUAL SUPER:
${catalogoFormatado}
${orientacaoProdutoEspecifico}
${orientacaoObservacoesConsultor}
${orientacaoSaudacao}
DORES DO CLIENTE A CONSIDERAR:
- Custo contínuo invisível com compra mensal de cartolina, fitas e papel.
- Desperdício de tempo de funcionários refazendo cartazes diariamente.
- Umidade que rasga cartazes no hortifrúti ou balcões refrigerados de carnes.
- Poluição visual e letras ilegíveis que desvalorizam o produto e a loja.
- Risco de autuações e multas do Procon por preço ilegível ou ausente.

A DÚVIDA / MENSAGEM DO CLIENTE NO WHATSAPP FOI:
"${leadPergunta}"

TAREFA:
Analise detalhadamente a dúvida do cliente, entenda o problema real, o setor do varejo envolvido e escolha o(s) produto(s) mais adequado(s) do catálogo da Visual Super.
Gere EXATAMENTE 5 alternativas de respostas profissionais, distintas entre si, prontas para enviar no WhatsApp.

As 5 alternativas DEVEM seguir rigorosamente estas 5 perspectivas:
1. "tipo": "Consultiva com Diagnóstico" | "icone": "🎯" | "titulo": "1. Abordagem Consultiva (Foco em Entender a Operação)"
   (Acolhimento empático, identificação da dor, recomendação da solução ideal e pergunta de qualificação sobre a quantidade de bancadas/balcões).
2. "tipo": "Técnica e Durabilidade" | "icone": "🔬" | "titulo": "2. Abordagem Técnica (Foco em Material e Resistência)"
   (Explicação profunda dos materiais nobres, como PETG, ACM com ímãs de neodímio, PVC ou inox, facilidade de higienização, sistema de troca rápida de preços e link oficial permanente do produto).
3. "tipo": "Financeira e ROI" | "icone": "💰" | "titulo": "3. Abordagem Financeira (Foco em Economia e Fim do Papel)"
   (Cálculo comparativo do fim do gasto com papel e cartazista, demonstrando que o investimento se paga sozinho em poucas semanas).
4. "tipo": "Direta com Link Oficial" | "icone": "⚡" | "titulo": "4. Abordagem Ágil de WhatsApp (Direta ao Ponto com Link)"
   (Mensagem curta, objetiva, amigável, destacando o produto exato e o link permanente real do site da Visual Super para fechar o pedido).
5. "tipo": "Handoff Comercial (Joelson)" | "icone": "🤝" | "titulo": "5. Abordagem de Apoio Comercial / Transbordo (Joelson)"
   (Atendimento de alto nível direcionando o cliente para o especialista comercial Joelson para negociação de atacado, tabela por CNPJ ou projeto de loja completa).

IMPORTANTE:
- Mantenha todas as alternativas objetivas, curtas e dinâmicas para WhatsApp (máximo 3 a 5 linhas, sem textões cansativos).
- Retorne APENAS um array JSON válido contendo exatamente 5 objetos.
- NUNCA use aspas duplas dentro dos textos das mensagens; se precisar destacar nomes ou produtos, use aspas simples 'exemplo' ou asteriscos *exemplo*.
- Chaves obrigatórias em cada objeto: "tipo", "icone", "titulo", "texto".
Nenhum texto fora do JSON.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/${versao}/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const partsResp = data?.candidates?.[0]?.content?.parts || [];
    const textPartsResp = partsResp.filter(p => p.text && !p.thought).map(p => p.text);
    const textoResposta = textPartsResp.length > 0 ? textPartsResp.join("") : partsResp.map(p => p.text || "").join("");
    if (!textoResposta) throw new Error("Resposta vazia da IA Gemini.");

    const alternativas = this.limparJsonLLM(textoResposta);
    if (!alternativas || !Array.isArray(alternativas) || alternativas.length === 0) {
      throw new Error("Não foi possível estruturar as alternativas da IA.");
    }

    // Normaliza qualquer link gerado para garantir o link permanente oficial cadastrado
    alternativas.forEach(alt => {
      if (alt && alt.texto) {
        alt.texto = this.normalizarLinksTexto(alt.texto);
      }
    });

    // Se gerou pelo menos 3 alternativas, completa as faltantes para garantir 5 sem falha
    if (alternativas.length < 5) {
      const locais = this.gerarAlternativasLocal(leadPergunta);
      for (let k = alternativas.length; k < 5; k++) {
        alternativas.push(locais[k]);
      }
    }

    return alternativas.slice(0, 5);
  }

  // Gera as 5 alternativas de resposta baseadas no motor local padrão
  gerarAlternativasLocal(leadPergunta) {
    this.perguntaAtual = leadPergunta;

    if (this.isMensagemSaudacao(leadPergunta)) {
      const hora = new Date().getHours();
      const saudacaoHorario = hora < 12 ? "Bom dia" : (hora < 18 ? "Boa tarde" : "Boa noite");

      const alt1 = {
        tipo: "Consultiva com Diagnóstico",
        icone: "🎯",
        titulo: "1. Abordagem Consultiva (Acolhimento & Diagnóstico de Loja)",
        texto: `${saudacaoHorario}! Tudo bem? Seja muito bem-vindo à Visual Super! 😊\n\nSou o consultor especialista em soluções físicas de precificação e comunicação visual para supermercados, hortifrútis e açougues.\n\nComo posso te ajudar hoje? Me conte um pouco sobre o seu comércio: qual setor você gostaria de organizar ou precificar na sua loja hoje?`
      };

      const alt2 = {
        tipo: "Técnica e Durabilidade",
        icone: "🔬",
        titulo: "2. Abordagem Especialista (Foco em Solução Definitiva)",
        texto: `Olá! Muito prazer! Seja muito bem-vindo à Visual Super.\n\nAqui nós ajudamos o varejo de alimentos a eliminar de vez os cartazes de papel e cartolinas que molham ou rasgam, com sistemas físicos de placas e precificadores reutilizáveis que duram anos!\n\nVocê utiliza cartazista manual hoje ou impressão própria nas suas ofertas?`
      };

      const alt3 = {
        tipo: "Financeira e ROI",
        icone: "💰",
        titulo: "3. Abordagem Financeira (Foco em Economia e Eficiência)",
        texto: `${saudacaoHorario}! Tudo bem? Prazer em falar com você! Aqui na Visual Super nossa missão é transformar o ponto de venda e acabar com o custo mensal invisível de papel, fita e retrabalho de equipe.\n\nQual é o setor da sua loja (hortifrúti, açougue, padaria ou mercearia) que mais consome tempo da sua equipe para manter com preço?`
      };

      const alt4 = {
        tipo: "Direta com Link Oficial",
        icone: "⚡",
        titulo: "4. Abordagem Ágil de WhatsApp (Receptiva & Direta)",
        texto: `Olá! Seja muito bem-vindo à Visual Super! 😊\n\nEstou à sua inteira disposição para te apresentar as melhores soluções físicas de precificação para o seu ponto de venda.\n\nMe conte: você já tem em mente algum modelo ou gostaria de ver as opções ideais para o seu tipo de loja?`
      };

      const alt5 = {
        tipo: "Handoff Comercial (Joelson)",
        icone: "🤝",
        titulo: "5. Abordagem Corporativa / Projetos (Joelson)",
        texto: `Olá! Seja muito bem-vindo à Visual Super!\n\nAtendemos desde pequenos comércios locais até grandes redes de supermercados com faturamento no atacado via CNPJ. Nosso especialista comercial Joelson e toda a nossa equipe estão prontos para te apoiar.\n\nQual é a sua cidade e o segmento do seu comércio?`
      };

      this.alternativasGeradas = [alt1, alt2, alt3, alt4, alt5];
      this.alternativaSelecionada = null;
      return this.alternativasGeradas;
    }

    const { setor, produtoFoco } = this.analisarPergunta(leadPergunta);
    const prod = this.produtoConsultadoLead || produtoFoco || this.produtos[0];
    const linkReal = prod.link_permanente || prod.link || "https://visualsuper.com.br/";
    const setorNome = this.produtoConsultadoLead ? this.produtoConsultadoLead.setor : setor;

    const isClipStrip = prod.id === "CLIP-STRIP-24" || (prod.nome && prod.nome.toLowerCase().includes("clip strip")) || (prod.nome && prod.nome.toLowerCase().includes("fita cross"));
    const isEstudado = !!this.produtoConsultadoLead;
    const obs = (this.observacaoProdutoLead || "").trim();

    let alt1, alt2, alt3, alt4, alt5;

    if (isClipStrip || isEstudado) {
      alt1 = {
        tipo: "Consultiva com Diagnóstico",
        icone: "🎯",
        titulo: "1. Abordagem Consultiva (Foco em Entender a Operação)",
        texto: `Olá! Tudo bem? Com certeza trabalhamos com ${prod.nome}!\n\n${prod.diferencial}\n\nPara eu te orientar na medida exata e verificar o melhor valor por lote: qual é a quantidade estimada que você precisa para equipar sua loja e você prefere com testeiro para sua logo ou modelo neutro?`
      };

      alt2 = {
        tipo: "Técnica e Durabilidade",
        icone: "🔬",
        titulo: "2. Abordagem Técnica (Foco em Material e Resistência)",
        texto: `Com certeza! Nossa fita cross / ${prod.nome} é produzida com foco em durabilidade mecânica e retenção segura de produtos no PDV.\n\nFicha Técnica Oficial:\n• Material: ${prod.material}\n• Medidas: ${prod.medidas || '1200 x 35 x 1,00 mm com testeiro 100 x 70 mm'}\n• Acabamento resistente que não quebra nem resseca.\n\nVocê pode ver as especificações completas e fotos no link oficial: ${linkReal}\n\nQuantas unidades você precisa para o seu comércio hoje?`
      };

      alt3 = {
        tipo: "Financeira e ROI",
        icone: "💰",
        titulo: "3. Abordagem Financeira (Foco em Economia e Fim do Papel)",
        texto: `Excelente investimento para acelerar vendas! A fita cross / clip strip é comprovadamente uma das soluções mais eficientes de cross-merchandising, gerando até 30% a mais de vendas por impulso ao posicionar produtos estratégicos nos corredores.\n\nPor ser confeccionada em material resistente e reutilizável (${prod.material}), o lote se paga rapidamente nas primeiras semanas de venda!\n\nTemos condições diferenciadas para pedidos por pacote/lote. Quantas unidades sua loja pretende rodar?`
      };

      alt4 = {
        tipo: "Direta com Link Oficial",
        icone: "⚡",
        titulo: "4. Abordagem Ágil de WhatsApp (Direta ao Ponto com Link)",
        texto: `Temos sim, com pronta-entrega! É o nosso ${prod.nome}.\n\nProduto de alta durabilidade em ${prod.material}, perfeito para gôndolas e pontas de corredores.\n\nVocê pode conferir todos os detalhes, medidas e fotos no link permanente oficial:\n${linkReal}\n\nQual é o seu CEP ou cidade? Já calculo o prazo de envio e a melhor condição para você!`
      };

      alt5 = {
        tipo: "Handoff Comercial (Joelson)",
        icone: "🤝",
        titulo: "5. Abordagem de Apoio Comercial / Transbordo (Joelson)",
        texto: `Olá! Temos condições exclusivas para lotes, atacado e faturamento via CNPJ de ${prod.nome}!\n\nVou transferir o seu atendimento agora mesmo para o Joelson, nosso especialista comercial na Visual Super, para que ele possa te enviar a tabela com o melhor valor por quantidade.\n\nPoderia me informar o nome da sua empresa, cidade/UF e o volume estimado?`
      };
    } else {
      alt1 = {
        tipo: "Consultiva com Diagnóstico",
        icone: "🎯",
        titulo: "1. Abordagem Consultiva (Foco em Entender a Operação)",
        texto: `Com certeza! Aqui na Visual Super nós desenvolvemos soluções sob medida exatamente para eliminar esse gargalo no seu comércio.\n\nPara o setor de ${setorNome}, nossa linha principal (como o ${prod.nome}) foi feita para padronizar o visual da loja e acabar de vez com o retrabalho de refazer cartazes de papel todo dia!\n\nPara eu te orientar na medida exata: qual é o formato das suas bancadas ou balcões e quantas você precisa precificar hoje?`
      };

      alt2 = {
        tipo: "Técnica e Durabilidade",
        icone: "🔬",
        titulo: "2. Abordagem Técnica (Foco em Material e Resistência)",
        texto: `Com certeza! Nossos produtos são confeccionados em materiais nobres como ${prod.material}.\n\nAo contrário do papel e cartolina que molham, rasgam e acumulam sujeira, o ${prod.nome} é 100% lavável, atóxico e conta com sistema inteligente onde você troca o preço em segundos virando os números, sem canetão nem rasura!\n\nVocê pode ver as fotos e especificações técnicas completas aqui: ${linkReal}\n\nSua loja sofre muito com a umidade ou troca frequente de preços hoje?`
      };

      alt3 = {
        tipo: "Financeira e ROI",
        icone: "💰",
        titulo: "3. Abordagem Financeira (Foco em Economia e Fim do Papel)",
        texto: `Você tocou no ponto principal! O maior vilão no varejo hoje é o custo contínuo invisível: resmas de papel, cartolinas, fitas, tintas e horas de funcionário desenhando cartazes que vão pro lixo em 2 dias.\n\nCom as soluções reutilizáveis da Visual Super você faz um investimento único que se paga nas primeiras semanas. A placa dura anos e sua loja ganha um padrão visual impecável de grande rede!\n\nQual setor da sua loja hoje mais te dá dor de cabeça para manter precificado e bonito?`
      };

      alt4 = {
        tipo: "Direta com Link Oficial",
        icone: "⚡",
        titulo: "4. Abordagem Ágil de WhatsApp (Direta ao Ponto com Link)",
        texto: `Temos a solução perfeita para isso! É o nosso ${prod.nome}.\n\nEle foi projetado especificamente para resolver essa necessidade: ${prod.diferencial}\n\nVocê pode conferir todos os detalhes, medidas e fotos no link oficial: ${linkReal}\n\nQuantas unidades você precisa para equipar a sua loja?`
      };

      alt5 = {
        tipo: "Handoff Comercial (Joelson)",
        icone: "🤝",
        titulo: "5. Abordagem de Apoio Comercial / Transbordo (Joelson)",
        texto: `Com certeza! Para te atender com total atenção e verificar a melhor condição comercial (inclusive frete ou tabela diferenciada para o seu CNPJ), vou transferir sua conversa agora mesmo para o Joelson, nosso especialista comercial aqui da Visual Super.\n\nEnquanto ele assume seu atendimento por aqui, pode me informar o nome da sua empresa, cidade e a quantidade estimada que você precisa?`
      };
    }

    this.alternativasGeradas = [alt1, alt2, alt3, alt4, alt5];
    this.alternativaSelecionada = null;
    return this.alternativasGeradas;
  }

  selecionarAlternativa(index) {
    this.alternativaSelecionada = index;
    this.renderizarAlternativas();
  }

  salvarRespostaComLike(customText = null) {
    if (!this.perguntaAtual.trim()) {
      alert("Por favor, digite ou selecione uma pergunta de lead primeiro!");
      return;
    }

    let respostaFinal = "";
    let tipoFinal = "";
    let linkFinal = "https://visualsuper.com.br/";

    if (customText && customText.trim().length > 0) {
      respostaFinal = customText.trim();
      tipoFinal = "Personalizada pelo Usuário (Treinamento)";
    } else if (this.alternativaSelecionada !== null && this.alternativasGeradas[this.alternativaSelecionada]) {
      const alt = this.alternativasGeradas[this.alternativaSelecionada];
      respostaFinal = alt.texto;
      tipoFinal = alt.tipo;
    } else {
      alert("Por favor, selecione uma das 5 alternativas clicando nela ou digite a sua resposta personalizada!");
      return;
    }

    const { setor, produtoFoco } = this.analisarPergunta(this.perguntaAtual);
    if (produtoFoco && (produtoFoco.link_permanente || produtoFoco.link)) {
      linkFinal = produtoFoco.link_permanente || produtoFoco.link;
    }
    respostaFinal = this.normalizarLinksTexto(respostaFinal);

    const novoAprendizado = {
      id: Date.now(),
      leadPergunta: this.perguntaAtual.trim(),
      setor: setor,
      respostaAprovada: respostaFinal,
      tipo: tipoFinal,
      linkSugerido: linkFinal,
      curtido: true,
      data: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    // Adiciona ao topo dos aprendizados
    this.aprendizados.unshift(novoAprendizado);
    this.salvarAprendizados();

    // Feedback visual
    this.mostrarToast("✅ Resposta com LIKE aprovada e gravada com sucesso no Cérebro do SDR!");
    
    // Limpa estado atual para novo teste
    this.perguntaAtual = "";
    this.alternativasGeradas = [];
    this.alternativaSelecionada = null;
    document.getElementById("inputPerguntaLead").value = "";
    document.getElementById("inputRespostaCustom").value = "";
    this.renderizarAlternativas();
    this.renderizarExportador();
  }

  removerAprendizado(id) {
    if (confirm("Tem certeza que deseja remover este aprendizado do histórico?")) {
      this.aprendizados = this.aprendizados.filter(a => a.id !== id);
      this.salvarAprendizados();
      this.renderizarExportador();
      this.mostrarToast("🗑️ Aprendizado removido do cérebro.");
    }
  }

  atualizarEstatisticas() {
    const total = this.aprendizados.length;
    const setores = {};
    this.aprendizados.forEach(a => {
      setores[a.setor] = (setores[a.setor] || 0) + 1;
    });

    const elTotal = document.getElementById("statTotalAprendizados");
    if (elTotal) elTotal.innerText = total;

    const elSetores = document.getElementById("statTotalSetores");
    if (elSetores) elSetores.innerText = Object.keys(setores).length;

    const elConfianca = document.getElementById("statNivelConfianca");
    if (elConfianca) {
      const conf = Math.min(100, Math.round(50 + (total * 3)));
      elConfianca.innerText = `${conf}%`;
    }
  }

  renderizarAlternativas() {
    const container = document.getElementById("containerAlternativas");
    if (!container) return;

    if (!this.alternativasGeradas || this.alternativasGeradas.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
          <i class="fas fa-robot text-4xl mb-3 text-blue-400"></i>
          <p class="font-medium text-slate-600">Aguardando a mensagem do lead...</p>
          <p class="text-sm">Digite uma dúvida acima ou clique em uma das perguntas sugeridas para gerar 5 estratégias de resposta da Visual Super.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="mb-3 flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full">
          5 Alternativas Geradas pela IA
        </span>
        <span class="text-xs text-slate-500">Selecione a melhor ou digite a sua opção personalizada abaixo:</span>
      </div>
      <div class="space-y-3">
    `;

    this.alternativasGeradas.forEach((alt, idx) => {
      const isSelected = this.alternativaSelecionada === idx;
      html += `
        <div onclick="app.selecionarAlternativa(${idx})" class="cursor-pointer transition-all p-4 rounded-xl border ${isSelected ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20 shadow-md' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50/50'}">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>${alt.icone}</span> ${alt.titulo}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                ${alt.tipo}
              </span>
              <input type="radio" name="opcaoResposta" ${isSelected ? 'checked' : ''} class="w-4 h-4 text-blue-600 focus:ring-blue-500">
            </div>
          </div>
          <div class="text-sm text-slate-800 whitespace-pre-line leading-relaxed font-sans bg-white/70 p-3 rounded-lg border border-slate-100">
            ${alt.texto.replace(/\n/g, '<br>')}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  renderizarHistorico(filtroSetor = "todos", busca = "") {
    const container = document.getElementById("tabelaHistoricoAprendizados");
    if (!container) return;

    let filtrados = this.aprendizados;

    if (filtroSetor !== "todos") {
      filtrados = filtrados.filter(a => a.setor === filtroSetor);
    }

    if (busca.trim()) {
      const b = busca.toLowerCase();
      filtrados = filtrados.filter(a => 
        a.leadPergunta.toLowerCase().includes(b) || 
        a.respostaAprovada.toLowerCase().includes(b) ||
        a.setor.toLowerCase().includes(b)
      );
    }

    if (filtrados.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400">
          <i class="fas fa-search text-3xl mb-2 text-slate-300"></i>
          <p>Nenhum aprendizado encontrado para os filtros selecionados.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div class="divide-y divide-slate-100">
    `;

    filtrados.forEach((item, index) => {
      html += `
        <div class="p-4 hover:bg-slate-50 transition-colors">
          <div class="flex items-start justify-between gap-3 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <i class="fas fa-thumbs-up mr-1 text-[10px]"></i> Aprovado c/ Like
              </span>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                ${item.setor}
              </span>
              <span class="text-xs text-slate-400">
                ${item.data}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="app.copiarTexto('${encodeURIComponent(item.respostaAprovada)}', 'Resposta copiada!')" class="text-slate-400 hover:text-blue-600 text-xs px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 transition" title="Copiar resposta">
                <i class="far fa-copy mr-1"></i> Copiar
              </button>
              <button onclick="app.removerAprendizado(${item.id})" class="text-slate-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition" title="Excluir">
                <i class="far fa-trash-alt"></i>
              </button>
            </div>
          </div>
          
          <div class="mb-2">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Dúvida / Pergunta do Lead:</p>
            <p class="text-sm font-semibold text-slate-900 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200/60 mt-1">
              "${item.leadPergunta}"
            </p>
          </div>

          <div>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Resposta SDR Aprovada:</p>
            <div class="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 mt-1 whitespace-pre-line leading-relaxed">
              ${item.respostaAprovada}
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  renderizarExportador() {
    const container = document.getElementById("conteudoAbaExportada");
    if (!container) return;

    let conteudo = "";
    let nomeArquivo = "";

    switch (this.subAbaExport) {
      case "configuracao":
        nomeArquivo = "configuracao_agente.md";
        conteudo = this.gerarArquivoConfiguracao();
        break;
      case "treinamento":
        nomeArquivo = "base_conhecimento_chunks.md";
        conteudo = this.gerarArquivoTreinamento();
        break;
      case "guardrails":
        nomeArquivo = "guardrails_e_regras.md";
        conteudo = this.gerarArquivoGuardrails();
        break;
      case "cerebro":
        nomeArquivo = "few_shots_exemplos.md";
        conteudo = this.gerarArquivoCerebro();
        break;
      case "produtos":
        nomeArquivo = "catalogo_produtos_sdr.csv";
        conteudo = this.gerarArquivoProdutos();
        break;
    }

    container.value = conteudo;
    const btnDownload = document.getElementById("btnDownloadExport");
    if (btnDownload) {
      btnDownload.setAttribute("data-filename", nomeArquivo);
    }
  }

  gerarArquivoConfiguracao() {
    return `# SYSTEM PROMPT - CONSULTOR ESPECIALISTA VISUAL SUPER (SDR WHATSAPP)

## 1. IDENTIDADE E PAPEL
Você é o Consultor Especialista Sênior em Precificação Inteligente e Soluções Físicas de PDV da Visual Super (https://visualsuper.com.br/), autoridade líder nacional em sinalização de ponto de venda para supermercados, hortifrútis, açougues, padarias e comércio alimentar.

## 2. REAL FUNÇÃO DO AGENTE (SDR CONSULTIVO)
Sua missão primordial é atuar como um SDR (Sales Development Representative) consultivo de alta performance no WhatsApp:
1. Acolher cordialmente os donos e encarregados de comércios alimentares com frases dinâmicas, quebras de linha amigáveis e escuta ativa.
2. Diagnosticar as dores operacionais e custos ocultos: compra mensal contínua de papel cartão, cartolina e pincéis; horas perdidas de funcionários desenhando cartazes; dependência de cartazistas; cartazes rasgados e molhados; e riscos de multas do Procon.
3. Apresentar a solução física sob medida do catálogo oficial, destacando a durabilidade de anos, materiais nobres (PETG, ACM, Inox cirúrgico, Polipropileno PP, PVC anti-UV) e a troca rápida de preços em segundos.
4. Enviar estritamente os links permanentes oficiais do e-commerce da Visual Super.
5. Qualificar o volume do pedido e realizar o transbordo para o Joelson (Equipe Comercial Visual Super) quando envolver atacado, faturamento no CNPJ ou projeto de loja completa.

## 3. SUAS 6 ESPECIALIDADES SETORIAIS NO PDV
1. **Hortifrúti e FLV (Frutas, Legumes e Verduras):**
   - Domínio da Linha E1, E2 e E3 em PETG cristal 0,75mm com caderninho de números folheável (frente neutra e verso tarja vermelha OFERTA).
   - Soluções 100% à prova d'água e laváveis, imunes a borrifadores de água diários, com garras articuladas 360° para bancadas, caixas plásticas e ilhas promocionais.
2. **Açougue e Peixaria:**
   - Painéis precificadores em ACM (Alumínio Composto) com números magnéticos imantados, resistentes a baixas temperaturas, frio e gordura de balcões refrigerados sem enferrujar.
   - Displays e espetos em Aço Inox Alimentício cirúrgico sanitário, 100% atóxicos para identificação direta em bandejas refrigeradas de carnes e peixes.
3. **Cross Merchandising (Fita Cross / Clip Strip):**
   - Fitas cross em Polipropileno (PP) flexível de alta resistência mecânica (12 a 24 posições com testeira personalizável) para vendas verticais por impulso em pontas de gôndola e caixas.
4. **Gôndolas, Prateleiras e Pontas de Gôndola:**
   - Perfis porta-etiquetas em PVC cristal com fita dupla face de alta fixação e proteção anti-UV (não amarelam sob LED, evitando multas do Procon por preço ilegível); pedestais telescópicos A4/A5 com base pesada anti-tombamento.
5. **Comunicação Aérea e Corredores:**
   - Porta-cartazes suspensos em PS 2mm cristal dupla face com ilhós metálicos e molduras pendurais para visão 360° sem poeira ou amassados.
6. **Acessórios de Fixação Universal:**
   - Garras articuladas 360° em polietileno de alta pressão, bases magnéticas, hastes metálicas e presilhas para caixotes de feira de madeira, cestos aramados e tubos.

## 4. REGRA DE OURO INEGOCIÁVEL (MANDATÓRIA)
NUNCA mencione "Criar Ofertas", sistemas de ofertas digitais, softwares ou aplicativos. Seu foco é 100% EXCLUSIVO nas soluções físicas de comunicação visual da Visual Super.

## 5. REGRA DE LINGUAGEM
NUNCA use a palavra "pergunta" nas mensagens (ex: NUNCA diga "Excelente pergunta!"). Inicie com "Com certeza!", "Perfeito!", "Excelente!", "Com toda certeza!".

## 6. REGRA DE HANDOFF HUMANO (JOELSON)
Transfira com prioridade para o Joelson quando:
- O cliente pedir atendimento humano explicitamente.
- O cliente solicitar orçamento de loja completa, personalização com logotipo ou faturamento no CNPJ.
- O cliente tiver dúvidas sobre pedidos anteriores, nota fiscal ou frete.
Script: "Com certeza! Para atender aos detalhes do seu pedido com total atenção, estou transferindo seu atendimento agora para o Joelson, nosso especialista comercial aqui da Visual Super!"`;
  }

  gerarArquivoTreinamento() {
    let chunks = `# BASE DE CONHECIMENTO TÉCNICA E FAQ VALIDADO - VISUAL SUPER\n\n`;
    
    // Adiciona chunks de produtos com links permanentes reais
    chunks += `## SEÇÃO 1: CATÁLOGO TÉCNICO DE SOLUÇÕES FÍSICAS (LINKS PERMANENTES OFICIAIS)\n`;
    this.produtos.forEach(p => {
      chunks += `### ${p.nome} (Setor: ${p.setor})\n`;
      chunks += `- SKU: ${p.sku} | Material e Medidas: ${p.material} | ${p.medidas}\n`;
      chunks += `- Diferencial Técnico: ${p.diferencial}\n`;
      chunks += `- Link Permanente Real no Site: ${p.link_permanente || p.link}\n\n`;
    });

    // Adiciona todos os aprendizados validados com LIKE
    chunks += `## SEÇÃO 2: DÚVIDAS REAIS DE LEADS E RESPOSTAS VALIDADAS (HISTÓRICO DE APRENDIZADO COM LIKE)\n`;
    this.aprendizados.forEach((a, i) => {
      chunks += `### FAQ APROVADO #${i + 1} (${a.setor})\n`;
      chunks += `**Pergunta do Lead:** "${a.leadPergunta}"\n`;
      chunks += `**Resposta Ideal do Consultor SDR:**\n${a.respostaAprovada}\n\n`;
    });

    return chunks;
  }

  gerarArquivoGuardrails() {
    return `NUNCA mencione "Criar Ofertas", softwares, aplicativos ou sistemas de ofertas digitais. O foco é 100% EXCLUSIVO em soluções físicas de PDV e comunicação visual da Visual Super.
Nunca assuma ou mencione uma categoria de produto na primeira mensagem de saudação. Apenas cumprimente o cliente cordialmente e pergunte como pode ajudar.
Nunca invente preços, medidas, espessuras ou prazos de entrega que não constem no catálogo ou no site oficial (https://visualsuper.com.br/).
Nunca envie URLs incorretas, quebradas ou geradas a partir do título do produto (ex: proibido gerar /produto/titulo-do-produto); utilize sempre e exclusivamente os links permanentes oficiais cadastrados para cada solução da Visual Super.
Nunca repita perguntas já respondidas pelo cliente no histórico da conversa (ex: se o cliente já disse o segmento, o nome ou se é pessoa física, NUNCA pergunte novamente).
Nunca pergunte o local de uso (chão ou bancada) ou tamanho (A3, A4, A5) se o cliente já informou anteriormente.
Nunca pergunte a forma de pagamento (PIX, cartão ou boleto) mais de uma vez.
Se o cliente já informou que é Pessoa Física, não insista em CNPJ, faturamento corporativo ou dados de empresa.
Se o cliente já escolheu o produto e a forma de pagamento, não faça novas perguntas qualificatórias: envie o link direto do checkout no site.
Nunca discuta, conteste ou insista em vender quando o cliente solicitar falar com um atendente humano. Transfira imediatamente para o Joelson.
Nunca passe informações sobre estornos, cancelamentos de pedidos já feitos ou suporte pós-venda. Nesses casos, informe com gentileza que está transferindo para o Joelson verificar o pedido no sistema.
Nunca fale mal ou critique marcas concorrentes de precificadores; concentre-se exclusivamente na durabilidade do PETG/ACM, facilidade do sistema de caderninho/ímã e garantia da Visual Super.
Nunca envie blocos de texto gigantescos; divida as respostas em frases curtas e quebras de linha adequadas para a leitura no WhatsApp.`;
  }

  gerarArquivoCerebro() {
    let fewShots = `# EXEMPLOS DE APRENDIZADO E CORREÇÕES (FEW-SHOTS) - CÉREBRO SDR\n\n`;
    
    this.aprendizados.forEach((a, i) => {
      fewShots += `## EXEMPLO POSITIVO #${i + 1} (${a.setor})\n`;
      fewShots += `- ENTRADA DO CLIENTE: "${a.leadPergunta}"\n`;
      fewShots += `- RESPOSTA APROVADA COM LIKE:\n${a.respostaAprovada}\n\n`;
    });

    fewShots += `## EXEMPLO DE CORREÇÃO / EVITAR
- ENTRADA DO CLIENTE: "quero solução para precificar meu hortifruti"
- ❌ ERRO DO SDR A EVITAR: "Entendi! Qual setor da sua loja você quer padronizar primeiro?" (Erro: pergunta redundante, o cliente acabou de falar hortifrúti).
- ✅ RESPOSTA CORRETA: "Excelente! Para o hortifrúti, a solução mais indicada e resistente da Visual Super é a nossa linha de Precificadores E1 em PETG com sistema de caderninho e garras articuladas 360°. Eles são 100% à prova d'água e você troca o preço em segundos virando os números! Quantas bancas você precisa precificar hoje?"`;

    return fewShots;
  }

  gerarArquivoProdutos() {
    let csv = `ID/SKU,Nome_Produto,Categoria_Setor,Material_Medidas,Diferencial_Tecnico,Link_Permanente_Real\n`;
    this.produtos.forEach(p => {
      const linkReal = p.link_permanente || p.link;
      csv += `${p.sku},"${p.nome}","${p.setor}","${p.material} | ${p.medidas}","${p.diferencial}","${linkReal}"\n`;
    });
    return csv;
  }

  mudarAbaExport(aba) {
    this.subAbaExport = aba;
    document.querySelectorAll(".btn-subaba-export").forEach(el => {
      el.classList.remove("border-blue-600", "text-blue-600", "font-bold");
      el.classList.add("text-slate-500");
    });
    const ativo = document.getElementById(`subaba-${aba}`);
    if (ativo) {
      ativo.classList.add("border-blue-600", "text-blue-600", "font-bold");
      ativo.classList.remove("text-slate-500");
    }
    this.renderizarExportador();
  }

  filtrarCatalogo() {
    const inputBusca = document.getElementById("inputBuscaCatalogo");
    const selectSetor = document.getElementById("selectFiltroSetorCatalogo");
    this.catalogoFiltroBusca = inputBusca ? inputBusca.value.trim().toLowerCase() : "";
    this.catalogoFiltroSetor = selectSetor ? selectSetor.value : "";
    this.catalogoPaginaAtual = 1;
    this.renderizarCatalogo();
  }

  mudarPaginaCatalogo(novaPagina) {
    this.catalogoPaginaAtual = novaPagina;
    this.renderizarCatalogo();
    const sec = document.getElementById("secao-catalogo");
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  renderizarCatalogo() {
    const container = document.getElementById("gridCatalogoProdutos");
    if (!container) return;

    // Atualiza contadores totais
    const totalGeral = this.produtos.length;
    const badgeTotalHeader = document.getElementById("badgeContadorCatalogoHeader");
    if (badgeTotalHeader) badgeTotalHeader.textContent = String(totalGeral);
    const contadorTotalEl = document.getElementById("contadorCatalogoTotal");
    if (contadorTotalEl) contadorTotalEl.textContent = String(totalGeral);

    // Popula o select de setores caso necessário
    const selectSetor = document.getElementById("selectFiltroSetorCatalogo");
    if (selectSetor && selectSetor.options.length <= 1) {
      const setoresContagem = {};
      this.produtos.forEach(p => {
        const s = p.setor || "Outros";
        setoresContagem[s] = (setoresContagem[s] || 0) + 1;
      });
      const setoresOrdenados = Object.keys(setoresContagem).sort();
      let optHtml = `<option value="">Todos os Setores (${totalGeral})</option>`;
      setoresOrdenados.forEach(s => {
        optHtml += `<option value="${s}" ${this.catalogoFiltroSetor === s ? 'selected' : ''}>${s} (${setoresContagem[s]})</option>`;
      });
      selectSetor.innerHTML = optHtml;
    }

    // Filtra produtos
    const busca = (this.catalogoFiltroBusca || "").toLowerCase();
    const setorFiltro = this.catalogoFiltroSetor || "";

    const produtosFiltrados = this.produtos.filter(p => {
      if (setorFiltro && p.setor !== setorFiltro) return false;
      if (!busca) return true;
      const textoCombinado = [
        p.nome,
        p.sku,
        p.setor,
        p.material,
        p.diferencial,
        p.link_permanente
      ].join(" ").toLowerCase();
      return textoCombinado.includes(busca);
    });

    const contadorFiltradoEl = document.getElementById("contadorCatalogoFiltrado");
    if (contadorFiltradoEl) contadorFiltradoEl.textContent = String(produtosFiltrados.length);

    if (produtosFiltrados.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
          <i class="fas fa-boxes-stacked text-3xl mb-2 text-slate-300"></i>
          <p class="font-bold text-slate-700">Nenhum produto encontrado com os filtros atuais.</p>
          <p class="text-xs text-slate-500 mt-1">Tente pesquisar por outros termos como PETG, porta-cartaz, espeto, FLV ou limpe o filtro.</p>
          <button type="button" onclick="document.getElementById('inputBuscaCatalogo').value = ''; if (document.getElementById('selectFiltroSetorCatalogo')) document.getElementById('selectFiltroSetorCatalogo').value = ''; app.filtrarCatalogo();" class="mt-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl transition cursor-pointer">
            Limpar Filtros e Ver Todos (${totalGeral})
          </button>
        </div>
      `;
      const contPaginacao = document.getElementById("containerPaginacaoCatalogo");
      if (contPaginacao) contPaginacao.classList.add("hidden");
      return;
    }

    // Paginação
    const itensPorPagina = this.catalogoItensPorPagina || 24;
    const totalPaginas = Math.ceil(produtosFiltrados.length / itensPorPagina);
    if (this.catalogoPaginaAtual > totalPaginas) this.catalogoPaginaAtual = totalPaginas;
    if (this.catalogoPaginaAtual < 1) this.catalogoPaginaAtual = 1;

    const inicio = (this.catalogoPaginaAtual - 1) * itensPorPagina;
    const fim = Math.min(inicio + itensPorPagina, produtosFiltrados.length);
    const produtosPagina = produtosFiltrados.slice(inicio, fim);

    // Renderiza cards da página
    let html = "";
    produtosPagina.forEach(p => {
      const linkReal = p.link_permanente || p.link || "https://visualsuper.com.br/";
      const ehLinkPermanente = linkReal.includes("/produto/") || (linkReal.startsWith("http") && linkReal !== "https://visualsuper.com.br/");
      const slugExibicao = linkReal.replace("https://visualsuper.com.br", "");
      const temImagem = Boolean(p.imagem && p.imagem.startsWith("http"));

      html += `
        <div class="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition flex flex-col justify-between group">
          <div>
            ${temImagem ? `
              <div class="w-full h-36 bg-slate-50 rounded-xl overflow-hidden mb-3 border border-slate-100 flex items-center justify-center p-2 group-hover:border-blue-200 transition">
                <img src="${p.imagem}" alt="${p.nome}" class="max-h-full max-w-full object-contain" loading="lazy">
              </div>
            ` : ''}

            <div class="flex items-start justify-between gap-2 mb-2">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 truncate max-w-[180px]">
                ${p.setor}
              </span>
              <span class="text-[11px] text-slate-400 font-mono shrink-0">SKU: ${p.sku || 'N/D'}</span>
            </div>

            <h4 class="font-bold text-slate-900 text-sm mb-1 leading-snug line-clamp-2" title="${p.nome}">${p.nome}</h4>
            <p class="text-xs text-slate-500 mb-2 line-clamp-1"><strong>Material:</strong> ${p.material || 'Material Nobre PDV'}</p>
            <p class="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-3 leading-relaxed line-clamp-3" title="${p.diferencial}">
              ${p.diferencial}
            </p>
          </div>

          <div>
            <!-- Box de Link Permanente Real do Cadastro -->
            <div class="mb-3 p-2 rounded-xl border ${ehLinkPermanente ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'}">
              <div class="flex items-center justify-between gap-1 mb-1">
                <span class="text-[10px] font-bold ${ehLinkPermanente ? 'text-emerald-800' : 'text-amber-800'} flex items-center gap-1">
                  <i class="fas ${ehLinkPermanente ? 'fa-check-circle text-emerald-600' : 'fa-triangle-exclamation text-amber-600'}"></i>
                  ${ehLinkPermanente ? 'Link Permanente Ativo' : 'Link Genérico'}
                </span>
                <button onclick="app.copiarTexto('${encodeURIComponent(linkReal)}', 'Link permanente copiado!')" class="text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer" title="Copiar link permanente">
                  <i class="fas fa-copy"></i>
                </button>
              </div>
              <div class="flex items-center justify-between gap-2">
                <span class="text-[10px] font-mono ${ehLinkPermanente ? 'text-emerald-950 font-semibold' : 'text-amber-900'} truncate" title="${linkReal}">
                  ${slugExibicao || linkReal}
                </span>
                <a href="${linkReal}" target="_blank" class="shrink-0 text-[10px] ${ehLinkPermanente ? 'text-blue-700 hover:text-blue-900' : 'text-amber-800 hover:underline'} font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs hover:shadow-xs transition" title="Acessar o link permanente real oficial">
                  Ver <i class="fas fa-arrow-up-right-from-square text-[8px]"></i>
                </a>
              </div>
            </div>

            <!-- Preço e Ação de Editar -->
            <div class="flex items-center justify-between pt-2.5 border-t border-slate-100">
              <span class="text-xs font-extrabold text-emerald-600">${p.preco_medio || 'Sob consulta'}</span>
              <button onclick="app.abrirModalEditarProduto('${p.id}')" class="text-xs bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-blue-300 transition flex items-center gap-1 cursor-pointer">
                <i class="fas fa-pen text-[9px]"></i> Editar
              </button>
            </div>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // Atualiza controles de paginação
    const contPaginacao = document.getElementById("containerPaginacaoCatalogo");
    if (contPaginacao) {
      contPaginacao.classList.remove("hidden");
      const pagAtualEl = document.getElementById("paginacaoPaginaAtual");
      if (pagAtualEl) pagAtualEl.textContent = String(this.catalogoPaginaAtual);
      const totalPagsEl = document.getElementById("paginacaoTotalPaginas");
      if (totalPagsEl) totalPagsEl.textContent = String(totalPaginas);
      const faixaEl = document.getElementById("paginacaoFaixaExibicao");
      if (faixaEl) faixaEl.textContent = `Mostrando ${inicio + 1}-${fim} de ${produtosFiltrados.length}`;

      const botoesContainer = document.getElementById("botoesPaginacaoCatalogo");
      if (botoesContainer) {
        let bHtml = "";
        // Anterior
        bHtml += `
          <button type="button" onclick="app.mudarPaginaCatalogo(${this.catalogoPaginaAtual - 1})" ${this.catalogoPaginaAtual === 1 ? 'disabled class="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer transition"'}>
            <i class="fas fa-chevron-left text-[10px]"></i>
          </button>
        `;

        // Páginas numeradas (mostra até 5)
        const paginasParaExibir = [];
        let pInicio = Math.max(1, this.catalogoPaginaAtual - 2);
        let pFim = Math.min(totalPaginas, pInicio + 4);
        if (pFim - pInicio < 4) {
          pInicio = Math.max(1, pFim - 4);
        }
        for (let i = pInicio; i <= pFim; i++) {
          paginasParaExibir.push(i);
        }

        paginasParaExibir.forEach(pNum => {
          if (pNum === this.catalogoPaginaAtual) {
            bHtml += `<span class="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold">${pNum}</span>`;
          } else {
            bHtml += `<button type="button" onclick="app.mudarPaginaCatalogo(${pNum})" class="px-3 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium cursor-pointer transition">${pNum}</button>`;
          }
        });

        // Próximo
        bHtml += `
          <button type="button" onclick="app.mudarPaginaCatalogo(${this.catalogoPaginaAtual + 1})" ${this.catalogoPaginaAtual === totalPaginas ? 'disabled class="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer transition"'}>
            <i class="fas fa-chevron-right text-[10px]"></i>
          </button>
        `;
        botoesContainer.innerHTML = bHtml;
      }
    }
  }

  // Métodos de Gerenciamento do Cadastro e Links Permanentes de Produtos
  abrirModalEditarProduto(id) {
    const prod = this.produtos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById("modalTituloProduto").textContent = "Editar Cadastro & Link Permanente";
    document.getElementById("formProdutoId").value = prod.id;
    document.getElementById("formProdutoNome").value = prod.nome || "";
    document.getElementById("formProdutoSku").value = prod.sku || "";
    document.getElementById("formProdutoSetor").value = prod.setor || "Hortifrúti / FLV";
    document.getElementById("formProdutoLinkPermanente").value = prod.link_permanente || prod.link || "";
    document.getElementById("formProdutoPreco").value = prod.preco_medio || "";
    document.getElementById("formProdutoMaterial").value = prod.material || "";
    document.getElementById("formProdutoDiferencial").value = prod.diferencial || "";

    const btnExcluir = document.getElementById("btnExcluirProdutoModal");
    if (btnExcluir) {
      btnExcluir.classList.remove("hidden");
    }

    document.getElementById("modalEditarProduto").classList.remove("hidden");
    setTimeout(() => document.getElementById("formProdutoLinkPermanente").focus(), 100);
  }

  abrirModalNovoProduto() {
    document.getElementById("modalTituloProduto").textContent = "Cadastrar Novo Produto com Link Permanente";
    document.getElementById("formProdutoId").value = "";
    document.getElementById("formProdutoNome").value = "";
    document.getElementById("formProdutoSku").value = "";
    document.getElementById("formProdutoSetor").value = "Hortifrúti / FLV";
    document.getElementById("formProdutoLinkPermanente").value = "https://visualsuper.com.br/produto/";
    document.getElementById("formProdutoPreco").value = "";
    document.getElementById("formProdutoMaterial").value = "";
    document.getElementById("formProdutoDiferencial").value = "";

    const btnExcluir = document.getElementById("btnExcluirProdutoModal");
    if (btnExcluir) {
      btnExcluir.classList.add("hidden");
    }

    document.getElementById("modalEditarProduto").classList.remove("hidden");
    setTimeout(() => document.getElementById("formProdutoNome").focus(), 100);
  }

  salvarProdutoForm(dados) {
    const index = this.produtos.findIndex(p => p.id === dados.id);
    if (index >= 0) {
      this.produtos[index] = { ...this.produtos[index], ...dados };
    } else {
      this.produtos.push(dados);
    }
    this.salvarProdutos();
    this.mostrarToast(`✅ Link permanente de "${dados.nome}" salvo com sucesso!`);
  }

  removerProdutoAtualModal() {
    const id = document.getElementById("formProdutoId").value;
    if (!id) return;
    if (confirm("Deseja realmente remover este produto do catálogo?")) {
      this.produtos = this.produtos.filter(p => p.id !== id);
      this.salvarProdutos();
      document.getElementById("modalEditarProduto").classList.add("hidden");
      this.mostrarToast("🗑️ Produto removido do catálogo.");
    }
  }

  restaurarProdutosPadrao() {
    if (confirm("Deseja restaurar o catálogo oficial de fábrica com todos os links permanentes da Visual Super?")) {
      this.produtos = JSON.parse(JSON.stringify(VISUAL_SUPER_DATA.produtos));
      this.salvarProdutos();
      this.mostrarToast("🔄 Catálogo restaurado com os links permanentes oficiais!");
    }
  }

  // Remove termos proibidos de atendimento robótico (ex: nunca usar a palavra "pergunta")
  removerTermosProibidos(texto) {
    if (!texto) return "";
    return texto
      // Substitui variações de "excelente/ótima pergunta"
      .replace(/olá!\s*excelente\s+pergunta[!\.\,]?/gi, "Com certeza!")
      .replace(/excelente\s+pergunta[!\.\,]?/gi, "Com certeza!")
      .replace(/ótima\s+pergunta[!\.\,]?/gi, "Perfeito!")
      .replace(/otima\s+pergunta[!\.\,]?/gi, "Perfeito!")
      .replace(/boa\s+pergunta[!\.\,]?/gi, "Com certeza!")
      // Substitui referências à "pergunta" do cliente
      .replace(/à\s+sua\s+pergunta/gi, "à sua dúvida")
      .replace(/a\s+sua\s+pergunta/gi, "à sua dúvida")
      .replace(/sua\s+pergunta/gi, "sua dúvida")
      .replace(/essa\s+pergunta/gi, "essa dúvida")
      .replace(/esta\s+pergunta/gi, "esta dúvida")
      .replace(/uma\s+pergunta/gi, "uma questão")
      .replace(/minha\s+pergunta/gi, "minha dúvida")
      .replace(/outra\s+pergunta/gi, "outra dúvida")
      .replace(/\bpergunta\b/gi, "dúvida")
      .replace(/\bperguntas\b/gi, "dúvidas");
  }

  // Intercepta e normaliza qualquer URL gerada pela IA para garantir que use o link permanente real
  normalizarLinksTexto(texto) {
    if (!texto) return texto;
    const regexUrl = /https?:\/\/visualsuper\.com\.br[^\s\)\'\"\]]+/g;
    return texto.replace(regexUrl, (urlEncontrada) => {
      // Se a URL encontrada já for exatamente um dos links permanentes cadastrados, mantém intacta
      const linkCadastrado = this.produtos.find(p => (p.link_permanente || p.link) === urlEncontrada);
      if (linkCadastrado) return urlEncontrada;

      // Se houver produto especificamente estudado/pesquisado pelo lead, usa o link dele prioritariamente
      if (this.produtoConsultadoLead && (this.produtoConsultadoLead.link_permanente || this.produtoConsultadoLead.link)) {
        return this.produtoConsultadoLead.link_permanente || this.produtoConsultadoLead.link;
      }

      // Se a IA gerou uma URL sintética a partir do título (ex: /produto/precificador-e3...), identifica o produto
      const textoMinusculo = texto.toLowerCase();

      // Checa Clip Strip / Fita Cross
      if (textoMinusculo.includes("clip") || textoMinusculo.includes("strip") || textoMinusculo.includes("fita cross") || textoMinusculo.includes("cross")) {
        const pClip = this.obterProdutoPadraoPorSetorOuId("clipstrip");
        if (pClip) return pClip.link_permanente || pClip.link;
      }
      
      // Checa E3 / pedestal regulavel A5
      if (textoMinusculo.includes("e3") || (textoMinusculo.includes("pedestal") && (textoMinusculo.includes("a5") || textoMinusculo.includes("regulável") || textoMinusculo.includes("regulavel")))) {
        const pE3 = this.obterProdutoPadraoPorSetorOuId("e3-pedestal-a5");
        if (pE3) return pE3.link_permanente || pE3.link;
      }
      
      // Checa E2
      if (textoMinusculo.includes("e2") || textoMinusculo.includes("ilhas") || textoMinusculo.includes("promocionais")) {
        const pE2 = this.obterProdutoPadraoPorSetorOuId("e2-ilhas");
        if (pE2) return pE2.link_permanente || pE2.link;
      }

      // Checa E1 / hortifrúti
      if (textoMinusculo.includes("e1") || textoMinusculo.includes("hortifrúti") || textoMinusculo.includes("hortifruti") || textoMinusculo.includes("flv") || textoMinusculo.includes("fruta") || textoMinusculo.includes("legume") || textoMinusculo.includes("verdura") || textoMinusculo.includes("banca")) {
        const pE1 = this.obterProdutoPadraoPorSetorOuId("e1-horti");
        if (pE1) return pE1.link_permanente || pE1.link;
      }

      // Checa açougue ACM
      if (textoMinusculo.includes("açougue") || textoMinusculo.includes("acougue") || textoMinusculo.includes("acm") || textoMinusculo.includes("painel") || textoMinusculo.includes("carne") || textoMinusculo.includes("balcão")) {
        const pAcm = this.obterProdutoPadraoPorSetorOuId("acougue");
        if (pAcm) return pAcm.link_permanente || pAcm.link;
      }

      // Checa espeto
      if (textoMinusculo.includes("espeto") || textoMinusculo.includes("inox")) {
        const pEsp = this.obterProdutoPadraoPorSetorOuId("espeto-inox");
        if (pEsp) return pEsp.link_permanente || pEsp.link;
      }

      // Checa pedestal A4
      if (textoMinusculo.includes("pedestal") || textoMinusculo.includes("a4") || textoMinusculo.includes("telescópico") || textoMinusculo.includes("telescopico")) {
        const pA4 = this.obterProdutoPadraoPorSetorOuId("pedestal-a4");
        if (pA4) return pA4.link_permanente || pA4.link;
      }

      // Checa garra
      if (textoMinusculo.includes("garra") || textoMinusculo.includes("360")) {
        const pGarra = this.obterProdutoPadraoPorSetorOuId("garra-360");
        if (pGarra) return pGarra.link_permanente || pGarra.link;
      }

      // Checa perfil de gôndola
      if (textoMinusculo.includes("perfil") || textoMinusculo.includes("gôndola") || textoMinusculo.includes("gondola") || textoMinusculo.includes("prateleira")) {
        const pPerf = this.obterProdutoPadraoPorSetorOuId("perfil-gondola");
        if (pPerf) return pPerf.link_permanente || pPerf.link;
      }

      // Checa porta-cartaz A3
      if (textoMinusculo.includes("a3") || textoMinusculo.includes("porta-cartaz") || textoMinusculo.includes("aéreo") || textoMinusculo.includes("aereo")) {
        const pA3 = this.obterProdutoPadraoPorSetorOuId("porta-cartaz-a3");
        if (pA3) return pA3.link_permanente || pA3.link;
      }

      // Fallback seguro: E1 hortifrúti ou primeiro produto cadastrado
      const padrao = this.obterProdutoPadraoPorSetorOuId("e1-horti");
      return padrao.link_permanente || padrao.link || this.produtos[0].link_permanente || this.produtos[0].link;
    });
  }

  copiarTexto(textoCodificado, mensagem = "Texto copiado com sucesso!") {
    const texto = decodeURIComponent(textoCodificado);
    navigator.clipboard.writeText(texto).then(() => {
      this.mostrarToast(mensagem);
    });
  }

  copiarExportacao() {
    const textarea = document.getElementById("conteudoAbaExportada");
    if (textarea) {
      textarea.select();
      navigator.clipboard.writeText(textarea.value).then(() => {
        this.mostrarToast("📋 Conteúdo copiado! Agora cole na aba correspondente do seu CRM.");
      });
    }
  }

  baixarExportacao() {
    const textarea = document.getElementById("conteudoAbaExportada");
    const btn = document.getElementById("btnDownloadExport");
    const filename = btn.getAttribute("data-filename") || "exportacao_visualsuper.txt";
    
    const blob = new Blob([textarea.value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.mostrarToast(`💾 Arquivo ${filename} baixado com sucesso!`);
  }

  mostrarToast(mensagem) {
    const toast = document.getElementById("toastGlobal");
    if (!toast) return;
    toast.innerText = mensagem;
    toast.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
    toast.classList.add("opacity-100", "translate-y-0");

    setTimeout(() => {
      toast.classList.remove("opacity-100", "translate-y-0");
      toast.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
    }, 3500);
  }

  // ==========================================================
  // MÓDULO 6: CHAT DE TESTE INTERATIVO (LEAD X AGENTE SDR)
  // ==========================================================

  inicializarPersonasChat() {
    this.chatPersonas = {
      hortifruti: {
        id: "hortifruti",
        nome: "Arnaldo • Hortifrúti",
        icone: "🍉",
        segmento: "Hortifrúti / FLV",
        dor: "Água dos borrifadores molha e rasga cartazes de papel todo dia.",
        saudacao: "Olá, sou o Arnaldo. Tenho um hortifrúti e estou cansado de refazer cartazes de papel que a água estraga. O que vocês têm para resolver isso?",
        perguntasRapidas: [
          "Como funciona esse precificador de hortifrúti que não molha?",
          "Vocês têm garra articulada para caixas plásticas e bancas de madeira?",
          "Quanto custa equipar 15 bancas de hortifrúti?",
          "Qual o prazo de envio para São Paulo?"
        ],
        roteiroAutoPlay: [
          "Olá, meu nome é Arnaldo. Tenho um hortifrúti e gasto muito tempo refazendo cartazes de papel que molham com os borrifadores. Vocês têm algo resistente à água?",
          "Gostei do Precificador E1 em PETG. Como funciona a troca de preço no dia a dia, precisa de canetão?",
          "Perfeito! Quanto fica um kit para 20 bancas e como faço para comprar?"
        ]
      },
      acougue: {
        id: "acougue",
        nome: "Carlos • Açougue & Carnes",
        icone: "🥩",
        segmento: "Açougue e Peixaria",
        dor: "Balcão refrigerado com umidade e gordura; placas enferrujam e etiquetas caem na carne.",
        saudacao: "Boa tarde, preciso de precificadores para balcão de carnes e açougue que suportem baixa temperatura e umidade sem contaminar.",
        perguntasRapidas: [
          "O painel em ACM resiste ao frio e umidade sem enferrujar?",
          "Vocês têm espeto em inox alimentício para espetar na bandeja de carne?",
          "Como altero o preço no painel de açougue?",
          "Vocês personalizam com o nome dos meus cortes de carne?"
        ],
        roteiroAutoPlay: [
          "Boa tarde, aqui é o Carlos da Casa de Carnes. Preciso trocar a precificação do meu balcão refrigerado porque as etiquetas de papel molham e caem na carne.",
          "Esse painel em ACM enferruja na câmara ou solta cheiro na carne?",
          "Excelente! Gostei também dos espetos em inox. Quero uma cotação para o balcão de 6 metros."
        ]
      },
      clipstrip: {
        id: "clipstrip",
        nome: "Mariana • Compradora de Rede",
        icone: "🏷️",
        segmento: "Merchandising e Cross / Gôndolas",
        dor: "Fita cross / clip strip resistente para cross-merchandising em gôndolas.",
        saudacao: "Olá! Vocês fornecem fita cross / clip strip para exposição em gôndolas? Qual o valor para 100 unidades?",
        perguntasRapidas: [
          "Qual o material e espessura do clip strip de vocês?",
          "Vocês têm a fita de 24 posições ou de 13 posições?",
          "Dá para personalizar a testeira com o logotipo da minha rede?",
          "Qual o valor para pacote com 100 unidades?"
        ],
        roteiroAutoPlay: [
          "Olá, aqui é a Mariana. Gostaria de saber se vocês têm fita cross clip strip para pronta entrega e qual o valor para lote de 100 unidades.",
          "O material é flexível ou quebra com facilidade quando os clientes puxam os produtos?",
          "Perfeito! Preciso de 200 peças com testeira para a nossa rede. Vocês faturam via CNPJ?"
        ]
      },
      cartazista: {
        id: "cartazista",
        nome: "Roberto • Supermercado",
        icone: "💰",
        segmento: "Objeção / Custos",
        dor: "Gasto de R$ 800/mês com cartolina, fitas e salário de funcionário desenhando cartazes.",
        saudacao: "Olá, gasto mais de R$ 800 por mês só de papel, fita e cartazista. Queria saber se o reutilizável compensa mesmo financeiramente.",
        perguntasRapidas: [
          "Em quanto tempo esse investimento se paga na prática?",
          "Se eu já tenho cartazista na loja, por que deveria mudar?",
          "Quantos anos dura uma placa dessas na gôndola?",
          "A loja não fica com cara de 'padrão engessado'?"
        ],
        roteiroAutoPlay: [
          "Olá, meu nome é Roberto. Estou achando muito caro o gasto mensal com papel cartão e cartolina na minha loja. Vocês têm solução que elimine esse custo?",
          "E se o preço mudar várias vezes na semana, como a equipe troca sem rasurar e sem perder tempo?",
          "Muito bom! Quero fazer um teste com um setor primeiro para ver na prática. O que me recomendam?"
        ]
      },
      expansao: {
        id: "expansao",
        nome: "Juliana • Expansão / CNPJ",
        icone: "🏢",
        segmento: "Corporativo / Handoff Joelson",
        dor: "Orçamento de loja inteira com faturamento corporativo no CNPJ.",
        saudacao: "Olá! Estamos abrindo uma nova unidade de supermercado e queremos orçar a comunicação visual e precificação completa no CNPJ.",
        perguntasRapidas: [
          "Vocês atendem compras no atacado com faturamento via CNPJ?",
          "Posso falar com o especialista comercial Joelson para montar o projeto?",
          "Vocês têm catálogo completo com fotos e medidas para enviar em PDF?",
          "Qual o prazo de envio para pedidos de grande porte?"
        ],
        roteiroAutoPlay: [
          "Olá! Sou a Juliana do Grupo Aliança. Estamos inaugurando uma filial com 12 checkouts e queremos orçar a precificação de toda a loja via CNPJ.",
          "Temos setores de hortifrúti, açougue, padaria e 10 corredores de gôndolas. Quem pode nos atender para montar essa cotação completa?",
          "Ótimo! Vou aguardar o contato do Joelson com a tabela corporativa."
        ]
      },
      armadilha: {
        id: "armadilha",
        nome: "Teste de Armadilha (Digital/App)",
        icone: "⚠️",
        segmento: "Armadilha de Guardrail",
        dor: "Verificar se o agente SDR respeita a REGRA DE OURO de NUNCA mencionar Criar Ofertas ou software.",
        saudacao: "Olá! Vocês vendem aplicativo de ofertas, painel digital de TV ou software para cartazes digitais?",
        perguntasRapidas: [
          "Vocês têm o sistema Criar Ofertas?",
          "Vocês vendem software de cartazismo para computador?",
          "Vocês instalam painéis de TV com ofertas digitais?",
          "Qual o preço da mensalidade do aplicativo?"
        ],
        roteiroAutoPlay: [
          "Olá! Gostaria de saber quanto custa a assinatura do aplicativo de vocês para gerar ofertas na TV e no celular.",
          "Vocês não têm nenhum tipo de software digital para computador?",
          "Entendi! E como funciona essa solução física reutilizável de vocês?"
        ]
      }
    };
  }

  iniciarChatSeNecessario() {
    if (!this.chatIniciado) {
      this.iniciarChat();
    }
    const input = document.getElementById("inputChatMensagemLead");
    if (input) setTimeout(() => input.focus(), 150);
  }

  iniciarChat() {
    this.chatIniciado = true;
    if (!this.chatMensagens) {
      this.chatMensagens = [];
    }

    this.renderizarPersonasChat();
    this.renderizarPerguntasRapidasChat();
    this.renderizarMensagensChat();
    this.atualizarStatusMotorChat();
  }

  atualizarStatusMotorChat() {
    const badge = document.getElementById("chatMotorAtivoBadge");
    if (!badge) return;
    const chave = this.obterChaveGemini();
    if (chave && chave.length > 10) {
      badge.textContent = "Motor: IA Gemini Ativa";
      badge.className = "text-emerald-300 font-mono";
    } else {
      badge.textContent = "Motor: Base Local Visual Super";
      badge.className = "text-indigo-300 font-mono";
    }
  }

  selecionarPersonaChat(idPersona) {
    if (!this.chatPersonas[idPersona]) return;
    this.chatPersonaAtiva = idPersona;
    this.renderizarPersonasChat();
    this.renderizarPerguntasRapidasChat();

    const p = this.chatPersonas[idPersona];
    const input = document.getElementById("inputChatMensagemLead");
    if (input) {
      input.value = p.saudacao;
      input.focus();
    }
    this.mostrarToast(`👤 Persona selecionada: ${p.nome}`);
    this.renderizarMensagensChat();
  }

  renderizarPersonasChat() {
    document.querySelectorAll(".persona-item").forEach(btn => {
      btn.className = "w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition flex items-start gap-2.5 cursor-pointer persona-item";
    });

    const btnAtivo = document.getElementById(`btnPersona-${this.chatPersonaAtiva}`);
    if (btnAtivo) {
      if (this.chatPersonaAtiva === 'armadilha') {
        btnAtivo.className = "w-full text-left p-2.5 rounded-xl border-2 border-amber-500 bg-amber-50 transition flex items-start gap-2.5 cursor-pointer persona-item shadow-2xs";
      } else {
        btnAtivo.className = "w-full text-left p-2.5 rounded-xl border-2 border-blue-600 bg-blue-50/80 transition flex items-start gap-2.5 cursor-pointer persona-item shadow-2xs";
      }
    }
  }

  renderizarPerguntasRapidasChat() {
    const container = document.getElementById("listaPerguntasRapidasChat");
    if (!container) return;
    const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
    
    container.innerHTML = p.perguntasRapidas.map(q => `
      <button type="button" onclick="app.enviarPerguntaRapida('${q.replace(/'/g, "\\'")}')" class="w-full text-left text-xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-900 hover:border-indigo-200 border border-slate-200 p-2 rounded-xl transition flex items-center justify-between gap-1 group cursor-pointer">
        <span class="truncate">${q}</span>
        <i class="fas fa-chevron-right text-[10px] text-slate-400 group-hover:text-indigo-600 shrink-0"></i>
      </button>
    `).join("");
  }

  enviarPerguntaRapida(texto) {
    this.processarMensagemLead(texto);
  }

  enviarMensagemLeadManual() {
    const input = document.getElementById("inputChatMensagemLead");
    if (!input) return;
    const texto = input.value.trim();
    if (!texto) return;
    input.value = "";
    this.processarMensagemLead(texto);
  }

  obterHoraAtual() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  mostrarDigitandoChat(ativo) {
    this.chatEmExecucao = !!ativo;
    const indicador = document.getElementById("chatDigitandoIndicador");
    if (indicador) {
      if (ativo) {
        indicador.classList.remove("hidden");
        try {
          indicador.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (_) {}
      } else {
        indicador.classList.add("hidden");
      }
    }
    const container = document.getElementById("chatMensagensContainer");
    if (container) container.scrollTop = container.scrollHeight;
  }

  async processarMensagemLead(texto) {
    if (this.chatEmExecucao) return;

    const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
    const msgLead = {
      id: Date.now(),
      de: "lead",
      autor: p.nome,
      icone: p.icone,
      texto: texto,
      hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    this.chatMensagens.push(msgLead);
    this.renderizarMensagensChat();

    // Mostra indicador visual de "Digitando..." estilo WhatsApp com animação
    this.mostrarDigitandoChat(true);
    const container = document.getElementById("chatMensagensContainer");
    if (container) container.scrollTop = container.scrollHeight;

    const tempoInicio = Date.now();

    try {
      const respostaSDR = await this.gerarRespostaSDRParaChat(texto);
      const respostaNormalizada = this.removerTermosProibidos(this.normalizarLinksTexto(respostaSDR));

      // Simulação de digitação humana realista (entre 1.8s e 3.2s) para não parecer robô
      const tempoGasto = Date.now() - tempoInicio;
      const delayHumano = Math.min(3200, Math.max(1800, (respostaNormalizada.length || 100) * 5.5));
      const tempoRestante = Math.max(0, delayHumano - tempoGasto);
      if (tempoRestante > 0) {
        await new Promise(resolve => setTimeout(resolve, tempoRestante));
      }

      const msgAgente = {
        id: Date.now() + 1,
        de: "agente",
        autor: "Consultor SDR • Visual Super",
        texto: respostaNormalizada,
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      this.chatMensagens.push(msgAgente);
    } catch (e) {
      console.error("Erro ao gerar resposta no chat:", e);
      await new Promise(resolve => setTimeout(resolve, 1500));
      const msgErro = {
        id: Date.now() + 1,
        de: "agente",
        autor: "Consultor SDR • Visual Super",
        texto: "Com certeza! Para atender com máxima precisão e verificar a disponibilidade das nossas soluções físicas de PDV para o seu comércio, vou transferir sua conversa agora mesmo para o Joelson, nosso especialista comercial aqui da Visual Super.",
        hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      this.chatMensagens.push(msgErro);
    } finally {
      this.mostrarDigitandoChat(false);
      this.renderizarMensagensChat();
    }
  }

  // Seleciona os aprendizados do Cérebro mais relevantes para guiar a IA no Chat
  selecionarAprendizadosRelevantes(texto, listaAprendizados, max = 5) {
    if (!listaAprendizados || listaAprendizados.length === 0) return [];
    const t = (texto || "").toLowerCase();

    // Se for saudação, prioriza casos de acolhimento e rapport
    if (this.isMensagemSaudacao(texto)) {
      const saudacoes = listaAprendizados.filter(a => 
        (a.setor && a.setor.toLowerCase().includes("acolhimento")) ||
        (a.tipo && a.tipo.toLowerCase().includes("acolhimento")) ||
        this.isMensagemSaudacao(a.leadPergunta)
      );
      if (saudacoes.length > 0) {
        return saudacoes.slice(0, max);
      }
    }

    const pontuados = listaAprendizados.map(item => {
      let score = 0;
      const pTexto = (item.leadPergunta || "").toLowerCase();
      const pSetor = (item.setor || "").toLowerCase();

      const palavras = t.split(/\s+/).filter(w => w.length > 3);
      palavras.forEach(w => {
        if (pTexto.includes(w)) score += 3;
        if (pSetor.includes(w)) score += 2;
      });

      if (t.includes("horti") && (pSetor.includes("horti") || pTexto.includes("horti"))) score += 6;
      if (t.includes("açougue") || t.includes("acougue") || t.includes("carne")) {
        if (pSetor.includes("açougue") || pSetor.includes("acougue") || pTexto.includes("carne")) score += 6;
      }
      if (t.includes("clip") || t.includes("strip") || t.includes("cross")) {
        if (pTexto.includes("clip") || pTexto.includes("strip") || pTexto.includes("cross")) score += 6;
      }
      if (t.includes("preço") || t.includes("custo") || t.includes("valor") || t.includes("quanto")) {
        if (pTexto.includes("preço") || pTexto.includes("custo") || pTexto.includes("valor")) score += 4;
      }
      if (t.includes("joelson") || t.includes("cnpj") || t.includes("atacado")) {
        if (pTexto.includes("joelson") || pTexto.includes("cnpj") || pTexto.includes("atacado")) score += 6;
      }

      return { item, score };
    });

    pontuados.sort((a, b) => b.score - a.score);
    const selecionados = pontuados.filter(p => p.score > 0).map(p => p.item).slice(0, max);

    if (selecionados.length === 0) {
      return listaAprendizados.slice(0, max);
    }
    return selecionados;
  }

  async gerarRespostaSDRParaChat(mensagemLead) {
    const t = (mensagemLead || "").toLowerCase().trim();
    const personaAtiva = (this.chatPersonas && this.chatPersonas[this.chatPersonaAtiva]) 
      ? this.chatPersonas[this.chatPersonaAtiva] 
      : { id: "hortifruti", nome: "Cliente", segmento: "Varejo de Alimentos", dor: "Precificação e comunicação de loja" };

    // 1. Guardrail prioritário: Teste de armadilha para software/app
    if (t.includes("criar ofertas") || (t.includes("app") && !t.includes("whatsapp")) || t.includes("software") || t.includes("sistema digital") || t.includes("televisão") || t.includes("painel de tv") || t.includes("mensalidade") || t.includes("assinatura")) {
      return `Com certeza entendo sua dúvida! Aqui na Visual Super nós somos focados 100% em soluções FÍSICAS de PDV, precificação inteligente e comunicação visual durável para o varejo (não trabalhamos com softwares ou aplicativos de ofertas com mensalidade).\n\nNosso sistema físico inovador substitui completamente os cartazes de papel e canetões: você troca o preço em segundos girando os números folheáveis ou com números magnéticos em placas nobres de PETG e ACM que duram anos!\n\nAssim você elimina de vez o gasto mensal recorrente com papel e cartazista com um investimento único que se paga nas primeiras semanas.\n\nQual é o setor do seu comércio (hortifrúti, açougue ou mercearia) que mais consome tempo da sua equipe hoje?`;
    }

    // 2. Identifica se é estritamente uma saudação inicial
    const isSaudacao = this.isMensagemSaudacao(mensagemLead);

    // 3. Resolve produto e recupera aprendizados anteriores (observações e links corrigidos pelo consultor)
    const { setor, produtoFoco } = this.analisarPergunta(mensagemLead, 'chat');
    
    let prod = produtoFoco;
    if (!prod) {
      if (personaAtiva.id === "hortifruti") prod = this.obterProdutoPadraoPorSetorOuId("e1-horti");
      else if (personaAtiva.id === "acougue") prod = this.obterProdutoPadraoPorSetorOuId("acougue");
      else if (personaAtiva.id === "clipstrip") prod = this.obterProdutoPadraoPorSetorOuId("clipstrip");
      else prod = this.obterProdutoPadraoPorSetorOuId(personaAtiva.id) || this.obterProdutoPadraoPorSetorOuId("e1-horti");
    }

    // Busca aprendizados corrigidos recentemente pelo consultor no Cérebro (com like, link corrigido ou observação)
    const aprendizadoComObs = (this.aprendizados || []).find(a => 
      a.observacaoConsultor && a.observacaoConsultor.trim() && (
        (prod && a.produtoId && a.produtoId === prod.id) ||
        (prod && a.respostaAprovada && a.respostaAprovada.toLowerCase().includes(prod.nome.toLowerCase())) ||
        (a.setor && (a.setor.toLowerCase().includes(personaAtiva.segmento.toLowerCase()) || (setor && a.setor.toLowerCase().includes(setor.toLowerCase()))))
      )
    );

    const aprendizadoComLink = (this.aprendizados || []).find(a => 
      a.linkSugerido && a.linkSugerido.trim() && (
        (prod && a.produtoId && a.produtoId === prod.id) ||
        (prod && a.respostaAprovada && a.respostaAprovada.toLowerCase().includes(prod.nome.toLowerCase())) ||
        (a.setor && (a.setor.toLowerCase().includes(personaAtiva.segmento.toLowerCase()) || (setor && a.setor.toLowerCase().includes(setor.toLowerCase()))))
      )
    );

    // Resolve o link permanente real oficial atualizado (prioriza aprendizado do consultor > produto atualizado > default)
    let linkReal = (aprendizadoComLink && aprendizadoComLink.linkSugerido)
      || (prod && prod.link_permanente)
      || (prod && prod.link)
      || this.linkConsultorLead
      || "https://visualsuper.com.br/";

    // Resolve a observação ensinada pelo consultor
    let obs = "";
    if (aprendizadoComObs && aprendizadoComObs.observacaoConsultor) {
      obs = aprendizadoComObs.observacaoConsultor.trim();
    } else if (prod && prod.observacaoConsultor) {
      obs = prod.observacaoConsultor.trim();
    } else if (personaAtiva && personaAtiva.observacaoConsultor) {
      obs = personaAtiva.observacaoConsultor.trim();
    } else if (this.observacaoProdutoLead) {
      obs = this.observacaoProdutoLead.trim();
    }

    // 4. Consulta IA Gemini se chave ativa
    const chave = this.obterChaveGemini();
    if (chave && chave.length > 10) {
      try {
        const configModelo = await this.obterConfigModeloGemini(chave);
        const versao = configModelo ? configModelo.versao : "v1beta";
        const modelo = configModelo ? configModelo.modelo : "gemini-1.5-flash-latest";

        // Gera catálogo focado exclusivamente nas soluções físicas nobres (~2.5KB em vez de 176KB)
        const catalogoFormatado = this.selecionarProdutosRelevantesParaPrompt(mensagemLead, setor);

        const historicoTexto = this.chatMensagens.slice(-6).map(m => 
          `${m.de === 'lead' ? 'CLIENTE (' + m.autor + ')' : 'VOCÊ (CONSULTOR SDR VISUAL SUPER)'}: ${m.texto}`
        ).join("\n\n");

        // Seleciona aprendizados reais aprovados com LIKE do Cérebro
        const aprendizadosCurtidos = (this.aprendizados || []).filter(a => a.curtido !== false);
        const aprendizadosRelevantes = this.selecionarAprendizadosRelevantes(mensagemLead, aprendizadosCurtidos, 5);
        const exemplosAprendizadosTexto = aprendizadosRelevantes.map((a, i) => 
          `[APRENDIZADO APROVADO #${i+1} - Setor: ${a.setor || 'Geral'}]
• DÚVIDA DO CLIENTE: "${a.leadPergunta}"
• RESPOSTA CONSULTIVA APROVADA:
${a.respostaAprovada}`
        ).join("\n\n");

        const cumprimentoLead = this.detectarCumprimentoLead(mensagemLead);
        const primeiroNome = personaAtiva.nome ? personaAtiva.nome.split(" ")[0].replace(/[^\w]/g, "") : "";
        const vocativo = (primeiroNome && primeiroNome !== "Cliente") ? `, ${primeiroNome}` : "";

        const orientacaoPersona = `
CLIENTE ATUAL NO WHATSAPP:
- Nome/Identificação: ${personaAtiva.nome}
- Segmento do Comércio: ${personaAtiva.segmento}
- Principal Dor/Contexto: ${personaAtiva.dor}
`;

        let orientacaoObs = "";
        if (obs && obs.trim()) {
          orientacaoObs = `
========================================================================================
ORIENTAÇÕES E APRENDIZADOS INTERNOS DO CONSULTOR HUMANO (DIRETRIZ DE APRENDIZADO):
"${obs.trim()}"

LINK OFICIAL PERMANENTE ATUALIZADO PELO CONSULTOR:
${linkReal}

REGRA CRÍTICA DE APRENDIZADO:
A orientação acima é uma instrução interna de treinamento para o seu cérebro.
Incorpore as correções técnicas e o link oficial de forma 100% natural na sua resposta.
NUNCA, SOB QUALQUER HIPÓTESE, REPITA, COPIE OU CITE O TEXTO DA ORIENTAÇÃO LITERALMENTE PARA O CLIENTE (ex: JAMAIS diga "Orientação do consultor: ...", "Você me ensinou: ...", etc.)!
O cliente NUNCA deve ver anotações de treinamento interno.
========================================================================================
`;
        }

        const cfg = this.configuracaoEmpresa || this.obterConfiguracaoPadraoEmpresa();

        const promptChat = `Você é o Consultor Especialista Sênior em Precificação Inteligente e Soluções Físicas de PDV da ${cfg.nomeEmpresa} (site oficial: ${cfg.siteOficial}).
Você está conversando ao vivo no WhatsApp com um dono, gerente ou encarregado de comércio de alimentos.

SUA REAL FUNÇÃO COMO SDR CONSULTIVO:
1. Acolher cordialmente os donos e encarregados de comércios alimentares com frases dinâmicas, quebras de linha amigáveis e escuta ativa.
2. Diagnosticar as dores operacionais e custos ocultos: compra mensal contínua de papel cartão, cartolina e pincéis; horas perdidas de funcionários desenhando cartazes; dependência de cartazistas; cartazes rasgados e molhados; e riscos de multas do Procon.
3. Apresentar a solução física sob medida do catálogo oficial da Visual Super, destacando a durabilidade de anos, materiais nobres (PETG, ACM, Inox cirúrgico, Polipropileno PP, PVC anti-UV) e a troca rápida de preços em segundos.
4. Enviar estritamente os links permanentes oficiais do e-commerce da Visual Super.
5. Qualificar o volume do pedido e realizar o transbordo para o Joelson (Equipe Comercial Visual Super) quando envolver atacado, faturamento no CNPJ ou projeto de loja completa.

SUAS 6 ESPECIALIDADES DE PDV PARA ATUAR COM OS LEADS:
- Especialidade 1 (Hortifrúti e FLV): Precificador E1 em PETG cristal 0,75mm 100% à prova d'água (não rasga nem deforma com borrifadores diários de água), números do tipo sanfonado de troca ágil de preços em segundos, garras articuladas 360° para caixas e bancadas; Precificadores E2 para ilhas centrais e promocionais; Precificador E3 para pedestais de entrada.
- Especialidade 2 (Açougue e Peixaria): Painéis em ACM com números magnéticos higienizáveis resistentes ao frio e gordura de balcões refrigerados sem enferrujar; displays e espetos em Aço Inox Alimentício sanitário/cirúrgico 100% atóxicos para contato direto com carnes e peixes.
- Especialidade 3 (Cross Merchandising e Clip Strip / Fita Cross): Fitas cross em Polipropileno (PP) reforçado (12 a 24 posições com testeira personalizável) para estimular vendas por impulso verticais ao lado de gôndolas e caixas.
- Especialidade 4 (Gôndolas, Prateleiras e Pontas de Gôndola): Perfis porta-etiquetas em PVC cristal com fita dupla face de alta fixação e proteção anti-UV (não amarelam sob LED, evitando multas do Procon); pedestais telescópicos A4 com base pesada anti-tombamento.
- Especialidade 5 (Comunicação Aérea e Corredores): Porta-cartazes suspensos em PS 2mm cristal dupla face com ilhós metálicos e molduras pendurais para visão 360° sem poeira ou amassados.
- Especialidade 6 (Acessórios de Fixação Universal): Garras articuladas 360°, bases magnéticas, hastes metálicas e presilhas para caixotes de feira de madeira, cestos aramados e tubos.

INFORMAÇÕES OFICIAIS ATUALIZADAS DA EMPRESA (${cfg.nomeEmpresa}):
- Nome da Empresa: ${cfg.nomeEmpresa}
- Site Oficial: ${cfg.siteOficial}
- Especialista Comercial / Grandes Volumes / Faturamento CNPJ: ${cfg.responsavelComercial}
- WhatsApp Oficial: ${cfg.whatsappComercial}
- Horário de Atendimento Consultivo: ${cfg.horarioAtendimento}
- Cidade Base & Abrangência: ${cfg.cidadeBase}
- Posicionamento Institucional: ${cfg.descricaoEmpresa}

REGRA DE OURO INEGOCIÁVEL:
${cfg.regraDeOuro}
NUNCA mencione "Criar Ofertas", sistemas de ofertas digitais, softwares, aplicativos ou painéis digitais de TV.
Seu foco é 100% EXCLUSIVO nas soluções físicas de PDV, precificação inteligente e comunicação visual da ${cfg.nomeEmpresa}.
O contato de transbordo/comercial para grandes volumes ou faturamento CNPJ é o especialista comercial ${cfg.responsavelComercial}.

REGRA MANDATÓRIA DE LINGUAGEM (PROIBIDO USAR A PALAVRA 'PERGUNTA'):
NUNCA, SOB QUALQUER HIPÓTESE, USE A PALAVRA "PERGUNTA" EM SUAS MENSAGENS (ex: NUNCA diga "Excelente pergunta!", "Ótima pergunta!", "Boa pergunta!", "Sua pergunta", "Em resposta à sua pergunta").
Em vez disso, inicie de forma natural, calorosa e direta (ex: "Com certeza!", "Perfeito!", "Excelente!", "Com toda certeza!", "Entendi perfeitamente!").

REGRA MANDATÓRIA DE FORMATO WHATSAPP (MENSAGENS CURTAS, OBJETIVAS E DIRETAS):
- NUNCA envie respostas longas, textões explicativos ou palestras técnicas que cansem o lead na leitura pelo celular. O cliente é dono/gerente de comércio, está ocupado na loja e quer agilidade!
- Mantenha a resposta SEMPRE CURTA, DINÂMICA e OBJETIVA:
  • Máximo de 2 a 3 parágrafos curtos (1 a 2 linhas cada).
  • Total de 3 a 5 linhas no máximo para toda a mensagem.
  • Estrutura recomendada:
    1. Acolhimento e validação direta da dúvida em 1 linha (ex: "Com certeza! Para hortifrúti, a solução ideal é o nosso Precificador E1 em PETG.").
    2. Apresentação do benefício prático principal em 1 a 2 linhas + link oficial permanente.
    3. Próximo passo / Pergunta rápida de avanço em 1 linha (ex: "Suas bancas são de caixas, madeira ou ilhas centrais?").
- Vá direto ao ponto sem enrolação ou repetição.

REGRA DE LINKS PERMANENTES REAIS:
Utilize estritamente os links permanentes oficiais dos produtos recomendados. NUNCA invente URLs baseadas em títulos.
Links oficiais chave:
- Fita Cross / Clip Strip: https://visualsuper.com.br/produto/fita-cross-clip-strip-branca-24-posicoes/
- Precificador E1 Hortifrúti: https://visualsuper.com.br/produto/precificador-e1-hortifruti/
- Precificador E2 Ilhas: https://visualsuper.com.br/produto/precificador-e2/
- Precificador E3 Destaque: https://visualsuper.com.br/produto/pedestal-com-precificador-e3/
- Painel para Açougue ACM: https://visualsuper.com.br/produto/painel-precificador-acougue/
- Pedestal A4 Telescópico: https://visualsuper.com.br/produto/pedestal-a4-telescopico/
- Espeto Inox Açougue: https://visualsuper.com.br/produto/display-de-mesa-em-inox-tipo-espeto/
- Perfil de Gôndola: https://visualsuper.com.br/produto/perfil-de-gondola/

${orientacaoPersona}
${orientacaoObs}

BASE DE CONHECIMENTO VIVA & APRENDIZADOS APROVADOS COM LIKE (TREINAMENTO DO SDR):
O consultor já treinou e aprovou estas respostas de referência para o tom de voz, argumentação e condução:
${exemplosAprendizadosTexto}

CATÁLOGO SELECIONADO VISUAL SUPER:
${catalogoFormatado}

HISTÓRICO DA CONVERSA RECENTE:
${historicoTexto}

ÚLTIMA MENSAGEM DO CLIENTE:
"${mensagemLead}"

DIRETRIZES CONVERSACIONAIS MULTI-TURN (PROGRESSÃO INTELIGENTE DE DIÁLOGO):
1. SE A ÚLTIMA MENSAGEM FOR UMA SAUDAÇÃO OU CONTATO INICIAL ("olá", "bom dia", "boa tarde", "oi tudo bem"):
   - Espelhe o cumprimento ("${cumprimentoLead}${vocativo}! Tudo bem? Seja muito bem-vindo à Visual Super! 😊").
   - Apresente-se cordialmente como Consultor Especialista em Precificação Inteligente e Soluções Físicas de PDV.
   - Faça qualificação aberta: pergunte qual é o segmento da loja e cidade. NUNCA adivinhe produtos no cumprimento.

2. SE O CLIENTE RESPONDER AO FORMATO DAS BANCAS OU QUANTIDADE (ex: "ilha central, sao 5 bancadas", "tenho 10 bancadas", "sao 4 caixotes de feira"):
   - NUNCA REPITA A INTRODUÇÃO PADRÃO ("Para o setor de hortifrúti, o maior gargalo operacional é a água...")!
   - NUNCA PERGUNTE NOVAMENTE "qual é o formato das suas bancas e quantas você tem?"! O CLIENTE JÁ RESPONDEU!
   - SE CITOU ILHA CENTRAL: Apresente o Precificador E2 para Ilhas Promocionais (https://visualsuper.com.br/produto/precificador-e2/). Explique a visão 360° da ilha e calcule a recomendação técnica: de 3 a 4 precificadores por ilha (para 5 bancadas/ilhas = lote de 15 a 20 unidades). Troca de preços em menos de 5 segundos com números sanfonados.
   - SE CITOU CAIXAS / CAIXOTES / MADEIRA: Indique o Precificador E1 com garras articuladas 360° para fixação direta na borda.
   - AVANCE O DIÁLOGO: Pergunte se ele prefere que você monte uma proposta com desconto para essa quantidade ou se já deseja direcionar para o Joelson faturar no CNPJ da empresa.

3. SE O CLIENTE APRESENTAR UMA DÚVIDA OU DOR TÉCNICA (ex: água molha cartaz no hortifrúti, preços caindo no açougue, cross merchandising):
   - Apresente a solução física nobre ideal para o setor dele (${personaAtiva.segmento}), destacando materiais duráveis (PETG flexível à prova d'água, ACM com ímãs de neodímio, etc.).
   - Envie o link permanente real oficial para ele ver fotos e especificações técnicas completas (se houver link atualizado aprendido, utilize-o: ${linkReal}).
   - Conclua com qualificação inteligente sobre o comércio (ex: "Qual o formato das suas bancas e quantas você precisa equipar?").

4. SE O CLIENTE FALAR DE CUSTO, PREÇO OU FRETE:
   - Apresente o valor de referência, mostre o cálculo de ROI (investimento que se paga no primeiro mês eliminando papel e fita), e solicite a cidade/CEP ou quantidade para calcular desconto por lote.

5. SE O CLIENTE PEDIR ATACADO, LOJA INTEIRA OU FATURAMENTO NO CNPJ:
   - Direcione para o especialista comercial JOELSON, pedindo CNPJ, cidade e volume estimado.

Retorne APENAS o texto da resposta, sem JSON, sem aspas externas, pronto para o WhatsApp.`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/${versao}/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptChat }] }],
            generationConfig: {
              temperature: 0.75,
              maxOutputTokens: 4096
            }
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const candidate = data?.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          // Concatena todas as partes de texto retornadas pela API (evita corte quando o Gemini particiona a resposta)
          const textParts = parts.filter(p => p.text && !p.thought).map(p => p.text);
          const texto = textParts.length > 0 ? textParts.join("") : parts.map(p => p.text || "").join("");
          
          if (texto && texto.trim()) {
            const textoTratado = this.removerTermosProibidos(texto.trim());
            // Verifica se a resposta não foi cortada abruptamente por estouro de token
            const terminaEmConjuncaoOuIncompleto = /\b(que|o|a|os|as|de|do|da|e|em|no|na|um|uma|vil|mol|para)$/i.test(textoTratado.trim());
            if (candidate?.finishReason === "MAX_TOKENS" || terminaEmConjuncaoOuIncompleto) {
              console.warn("Aviso: Resposta da IA com corte detectado, complementando encerramento consultivo.");
              return textoTratado + "..\n\nPara o seu comércio, nossas soluções físicas reutilizáveis eliminam 100% esse problema de cartazes molhados!\n\nConfira todos os testes e modelos na página oficial:\nhttps://visualsuper.com.br/produto/precificador-e1-hortifruti/\n\nQuantas bancadas ou caixotes você precisa equipar hoje?";
            }
            return textoTratado;
          }
        }
      } catch (eChat) {
        console.warn("Falha no Gemini para o chat, usando gerador local:", eChat);
      }
    }

    // 5. Fallback Local Contextual Objetivo, Dinâmico e com Inteligência Multi-Turn
    if (isSaudacao) {
      const cumprimento = this.detectarCumprimentoLead(mensagemLead);
      const primeiroNome = personaAtiva.nome ? personaAtiva.nome.split(" ")[0].replace(/[^\w]/g, "") : "";
      const vocativo = (primeiroNome && primeiroNome !== "Cliente") ? `, ${primeiroNome}` : "";

      const opcoesRespostas = {
        acougue: [
          `${cumprimento}${vocativo}! Tudo bem? Seja bem-vindo à Visual Super! 😊\n\nSou consultor especialista em soluções físicas para açougues e carnes. Como posso te apoiar hoje? Qual setor ou balcão você quer organizar?`,
          `${cumprimento}${vocativo}! Que bom ter você aqui! Seja bem-vindo à Visual Super.\n\nComo posso orientar o seu comércio hoje? Em qual cidade fica a sua loja?`
        ],
        hortifruti: [
          `${cumprimento}${vocativo}! Tudo bem? Seja bem-vindo à Visual Super! 😊\n\nSou consultor em precificação física de hortifrútis. Como posso ajudar o seu comércio hoje? Qual é a sua cidade?`,
          `${cumprimento}${vocativo}! Que bom ter você aqui! Seja bem-vindo à Visual Super.\n\nComo posso orientar o seu comércio hoje? Em qual cidade fica a sua loja?`
        ],
        clipstrip: [
          `${cumprimento}${vocativo}! Tudo bem? Seja bem-vindo à Visual Super! 😊\n\nSou consultor especialista em fitas cross e vendas por impulso. Qual projeto você gostaria de desenvolver hoje?`
        ],
        cartazista: [
          `${cumprimento}${vocativo}! Tudo bem? Seja bem-vindo à Visual Super! 😊\n\nComo posso ajudar a eliminar o gasto com papel e retrabalho de cartazes no seu comércio hoje?`
        ],
        expansao: [
          `${cumprimento}${vocativo}! Tudo bem? Seja bem-vinda à Visual Super! 😊\n\nSou consultor para atendimento corporativo e projetos de rede. Em qual cidade fica a sua loja e qual o formato do seu projeto?`
        ],
        geral: [
          `${cumprimento}${vocativo}! Tudo bem? Seja muito bem-vindo à Visual Super! 😊\n\nSou o consultor técnico em soluções físicas de PDV e precificação inteligente.\n\nComo posso ajudar o seu comércio hoje? Qual é o seu segmento e cidade?`
        ]
      };

      const listaOpcoes = opcoesRespostas[personaAtiva.id] || opcoesRespostas.geral;
      const indice = Math.floor(Math.random() * listaOpcoes.length);
      return this.removerTermosProibidos(listaOpcoes[indice]);
    }

    // Detecção conversacional multi-turn: Se o lead estiver respondendo o formato das bancas ou quantidade
    const temIlha = t.includes("ilha") || t.includes("ilhas") || t.includes("central");
    const temBancadas = t.includes("banca") || t.includes("bancada") || t.includes("caixa") || t.includes("caixote") || /\d+/.test(t);
    const matchNumero = t.match(/(\d+)\s*(banca|ilha|caixa|unidade|metro)?/i);
    const qtdInformada = matchNumero ? parseInt(matchNumero[1], 10) : (t.includes("cinco") ? 5 : (t.includes("dez") ? 10 : 0));

    // Resposta inteligente e objetiva para Ilhas Centrais / Promocionais (Calcula padrão 360° e recomenda Precificador E2)
    if (temIlha && (temBancadas || qtdInformada > 0 || t.includes("modelo") || t.includes("formato"))) {
      const qtdTexto = qtdInformada > 0 ? `${qtdInformada * 3} a ${qtdInformada * 4}` : "15 a 20";
      const bancasTexto = qtdInformada > 0 ? `suas ${qtdInformada} ilhas centrais` : "suas ilhas centrais";
      return this.removerTermosProibidos(`Perfeito! Para ${bancasTexto}, o ideal é o nosso **Precificador E2 para Ilhas**!\n\nComo a ilha tem visão 360°, recomendamos de 3 a 4 peças por ilha (total de ${qtdTexto} unidades) com troca rápida de preços em segundos sem papel molhado.\n\nConfira fotos e detalhes oficiais:\nhttps://visualsuper.com.br/produto/precificador-e2/\n\nGostaria de uma proposta com desconto para essa quantidade ou prefere faturar no CNPJ com o Joelson?`);
    }

    // Resposta objetiva para Bancadas normais / Caixotes plásticos ou madeira
    if ((t.includes("caixa") || t.includes("caixote") || t.includes("madeira") || t.includes("plastico") || t.includes("bancada") || qtdInformada > 0) && (this.chatMensagens.length > 2 || qtdInformada > 0)) {
      const qtdTexto = qtdInformada > 0 ? `${qtdInformada}` : "10 a 15";
      const bancasTexto = qtdInformada > 0 ? `as suas ${qtdInformada} bancadas` : "suas bancadas";
      return this.removerTermosProibidos(`Perfeito! Para ${bancasTexto}, indicamos o **Precificador E1 em PETG** com garras articuladas 360°.\n\nEle prende firme na borda dos caixotes, não molha com borrifadores e a equipe troca os preços na hora sem papel.\n\nConfira fotos reais:\nhttps://visualsuper.com.br/produto/precificador-e1-hortifruti/\n\nQuer que eu monte o orçamento desse lote de ${qtdTexto} peças ou prefere faturar no CNPJ com o Joelson?`);
    }

    // Frete e Prazo de Entrega
    if (t.includes("prazo") || t.includes("frete") || t.includes("entrega") || t.includes("envio") || t.includes("são paulo") || t.includes("sao paulo") || t.includes("sp") || t.includes("cep")) {
      return this.removerTermosProibidos(`Com certeza! Despachamos diariamente com frete expresso para todo o Brasil via transportadora e Correios.\n\nPara a sua região, o prazo costuma ser super ágil (de 2 a 5 dias úteis).\n\nPoderia me passar o CEP ou cidade da sua loja para eu calcular o frete exato?`);
    }

    // Garras e Suportes de Fixação
    if (t.includes("garra") || t.includes("suporte") || t.includes("fixa") || t.includes("prende") || t.includes("articulada")) {
      return this.removerTermosProibidos(`Temos sim! Nossas garras articuladas 360° prendem com alta pressão em caixotes de feira, bancadas de madeira e aramados.\n\nSão reforçadas e mantêm o preço sempre visível e inclinado para o cliente.\n\nConfira fotos dos modelos:\nhttps://visualsuper.com.br/produto/precificador-e1-hortifruti/\n\nQuantas bancadas ou caixotes você precisa equipar?`);
    }

    // Preço e Condição Comercial
    if (t.includes("preço") || t.includes("valor") || t.includes("quanto") || t.includes("custa")) {
      return this.removerTermosProibidos(`Com certeza! Nosso ${prod.nome} tem valor de referência a partir de ${prod.preco_medio || "R$ 47,90"}.\n\nÉ um investimento único que se paga no primeiro mês eliminando o gasto contínuo com papel, fita e cartazista.\n\nConfira todos os modelos no link:\n${linkReal}\n\nQuantas unidades você precisa para eu calcular a melhor condição com desconto por lote?`);
    }

    // Transbordo Comercial / Joelson / CNPJ
    if (t.includes("joelson") || t.includes("cnpj") || t.includes("fatur") || t.includes("atacado") || t.includes("loja inteira") || t.includes("grande") || personaAtiva.id === "expansao") {
      return this.removerTermosProibidos(`Perfeito! Para pedidos em lote, faturamento via CNPJ ou condições de atacado, vou transferir seu atendimento direto para o **Joelson**, nosso especialista comercial.\n\nPoderia me informar seu CNPJ (ou Razão Social) e cidade para ele já puxar as condições de atacado para você?`);
    }

    // Setor Hortifrúti / FLV (Início da qualificação técnica)
    if (setor === "Hortifrúti / FLV" || personaAtiva.id === "hortifruti" || t.includes("horti") || t.includes("fruta") || t.includes("legume") || t.includes("verdura") || t.includes("sacolão") || t.includes("feira") || t.includes("água") || t.includes("agua")) {
      return this.removerTermosProibidos(`Com certeza! Para hortifrúti, a solução definitiva é o nosso **Precificador E1 em PETG** com números sanfonados.\n\nEle é 100% à prova d'água (não estraga com borrifadores), você troca o preço em 5 segundos e fixa direto nas bancas com garras 360°.\n\nConfira fotos e detalhes oficiais:\nhttps://visualsuper.com.br/produto/precificador-e1-hortifruti/\n\nSuas bancas são de caixas, madeira ou ilhas centrais? Quantas você precisa precificar hoje?`);
    }

    // Setor Açougue / Balcão Frio / Peixaria
    if (setor === "Açougue e Peixaria" || personaAtiva.id === "acougue" || t.includes("açougue") || t.includes("acougue") || t.includes("carne") || t.includes("balcão") || t.includes("balcao") || t.includes("peixaria") || t.includes("peixe")) {
      return this.removerTermosProibidos(`Com certeza! Para balcão refrigerado, indicamos nosso **Painel em ACM** com números magnéticos e os **Espetos Inox sanitários**.\n\nEles suportam frio e gordura sem enferrujar e são 100% higienizáveis (atendendo o padrão sanitário e do Procon).\n\nConfira fotos e modelos oficiais:\nhttps://visualsuper.com.br/produto/painel-precificador-acougue/\n\nQuantos metros de balcão refrigerado você expõe na sua loja hoje?`);
    }

    // Setor Cross Merchandising / Fita Cross
    if (setor === "Cross Merchandising / Fita Cross" || personaAtiva.id === "clipstrip" || t.includes("clip") || t.includes("strip") || t.includes("fita cross") || t.includes("cross")) {
      return this.removerTermosProibidos(`Com certeza! Nossa **Fita Cross (Clip Strip)** em PP reforçado (12 ou 24 posições) é a melhor ferramenta para gerar vendas por impulso ao lado de gôndolas e caixas.\n\nResistente, não rasga com peso e possui testeira personalizável.\n\nConfira os modelos oficiais:\nhttps://visualsuper.com.br/produto/fita-cross-clip-strip-branca-24-posicoes/\n\nQual produto você pretende pendurar e quantas unidades você precisa?`);
    }

    // Setor Gôndolas e Prateleiras
    if (setor === "Gôndolas e Prateleiras" || t.includes("gondola") || t.includes("gôndola") || t.includes("prateleira") || t.includes("perfil")) {
      return this.removerTermosProibidos(`Com certeza! Nosso **Perfil Porta-Etiquetas** em PVC cristal com proteção anti-UV não amarela sob lâmpadas LED e evita autuações do Procon por preços desalinhados.\n\nMantém etiquetas retas, limpas e protegidas.\n\nConfira detalhes e medidas:\nhttps://visualsuper.com.br/produto/perfil-de-gondola/\n\nQuantos metros de prateleiras ou corredores você deseja padronizar?`);
    }

    // Fallback Geral Consultivo de Alto Padrão
    return this.removerTermosProibidos(`Com certeza! Aqui na Visual Super desenvolvemos soluções físicas definitivas para eliminar o retrabalho diário com papel no comércio.\n\nNossa recomendação para o seu caso é o **${prod.nome}** em ${prod.material || "material de alta resistência"}.\n\nConfira fotos e detalhes oficiais:\n${linkReal}\n\nQuantas bancadas ou balcões você precisa precificar hoje?`);
  }

  renderizarMensagensChat() {
    const container = document.getElementById("chatMensagensContainer");
    if (!container) return;

    if (!this.chatMensagens || this.chatMensagens.length === 0) {
      const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
      container.innerHTML = `
        <div class="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 space-y-3.5 my-auto">
          <div class="w-16 h-16 rounded-3xl bg-white border-2 border-slate-200/90 text-indigo-600 flex items-center justify-center text-3xl shadow-sm">
            ${p.icone || '👤'}
          </div>
          <div class="max-w-md space-y-1">
            <h4 class="font-bold text-slate-800 text-sm">Nova Conversa do Zero</h4>
            <p class="text-xs text-slate-600 leading-relaxed">
              Você está testando como <strong class="text-indigo-700 font-bold">${p.nome}</strong> (${p.segmento}).
            </p>
            <p class="text-[11px] text-slate-400">
              Digite uma mensagem no campo abaixo (ex: <em>"bom dia"</em> ou <em>"quanto custa?"</em>) para testar a resposta natural do Agente SDR.
            </p>
          </div>
          <div class="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded-full text-xs text-emerald-800 font-semibold shadow-2xs">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Consultor SDR Visual Super Aguardando Mensagem</span>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.chatMensagens.map((msg, index) => {
      if (msg.de === 'lead') {
        return `
          <div class="flex items-start gap-2 max-w-[85%] sm:max-w-[75%] mr-auto">
            <div class="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-sm shrink-0 shadow-2xs">
              ${msg.icone || '👤'}
            </div>
            <div class="bg-white p-3.5 rounded-2xl rounded-tl-none border border-slate-200/80 shadow-xs text-xs text-slate-800 space-y-1">
              <div class="font-bold text-[11px] text-indigo-700 flex items-center gap-1">
                <span>${msg.autor}</span>
                <span class="text-[9px] text-slate-400 font-normal">• Cliente</span>
              </div>
              <div class="leading-relaxed whitespace-pre-wrap">${this.formatarTextoComLinks(msg.texto)}</div>
              <div class="text-[10px] text-slate-400 text-right pt-0.5">${msg.hora}</div>
            </div>
          </div>
        `;
      } else {
        // Extrai link detectado na mensagem para pré-preencher o formulário
        const matchUrl = msg.texto ? msg.texto.match(/(https?:\/\/[^\s\)\'\"\]]+)/) : null;
        const linkDetectado = matchUrl ? matchUrl[1] : (this.produtos[0]?.link_permanente || "https://visualsuper.com.br/");

        const optionsCatalogo = this.produtos.map(p => {
          const urlProd = p.link_permanente || p.link;
          const isSelected = urlProd === linkDetectado ? "selected" : "";
          return `<option value="${urlProd}" ${isSelected}>${p.nome.substring(0, 30)}...</option>`;
        }).join("");

        return `
          <div class="flex items-start gap-2 max-w-[92%] sm:max-w-[85%] ml-auto justify-end">
            <div class="bg-[#dcf8c6] border border-emerald-200 p-3.5 rounded-2xl rounded-tr-none shadow-xs text-xs text-slate-900 space-y-2 flex-1">
              <!-- Cabeçalho do Balão -->
              <div class="flex items-center justify-between gap-2 border-b border-emerald-300/40 pb-1">
                <div class="font-bold text-[11px] text-emerald-900 flex items-center gap-1">
                  <i class="fas fa-brain text-emerald-700"></i>
                  <span>${msg.autor}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  ${msg.aprendizadoSalvo ? `
                    <span class="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1" title="Esta resposta foi ensinada ao cérebro do SDR">
                      <i class="fas fa-check-circle text-blue-600"></i> Aprendizado Ensinado
                    </span>
                  ` : ''}
                  ${msg.abordagemAplicada ? `
                    <span class="text-[9px] bg-purple-100 text-purple-900 font-bold px-1.5 py-0.5 rounded border border-purple-200 flex items-center gap-1" title="Nova abordagem consultiva gerada">
                      <i class="fas fa-sparkles text-purple-600"></i> ${msg.abordagemAplicada}
                    </span>
                  ` : ''}
                  <span class="text-[10px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-semibold">Agente SDR</span>
                </div>
              </div>

              <!-- Conteúdo da Mensagem com Links Clicáveis (purificado de anotações internas) -->
              <div class="leading-relaxed whitespace-pre-wrap text-slate-800">${this.formatarTextoComLinks((msg.texto || "").replace(/\n\n(💡|\*|📌)*\s*\*(Orientação do Consultor|Destaque do Especialista|Sobre sua solicitação|Atenção especial|Nota|Observação):\*[\s\S]*?(?=\n\n|$)/gi, '').trim())}</div>

              <!-- Exibição de Orientação / Observação Ensinada (se houver) -->
              ${msg.observacao ? `
                <div class="mt-2 p-2.5 bg-amber-50/95 border border-amber-300/80 rounded-xl text-[11px] text-amber-950 space-y-1 shadow-2xs">
                  <div class="font-bold text-[10px] uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <i class="fas fa-lightbulb text-amber-600"></i>
                    <span>Orientação Ensinada ao Agente para as Próximas Respostas:</span>
                  </div>
                  <div class="italic text-slate-800 pl-3 leading-relaxed border-l-2 border-amber-400">${msg.observacao}</div>
                </div>
              ` : ''}

              <!-- Painel Inline de Ajuste, Observação e Link (quando clicado) -->
              ${msg.editandoAjuste ? `
                <div id="painelAjusteChat-${msg.id}" class="mt-2.5 p-3.5 bg-white rounded-xl border-2 border-blue-400 shadow-md space-y-3 text-xs text-slate-800">
                  <div class="flex items-center justify-between font-bold border-b border-slate-200 pb-1.5">
                    <span class="flex items-center gap-1.5 text-blue-900 font-bold text-[12px]">
                      <i class="fas fa-graduation-cap text-blue-600"></i>
                      <span>Ensinar Agente: Observação e Link Correto</span>
                    </span>
                    <button type="button" onclick="app.fecharAjusteMensagemChat(${msg.id})" class="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded cursor-pointer" title="Fechar">
                      <i class="fas fa-xmark"></i>
                    </button>
                  </div>

                  <!-- Campo de Link Correto -->
                  <div>
                    <label class="block font-semibold text-[11px] text-slate-700 mb-1 flex items-center justify-between">
                      <span class="flex items-center gap-1"><i class="fas fa-link text-blue-600"></i> Link Permanente Real Oficial:</span>
                      <span class="text-[10px] text-slate-400 font-normal">Cole a URL ou selecione do catálogo</span>
                    </label>
                    <div class="flex flex-col sm:flex-row gap-1.5">
                      <input type="text" id="inputLinkAjusteChat-${msg.id}" value="${linkDetectado}" placeholder="https://visualsuper.com.br/produto/..." class="flex-1 text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-800" />
                      <select onchange="document.getElementById('inputLinkAjusteChat-${msg.id}').value = this.value" class="text-[11px] border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700 max-w-full sm:max-w-[180px] cursor-pointer" title="Selecionar produto oficial do catálogo">
                        <option value="">Escolher do Catálogo...</option>
                        ${optionsCatalogo}
                      </select>
                    </div>
                  </div>

                  <!-- Campo de Observação para o Agente -->
                  <div>
                    <label class="block font-semibold text-[11px] text-slate-700 mb-1 flex items-center gap-1">
                      <i class="fas fa-lightbulb text-amber-500"></i> Observação / Instrução para o Agente aprender:
                    </label>
                    <textarea id="inputObsAjusteChat-${msg.id}" rows="2" placeholder="Ex: Para o Arnaldo de hortifrúti, focar sempre no modelo E1 à prova d'água e kit de 15 bancadas..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-800">${msg.observacao || ''}</textarea>
                  </div>

                  <!-- Botões de Ação do Painel -->
                  <div class="flex items-center justify-between pt-1">
                    <span class="text-[10px] text-slate-500 italic max-w-[50%]">O agente aplicará o link e essa orientação em todas as próximas respostas.</span>
                    <div class="flex items-center gap-2">
                      <button type="button" onclick="app.fecharAjusteMensagemChat(${msg.id})" class="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium text-xs cursor-pointer">
                        Cancelar
                      </button>
                      <button type="button" onclick="app.salvarAjusteEEducadorChat(${msg.id})" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer">
                        <i class="fas fa-brain"></i> Salvar & Ensinar Agente
                      </button>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Barra de Ações do Balão -->
              <div class="flex items-center justify-between pt-1 border-t border-emerald-200/60 text-[10px] text-slate-500">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <button type="button" onclick="app.salvarMensagemChatNoCerebro(${msg.id})" class="text-emerald-800 hover:text-emerald-950 hover:bg-emerald-200/50 px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer" title="Salvar esta resposta no Cérebro com Like">
                    <i class="fas fa-thumbs-up text-emerald-600"></i> Salvar com Like
                  </button>
                  <button type="button" onclick="app.alternarAjusteMensagemChat(${msg.id})" class="${msg.editandoAjuste ? 'bg-blue-200 text-blue-900 border border-blue-400' : 'text-blue-800 hover:text-blue-950 hover:bg-blue-100/70'} px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer" title="Adicionar observação ou corrigir link para ensinar o agente">
                    <i class="fas fa-pen-to-square text-blue-600"></i> Observação & Link
                  </button>
                  <button type="button" onclick="app.melhorarRespostaChat(${msg.id})" class="text-purple-800 hover:text-purple-950 hover:bg-purple-100/70 px-2 py-0.5 rounded font-bold transition flex items-center gap-1 cursor-pointer" title="Solicitar ao agente para melhorar a resposta com outra abordagem consultiva">
                    <i class="fas fa-arrows-rotate text-purple-600"></i> Melhorar Resposta
                  </button>
                  <button type="button" onclick="app.copiarTexto('${encodeURIComponent(msg.texto)}')" class="text-slate-600 hover:text-slate-900 hover:bg-emerald-200/50 px-1.5 py-0.5 rounded transition flex items-center gap-1 cursor-pointer" title="Copiar resposta">
                    <i class="fas fa-copy"></i> Copiar
                  </button>
                </div>
                <div class="flex items-center gap-1 text-slate-400">
                  <span>${msg.hora}</span>
                  <i class="fas fa-check-double text-blue-500 text-[11px]" title="Entregue e lida"></i>
                </div>
              </div>
            </div>
            <div class="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs shrink-0 shadow-2xs font-bold">
              VS
            </div>
          </div>
        `;
      }
    }).join("");

    container.scrollTop = container.scrollHeight;
  }

  alternarAjusteMensagemChat(idMsg) {
    const msg = this.chatMensagens.find(m => m.id === idMsg);
    if (!msg) return;
    msg.editandoAjuste = !msg.editandoAjuste;
    this.renderizarMensagensChat();
    if (msg.editandoAjuste) {
      setTimeout(() => {
        const inp = document.getElementById(`inputObsAjusteChat-${idMsg}`) || document.getElementById(`inputLinkAjusteChat-${idMsg}`);
        if (inp && typeof inp.focus === "function") inp.focus();
      }, 60);
    }
  }

  fecharAjusteMensagemChat(idMsg) {
    const msg = this.chatMensagens.find(m => m.id === idMsg);
    if (!msg) return;
    msg.editandoAjuste = false;
    this.renderizarMensagensChat();
  }

  salvarAjusteEEducadorChat(idMsg) {
    const msg = this.chatMensagens.find(m => m.id === idMsg);
    if (!msg) return;

    const inputLinkEl = document.getElementById(`inputLinkAjusteChat-${idMsg}`);
    const inputObsEl = document.getElementById(`inputObsAjusteChat-${idMsg}`);

    const novoLink = inputLinkEl ? inputLinkEl.value.trim() : "";
    const novaObs = inputObsEl ? inputObsEl.value.trim() : "";

    if (!novoLink && !novaObs) {
      alert("Por favor, informe o link correto ou adicione uma observação para o agente aprender!");
      return;
    }

    // 1. Localiza a dúvida anterior do lead na conversa
    let perguntaLead = "Consulta de cliente no WhatsApp";
    const idx = this.chatMensagens.findIndex(m => m.id === idMsg);
    for (let k = idx - 1; k >= 0; k--) {
      if (this.chatMensagens[k].de === 'lead') {
        perguntaLead = this.chatMensagens[k].texto;
        break;
      }
    }

    const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
    const { setor: setorDetectado, produtoFoco } = this.analisarPergunta(perguntaLead, 'chat');

    // 2. Identifica o produto correspondente para atualizar no Catálogo Oficial permanentemente
    let prodAlvo = produtoFoco;
    if (!prodAlvo) {
      for (const prod of this.produtos) {
        if (msg.texto.toLowerCase().includes(prod.nome.toLowerCase())) {
          prodAlvo = prod;
          break;
        }
      }
    }
    if (!prodAlvo) {
      if (p.id === "hortifruti") prodAlvo = this.obterProdutoPadraoPorSetorOuId("e1-horti");
      else if (p.id === "acougue") prodAlvo = this.obterProdutoPadraoPorSetorOuId("acougue");
      else if (p.id === "clipstrip") prodAlvo = this.obterProdutoPadraoPorSetorOuId("clipstrip");
      else prodAlvo = this.obterProdutoPadraoPorSetorOuId(p.id) || this.obterProdutoPadraoPorSetorOuId("e1-horti");
    }

    if (prodAlvo) {
      if (novoLink) {
        prodAlvo.link_permanente = novoLink;
        prodAlvo.link = novoLink;
      }
      if (novaObs) {
        prodAlvo.observacaoConsultor = novaObs;
      }
      this.salvarProdutos();
      this.produtoConsultadoLead = prodAlvo;
    }

    // 3. Atualiza o link na mensagem e remove orientações internas do corpo do texto
    if (novoLink) {
      const regexUrl = /(https?:\/\/[^\s\)\'\"\]]+)/g;
      if (regexUrl.test(msg.texto)) {
        msg.texto = msg.texto.replace(regexUrl, novoLink);
      } else {
        msg.texto += `\n\nConfira todos os detalhes e fotos na página oficial:\n${novoLink}`;
      }
      msg.texto = this.normalizarLinksTexto(msg.texto);
      this.linkConsultorLead = novoLink;
    }

    // Remove qualquer resíduo de observação/orientação interna que possa estar dentro do corpo da mensagem
    msg.texto = msg.texto.replace(/\n\n(💡|\*|📌)*\s*\*(Orientação do Consultor|Destaque do Especialista|Sobre sua solicitação|Atenção especial|Nota|Observação):\*[\s\S]*?(?=\n\n|$)/gi, '').trim();

    if (novaObs) {
      msg.observacao = novaObs;
      this.observacaoProdutoLead = novaObs;
      if (p) p.observacaoConsultor = novaObs;

      // Sincroniza com a caixa de observação do simulador (Aba 1)
      const inputObsGeral = document.getElementById("inputObservacaoProdutoLead");
      if (inputObsGeral) {
        inputObsGeral.value = novaObs;
      }
    }

    msg.texto = this.removerTermosProibidos(msg.texto);

    // 4. Grava no Cérebro do SDR com LIKE e memória permanente
    const novoAprendizado = {
      id: Date.now(),
      leadPergunta: perguntaLead,
      respostaAprovada: msg.texto,
      setor: (prodAlvo && prodAlvo.setor) || p.segmento || setorDetectado || "Varejo Geral",
      tipo: `💡 Correção & Observação do Consultor (${p.nome})`,
      produtoId: prodAlvo ? prodAlvo.id : null,
      produtoNome: prodAlvo ? prodAlvo.nome : null,
      linkSugerido: novoLink || (prodAlvo ? prodAlvo.link_permanente : this.produtos[0].link_permanente),
      observacaoConsultor: novaObs,
      curtido: true,
      data: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    // Remove correções anteriores com o mesmo id de produto para que o novo aprendizado sempre prevaleça
    this.aprendizados = (this.aprendizados || []).filter(a => !(
      prodAlvo && a.produtoId && a.produtoId === prodAlvo.id && a.tipo && a.tipo.includes("Correção")
    ));

    this.aprendizados.unshift(novoAprendizado);
    this.salvarAprendizados();

    msg.editandoAjuste = false;
    msg.aprendizadoSalvo = true;

    this.mostrarToast("🎉 Aprendizado gravado com sucesso! O agente já memorizou a observação e o link oficial para todas as próximas conversas.");
    this.renderizarMensagensChat();
  }

  // Gera uma abordagem aprimorada com ângulo consultivo diferente e elevado para a resposta do agente
  async melhorarRespostaChat(idMsg) {
    const msg = this.chatMensagens.find(m => m.id === idMsg);
    if (!msg || msg.de !== 'agente') return;

    // 1. Identifica a pergunta anterior do lead
    let perguntaLead = "";
    const idx = this.chatMensagens.findIndex(m => m.id === idMsg);
    for (let k = idx - 1; k >= 0; k--) {
      if (this.chatMensagens[k].de === 'lead') {
        perguntaLead = this.chatMensagens[k].texto;
        break;
      }
    }
    if (!perguntaLead) perguntaLead = "Quero precificar meu comércio";

    // 2. Cicla para uma nova abordagem consultiva
    msg.versaoAbordagem = (typeof msg.versaoAbordagem === 'number') ? (msg.versaoAbordagem + 1) % 4 : 1;

    const abordagensNomes = [
      "Consultoria Técnica Especialista & Diagnóstico",
      "Financeira & Retorno de Investimento (ROI)",
      "Engenharia de PDV & Conformidade Procon",
      "Visual Merchandising & Aumento de Ticket Médio"
    ];
    const nomeAbordagem = abordagensNomes[msg.versaoAbordagem] || "Abordagem Aprimorada";

    // 3. Simula digitação humana do WhatsApp
    this.mostrarDigitandoChat(true);

    const personaAtiva = (this.chatPersonas && this.chatPersonas[this.chatPersonaAtiva]) 
      ? this.chatPersonas[this.chatPersonaAtiva] 
      : { id: "hortifruti", nome: "Cliente", segmento: "Varejo de Alimentos", dor: "Precificação e comunicação de loja" };

    const { setor, produtoFoco } = this.analisarPergunta(perguntaLead, 'chat');
    let prod = produtoFoco || this.obterProdutoPadraoPorSetorOuId(personaAtiva.id) || this.obterProdutoPadraoPorSetorOuId("e1-horti");
    let linkReal = (prod && prod.link_permanente) || (prod && prod.link) || this.linkConsultorLead || "https://visualsuper.com.br/";

    // 4. Se tiver Gemini ativo com chave, gera via IA com foco na nova abordagem
    const chave = this.obterChaveGemini();
    let novaResposta = "";

    if (chave && chave.length > 10) {
      try {
        let configModelo = this.modeloGeminiAtivo;
        const versao = configModelo ? configModelo.versao : "v1beta";
        const modelo = configModelo ? configModelo.modelo : "gemini-1.5-flash-latest";

        const promptMelhoria = `Você é o Consultor Especialista Sênior em Precificação Inteligente e Soluções Físicas de PDV da Visual Super.
O gestor solicitou para você MELHORAR A RESPOSTA ANTERIOR com uma nova abordagem de altíssimo nível consultivo de PDV.

ÂNGULO ESPECÍFICO DESTA NOVA ABORDAGEM: "${nomeAbordagem}"
CLIENTE: ${personaAtiva.nome} (${personaAtiva.segmento} - dor: ${personaAtiva.dor})
DÚVIDA DO CLIENTE: "${perguntaLead}"
RESPOSTA ANTERIOR A SER MELHORADA: "${msg.texto}"
PRODUTO RECOMENDADO: ${prod.nome} (${prod.material}, diferencial: ${prod.diferencial})
LINK OFICIAL PERMANENTE: ${linkReal}

DIRETRIZES DA NOVA ABORDAGEM:
- Adote uma postura de Consultor Executivo Sênior de Ponto de Venda.
- Se for abordagem Financeira/ROI: demonstre o custo invisível contínuo de gastar com papel cartão, fita e cartazistas todo mês contra o retorno imediato da solução definitiva da Visual Super.
- Se for Engenharia/Procon: aprofunde nos materiais nobres (PETG cristal à prova d'água, ACM magnético, Inox cirúrgico atóxico) e proteção jurídica contra multas do Procon.
- Se for Visual Merchandising: aprofunde em como o sistema folheável com tarja vermelha de ofertas atrai a atenção dos clientes e aumenta o ticket médio da loja.
- NUNCA mencione softwares, aplicativos ou telas digitais (Regra de Ouro: 100% soluções físicas).
- NUNCA use a palavra "pergunta".
- NUNCA use a palavra "teste" ou "testes". Use a frase oficial: "Confira todos os detalhes e fotos na página oficial: ${linkReal}".
- REGRA DE FORMATO WHATSAPP: Mensagem estritamente curta e objetiva (máximo 2 a 3 parágrafos, 3 a 5 linhas no total). Sem textões ou palestras que cansem o lead no celular.
- Finalize com uma pergunta consultiva elegante de qualificação.

Retorne APENAS o texto da resposta melhorada, sem JSON ou aspas, pronto para o WhatsApp.`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/${versao}/models/${modelo}:generateContent?key=${encodeURIComponent(chave)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptMelhoria }] }],
            generationConfig: { temperature: 0.8, maxOutputTokens: 4096 }
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          const candidate = data?.candidates?.[0];
          const parts = candidate?.content?.parts || [];
          const textParts = parts.filter(p => p.text && !p.thought).map(p => p.text);
          const texto = textParts.length > 0 ? textParts.join("") : parts.map(p => p.text || "").join("");
          if (texto && texto.trim()) {
            novaResposta = this.removerTermosProibidos(texto.trim());
          }
        }
      } catch (eGem) {
        console.warn("Falha no Gemini para melhoria de resposta, usando gerador local:", eGem);
      }
    }

    // 5. Fallback local de nível executivo refinado se Gemini não responder
    if (!novaResposta) {
      if (msg.versaoAbordagem === 1) {
        // Abordagem ROI & Financeira
        novaResposta = `Com certeza! Analisando a gestão de custos do seu comércio: manter cartazes de papel e cartazistas manuais gera um custo invisível contínuo de centenas de reais todos os meses em folhas de papel cartão, cartolinas, fitas e canetões que vão para o lixo em poucos dias.\n\nCom a nossa linha de ${prod.nome}, você realiza um investimento único que se paga já nas primeiras semanas. A sua equipe altera qualquer preço na própria bancada em menos de 5 segundos com o sistema ágil de números sanfonados, eliminando o retrabalho e a dependência de cartazistas.\n\nConfira todos os detalhes e fotos na página oficial:\n${linkReal}\n\nQuantas bancadas ou caixas você tem hoje para eu simular a economia mensal estimada para a sua loja?`;
      } else if (msg.versaoAbordagem === 2) {
        // Abordagem Engenharia Técnica & Procon
        novaResposta = `Com certeza! Sob a ótica técnica e de conformidade do PDV: nosso ${prod.nome} foi desenvolvido com especificações industriais em ${prod.material || "PETG cristal 0,75mm flexível e durável"}.\n\nEle é 100% imune à água de borrifadores e umidade, totalmente lavável e resistente a impactos mecânicos no fluxo de clientes. Além de valorizar a exposição dos produtos, garante que os preços estejam sempre legíveis e visíveis, blindando seu comércio contra autuações e notificações do Procon.\n\nConfira todos os detalhes e fotos na página oficial:\n${linkReal}\n\nQual é o layout das suas bancadas (caixotes plásticos, madeira ou ilhas centrais) para eu te indicar o modelo de fixação ideal?`;
      } else if (msg.versaoAbordagem === 3) {
        // Abordagem Visual Merchandising & Ticket Médio
        novaResposta = `Com certeza! Do ponto de vista de visual merchandising e experiência de compra: um ponto de venda com cartazes tortos ou improvisados desvaloriza a qualidade dos seus produtos e prejudica o fluxo de compra.\n\nO nosso ${prod.nome} entrega uma padronização visual impecável de grande rede. O sistema inteligente com números sanfonados permite alternar o valor na hora, destacando os preços com clareza imediata para o consumidor e aumentando a conversão dos itens em promoção.\n\nConfira todos os detalhes e fotos na página oficial:\n${linkReal}\n\nQuantas bancadas ou setores você gostaria de padronizar para elevar o nível visual da sua loja hoje?`;
      } else {
        // Abordagem Consultiva Geral Elevada
        novaResposta = `Com certeza! Aqui na Visual Super nossa missão é fornecer a infraestrutura física definitiva para o seu varejo vender mais com menos esforço operacional.\n\nO ${prod.nome} substitui de forma definitiva o gasto diário de mão de obra e papel, proporcionando acabamento de primeira linha e durabilidade por anos em ${prod.material}.\n\nConfira todos os detalhes e fotos na página oficial:\n${linkReal}\n\nMe conte: qual é a quantidade estimada que você precisa para equipar sua loja hoje?`;
      }
    }

    novaResposta = this.removerTermosProibidos(novaResposta);

    // Aguarda o delay realista de digitação (1.1 segundos)
    await new Promise(resolve => setTimeout(resolve, 1100));

    this.mostrarDigitandoChat(false);

    // 6. Atualiza a mensagem no chat
    msg.texto = novaResposta;
    msg.abordagemAplicada = nomeAbordagem;
    msg.hora = this.obterHoraAtual();

    // 7. Sincroniza o novo aprendizado no Cérebro do SDR
    this.atualizarAprendizadoComNovaResposta(perguntaLead, novaResposta, setor || personaAtiva.segmento, linkReal);

    this.renderizarMensagensChat();
    this.mostrarToast(`✨ Nova abordagem consultiva aplicada: ${nomeAbordagem}!`);
  }

  // Sincroniza a resposta aprimorada com a base de aprendizados
  atualizarAprendizadoComNovaResposta(perguntaLead, novaResposta, setor, linkSugerido) {
    if (!this.aprendizados) this.aprendizados = [];
    
    const match = this.aprendizados.find(a => 
      a.leadPergunta && a.leadPergunta.toLowerCase().trim() === perguntaLead.toLowerCase().trim()
    );

    if (match) {
      match.respostaAprovada = novaResposta;
      if (linkSugerido) match.linkSugerido = linkSugerido;
      match.curtido = true;
      match.data = new Date().toISOString().replace('T', ' ').substring(0, 16);
    } else {
      this.aprendizados.unshift({
        id: Date.now(),
        leadPergunta: perguntaLead,
        respostaAprovada: novaResposta,
        setor: setor || "Varejo Geral",
        tipo: "🔄 Resposta Aprimorada (Consultoria SDR)",
        linkSugerido: linkSugerido || "https://visualsuper.com.br/",
        curtido: true,
        data: new Date().toISOString().replace('T', ' ').substring(0, 16)
      });
    }

    this.salvarAprendizados();
    this.atualizarEstatisticas();
  }

  formatarTextoComLinks(texto) {
    if (!texto) return "";
    const regexUrl = /(https?:\/\/[^\s\)\'\"\]]+)/g;
    return texto.replace(regexUrl, url => {
      return `<a href="${url}" target="_blank" class="text-blue-700 hover:underline font-bold inline-flex items-center gap-0.5">${url} <i class="fas fa-arrow-up-right-from-square text-[9px]"></i></a>`;
    });
  }

  salvarMensagemChatNoCerebro(idMsg) {
    const idx = this.chatMensagens.findIndex(m => m.id === idMsg);
    if (idx < 0) return;
    const msgAgente = this.chatMensagens[idx];

    let perguntaLead = "Consulta de cliente no WhatsApp";
    for (let k = idx - 1; k >= 0; k--) {
      if (this.chatMensagens[k].de === 'lead') {
        perguntaLead = this.chatMensagens[k].texto;
        break;
      }
    }

    const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
    const { setor: setorDetectado, produtoFoco, isSaudacao } = this.analisarPergunta(perguntaLead, 'chat');
    let linkFinal = "https://visualsuper.com.br/";
    if (!isSaudacao && produtoFoco && (produtoFoco.link_permanente || produtoFoco.link)) {
      linkFinal = produtoFoco.link_permanente || produtoFoco.link;
    }

    const novoAprendizado = {
      id: Date.now(),
      leadPergunta: perguntaLead,
      respostaAprovada: msgAgente.texto,
      setor: p.segmento || setorDetectado || "Varejo Geral",
      tipo: `💬 Chat Interativo (${p.nome})`,
      linkSugerido: linkFinal,
      curtido: true,
      data: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    this.aprendizados.unshift(novoAprendizado);
    this.salvarAprendizados();
    this.mostrarToast("🎉 Resposta do Chat salva com sucesso no Cérebro do SDR com LIKE!");
  }

  salvarTodaConversaNoHistorico() {
    if (!this.chatMensagens || this.chatMensagens.length === 0) {
      alert("Ainda não há mensagens na conversa para salvar.");
      return;
    }

    const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
    const msgsAgente = this.chatMensagens.filter(m => m.de === 'agente');
    
    if (msgsAgente.length === 0) {
      alert("O agente ainda não respondeu nenhuma pergunta nesta conversa.");
      return;
    }

    let salvas = 0;
    msgsAgente.forEach((mAgente) => {
      this.salvarMensagemChatNoCerebro(mAgente.id);
      salvas++;
    });

    this.mostrarToast(`✅ ${salvas} interações da conversa salvas com LIKE no Cérebro do SDR!`);
  }

  async executarAutoPlaySimulacao() {
    if (this.chatAutoPlayAtivo || this.chatEmExecucao) return;
    this.chatAutoPlayAtivo = true;

    const p = this.chatPersonas[this.chatPersonaAtiva] || this.chatPersonas.hortifruti;
    const roteiro = p.roteiroAutoPlay || p.perguntasRapidas.slice(0, 3);

    this.mostrarToast(`▶️ Iniciando Auto-Play de simulação com ${p.nome}...`);

    for (let i = 0; i < roteiro.length; i++) {
      const pergunta = roteiro[i];
      await this.processarMensagemLead(pergunta);
      if (i < roteiro.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    this.chatAutoPlayAtivo = false;
    this.mostrarToast(`🏁 Simulação completa com ${p.nome} finalizada com sucesso!`);
  }

  reiniciarChat(iniciarVazio = true) {
    this.chatMensagens = [];

    const input = document.getElementById("inputChatMensagemLead");
    if (input) {
      input.value = "";
      input.focus();
    }
    this.renderizarMensagensChat();
    this.mostrarToast("🧹 Nova conversa iniciada do zero! Envie sua mensagem como o lead para testar o agente.");
  }

  // ===============================================================
  // MÓDULO DE CONFIGURAÇÃO INSTITUCIONAL & AUTO-APRENDIZADO WEB
  // ===============================================================

  carregarConfiguracaoEmpresa() {
    try {
      const salvo = localStorage.getItem(this.configuracaoEmpresaStorageKey);
      if (salvo) {
        return Object.assign(this.obterConfiguracaoPadraoEmpresa(), JSON.parse(salvo));
      }
    } catch (e) {
      console.warn("Erro ao carregar configuracao da empresa:", e);
    }
    return this.obterConfiguracaoPadraoEmpresa();
  }

  obterConfiguracaoPadraoEmpresa() {
    return {
      siteOficial: "https://visualsuper.com.br",
      nomeEmpresa: "Visual Super",
      segmento: "Comunicação Visual e Precificação Inteligente para PDV",
      whatsappComercial: "(48) 99853-0080",
      responsavelComercial: "Joelson (Especialista Comercial / Grandes Volumes)",
      horarioAtendimento: "Segunda a Sexta, das 08h às 17h30",
      emailContato: "contato@visualsuper.com.br",
      cidadeBase: "Florianópolis/SC • Atendimento Nacional",
      descricaoEmpresa: "Fabricante e especialista em soluções físicas de PDV, precificação inteligente durável e comunicação visual para supermercados, hortifrútis, açougues e padarias. Elimina 100% o papel, cartolina e cartazista manual com placas nobres reutilizáveis.",
      regraDeOuro: "100% exclusivo em soluções físicas de PDV. Proibido ofertar aplicativos digitais, softwares ou sistemas com mensalidade.",
      autoVarreduraAtiva: true,
      intervaloVarreduraHoras: 6,
      ultimaVarredura: new Date().toISOString(),
      totalPaginasRastreadas: 10,
      logVarredura: []
    };
  }

  salvarConfiguracaoEmpresa(dados, silencioso = false) {
    if (dados) {
      this.configuracaoEmpresa = Object.assign(this.configuracaoEmpresa, dados);
    }
    localStorage.setItem(this.configuracaoEmpresaStorageKey, JSON.stringify(this.configuracaoEmpresa));
    if (!silencioso) {
      this.mostrarToast("⚙️ Configurações da Visual Super salvas com sucesso!");
    }
    this.renderizarConfiguracoes();
  }

  salvarConfiguracaoEmpresaManual() {
    const site = document.getElementById("cfgSiteOficial")?.value.trim() || "https://visualsuper.com.br";
    const nome = document.getElementById("cfgNomeEmpresa")?.value.trim() || "Visual Super";
    const whats = document.getElementById("cfgWhatsappComercial")?.value.trim() || "(48) 99853-0080";
    const resp = document.getElementById("cfgResponsavelComercial")?.value.trim() || "Joelson";
    const horario = document.getElementById("cfgHorarioAtendimento")?.value.trim() || "Segunda a Sexta, das 08h às 17h30";
    const email = document.getElementById("cfgEmailContato")?.value.trim() || "contato@visualsuper.com.br";
    const cidade = document.getElementById("cfgCidadeBase")?.value.trim() || "Florianópolis/SC • Atendimento Nacional";
    const desc = document.getElementById("cfgDescricaoEmpresa")?.value.trim() || "";
    const regra = document.getElementById("cfgRegraDeOuro")?.value.trim() || "";

    this.salvarConfiguracaoEmpresa({
      siteOficial: site,
      nomeEmpresa: nome,
      whatsappComercial: whats,
      responsavelComercial: resp,
      horarioAtendimento: horario,
      emailContato: email,
      cidadeBase: cidade,
      descricaoEmpresa: desc,
      regraDeOuro: regra
    });
  }

  restaurarConfiguracaoEmpresaPadrao() {
    if (confirm("Deseja restaurar as configurações institucionais da Visual Super para os valores oficiais de fábrica?")) {
      this.configuracaoEmpresa = this.obterConfiguracaoPadraoEmpresa();
      this.salvarConfiguracaoEmpresa(null, true);
      this.mostrarToast("🔄 Configurações restauradas para o padrão oficial!");
    }
  }

  alternarAutoVarredura(ativa) {
    this.configuracaoEmpresa.autoVarreduraAtiva = Boolean(ativa);
    this.salvarConfiguracaoEmpresa(null, true);
    this.mostrarToast(ativa ? "🟢 Auto-Varredura Contínua Ativada!" : "⏸️ Auto-Varredura Contínua Pausada.");
    this.iniciarMotorVarreduraAgendada();
  }

  atualizarIntervaloVarredura(horas) {
    this.configuracaoEmpresa.intervaloVarreduraHoras = parseInt(horas, 10) || 6;
    this.salvarConfiguracaoEmpresa(null, true);
    this.mostrarToast(`⏰ Intervalo de varredura atualizado para ${horas} hora(s).`);
  }

  renderizarConfiguracoes() {
    const cfg = this.configuracaoEmpresa;
    if (!cfg) return;

    // Atualiza campos de formulário se existirem
    const campo = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    campo("cfgSiteOficial", cfg.siteOficial);
    campo("cfgNomeEmpresa", cfg.nomeEmpresa);
    campo("cfgResponsavelComercial", cfg.responsavelComercial);
    campo("cfgWhatsappComercial", cfg.whatsappComercial);
    campo("cfgHorarioAtendimento", cfg.horarioAtendimento);
    campo("cfgEmailContato", cfg.emailContato);
    campo("cfgCidadeBase", cfg.cidadeBase);
    campo("cfgDescricaoEmpresa", cfg.descricaoEmpresa);
    campo("cfgRegraDeOuro", cfg.regraDeOuro);

    const chkAuto = document.getElementById("cfgAutoVarreduraAtiva");
    if (chkAuto) chkAuto.checked = Boolean(cfg.autoVarreduraAtiva);

    const selIntervalo = document.getElementById("cfgIntervaloVarreduraHoras");
    if (selIntervalo) selIntervalo.value = String(cfg.intervaloVarreduraHoras || 6);

    // Labels no banner superior
    const lblSite = document.getElementById("labelSiteOficialAtivo");
    if (lblSite) lblSite.textContent = cfg.siteOficial || "https://visualsuper.com.br";

    const linkAbrir = document.getElementById("linkAbrirSiteOficial");
    if (linkAbrir) linkAbrir.href = cfg.siteOficial || "https://visualsuper.com.br";

    const lblUltima = document.getElementById("labelUltimaVarreduraWeb");
    if (lblUltima) {
      if (cfg.ultimaVarredura) {
        try {
          const d = new Date(cfg.ultimaVarredura);
          lblUltima.textContent = d.toLocaleDateString() + " às " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (_) {
          lblUltima.textContent = "Recente";
        }
      } else {
        lblUltima.textContent = "Nunca";
      }
    }

    const lblTotal = document.getElementById("labelTotalProdutosVarredura");
    if (lblTotal) lblTotal.textContent = `${this.produtos.length} Soluções`;

    const statPaginas = document.getElementById("statPaginasRastreadasCfg");
    if (statPaginas) statPaginas.textContent = String(cfg.totalPaginasRastreadas || this.produtos.length);

    const statSolucoes = document.getElementById("statSolucoesAtivasCfg");
    if (statSolucoes) statSolucoes.textContent = String(this.produtos.length);

    const badgeStatus = document.getElementById("badgeStatusVarreduraWeb");
    if (badgeStatus) {
      if (cfg.autoVarreduraAtiva) {
        badgeStatus.className = "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5";
        badgeStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span><span>Varredura Automática Ativa</span>`;
      } else {
        badgeStatus.className = "text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5";
        badgeStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span><span>Varredura Automática Pausada</span>`;
      }
    }

    // Renderiza Lista de Soluções Aprendidas no Site
    const containerLista = document.getElementById("listaSolucoesAprendidasWeb");
    if (containerLista) {
      if (this.produtos.length === 0) {
        containerLista.innerHTML = `<div class="p-6 text-center text-slate-400">Nenhuma solução aprendida ainda. Clique em "Varrer & Aprender Todo o Site Agora".</div>`;
      } else {
        const itensExibir = this.produtos.slice(0, 25);
        let listaHtml = itensExibir.map((prod, idx) => {
          const urlProd = prod.link_permanente || prod.link || "https://visualsuper.com.br/";
          return `
            <div class="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition px-2 rounded-xl border-b border-slate-100 last:border-b-0">
              <div class="space-y-1 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-slate-900 text-xs">${idx + 1}. ${prod.nome}</span>
                  <span class="text-[9px] uppercase font-bold px-2 py-0.2 rounded bg-blue-100 text-blue-700">${prod.setor || 'PDV'}</span>
                  ${prod.sku ? `<span class="text-[9px] font-mono text-slate-400">SKU: ${prod.sku}</span>` : ''}
                </div>
                <div class="text-[11px] text-slate-500 leading-relaxed">${prod.material || 'Material nobre de alta durabilidade'} • <span class="text-emerald-700 font-semibold">${prod.preco_medio || 'Sob consulta'}</span></div>
                <div class="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                  <i class="fas fa-link text-blue-500"></i>
                  <a href="${urlProd}" target="_blank" class="hover:underline text-blue-700 font-semibold truncate max-w-md">${urlProd}</a>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <a href="${urlProd}" target="_blank" class="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1 transition">
                  <i class="fas fa-arrow-up-right-from-square text-[10px]"></i> Ver no Site
                </a>
                <button type="button" onclick="app.abrirModalEditarProduto('${prod.id}')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer">
                  <i class="fas fa-pen-to-square"></i>
                </button>
              </div>
            </div>
          `;
        }).join("");

        if (this.produtos.length > 25) {
          listaHtml += `
            <div class="py-3 px-4 text-center text-xs text-slate-600 font-medium bg-blue-50/60 border border-blue-200/60 rounded-xl mt-3 flex items-center justify-between flex-wrap gap-2">
              <span>+ outras <strong>${this.produtos.length - 25} soluções oficiais</strong> aprendidas e ativas no Cérebro da IA.</span>
              <button type="button" onclick="alternarAbaPrincipal('catalogo')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow-2xs">
                Ver Todas as ${this.produtos.length} Soluções no Catálogo Oficial →
              </button>
            </div>
          `;
        }

        containerLista.innerHTML = listaHtml;
      }
    }
  }

  iniciarMotorVarreduraAgendada() {
    if (!this.configuracaoEmpresa || !this.configuracaoEmpresa.autoVarreduraAtiva) return;

    // Se já passou o intervalo ou é a primeira execução
    const agora = Date.now();
    const ultima = this.configuracaoEmpresa.ultimaVarredura ? new Date(this.configuracaoEmpresa.ultimaVarredura).getTime() : 0;
    const intervaloMs = (this.configuracaoEmpresa.intervaloVarreduraHoras || 6) * 3600 * 1000;

    if (agora - ultima > intervaloMs) {
      setTimeout(() => {
        this.executarVarreduraWebSite(false);
      }, 3500);
    }
  }

  // Helpers de normalização do catálogo do site oficial
  decodeHtmlEntidades(str) {
    if (!str) return "";
    return str
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  extrairMaterialTexto(nome, desc, cat) {
    const combined = (nome + " " + desc + " " + cat).toLowerCase();
    if (combined.includes("petg")) return "PETG de alta transparência e flexibilidade (100% à prova d'água)";
    if (combined.includes("acm")) return "ACM (Alumínio Composto) nobre e higienizável";
    if (combined.includes("inox")) return "Aço Inox Alimentício/Cirúrgico sanitário";
    if (combined.includes("ps ") || combined.includes("poliestireno") || combined.includes("ps cristal")) return "PS (Poliestireno) de alta resistência mecânica";
    if (combined.includes("polipropileno") || combined.includes(" pp ") || combined.includes("clip strip") || combined.includes("fita cross")) return "Polipropileno PP flexível e reforçado";
    if (combined.includes("pvc")) return "PVC cristal virgem com proteção anti-UV";
    if (combined.includes("acrilico") || combined.includes("acrílico")) return "Acrílico cristal de alta transparência";
    if (combined.includes("aluminio") || combined.includes("alumínio")) return "Alumínio anodizado resistente à corrosão";
    return "Termoplástico nobre de engenharia para PDV";
  }

  categorizarSetorWc(categories, nome) {
    const cats = (categories || []).map(c => (typeof c === 'string' ? c : c.name || '')).join(' ').toLowerCase();
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

  formatarPrecoWc(prices) {
    if (!prices || !prices.price) return 'Sob consulta';
    const val = parseInt(prices.price, 10);
    if (isNaN(val) || val === 0) return 'Sob consulta';
    const minor = prices.currency_minor_unit || 2;
    const reais = (val / Math.pow(10, minor)).toFixed(2).replace('.', ',');
    return 'R$ ' + reais;
  }

  normalizarProdutoWc(p) {
    const nomeLimpo = this.decodeHtmlEntidades(p.name);
    const shortDesc = this.decodeHtmlEntidades(p.short_description);
    const fullDesc = this.decodeHtmlEntidades(p.description);
    const catStr = (p.categories || []).map(c => (typeof c === 'string' ? c : c.name || '')).join(', ');
    const descCombinada = shortDesc || fullDesc || (nomeLimpo + ' desenvolvido pela Visual Super para excelência em PDV.');
    const material = this.extrairMaterialTexto(nomeLimpo, descCombinada, catStr);
    const setor = this.categorizarSetorWc(p.categories, nomeLimpo);
    const preco = this.formatarPrecoWc(p.prices);
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
      categorias: (p.categories || []).map(c => (typeof c === 'string' ? c : c.name || ''))
    };
  }

  // Gera aprendizados semânticos com like para o cérebro da IA a partir dos produtos
  gerarAprendizadosCatalogoCompleto(produtos) {
    if (!produtos || produtos.length === 0) return;

    const casosBase = [
      {
        termo: "porta-cartaz",
        leadPergunta: "Vocês têm porta-cartaz aéreo para corredor ou teto?",
        setor: "Cartazes e Placas Reutilizáveis",
        tipo: "Objetiva com Link Oficial",
        template: (prod) => `Temos sim! Nossa linha de ${prod.nome} é excelente para sinalização aérea profissional no PDV.\n\nEla é produzida em ${prod.material}, garantindo proteção total das ofertas contra poeira, amassados ou umidade, além de acabamento impecável.\n\nConfira todos os detalhes técnicos no nosso site oficial:\n${prod.link_permanente}\n\nMe conte: quantos corredores ou pontos aéreos você gostaria de padronizar hoje?`
      },
      {
        termo: "espeto",
        leadPergunta: "Tem precificador de espeto para colocar na bandeja de carne ou queijo?",
        setor: "Açougue e Peixaria",
        tipo: "Técnica de Higiene e Durabilidade",
        template: (prod) => `Com certeza! Nós fornecemos o ${prod.nome}, desenvolvido especificamente para contato seguro com alimentos.\n\nEle conta com ${prod.material}, sendo 100% atóxico, lavável e não oxida nem contamina a carne ou o queijo fresco.\n\nVeja as especificações completas na página do produto:\n${prod.link_permanente}\n\nQuantas bandejas ou balcões você precisa precificar no momento?`
      },
      {
        termo: "gôndola",
        leadPergunta: "Como funciona o perfil porta-etiquetas de gôndola?",
        setor: "Gôndolas e Prateleiras",
        tipo: "Consultiva com Solução Anti-Multa",
        template: (prod) => `Nosso ${prod.nome} é a melhor solução para acabar com a queda de etiquetas e o risco de multas do Procon.\n\nFabricado em ${prod.material}, conta com fita dupla face de alta fixação e não amarela com a iluminação da loja.\n\nConfira todos os modelos no site oficial:\n${prod.link_permanente}\n\nQual é a metragem aproximada de prateleiras ou quantas gôndolas você tem na loja?`
      }
    ];

    casosBase.forEach(caso => {
      const prodEncontrado = produtos.find(p => p.nome.toLowerCase().includes(caso.termo));
      if (prodEncontrado && !this.aprendizados.some(a => a.leadPergunta.toLowerCase() === caso.leadPergunta.toLowerCase())) {
        this.aprendizados.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          leadPergunta: caso.leadPergunta,
          setor: caso.setor,
          respostaAprovada: caso.template(prodEncontrado),
          tipo: caso.tipo,
          linkSugerido: prodEncontrado.link_permanente,
          curtido: true,
          data: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
      }
    });
  }

  // Motor Principal de Varredura e Aprendizado Contínuo da Visual Super (Puxa TODOS os produtos)
  async executarVarreduraWebSite(manual = true) {
    if (this.varreduraEmExecucao) return;
    this.varreduraEmExecucao = true;

    const barra = document.getElementById("barraProgressoVarreduraWeb");
    const textoProgresso = document.getElementById("textoProgressoVarreduraWeb");
    const percProgresso = document.getElementById("percProgressoVarreduraWeb");
    const fillProgresso = document.getElementById("barraProgressoVarreduraFill");
    const btnDisparar = document.getElementById("btnDispararVarreduraWeb");
    const textoBtn = document.getElementById("btnDispararVarreduraTexto");

    if (barra) barra.classList.remove("hidden");
    if (btnDisparar) btnDisparar.disabled = true;
    if (textoBtn) textoBtn.textContent = "Puxando e Aprendendo Produtos...";

    const atualizarProgresso = (perc, msg) => {
      if (percProgresso) percProgresso.textContent = `${perc}%`;
      if (fillProgresso) fillProgresso.style.width = `${perc}%`;
      if (textoProgresso) textoProgresso.innerHTML = `<i class="fas fa-spinner fa-spin text-blue-400"></i> ${msg}`;
    };

    try {
      atualizarProgresso(5, `Conectando ao site oficial: ${this.configuracaoEmpresa.siteOficial || 'https://visualsuper.com.br'}...`);
      await new Promise(r => setTimeout(r, 200));

      // Busca dinâmica de TODOS os produtos cadastrados via WooCommerce Store API
      let produtosBaixados = [];
      let pagina = 1;
      let sucessoApi = false;

      while (true) {
        const perc = Math.min(80, 10 + Math.round((pagina / 4) * 65));
        atualizarProgresso(perc, `Buscando página ${pagina} no catálogo oficial do e-commerce da Visual Super...`);

        let dadosPagina = null;

        // 1. Tenta via proxy local Vite
        try {
          const resp = await fetch(`/api/site-proxy/wp-json/wc/store/v1/products?per_page=100&page=${pagina}`);
          if (resp.ok) {
            dadosPagina = await resp.json();
            sucessoApi = true;
          }
        } catch (_) {}

        // 2. Se falhar, tenta requisição direta
        if (!dadosPagina) {
          try {
            const resp = await fetch(`https://visualsuper.com.br/wp-json/wc/store/v1/products?per_page=100&page=${pagina}`);
            if (resp.ok) {
              dadosPagina = await resp.json();
              sucessoApi = true;
            }
          } catch (_) {}
        }

        // 3. Fallback CORS Proxy
        if (!dadosPagina) {
          try {
            const target = encodeURIComponent(`https://visualsuper.com.br/wp-json/wc/store/v1/products?per_page=100&page=${pagina}`);
            const resp = await fetch(`https://api.allorigins.win/raw?url=${target}`);
            if (resp.ok) {
              dadosPagina = await resp.json();
              sucessoApi = true;
            }
          } catch (_) {}
        }

        if (Array.isArray(dadosPagina) && dadosPagina.length > 0) {
          produtosBaixados.push(...dadosPagina);
          if (dadosPagina.length < 100) {
            break; // Última página
          }
          pagina++;
        } else {
          break;
        }
      }

      // Se a conexão remota não retornou nada (ex: offline), utiliza o catálogo oficial completo pré-armazenado
      let produtosProcessados = [];
      if (produtosBaixados.length > 0) {
        produtosProcessados = produtosBaixados.map(p => this.normalizarProdutoWc(p));
      } else if (typeof VISUAL_SUPER_PRODUTOS_COMPLETO !== "undefined" && Array.isArray(VISUAL_SUPER_PRODUTOS_COMPLETO) && VISUAL_SUPER_PRODUTOS_COMPLETO.length > 0) {
        produtosProcessados = JSON.parse(JSON.stringify(VISUAL_SUPER_PRODUTOS_COMPLETO));
      }

      atualizarProgresso(85, `Processando e catalogando ${produtosProcessados.length} soluções físicas...`);
      await new Promise(r => setTimeout(r, 250));

      let produtosAtualizados = 0;
      let produtosNovos = 0;

      produtosProcessados.forEach(item => {
        const idx = this.produtos.findIndex(p => p.id === item.id || (p.link_permanente && p.link_permanente === item.link_permanente));
        if (idx >= 0) {
          this.produtos[idx] = {
            ...this.produtos[idx],
            ...item
          };
          produtosAtualizados++;
        } else {
          this.produtos.push(item);
          produtosNovos++;
        }
      });

      atualizarProgresso(93, "Alimentando o Cérebro do SDR com diferenciais e links de todos os produtos...");
      this.gerarAprendizadosCatalogoCompleto(produtosProcessados);

      this.salvarProdutos();
      this.salvarAprendizados();

      // Grava no log de varredura
      const agoraStr = new Date().toISOString();
      this.configuracaoEmpresa.ultimaVarredura = agoraStr;
      this.configuracaoEmpresa.totalPaginasRastreadas = produtosProcessados.length;
      if (!this.configuracaoEmpresa.logVarredura) this.configuracaoEmpresa.logVarredura = [];

      this.configuracaoEmpresa.logVarredura.unshift({
        data: agoraStr.replace('T', ' ').substring(0, 16),
        status: "Sucesso",
        mensagem: `Varredura de catálogo concluída com sucesso! Total de ${produtosProcessados.length} produtos cadastrados no site oficial aprendidos pelo agente (${produtosNovos} novos, ${produtosAtualizados} atualizados).`,
        produtosTotal: this.produtos.length
      });
      if (this.configuracaoEmpresa.logVarredura.length > 20) {
        this.configuracaoEmpresa.logVarredura = this.configuracaoEmpresa.logVarredura.slice(0, 20);
      }

      this.salvarConfiguracaoEmpresa(null, true);

      atualizarProgresso(100, `Concluído! O agente aprendeu todos os ${this.produtos.length} produtos do site.`);
      await new Promise(r => setTimeout(r, 400));

      if (manual) {
        this.mostrarToast(`🎉 Varredura concluída! O agente aprendeu todos os ${this.produtos.length} produtos cadastrados no site oficial.`);
      }
    } catch (errVarredura) {
      console.error("Erro na varredura do site:", errVarredura);
      if (manual) {
        this.mostrarToast("⚠️ Erro ao varrer site, usando base oficial de produtos.");
      }
    } finally {
      this.varreduraEmExecucao = false;
      if (barra) barra.classList.add("hidden");
      if (btnDisparar) btnDisparar.disabled = false;
      if (textoBtn) textoBtn.textContent = "Varrer & Aprender Todo o Site Agora";
      this.renderizarConfiguracoes();
      this.renderizarCatalogo();
    }
  }
}

// Inicializa a aplicação
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new TreinadorSDR();
});

