'use strict';
(function (MM) {
  const { M, L, R } = MM;

  function build(name, spec) {
    const map = M.createMap(name, spec.t, spec.structure);
    const root = map.nodes[map.rootId];
    Object.assign(root, { note: spec.note || '', style: spec.style || {}, icon: spec.icon || '', emoji: spec.emoji || '' });
    map.arrows = !!spec.arrows;
    map.autoLayout = !!spec.autoLayout;
    if (spec.rootAt) { root.x = spec.rootAt[0]; root.y = spec.rootAt[1]; }
    const byText = { [spec.t]: root.id };
    const add = (parentId, s, depth) => {
      const n = M.addChild(map, parentId, s.t);
      byText[s.t] = n.id;
      n.note = s.note || '';
      n.link = s.link || '';
      n.icon = s.icon || '';
      n.emoji = s.emoji || '';
      n.edge = s.edge ? { label: s.edge } : {};
      n.style = Object.assign({}, s.style || {});
      if (depth === 1 && !n.style.branch) n.style.branch = R.PALETTE[(map.nodes[parentId].children.length - 1) % R.PALETTE.length];
      (s.kids || []).forEach((k) => add(n.id, k, depth + 1));
      n.collapsed = !!s.collapsed;
    };
    (spec.kids || []).forEach((k) => add(map.rootId, k, 1));
    if (spec.oneSide) for (const c of root.children) map.nodes[c].x = root.x + 1;
    L.layoutAll(map, false);
    if (spec.funnel) map.shapes.push(Object.assign(M.newFunnel(0, 0, spec.funnel.labels), spec.funnel.props || {}));
    (spec.free || []).forEach((s, i) => {
      const n = M.addFree(map, s.t, s.x, s.y);
      byText[s.t] = n.id;
      n.icon = s.icon || '';
      n.emoji = s.emoji || '';
      n.note = s.note || '';
      n.style = Object.assign({ branch: s.color || '#495057' }, s.style || {});
      void i;
    });
    for (const [a, b, label, opts] of spec.links || []) {
      const l = M.addLink(map, byText[a], byText[b]);
      if (l) Object.assign(l, { label: label || '' }, opts || {});
    }
    return map;
  }

  // ---------- modelos para "Novo mapa" ----------
  const FUNNEL_STAGES = ['Topo · Descoberta', 'Meio · Consideração', 'Fundo · Decisão', 'Pós-venda · Fidelização'];
  const STAGE = MM.M.STAGE_COLORS;

  function funnelSpec(title, sample) {
    // funil de 760 × 4 etapas de 150; textos posicionados dentro de cada faixa
    const y = (i) => i * 150 + 92;
    return {
      t: title, rootAt: [0, -70], style: { fontSize: 22 },
      note: 'Arraste textos e ícones para dentro das etapas do funil. Dê dois cliques dentro do funil (ou no fundo) para criar um texto. Use "Conectar" (Ctrl+K) para ligar os conteúdos com setas.',
      funnel: { labels: FUNNEL_STAGES, props: { w: 760, stageH: 150, taper: 0.32 } },
      free: sample ? [
        { t: 'Reels e TikTok', icon: 'tiktok', x: -205, y: y(0), color: STAGE[0] },
        { t: 'Blog e SEO', icon: 'busca', x: 0, y: y(0), color: STAGE[0] },
        { t: 'Anúncios', icon: 'anuncio', x: 195, y: y(0), color: STAGE[0] },
        { t: 'Carrossel educativo', icon: 'apresentacao', x: -140, y: y(1), color: STAGE[1] },
        { t: 'E-mail de nutrição', icon: 'email', x: 140, y: y(1), color: STAGE[1] },
        { t: 'Depoimentos', icon: 'estrela', x: -100, y: y(2), color: STAGE[2] },
        { t: 'WhatsApp', icon: 'whatsapp', x: 100, y: y(2), color: STAGE[2] },
        { t: 'Comunidade', icon: 'equipe', x: 0, y: y(3), color: STAGE[3] },
      ] : [],
      links: sample ? [
        ['Reels e TikTok', 'Carrossel educativo', 'seguiu', { line: 'solid' }],
        ['Blog e SEO', 'E-mail de nutrição', 'baixou e-book', { line: 'solid' }],
        ['Anúncios', 'E-mail de nutrição', '', { line: 'solid' }],
        ['Carrossel educativo', 'Depoimentos', '', { line: 'solid' }],
        ['E-mail de nutrição', 'WhatsApp', 'clicou na oferta', { line: 'solid' }],
        ['WhatsApp', 'Comunidade', 'comprou', { line: 'solid' }],
      ] : [],
    };
  }

  MM.templateMap = function (kind, name, sample) {
    if (kind === 'flow') {
      return build(name, {
        t: sample ? 'Ideia' : 'Início', icon: sample ? 'ideia' : 'alvo', structure: 'flow', arrows: true, autoLayout: true,
        kids: sample ? [{ t: 'Roteiro', icon: 'proposta', kids: [{ t: 'Gravação', icon: 'evento', kids: [{ t: 'Edição', icon: 'config', kids: [
          { t: 'Publicação', icon: 'foguete', edge: 'aprovado', kids: [{ t: 'Análise de métricas', icon: 'grafico' }] },
          { t: 'Ajustes', icon: 'alerta', edge: 'reprovado' },
        ] }] }] }] : [{ t: 'Etapa 1' }],
      });
    }
    if (kind === 'org') {
      return build(name, {
        t: sample ? 'Diretoria' : 'Diretoria', structure: 'org', autoLayout: true,
        kids: sample ? [
          { t: 'Marketing', icon: 'anuncio', kids: [{ t: 'Conteúdo' }, { t: 'Tráfego pago' }, { t: 'Design' }] },
          { t: 'Comercial', icon: 'lead', kids: [{ t: 'Pré-vendas' }, { t: 'Vendas' }] },
          { t: 'Operações', icon: 'config', kids: [{ t: 'Atendimento' }, { t: 'Financeiro' }] },
        ] : [{ t: 'Área 1' }, { t: 'Área 2' }],
      });
    }
    if (kind === 'funnel') return build(name, funnelSpec(name, sample));
    return M.createMap(name, name);
  };

  MM.demoMaps = function () {
    const guide = build('Guia rápido', {
      t: 'Bem-vindo ao Mapas Mentais',
      note: 'Este mapa explica como usar o aplicativo. Fique à vontade para editá-lo ou excluí-lo.',
      kids: [
        { t: 'Criar tópicos', kids: [
          { t: 'Tab: novo subtópico' },
          { t: 'Enter: novo tópico irmão' },
          { t: 'Duplo clique ou F2: editar texto' },
          { t: 'Comece a digitar para substituir o texto' },
        ] },
        { t: 'Organizar', kids: [
          { t: 'Arraste um tópico para movê-lo com seus subtópicos' },
          { t: 'Solte sobre outro tópico para mudar de pai' },
          { t: 'Botão "Reorganizar" alinha a ramificação' },
          { t: 'Espaço: recolher / expandir', collapsed: false },
        ] },
        { t: 'Navegar', kids: [
          { t: 'Arraste o fundo para mover a tela' },
          { t: 'Roda do mouse ou pinça: zoom' },
          { t: 'Setas: selecionar tópicos vizinhos' },
          { t: 'Ctrl+0: centralizar o mapa' },
        ] },
        { t: 'Estilo', note: 'Selecione um tópico e use o painel lateral para mudar cor, forma, tamanho do texto, borda e cor da ramificação.', kids: [
          { t: 'Formas', style: { shape: 'hexagon' } },
          { t: 'Cores', style: { shape: 'pill', fill: '#ffd8a8' } },
          { t: 'Negrito e itálico', style: { bold: true, italic: true } },
          { t: 'Notas e links', link: 'https://pt.wikipedia.org/wiki/Mapa_mental', note: 'Clique no ícone de nota para lê-la. O ícone de corrente abre o link.' },
        ] },
        { t: 'Arquivos', kids: [
          { t: 'Salvamento automático no dispositivo' },
          { t: 'Exportar PDF, PNG, SVG e JSON' },
          { t: 'Cópias de segurança' },
          { t: 'Desfazer: Ctrl+Z · Refazer: Ctrl+Y' },
        ] },
        { t: 'Ramificação recolhida', collapsed: true, kids: [
          { t: 'Clique no número para expandir' },
          { t: 'Os itens escondidos são preservados' },
        ] },
      ],
    });

    const project = build('Lançamento do produto', {
      t: 'Lançamento do Produto',
      kids: [
        { t: 'Pesquisa', kids: [
          { t: 'Público-alvo', kids: [{ t: 'Pequenas empresas' }, { t: 'Profissionais autônomos' }] },
          { t: 'Concorrentes' },
          { t: 'Entrevistas com clientes', note: '10 entrevistas de 30 minutos.\nRoteiro na pasta compartilhada.' },
        ] },
        { t: 'Marketing', kids: [
          { t: 'Redes sociais' },
          { t: 'E-mail para a base' },
          { t: 'Página de lançamento', link: 'https://example.com' },
          { t: 'Parcerias' },
        ] },
        { t: 'Desenvolvimento', kids: [
          { t: 'MVP', style: { bold: true } },
          { t: 'Testes com usuários' },
          { t: 'Correções' },
        ] },
        { t: 'Orçamento', kids: [{ t: 'Equipe' }, { t: 'Ferramentas' }, { t: 'Mídia paga' }] },
        { t: 'Cronograma', kids: [
          { t: 'Fase 1 · Descoberta' },
          { t: 'Fase 2 · Construção' },
          { t: 'Fase 3 · Lançamento', style: { fill: '#b2f2bb', shape: 'pill' } },
        ] },
      ],
    });
    const flow = build('Fluxo comercial', {
      t: 'Lead qualificado',
      icon: 'lead',
      style: { fontSize: 20 },
      arrows: true,
      oneSide: true,
      note: 'Exemplo de fluxo: as setas mostram para quais canais o lead é direcionado. Clique numa seta para editar o rótulo; use "Conectar" para ligar quaisquer tópicos.',
      kids: [
        { t: 'WhatsApp', icon: 'whatsapp', edge: 'resposta rápida', kids: [
          { t: 'Agendar reunião', icon: 'evento', edge: 'interessado', kids: [
            { t: 'Proposta', icon: 'proposta', edge: 'em até 24h', kids: [
              { t: 'Fechamento', icon: 'trofeu', edge: 'aprovou' },
            ] },
          ] },
        ] },
        { t: 'Telefone', icon: 'telefone', edge: 'ticket alto' },
        { t: 'E-mail', icon: 'email', edge: 'envio de material' },
        { t: 'Instagram', icon: 'instagram', edge: 'remarketing' },
      ],
      links: [
        ['Telefone', 'Agendar reunião', 'quer conversar'],
        ['E-mail', 'Proposta', 'pediu orçamento'],
      ],
    });
    const funnel = build('Funil de conteúdo', funnelSpec('Estratégia de conteúdo', true));
    project.updated -= 1000; // o guia aparece primeiro
    flow.updated -= 500;
    funnel.updated -= 250;
    return [guide, funnel, flow, project];
  };
})(window.MM);
