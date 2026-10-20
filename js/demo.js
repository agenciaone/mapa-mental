'use strict';
(function (MM) {
  const { M, L, R } = MM;

  function build(name, spec) {
    const map = M.createMap(name, spec.t);
    const root = map.nodes[map.rootId];
    Object.assign(root, { note: spec.note || '', style: spec.style || {} });
    const add = (parentId, s, depth) => {
      const n = M.addChild(map, parentId, s.t);
      n.note = s.note || '';
      n.link = s.link || '';
      n.style = Object.assign({}, s.style || {});
      if (depth === 1 && !n.style.branch) n.style.branch = R.PALETTE[(map.nodes[parentId].children.length - 1) % R.PALETTE.length];
      (s.kids || []).forEach((k) => add(n.id, k, depth + 1));
      n.collapsed = !!s.collapsed;
    };
    (spec.kids || []).forEach((k) => add(map.rootId, k, 1));
    L.layoutAll(map, true);
    return map;
  }

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
    project.updated -= 1000; // o guia aparece primeiro
    return [guide, project];
  };
})(window.MM);
