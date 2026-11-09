# Mapas Mentais

Aplicativo de mapas mentais que roda inteiramente no navegador, sem internet e sem enviar dados para nenhum servidor. Feito em HTML, CSS e JavaScript puros, sem bibliotecas externas.

## Como abrir

### Opção 1 — Servidor local (recomendado: permite instalar e usar offline)

**Windows:** dê dois cliques em `iniciar.bat`. O navegador abre em `http://localhost:8080`. Mantenha a janela preta aberta enquanto usa; feche-a para parar.

Se a porta 8080 estiver ocupada:

```bash
powershell -ExecutionPolicy Bypass -File servidor.ps1 -Port 8081
```

**Com Python (qualquer sistema):** dentro desta pasta, rode

```bash
python -m http.server 8080
```

e abra `http://localhost:8080`.

### Opção 2 — Abrir o arquivo direto

Dê dois cliques em `index.html`. Tudo funciona, exceto a instalação como aplicativo (PWA), que exige `http://localhost`. Nesse modo alguns navegadores guardam os mapas no `localStorage` em vez do IndexedDB; os mapas ficam separados dos salvos pelo modo servidor (use Exportar/Importar JSON para levá-los de um para o outro).

## Instalar como aplicativo (PWA)

1. Abra pelo servidor local (opção 1).
2. **Chrome/Edge:** clique no ícone de instalar na barra de endereço (ou menu ⋮ → "Instalar Mapas Mentais"). **Firefox:** o Firefox para computador não instala PWAs; use normalmente pelo navegador, que também funciona offline após o primeiro acesso.
3. Depois do primeiro carregamento, o app funciona sem internet e sem o servidor: os arquivos ficam no cache do service worker.

## Funcionalidades

- Criar, renomear, duplicar, excluir (com confirmação) e buscar mapas — botão ☰.
- Tópico central, subtópicos (Tab) e irmãos (Enter); editar com duplo clique, F2 ou começando a digitar.
- Arrastar tópicos livremente (os subtópicos acompanham); soltar sobre outro tópico muda o pai.
- Reorganizar o tópico selecionado e seus subtópicos (Ctrl+L) ou o mapa inteiro; modo "organização automática" opcional (ícone de ímã).
- Recolher e expandir ramificações (Espaço ou o círculo ao lado do tópico).
- Zoom (roda do mouse, pinça, + / −), mover a tela arrastando o fundo, centralizar (Ctrl+0).
- Desfazer / refazer (Ctrl+Z / Ctrl+Y).
- Painel de estilo: forma (7 opções), cor de preenchimento, cor do texto, cor da ramificação, tamanho do texto, negrito, itálico, borda.
- Elementos visuais: cada tópico pode ter um emoji ou um ícone da biblioteca própria (WhatsApp, Instagram, e-mail, telefone, site, funil, proposta, contrato, pagamento etc.). Com o texto vazio, o tópico mostra só o elemento, em tamanho grande.
- Fotos: cada tópico pode ter uma foto (botão "Adicionar foto", colar com Ctrl+V ou arrastar o arquivo sobre o tópico), em tamanho pequeno, médio ou grande. As imagens são reduzidas automaticamente e ficam guardadas dentro do mapa, então funcionam offline e entram no PDF, PNG e JSON.
- Fluxos com setas: as ligações pai → filho podem ter ponta de seta (simples ou dupla), rótulo (ex.: "resposta rápida") e linha tracejada ou pontilhada. Em ⋯ → "Setas em todas as ligações" o mapa inteiro vira um fluxo.
- Conexões livres: botão "Conectar" (Ctrl+K) liga qualquer tópico a qualquer outro com uma seta extra, com rótulo, cor, curva e sentido ajustáveis. Clique na seta para editar; Delete exclui.
- Notas e links por tópico (links aceitam apenas http, https, mailto e tel).
- Temas claro e escuro.
- Salvamento automático no dispositivo (IndexedDB, com localStorage como alternativa).
- Exportar/importar JSON; cópias de segurança (manual e uma automática por dia, até 10) que podem ser restauradas ou baixadas como arquivo.
- Exportar PDF (com pré-visualização, retrato/paisagem, A4/A3/Carta/Ofício, margem, qualidade, uma página ou várias páginas para manter o texto legível), PNG (1×–4×, fundo transparente opcional) e SVG.
- "Imprimir / Salvar como PDF": versão de impressão vetorial; na janela de impressão escolha "Salvar como PDF".

Veja todos os atalhos em ⋯ → "Atalhos de teclado". O mapa "Guia rápido" já vem com um resumo.

## Sobre o PDF

O PDF é gerado pelo próprio aplicativo, sem bibliotecas: o mapa é desenhado em SVG, convertido em imagem de alta resolução (150–300 dpi) e embutido em um PDF. O enquadramento usa o mapa completo, inclusive o que está fora da tela. No modo "várias páginas", as páginas se sobrepõem o suficiente para que cada tópico apareça inteiro em pelo menos uma delas. Para um PDF 100% vetorial (texto selecionável), use "Imprimir / Salvar como PDF".

## Privacidade e segurança

- Nenhuma requisição externa: sem CDN, fontes externas ou APIs. Uma Content-Security-Policy bloqueia scripts de outras origens.
- Textos digitados são sempre inseridos como texto (nunca como HTML).
- Arquivos importados são validados: campos desconhecidos, cores inválidas, links inseguros e estruturas circulares são descartados.

## Estrutura

```
index.html            página principal
css/app.css           estilos (temas claro/escuro, responsivo, impressão)
js/util.js            utilitários (ids, cores, downloads, links seguros)
js/icons.js           biblioteca de ícones e emojis
js/model.js           dados do mapa, histórico, validação de importação
js/layout.js          medição de texto e organização automática
js/render.js          desenho SVG dos tópicos e conexões
js/store.js           armazenamento local (IndexedDB / localStorage)
js/export.js          PDF, PNG, SVG, impressão e JSON
js/dialogs.js         janelas de diálogo e avisos
js/demo.js            mapas de demonstração
js/app.js             interface, eventos e atalhos
sw.js                 service worker (cache offline)
manifest.webmanifest  manifesto da PWA
icons/                ícones do aplicativo
servidor.ps1          servidor local para Windows
iniciar.bat           atalho para o servidor
```

Para publicar uma nova versão depois de alterar arquivos, o service worker atualiza o cache em segundo plano; recarregue a página duas vezes para ver as mudanças.
