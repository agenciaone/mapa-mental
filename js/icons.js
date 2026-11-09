'use strict';
(function (MM) {
  /**
   * Ícones próprios (24×24, traço). "{c}" é trocado pela cor do ícone;
   * color null usa a cor do texto do tópico. Conteúdo estático e confiável.
   */
  const I = {
    whatsapp: ['WhatsApp', '#25a55f', '<path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.3z"/><path d="M9.2 8.4c.2 3 3.1 6 6.2 6.3l1-1.6-2-1-1 .9c-1-.5-2-1.5-2.4-2.5l.9-1-.9-2.1z" fill="{c}" stroke="none"/>'],
    instagram: ['Instagram', '#d62976', '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1" fill="{c}" stroke="none"/>'],
    facebook: ['Facebook', '#1877f2', '<rect x="3" y="3" width="18" height="18" rx="4" fill="{c}" stroke="none"/><path d="M15.5 7.5h-1.8A1.7 1.7 0 0 0 12 9.2V21M9.5 12.5h5.5" stroke="#fff"/>'],
    linkedin: ['LinkedIn', '#0a66c2', '<rect x="3" y="3" width="18" height="18" rx="4" fill="{c}" stroke="none"/><path d="M8 10.5v6M8 7.6v.1M11.5 16.5v-6M11.5 13.2c0-1.7 1-2.7 2.4-2.7s2.1 1 2.1 2.7v3.3" stroke="#fff"/>'],
    youtube: ['YouTube', '#e62117', '<rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="{c}" stroke="none"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#fff" stroke="none"/>'],
    tiktok: ['TikTok', null, '<path d="M13 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M13 3c.4 2.6 2.2 4.3 5 4.5"/>'],
    email: ['E-mail', null, '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>'],
    telefone: ['Telefone', null, '<path d="M5 4h3.5l1.5 4-2 1.3a11 11 0 0 0 6.7 6.7L16 14l4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'],
    chat: ['Chat', null, '<path d="M4 5h16v11H9l-4 3.5V16H4z"/><path d="M8 9.5h8M8 12.5h5"/>'],
    site: ['Site', null, '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3z"/>'],
    busca: ['Busca', null, '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'],
    anuncio: ['Anúncio', null, '<path d="M3 10v4h3l7 4.5v-13L6 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M7 14l1 5h2.5l-1-4.5"/>'],
    loja: ['Loja', null, '<path d="M4 9.5V20h16V9.5M3 4h18l1 5H2zM9.5 20v-5.5h5V20"/>'],
    evento: ['Agenda', null, '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'],
    lead: ['Lead', null, '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],
    equipe: ['Equipe', null, '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.8"/><path d="M17.5 14a5 5 0 0 1 4.5 5"/>'],
    funil: ['Funil', null, '<path d="M3 4h18l-7 8.5V20l-4-2v-5.5z"/>'],
    apresentacao: ['Apresentação', null, '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2.5 2L17 7.5"/>'],
    proposta: ['Proposta', null, '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'],
    contrato: ['Contrato', null, '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 14l2 2 4-4"/>'],
    pagamento: ['Pagamento', '#2b8a3e', '<circle cx="12" cy="12" r="9"/><path d="M15 9.2c-.5-1.2-1.7-1.8-3-1.8-1.8 0-3 .9-3 2.2 0 3.2 6 1.7 6 5 0 1.4-1.3 2.4-3 2.4-1.5 0-2.7-.7-3.1-1.9M12 5.5v1.9M12 17v1.5"/>'],
    cartao: ['Cartão', null, '<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/>'],
    carrinho: ['Carrinho', null, '<path d="M3 4h2.5l2.2 11h10.8l2-8H6.5"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>'],
    entrega: ['Entrega', null, '<path d="M2.5 6h11v10h-11zM13.5 9.5h4l3.5 3.5v3h-7.5"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'],
    suporte: ['Suporte', null, '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-1.5 2.5-4 2.5h-2"/>'],
    alvo: ['Meta', '#d6336c', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="{c}"/>'],
    ideia: ['Ideia', '#e67700', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'],
    grafico: ['Resultados', null, '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>'],
    foguete: ['Lançamento', null, '<path d="M12 2.5c3 2 4.5 5.5 4.5 9.5L14 16h-4l-2.5-4c0-4 1.5-7.5 4.5-9.5z"/><circle cx="12" cy="9.5" r="1.6"/><path d="M8 13l-3 2 1 4 3-2M16 13l3 2-1 4-3-2M10.5 19.5L12 22l1.5-2.5"/>'],
    trofeu: ['Fechamento', '#e8a700', '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8 21h8M9.5 18h5"/>'],
    estrela: ['Destaque', '#f59f00', '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'],
    check: ['Concluído', '#2f9e44', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>'],
    alerta: ['Atenção', '#e67700', '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.3v.2"/>'],
    relogio: ['Prazo', null, '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'],
    config: ['Processo', null, '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'],
    coracao: ['Fidelização', '#e03131', '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'],
  };

  MM.ICONS = {};
  for (const [k, [label, color, svg]] of Object.entries(I)) MM.ICONS[k] = { label, color, svg };

  MM.EMOJIS = ['📱', '💬', '📧', '📞', '🌐', '📣', '📸', '🎥', '🛒', '🏪', '💰', '💳', '🤝', '📝', '📄', '✅',
    '❌', '⭐', '🎯', '🚀', '💡', '📈', '📊', '🔥', '⏰', '📅', '👤', '👥', '🏆', '🎁', '🔔', '⚠️',
    '❓', '❤️', '🔒', '🔑', '📦', '🚚', '🧾', '💼', '🏢', '🎉', '👍', '👎', '➡️', '🔄', '🧲', '📍'];
})(window.MM);
