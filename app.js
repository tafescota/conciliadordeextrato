// ── CONFIG PDF.JS ────────────────────────────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ── ESTADO ───────────────────────────────────────────────────────────────────
let allTxns = [], currentMes = '', chartR = null, chartC = null, sourceCompanies = {}, importValidations = {};

// ── ENCODING ─────────────────────────────────────────────────────────────────
function fixEnc(s) {
  if (!s) return '';
  return s
    .replace(/Ã©/g,'é').replace(/Ã‰/g,'É').replace(/Ã£/g,'ã').replace(/Ã¡/g,'á')
    .replace(/Ã³/g,'ó').replace(/Ãº/g,'ú').replace(/Ã§/g,'ç').replace(/Ã‡/g,'Ç')
    .replace(/Ã¢/g,'â').replace(/Ãª/g,'ê').replace(/Ã´/g,'ô').replace(/Ã /g,'à')
    .replace(/Ãƒâ€¢/g,'Ã•').replace(/ÃƒÂµ/g,'Ãµ').replace(/Ãƒâ€š/g,'Ã‚').replace(/ÃƒÅ /g,'Ê')
    .replace(/[\xc0-\xff][\x80-\xbf]+/g, m => {
      try { return new TextDecoder('utf-8').decode(new Uint8Array([...m].map(c => c.charCodeAt(0)))); }
      catch(e) { return m; }
    });
}

// ── CATEGORIAS ────────────────────────────────────────────────────────────────
const CATS = [
  { name: 'Transferência entre contas', color: '#42d8d2', test: /\btbi\b/i },
  { name: 'Tarifa bancária',      color: '#556',    test: /\btar\b|tarifa|pacote.?serv|d[eé]bito.?pacote/i },
  { name: 'Multa de trânsito',     color: '#d86f45', test: /db\s*conv\s*multas?\s*tran|multa\s+de\s+tr[aâ]nsito|multa\s+transito/i },
  { name: 'Tributo estadual',      color: '#d86f45', test: /dare\s+nf|dare\b/i },
  { name: 'Tributo sindicato',     color: '#d86f45', test: /sindicato|contribui[çc][aã]o sindical/i },
  { name: 'Tributos',              color: '#d86f45', test: /d[eé]b\.?\s*conv\.?\s*[oó]rg[aã]os\s*go|\btributos?\b|\bdas\b|imposto|pagamento de imposto|pagto imposto|secret\.?\s* fazenda|secretaria da fazenda|sefaz|gare|gnre/i },
  { name: 'Cartão corporativo',    color: '#e0a030', test: /cart[aã]o de cr[eé]dito|cartao de credito|cart[aã]o credito|cartao credito|pagto cart[aã]o|pagamento cart[aã]o|fatura.*cart[aã]o/i },
  { name: 'Manutenção',            color: '#8bb4f3', test: /manuten[çc][aã]o|manutencao/i },
  { name: 'Viagem terrestre',      color: '#6b9cf3', test: /\buber\b|99\s*pop|99\s*taxi|taxi|t[aá]xi/i },
  { name: 'Energia elétrica',     color: '#f5c842', test: /cemig|cpfl|enel|coelba|celpe|energisa|elektro|light|ampla|cosern|celg|cemar|ceal|ceron|eletroacre|\bedp\b|equatorial|neoenergia|enersul|energia\s+el[eé]trica|conta\s+luz|pgto\s+conta\s+luz|pagamento\s+conta\s+luz|conta\s+de\s+energia|internet\s+edp/i },
  { name: 'Água e esgoto',        color: '#1ba6a6', test: /sabesp|copasa|saneago|caema|cosanpa|casan|saae|embasa|caerd|agespisa|aguar|sanepar|caesb|conta\s+[aá]gua|pgto\s+conta\s+[aá]gua|[aá]gua\s+e\s+esgoto|cia\s+de\s+saneamento|cia\s+saneamento|saneamento|esgoto/i },
  { name: 'Combustível',           color: '#f5c842', test: /auto\s*posto|\bposto\b|combust[ií]v|gasolina|etanol|gas\s*station|petrol|shell|ipiranga|br\s+distribuidora|raizen|raízen/i },
  { name: 'Alimentação',           color: '#e0a030', test: /restaurante|lanchonete|pizzaria|padaria|panificadora|pastelaria|\bcafe\b|\bcafé\b|coffee|bolos|salgados|buffet|churrascaria|hamb[uú]rger|hamburger|sorveteria/i },
  { name: 'Uso e consumo',         color: '#8bb4f3', test: /supermercado|\\bmercado\\b|atacado|atacadista|alimentos|hortifruti|mercearia/i },
  { name: 'Fornecedor',            color: '#7b5cf0', test: /pix[.\s]*emit[.\s]*out(?:ra)?\s+if|pix[.\s]*emit[.\s]*out\s+if\s*-?\s*msm\s*d|marketplace|cef\s+matriz|sercol|\bmark\b|mobile int|sispag pag tit|cel pag tit|d[eé]b\.?\s*tit\.?\s*compe\.?\s*efeti(?:vado)?\s*d?|d[eé]b\.?\s*tit\.?\s*cobran[çc]a efetivado|d[eé]b\.?\s*t[íi]tulo cobran[çc]a|db\.?\s*tr\.?\s*c\.?\s*dif\.?\s*tit\.?\s*int\.?\s*fav\.?|pagamento de boleto|pagto boleto|pag boleto|boleto/i },
  { name: 'Honorários contábeis', color: '#2dd4a0', test: /contabil|contábil|contador|contabilidade|honorar/i },
  { name: 'Empréstimo / Financiamento', color: '#a36cf0', test: /pronampe|\bgiro\b|parcela giro|emprestimo|empr[eé]stimo|financiamento/i },
  { name: 'Encargo fundo garantidor', color: '#778', test: /ecg garantia fgi|garantia fgi|\bfgi\b|fundo garantidor/i },
  { name: 'Investimento Ourocap',  color: '#c4881a', test: /ourocap/i },
  { name: 'Pedágio',               color: '#8bb4f3', test: /concessionaria nasce|concession[aá]ria nasce|autopista fern[aã]o dia|autopista fernao dias|epr sul de minas|ped[aá]gio|pedagio/i },
  { name: 'Combustível',           color: '#f5c842', test: /(cart[aã]o|cartao|compra|pagto).*(posto|combust[ií]vel|combustivel|gasolina|etanol|diesel)|posto.*(cart[aã]o|cartao|compra|pagto)/i },
  { name: 'Refeições',             color: '#e0a030', test: /(cart[aã]o|cartao|compra|pagto).*(alimenta[çc][aã]o|alimentacao|refei[çc][aã]o|refeicao|restaurante|churrascaria|lanchonete|padaria|sorvete|sorveteria|bar|ifood)|(?:alimenta[çc][aã]o|alimentacao|refei[çc][aã]o|refeicao|restaurante|churrascaria|lanchonete|padaria|sorvete|sorveteria|bar|ifood).*(cart[aã]o|cartao|compra|pagto)/i },
  { name: 'Uso e consumo',         color: '#8bb4f3', test: /cr[.\s]*compras.*rede[_\s.]?cred|(cart[aã]o|cartao|compra|pagto).*(mercado|supermercado|atacad|mercearia)|(?:mercado|supermercado|atacad|mercearia).*(cart[aã]o|cartao|compra|pagto)/i },
  { name: 'Cartão corporativo',    color: '#e0a030', test: /cart[aã]o corporativo/i },
  { name: 'Recebimento de clientes - cartão', color: '#2dd4a0', test: /recebimento rede visa|recebimento rede mast|recebimento rede amex|recebimento rede elo|recebimento rede|recebimento stone|rede_cred|rede_deb|rede.?cred|rede.?deb|stone visa|stone mast|stone elo|infinitepay|cloudwalk|wellhub|gympass/i },
  { name: 'Plano VGBL',            color: '#2f80ed', test: /premio vgbl|premio.*vgbl|\bvgbl\b/i },
  { name: 'Fornecedor',            color: '#7b5cf0', test: /tit pag tit ulo itau|pag titulo itau|business|pag boleto int|d[eé]b\.?\s*tit\.?\s*compe efetivado|deb\.?\s*tit\.?\s*compe efetivado|debito\.?\s*tit\.?\s*compe efetivado|pix emitido outra if|d[eé]b\.?\s*pagamento de bolet|deb\.?\s*pagamento de bolet|debito\.?\s*pagamento de bolet|d[eé]b\.?\s*conv\.?\s*demais empres|deb\.?\s*conv\.?\s*demais empres|debito\.?\s*conv\.?\s*demais empres|sispag fornecedores|mobile pag tit|cheque|chq |cheque compe/i },
  { name: 'Tarifa',                color: '#556',    test: /\btar\b|tarifa pagamento salar|teg ex gar/i },
  { name: 'Aplicação financeira', color: '#42d8d2', test: /bb rende|rende f[aá]cil|resgate.*cdb|cdb\s*di|aplica[çc][aã]o|aplicacao|investimento/i },
  { name: 'Rendimento de aplicação', color: '#20b8aa', test: /rendimentos?\s+rend pago aplic|rend pago aplic aut mais|rendimento de aplica/i },
  { name: 'Empréstimo / Financiamento', color: '#a36cf0', test: /parcela giro|emprestimo|empr[eé]stimo|financiamento/i },
  { name: 'Plano de saúde',        color: '#2f80ed', test: /pleno saude|pleno sa[úu]de|plano de sa[úu]de/i },
  { name: 'Fornecedor',            color: '#7b5cf0', test: /sispag fornecedores|mobile pag tit|cheque|chq |cheque compe/i },
  { name: 'Tarifa',                color: '#556',    test: /teg ex gar/i },
  { name: 'Tributos',              color: '#d86f45', test: /sispag tributos/i },
  { name: 'Taxas e tributos prefeitura', color: '#d86f45', test: /d[eé]b\.?conv\.?prefeitura|prefeitura|municipio|munic[ií]pio|iptu|alvar[aá]|taxa.*pref|tributo.*pref/i },
  { name: 'Água e esgoto',        color: '#1ba6a6', test: /d[eé]b\.?conv\.?saneamento|saneamento|saae|sabesp|copasa|cedae|caesb|embasa|[aá]gua|agua|esgoto/i },
  { name: 'Tributos federais',    color: '#cc2020', test: /d[eé]b\.?conv\.?tributos federais|tributos federais|receita federal|\brfb\b|arrecada[çc][aã]o federal/i },
  { name: 'INSS / GPS',           color: '#e07040', test: /\binss\b|gps |guia.?prev/i },
  { name: 'FGTS',                 color: '#c4881a', test: /\bfgts\b/i },
  { name: 'IRRF',                 color: '#9a6010', test: /\birrf\b/i },
  { name: 'Simples Nacional',     color: '#b83a2a', test: /simples.?nac|pgdas/i },
  { name: 'DARF / IRPJ / CSLL',  color: '#cc2020', test: /\bdarf\b|irpj|csll/i },
  { name: 'ISS',                  color: '#e07040', test: /\biss\b/i },
  { name: 'ICMS',                 color: '#b83a2a', test: /\bicms\b/i },
  { name: 'PIS / COFINS',         color: '#c4881a', test: /\bpis\b|\bcofins\b/i },
  { name: 'Salários',             color: '#4b7cf3', test: /\bfolha\b|salario|salário|pagamento.?salario|debito.?pag.*salario/i },
  { name: 'Pró-labore',           color: '#6b9cf3', test: /pro.?labore/i },
  { name: 'Férias / 13º',        color: '#8bb4f3', test: /\bferias\b|férias|13.?sal/i },
  { name: 'Honorários contábeis', color: '#2dd4a0', test: /honorar/i },
  { name: 'Aluguel',              color: '#7b5cf0', test: /aluguel|loca[çc][aã]o/i },
  { name: 'Cesta básica',         color: '#16a34a', test: /cesta(?:\s+b[aá]sica)?|vale.?alimenta[çc][aã]o|aux[ií]lio.?alimenta[çc][aã]o/i },
  { name: 'Energia elétrica',     color: '#f5c842', test: /energia|el[eé]trica|cpfl|cemig|enel|coelba|celpe|\bluz\b|conv.*en\.|origo.?energia/i },
  { name: 'Internet / Telefone',  color: '#e0a030', test: /internet|telefon|vivo|claro|\btim\b|\boi\b|telecom|netspeed/i },
  { name: 'Seguros',              color: '#888',    test: /seguro/i },
  { name: 'Tarifa bancária',      color: '#556',    test: /tarifa|pacote.?serv|débito.?pacote/i },
  { name: 'IOF',                  color: '#445',    test: /\biof\b/i },
  { name: 'Juros e comissões bancárias', color: '#778', test: /juros\s+limite\s+da\s+conta|comiss(?:ao|ão|oes|ões)\s+banc/i },
  { name: 'Juros / Encargos',     color: '#778',    test: /comiss(?:ao|ão)\s+recurso\s+nao\s+disp|comiss(?:ao|ão)\s+recurso|juros|encargo|\bmulta\b|\bmora\b/i },
  { name: 'Recebimento de clientes - cartão', color: '#2dd4a0', test: /rede_cred|rede_deb|rede.?cred|rede.?deb|recebimento (rede|stone)|stone visa|stone mast|stone elo|infinitepay|cloudwalk|wellhub|gympass/i },
];

const TRF_CATS = new Set(['Recebimento de clientes','Recebimento de clientes - cartão','Transferência mesma empresa','Transferência entre contas','Operações pessoa física','PIX para PF','Transferência pessoa física','Transferência bancária','TED recebida','PIX enviado','TED enviada',
  'Transf. recebida','Transf. enviada','Fornecedor','Fornecedores']);

const CAT_COLOR = {};
CATS.forEach(c => { CAT_COLOR[c.name] = c.color; });
Object.assign(CAT_COLOR, {
  'Aplicação financeira': '#42d8d2',
  'Fornecedor': '#7b5cf0', 'Fornecedores': '#7b5cf0',
  'Transferência mesma empresa': '#42d8d2',
  'Transferência entre contas': '#42d8d2',
  'Transferência pessoa física': '#6b9cf3',
  'Operações pessoa física': '#6b9cf3',
  'PIX para PF': '#6b9cf3',
  'Cartão corporativo': '#e0a030',
  'Recebimento de clientes': '#2dd4a0', 'Recebimento de clientes - cartão': '#2dd4a0', 'Recebimento cliente': '#2dd4a0',
  'PIX recebido': '#2dd4a0', 'TED recebida': '#1aa070',
  'PIX enviado': '#f08080', 'TED enviada': '#f05c5c',
  'Transferência bancária': '#42d8d2', 'Transf. recebida': '#2dd4a0', 'Transf. enviada': '#f08080',
  'Combustível': '#f5c842', 'Alimentação': '#e0a030', 'Refeições': '#e0a030', 'Uso e consumo': '#8bb4f3',
  'Pedágio': '#8bb4f3',
  'Encargo fundo garantidor': '#778', 'Investimento Ourocap': '#c4881a',
  'Marketing': '#d66bd6', 'Matéria prima': '#16a34a', 'Revenda comida': '#f59e0b',
  'Cesta básica': '#16a34a',
  'Manutenção': '#8bb4f3', 'Viagem terrestre': '#6b9cf3', 'Tributo estadual': '#d86f45', 'Tributo sindicato': '#d86f45',
  'Multa de trânsito': '#d86f45', 'Juros e comissões bancárias': '#778',
  'Cheque': '#7b5cf0', 'Outros': '#445566',
});

function getCatColor(n) { return CAT_COLOR[n] || '#445566'; }
function isTrf(cat) { return TRF_CATS.has(cat); }

function temEmpresa(d) {
  return /\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-\/]?\d{4}[\.\-]?\d{2}/.test(d) ||
    /ltda|s\.?a\.?|eireli|\bme\b|\bepp\b|distribuidora|industria|comércio|comercio|servi[çc]os|farmácia|farmacia/i.test(d);
}

function categorize(desc, tipo) {
  const d = desc || '';
  if (/estorno\s+(?:de\s+)?tarifa/i.test(d)) return 'Tarifa bancária';
  if (/resgate\s+(?:rdc|contamax|bb\s*cdb)|resgate\s+contamax\s+automatico|resgate.*cdb/i.test(d)) return 'Resgate de Aplicação';
  if (/rendimento\s+l[ií]quido\s+de\s+contamax|rend\s+pago\s+aplic|rendimento\s+cdb|juros\s+s\/?capital/i.test(d)) return 'Rendimento de aplicação';
  if (/business\s+4004(?:\s*-?\s*7113)?/i.test(d)) return 'Cartão corporativo';
  if (/\btbi\s+\d{3,5}[\.\-\s]*\d/i.test(d)) return 'Transferência entre contas';
  if (/comiss(?:ao|ão)\s+recurso\s+nao\s+disp|comiss(?:ao|ão)\s+recurso|juros\s+limite\s+da\s+conta|juros\s+cta\s+garantida/i.test(d)) return 'Juros / Encargos';
  if (/pronampe|bb\s+giro\s+pronampe|capital\s+giro|peac\s+fgi|parcela\s+giro|deb\.?\s*emprestimo|d[eé]b\.?\s*emprestimo|bb\s+giro/i.test(d)) return 'Empréstimo / Financiamento';
  if (tipo === 'saida' && /cr[.\s]*compras.*rede[_\s.]?cred/i.test(d)) return 'Uso e consumo';
  // Recebimentos via Rede Itaú (ELO, MAST, VISA, MC, VS, AM, EL, CA + DB = débito automático cartão)
  if (tipo === 'entrada' && /^Rede\s+(ELO|MAST|VISA|MC|VS|AM|EL|CA|VS)\s+DB\d/i.test(d)) return 'Recebimento de clientes - cartão';
  if (tipo === 'entrada' && /^Rede\s+(ELO|MAST|VISA|MC|VS|AM|EL|CA)\s+\d/i.test(d)) return 'Recebimento de clientes - cartão';
  if (tipo === 'entrada' && /getnet|pagamento cart[aã]o de cr[eé]dito|pagamento cart[aã]o de d[eé]bito/i.test(d)) return 'Recebimento de clientes - cartão';
  for (const c of CATS) {
    if (tipo === 'saida' && c.name === 'Recebimento de clientes - cartão') continue;
    if (tipo === 'entrada' && c.name === 'Cartão corporativo') continue;
    if (c.test.test(d)) return c.name;
  }
  if (tipo === 'saida' && /(cart[aã]o|cartao|compra no cart|compra cart|pagto cart)/i.test(d)) return 'Uso e consumo';
  if (/\b(pix|ted|doc)\b|transf/i.test(d)) {
    if (/pix.?emitido|pagamento.?pix/i.test(d)) return 'PIX enviado';
    if (/pix.?recebido|recebimento.?pix/i.test(d)) return 'Recebimento de clientes';
    if (/ted.?cr[eé]dito|ted.?credito|cr[eé]d\.?ted|cred\.?ted|cr[eé]dito em conta|credito em conta/i.test(d)) return 'TED recebida';
    if (/ted.?d[eé]bito|ted.?debito|d[eé]b\.?ted|deb\.?ted|ted enviada/i.test(d)) return 'TED enviada';
    if (/ted.?pag.?fornecedores/i.test(d)) return tipo === 'entrada' ? 'Transf. recebida' : 'TED enviada';
    if (/créd\.ted|cred\.ted|transf.?recebida.*pix.?sicoob/i.test(d)) return 'TED recebida';
    if (/transf\.realizada|déb\.transf|debito.?emissao.?ted/i.test(d)) return 'Transf. enviada';
    if (/cred\.transf|créd\.transf|transf\.recebida/i.test(d)) return 'Transf. recebida';
    if (temEmpresa(d)) return tipo === 'entrada' ? 'Recebimento de clientes' : 'Fornecedor';
    return tipo === 'entrada' ? 'Recebimento de clientes' : 'Fornecedor';
  }
  return tipo === 'entrada' ? 'Recebimento de clientes' : 'Fornecedor';
}

function normalizeCNPJ(s) {
  const m = String(s || '').match(/\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-\/]?\d{4}[\.\-]?\d{2}/);
  return m ? m[0].replace(/\D/g, '') : '';
}

function normalizeCompanyName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(CNPJ|CPF|LTDA|EIRELI|ME|EPP|SA|S A|MATRIZ|FILIAL)\b/gi, ' ')
    .replace(/[^A-Z0-9 ]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function isOwnCompanyTransfer(desc, empresa) {
  const d = String(desc || '');
  const e = String(empresa || '');
  if (!e || !/\b(pix|ted|doc|transf|transfer[êe]ncia|transferencia)\b/i.test(d)) return false;

  // Prioridade 1: CNPJ idêntico no histórico
  const docEmpresa = normalizeCNPJ(e);
  if (docEmpresa && d.replace(/\D/g, '').includes(docEmpresa)) return true;

  // Prioridade 2: nome da empresa no histórico — exige mínimo 3 tokens significativos
  // para evitar falsos positivos com nomes curtos ou comuns
  const nomeEmpresa = normalizeCompanyName(e);
  const nomeDesc = normalizeCompanyName(d);
  if (!nomeEmpresa || nomeEmpresa.length < 12 || !nomeDesc) return false;
  const tokens = nomeEmpresa.split(' ').filter(x => x.length >= 5);
  if (tokens.length < 3) return false; // exige pelo menos 3 palavras longas
  const matches = tokens.filter(t => nomeDesc.includes(t)).length;
  return matches >= Math.min(3, tokens.length);
}

function hasCPF(desc) {
  const d = String(desc || '');
  return /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(d) || /\*{3}\.\d{3}\.\d{3}-\*{2}/.test(d);
}

function hasCNPJ(desc) {
  return /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.test(String(desc || ''));
}

function hasPixTransferContext(desc) {
  return /\b(pix|ted|doc|tbi|transf|transfer[êe]ncia|transferencia)\b|db\.?\s*tr\.?\s*c\.?\s*dif|d[eé]b\.?\s*transf/i.test(String(desc || ''));
}

function isPF(descricao) {
  const d = String(descricao || '').trim();
  if (!d) return null;

  if (hasCNPJ(d)) return false;
  if (/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(d)) return true;
  if (/\*{3}\.\d{3}\.\d{3}-\*{2}/.test(d)) return true;
  if (hasPixTransferContext(d) && /(?:^|\D)\d{11}(?:\D|$)/.test(d)) return true;

  return null;
}

function isPFBlockedContext(desc) {
  return /tarifa|\btar\b|juros|cobran[çc]a|taxa|\biof\b|multa|[oó]rg[aã]os?|\bgov\b|cart[oó]rio|\btel\b|vivo|claro|\btim\b|\boi\b|celular|conta\s*luz|energia|[aá]gua|agua|esgoto|saneamento|\bdarf\b|simples|tributo/i.test(String(desc || ''));
}

function hasExplicitPFTransferContext(desc) {
  const d = String(desc || '');
  return /pix\s+enviado\s+\S+/i.test(d) ||
    /pix\s+transf\s+\S+/i.test(d) ||
    /pix\s+emit(?:ido|\.?out(?:ra)?\s+if)?\s+\S+/i.test(d) ||
    /db\.?\s*tr\.?\s*c\.?\s*dif.*fav\.?\s*:\s*\S+/i.test(d) ||
    /transfer[êe]ncia\s+enviada\s+\S+/i.test(d);
}

function canOverrideWithPixPF(cat) {
  return !cat || ['Outros','PIX enviado','TED enviada','Transf. enviada','Fornecedor','Fornecedores','Transferência bancária'].includes(cat);
}

function isPessoaFisicaTransfer(desc, tipo, cat) {
  if (tipo !== 'saida') return false;
  if (!canOverrideWithPixPF(cat)) return false;
  if (isPFBlockedContext(desc)) return false;
  if (!hasExplicitPFTransferContext(desc)) return false;
  return isPF(desc) === true;
}

function isProtectedPessoaFisicaCategory(cat, desc) {
  const d = String(desc || '');
  if (cat && !['Outros','PIX enviado','TED enviada','Transf. enviada','Fornecedor'].includes(cat)) return true;
  return /pix[.\s]*emit[.\s]*out(?:ra)?\s+if|pix[.\s]*emit[.\s]*out\s+if\s*-?\s*msm\s*d|marketplace|cef\s+matriz|sercol|\bmark\b|sispag\s+fornecedores|mobile\s+int\d*|mobile\s+pag\s+tit|cel\s+pag\s+tit|d[eé]b\.?\s*tit|d[eé]b\.?\s*conv|pagamento\s+de\s+boleto|pagto\s+boleto|boleto|tarifa|\btar\b|\biof\b|pronampe|empr[eé]stimo|emprestimo|juros\s+limite\s+da\s+conta|tributos?|imposto|secretaria\s+da\s+fazenda|sefaz|db\s*conv\s*multas?\s*tran/i.test(d);
}

function refreshTxnCategory(txn) {
  const baseDesc = txn.descFull || txn.desc || txn.complemento || '';
  let cat = categorize(baseDesc, txn.tipo);
  const fullDesc = `${txn.descFull || ''} ${txn.desc || ''} ${txn.complemento || ''}`;
  if (isOwnCompanyTransfer(fullDesc, txn.empresa)) {
    cat = 'Transferência mesma empresa';
  } else if (isPessoaFisicaTransfer(baseDesc, txn.tipo, cat)) {
    cat = 'PIX para PF';
  }
  if (txn.tipo === 'saida' && ['PIX enviado','TED enviada','Transf. enviada','Transferência bancária','Outros'].includes(cat)) {
    cat = 'Fornecedor';
  }
  const bL = txn.bancoInfo || txn.banco || (txn.source || '').replace(/\.[^.]+$/, '');
  txn.cat = cat;
  txn.codDebito = txn.tipo === 'saida' ? cat : bL;
  txn.codCredito = txn.tipo === 'saida' ? bL : cat;
  return txn;
}

function extractNome(desc) {
  if (!desc) return { nome: null, cnpj: null };
  const pr = /Recebimento Pix\s+(.+?)(?:\s+\*\*\*|$)/i.exec(desc);
  if (pr) return { nome: pr[1].trim(), cnpj: null };
  const pp = /Pagamento Pix\s+(.+?)(?:\s+\*\*\*|$)/i.exec(desc);
  if (pp) return { nome: pp[1].trim(), cnpj: null };
  const cm = desc.match(/(\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-\/]?\d{4}[\.\-]?\d{2})/);
  const cnpj = cm ? cm[1] : null;
  let nome = cnpj ? desc.substring(0, desc.indexOf(cm[0])).trim() : desc.trim();
  if (cnpj) {
    const before = desc.substring(0, desc.indexOf(cm[0])).trim();
    const after = desc.substring(desc.indexOf(cm[0]) + cm[0].length).trim();
    if (/^(?:\d+\s*){1,4}$/.test(before) && after.length >= 3) nome = after;
  }
  nome = nome.replace(/\s+/g, ' ').replace(/[\-,]$/, '').trim();
  return { nome: nome.length >= 3 ? nome : null, cnpj };
}

function detectMeio(d) {
  if (/\bpix\b/i.test(d)) return 'PIX';
  if (/\bted\b/i.test(d)) return 'TED';
  if (/\bdoc\b/i.test(d)) return 'DOC';
  if (/transf/i.test(d)) return 'Transf.';
  return null;
}

function sanitizeHistoryText(s, limit = 240) {
  return String(s || '')
    .replace(/[\r\n\t;|*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, limit);
}

function extractStatementCompany(text, fname = '') {
  const s = fixEnc(String(text || '')).replace(/\s+/g, ' ').trim();
  const cnpjPat = /\d{2}[\.\-]?\d{3}[\.\-]?\d{3}[\.\-\/]?\d{4}[\.\-]?\d{2}/;
  const cnpj = s.match(cnpjPat)?.[0] || '';
  let nome = '';
  const cloudWalkCompany = s.match(/Relat.rio de movimenta..es\s+(.+?)\s*-\s*CNPJ/i);
  if (cloudWalkCompany) nome = cloudWalkCompany[1];
  const cnpjLabel = s.match(new RegExp('([A-ZÁÃ‰ÍÃ“ÃšÃƒÃ•Ã‚ÃŠÃ”Ã‡0-9 .,&/-]{5,90})\\s+CNPJ\\s*' + cnpjPat.source, 'i'));
  if (!nome && cnpjLabel) nome = cnpjLabel[1];
  if (!nome && cnpj) {
    const idx = s.indexOf(cnpj);
    nome = s.substring(Math.max(0, idx - 90), idx)
      .replace(/.*(?:cliente|nome|empresa|raz[aã]o social)[: ]/i, '')
      .trim();
  }
  if (!nome) {
    const m = s.match(/(?:nome|cliente|empresa|raz[aã]o social)[: ]+([A-ZÁÃ‰ÍÃ“ÃšÃƒÃ•Ã‚ÃŠÃ”Ã‡0-9 .,&/-]{5,90})(?=\s+(?:ag[eê]ncia|conta|cnpj|cpf|data|extrato)|$)/i);
    if (m) nome = m[1];
  }
  nome = sanitizeHistoryText(nome, 80)
    .replace(/\b(Ag[eê]ncia|Conta|Extrato|Banco|CNPJ|CPF)\b.*$/i, '')
    .trim();
  if (/^(documento|hist[oó]rico|valor|saldo|lan[çc]amentos?|extrato|ag[eê]ncia|conta)\b/i.test(nome)) nome = '';
  if (!nome && cnpj) nome = `CNPJ ${cnpj}`;
  return nome || '';
}

function fmtBRL(v) { return (+v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function mkMk(dd, mm, yyyy) {
  const label = new Date(+yyyy, +mm - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  return { date: `${dd}/${mm}/${yyyy}`, monthKey: `${yyyy}-${mm}`, monthLabel: label, dateSerial: new Date(+yyyy, +mm - 1, +dd) };
}

function makeTxn(date, monthKey, monthLabel, dateSerial, desc, tipo, value, bancoNome, bancoInfo, fname) {
  const cat = categorize(desc, tipo);
  const { nome, cnpj } = extractNome(desc);
  const catL = cat, bL = bancoInfo || bancoNome || fname.replace(/\.[^.]+$/, '');
  const cleanDesc = sanitizeHistoryText(desc, 240);
  return refreshTxnCategory({
    date, monthKey, monthLabel, dateSerial, desc: cleanDesc, descFull: cleanDesc, nome, cnpj,
    meio: detectMeio(desc), value: Math.round(value * 100) / 100, tipo, cat,
    codDebito: tipo === 'saida' ? catL : bL,
    codCredito: tipo === 'saida' ? bL : catL,
    complemento: sanitizeHistoryText(desc || nome || '', 120),
    banco: bancoNome, bancoInfo, source: fname
  });
}

function makeTxnWithComplement(date, monthKey, monthLabel, dateSerial, desc, complemento, tipo, value, bancoNome, bancoInfo, fname) {
  const txn = makeTxn(date, monthKey, monthLabel, dateSerial, desc, tipo, value, bancoNome, bancoInfo, fname);
  txn.complemento = sanitizeHistoryText(complemento || desc || txn.complemento, 120);
  txn.descFull = sanitizeHistoryText(complemento || desc || txn.descFull, 240);
  return txn;
}

function dedupeTxns(txns) {
  const seen = new Set();
  return txns.filter(t => {
    if (t.banco === 'Banco do Brasil') return true;
    if (t.banco === 'Itaú') return true;
    if (t.banco === 'Sicoob') return true;
    if (t.banco === 'Santander') return true;
    const descKey = String(t.desc || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const key = [t.date, t.tipo, t.value.toFixed(2), t.bancoInfo || t.banco, descKey].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── PARSER SICOOB PDF (coordenadas X/Y via PDF.js) ────────────────────────────
// Layout do Sicoob:
//   x~37  = Data (dd/mm)
//   x~68  = Documento
//   x~137-150 = Histórico (linha principal quando tem data)
//   x~137 = Detalhe (linha de continuação sem data — mesmo X, Y diferente)
//   x~493-536 = "R$" e valor com D ou C
// Uma transação ocupa 1 ou 2 linhas de Y:
//   Linha 1: Data | Documento | Histórico resumido | (valor às vezes aqui)
//   Linha 2: (sem data) | detalhe do histórico   | (valor pode estar aqui)
function extractSicoobDateText(items, rowText) {
  const leftText = items
    .filter(t => t.x < 50)
    .sort((a, b) => a.x - b.x)
    .map(t => t.text)
    .join('')
    .replace(/\s+/g, '');
  const mLeft = leftText.match(/^(\d{2})\/(\d{2})/);
  if (mLeft) return `${mLeft[1]}/${mLeft[2]}`;

  const compact = String(rowText || '').replace(/\s+/g, '');
  const mRow = compact.match(/^(\d{2})\/(\d{2})/);
  return mRow ? `${mRow[1]}/${mRow[2]}` : null;
}

function isSicoobSaldoOuResumoLine(text) {
  let n = normBuscaLayout(text);
  n = n
    .replace(/^\d{2}\s+\d{2}(?=saldo)/, '')
    .replace(/^\d{2}\s+\d{2}\s+/, '')
    .trim();
  return /^(saldo anterior|saldo bloq anterior|saldo bloqueado|saldo do dia|saldo em conta|saldo disponivel|cheque especial contratado|juros vencidos|tarifas vencidas|encargos vencidos|encargos a vencer|outras informacoes|custo efetivo total|vencimento cheque|taxa cheque|sac|ouvidoria)/i.test(n);
}
async function parseSicoobPDFCoords(pdfDoc, fname) {
  // Coleta metadados do cabeçalho (ano, banco, conta)
  let ano = (fname.match(/20\d{2}/) || [String(new Date().getFullYear())])[0];
  let bancoNome = 'Sicoob', bancoInfo = 'Sicoob';

  // Pega o texto da primeira página para extrair cabeçalho
  const page1 = await pdfDoc.getPage(1);
  const tc1 = await page1.getTextContent();
  const fullText1 = tc1.items.map(i => i.str).join(' ');
  const mAno = fullText1.match(/(?:Periodo|Período):.*?(\d{4})|(\d{2})\/(\d{2})\/(20\d{2})\s*-\s*\d{2}\/\d{2}\/(20\d{2})/i);
  if (mAno) ano = mAno[1] || mAno[5] || mAno[4] || ano;
  const mCoop = fullText1.match(/Cooperativa:.*?\/\s*([^C]+?)(?=Conta:|$)/);
  if (mCoop) bancoInfo = 'Sicoob - ' + mCoop[1].trim().substring(0, 35);
  const mConta = fullText1.match(/Conta:\s*([\d\.\-]+)/);
  if (mConta) bancoInfo += ` Cc.${mConta[1]}`;

  const txns = [];
  const SKIP_TEXT = /^(SALDO ANTERIOR|SALDO BLOQ|SALDO BLOQUEADO|SALDO DO DIA|SALDO EM CONTA|SALDO DISPON|Data|Documento|Histórico|Valor|HISTÓRICO|RESUMO|ENCARGOS|OUTRAS|Sicoob|SISTEMA|PLATAFORMA|EXTRATO|Cooperativa|Conta:|Periodo:|Saldo |Cheque especial|Tarifas |SAC:|Taxa |Custo |Vencimento |Previsão |https?:|INFORMAÇ)/i;

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const tc = await page.getTextContent();

    // Agrupa items por linha Y (tolerância de 3pt)
    const rows = [];
    for (const item of tc.items) {
      if (!item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5]; // Y cresce de baixo pra cima no PDF.js
      // Encontra linha existente com Y próximo
      let row = rows.find(r => Math.abs(r.y - y) < 3);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push({ x, text: item.str.trim() });
    }

    // Ordena linhas de cima para baixo (Y decrescente no sistema PDF.js)
    rows.sort((a, b) => b.y - a.y);

    // Processa cada linha
    // Uma linha de transação Sicoob tem:
    //   - item com x < 60 e texto dd/mm  → é data
    //   - items com x > 130 e x < 490   → é histórico
    //   - item com x > 490 e texto contendo D ou C → é valor
    // Uma linha de detalhe NÃO tem data (x~37) nem valor (x>490)

    // Primeiro passa: identifica quais linhas são transações e quais são detalhes
    const structured = rows.map(row => {
      const texts = row.items.slice().sort((a, b) => a.x - b.x);
      const rowText = texts.map(t => t.text).join('').replace(/\s+/g, ' ').trim();
      const dateText = extractSicoobDateText(texts, rowText);
      const valInfo = extractPDFMoneyText(texts.filter(t => t.x > 430)) ||
        extractPDFMoneyText([{ x: 0, text: rowText }]);
      const histItems = texts.filter(t => t.x >= 130 && t.x < 430);
      let hist = histItems.map(t => t.text).join(' ').trim();
      if (!hist && rowText) {
        hist = rowText
          .replace(/^(\d{2}\/\d{2})/, '')
          .replace(valInfo?.text || '', '')
          .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}[DC*]?/i, '')
          .replace(/R\$\s*\d+,\d{2}[DC*]?/i, '')
          .trim();
      }

      return { y: row.y, date: dateText, val: valInfo?.text || null, valInfo, hist, raw: rowText, isSkip: SKIP_TEXT.test(hist) || isSicoobSaldoOuResumoLine(hist) || isSicoobSaldoOuResumoLine(rowText) };
    });

    // Segunda passa: monta transações
    // O valor pode estar na linha da data OU na linha anterior (acima) quando o histórico ocupa 2 linhas
    // Estratégia: percorre linhas; quando acha data, coleta histórico e busca valor
    for (let i = 0; i < structured.length; i++) {
      const row = structured[i];
      if (!row.date || row.isSkip) continue;
      if (SKIP_TEXT.test(row.hist) || isSicoobSaldoOuResumoLine(row.hist) || isSicoobSaldoOuResumoLine(row.raw)) continue;

      const [dd, mm] = row.date.split('/');
      let hist = row.hist;
      let valStr = row.val;

      // Em alguns PDFs Sicoob, o valor fica poucos pontos acima da linha da data.
      if (!valStr && i > 0) {
        const prev = structured[i - 1];
        if (!prev.date && prev.val && Math.abs(prev.y - row.y) <= 8) {
          valStr = prev.val;
        }
      }

      // Se não tem valor nessa linha, verifica próxima linha (detalhe + valor juntos no Sicoob)
      // O Sicoob às vezes coloca o valor na mesma Y que o detalhe, não na da data
      if (!valStr && i + 1 < structured.length) {
        const next = structured[i + 1];
        if (!next.date && next.val) {
          // Linha de detalhe com o valor
          if (next.hist) hist = (hist + ' ' + next.hist).trim();
          valStr = next.val;
          i++; // pula a linha de detalhe
        }
      }

      // Pega linha de detalhe adicional (sem valor, sem data)
      if (i + 1 < structured.length) {
        const next = structured[i + 1];
        if (!next.date && !next.val && next.hist && !next.isSkip) {
          hist = (hist + ' ' + next.hist).trim();
          i++;
        }
      }

      if (!valStr) continue;
      if (/\*$/.test(String(valStr).trim()) && !/[DC]$/i.test(String(valStr).trim())) continue;

      const defaultTipo = inferSicoobTipo(hist);
      const parsedVal = extractPDFMoneyText([{ x: 0, text: valStr }], { defaultTipo });
      if (!parsedVal) continue;

      const val = parsedVal.value;
      const tipo = parsedVal.tipo || defaultTipo;

      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, ano);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, hist, tipo, val, bancoNome, bancoInfo, fname));
    }
  }

  return txns;
}

function inferSicoobTipo(hist) {
  const h = String(hist || '');
  if (/PIX\s*REC|REC\.OUTRA|RECEB|CR[ÉE]D|RESGATE|\bDEP\.?|DEPOS|LIQ\.COBRAN[ÇC]A/i.test(h)) return 'entrada';
  if (/PIX\s*EMIT|EMIT\.OUT|D[ÉE]B|TARIFA|JUROS|IOF|EMPR[ÉE]STIMO|CONV|PAGAMENTO/i.test(h)) return 'saida';
  return 'saida';
}

// ── PARSER OFX ────────────────────────────────────────────────────────────────
function pdfMoneyToNumber(s) {
  if (!s) return NaN;
  let raw = String(s).replace(/\s+/g, '').replace(/R\$/gi, '');
  const neg = raw.includes('-') || /^\(.*\)$/.test(raw);
  raw = raw.replace(/[()\-]/g, '');
  if (!raw) return NaN;
  if (raw.includes(',')) raw = raw.replace(/\./g, '').replace(',', '.');
  else raw = raw.replace(/,/g, '');
  const n = parseFloat(raw);
  return isNaN(n) ? NaN : (neg ? -Math.abs(n) : n);
}

function extractPDFMoneyText(items, opts = {}) {
  const text = items
    .slice()
    .sort((a, b) => a.x - b.x)
    .map(i => i.text)
    .join('')
    .replace(/\s+/g, '');
  const m = text.match(/-?(?:R\$)?-?\d{1,3}(?:\.\d{3})*,\d{2}(?:[DC]|\([+-]\)|[+-]|\*)?|-?(?:R\$)?-?\d+,\d{2}(?:[DC]|\([+-]\)|[+-]|\*)?/);
  if (!m) return null;
  const valueText = m[0];
  const signal = /D|\(-\)|^-|-$/.test(valueText) ? 'saida'
    : /C|\(\+\)|\+$/.test(valueText) ? 'entrada'
    : opts.defaultTipo || null;
  return { text: valueText, tipo: signal, value: Math.abs(pdfMoneyToNumber(valueText)) };
}

async function collectPDFWords(pdfDoc, pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const tc = await page.getTextContent();
  return tc.items
    .filter(item => item.str && item.str.trim())
    .map(item => ({ x: item.transform[4], y: item.transform[5], text: item.str.trim() }));
}

function textFromWords(words) {
  return words
    .slice()
    .sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x)
    .map(w => w.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function parseUnicredPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'Unicred';

  const page1Words = await collectPDFWords(pdfDoc, 1);
  const fullText1 = page1Words.map(w => w.text).join(' ');
  const mConta = fullText1.match(/Coop:\s*([\d-]+).*?AG:\s*([\d-]+).*?Conta:\s*([\d.-]+)/i);
  if (mConta) bancoInfo = `Unicred Coop.${mConta[1]} Ag.${mConta[2]} Cc.${mConta[3]}`;

  const DATE_PAT = /^\d{2}\/\d{2}\/\d{4}$/;
  const VAL_PAT = /^(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
  const SKIP = /^(SALDO|DATA|DESCRI|HIST|VALOR|EXTRATO|CONTA|AG:|COOP:|TOTAL|LANCAMENTOS|LANÇAMENTOS)$/i;

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);
    const anchors = [];

    for (const w of words.slice().sort((a, b) => b.y - a.y || a.x - b.x)) {
      if (!DATE_PAT.test(w.text) || w.x >= 35) continue;
      const valInfo = extractPDFMoneyText(words.filter(v =>
        Math.abs(v.y - w.y) < 2 &&
        v.x > 360 && v.x < 480
      ));
      if (!valInfo) continue;
      const isNeg = words.some(v => v.text === '-' && v.x > 370 && v.x < 395 && Math.abs(v.y - w.y) < 2);
      anchors.push({ y: w.y, date: w.text, val: valInfo.text, neg: isNeg || valInfo.tipo === 'saida' });
    }

    anchors.sort((a, b) => b.y - a.y);

    for (let i = 0; i < anchors.length; i++) {
      const anc = anchors[i];
      const nextY = anchors[i + 1]?.y ?? (anc.y - 100);
      const lowerY = Math.max(anc.y - 15, nextY + 5);
      const upperY = anc.y + 15;
      const histWords = words.filter(w =>
        w.x >= 80 && w.x < 380 &&
        w.y >= lowerY && w.y <= upperY &&
        !SKIP.test(w.text)
      );
      let hist = textFromWords(histWords)
        .replace(/\s*\(\s*Doc\.:\s*\S+\s*\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!hist) hist = 'Lançamento Unicred';

      let rawVal = pdfMoneyToNumber(anc.val);
      if (anc.neg) rawVal = -Math.abs(rawVal);
      if (!isFinite(rawVal) || rawVal === 0) continue;

      const [dd, mm, yyyy] = anc.date.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      const tipo = rawVal < 0 ? 'saida' : 'entrada';
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, fixEnc(hist), tipo, Math.abs(rawVal), 'Unicred', bancoInfo, fname));
    }
  }

  return txns;
}

async function parseItauPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'Itaú';

  const page1Words = await collectPDFWords(pdfDoc, 1);
  const fullText1 = page1Words.map(w => w.text).join(' ');
  const mConta = fullText1.match(/Ag[eê]ncia\s+(\d+).*?Conta\s+([\d.-]+)/i);
  if (mConta) bancoInfo = `Itaú Ag.${mConta[1]} Cc.${mConta[2]}`;

  const DATE_PAT = /^\d{2}\/\d{2}\/\d{4}$/;
  const SKIP = /^(SALDO|DATA|LANCAMENTOS|LANÇAMENTOS|RAZAO|RAZÃO|CNPJ|CPF|VALOR|AGENCIA|AGÊNCIA|CONTA)$/i;
  const IGNORE = /saldo (do dia|total dispon[ií]vel)|saldo total|saldo anterior|lan[çc]amentos do per[ií]odo|saldo total limite/i;

  let currentDate = null;
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);
    const rows = [];
    for (const item of words) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 3);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.sort((a, b) => b.y - a.y || Math.min(...a.items.map(i => i.x)) - Math.min(...b.items.map(i => i.x)));

    // Itaú layout em colunas: alguns rendimentos AUT MAIS aparecem como
    // linha anterior "AUT MAIS", linha com data+valor, linha seguinte "RENDIMENTOS...".
    for (const row of rows) {
      const rowItems = row.items.slice().sort((a, b) => a.x - b.x);
      const dateItem = rowItems.find(i => i.x < 90 && DATE_PAT.test(i.text));
      if (!dateItem) continue;
      const valInfo = extractPDFMoneyText(rowItems.filter(i => i.x >= 450 && i.x < 535), { defaultTipo: 'entrada' });
      if (!valInfo || valInfo.tipo === 'saida') continue;
      const ownHist = cleanItauHistory(textFromWords(rowItems.filter(i => i.x >= 88 && i.x < 450 && !DATE_PAT.test(i.text))));
      if (ownHist) continue;
      const nearText = rows
        .filter(r => r !== row && Math.abs(r.y - row.y) <= 7)
        .map(r => textFromWords(r.items.filter(i => i.x >= 80 && i.x < 380)))
        .join(' ');
      if (!/aut mais/i.test(nearText) || !/rendimentos?\s+rend pago aplic/i.test(nearText)) continue;

      const [dd, mm, yyyy] = dateItem.text.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      const exists = txns.some(t =>
        t.banco === 'Itaú' &&
        t.date === date &&
        Math.abs(t.value - valInfo.value) < 0.001 &&
        /rendimentos.*aut mais|aut mais.*rendimentos/i.test(t.descFull || t.desc || '')
      );
      if (!exists) {
        const hist = 'RENDIMENTOS REND PAGO APLIC AUT MAIS';
        txns.push(makeTxnWithComplement(date, monthKey, monthLabel, dateSerial, hist, hist, 'entrada', valInfo.value, 'Itaú', bancoInfo, fname));
      }
    }

    for (const row of rows) {
      const rowItems = row.items.slice().sort((a, b) => a.x - b.x);
      const rowText = rowItems.map(i => i.text).join('').replace(/\s+/g, ' ').trim();
      const dateItem = rowItems.find(i => i.x < 90 && DATE_PAT.test(i.text));

      if (DATE_PAT.test(rowText)) {
        currentDate = rowText;
        continue;
      }

      const inlineValue = dateItem
        ? (extractPDFMoneyText(rowItems.filter(i => i.x >= 450), { defaultTipo: 'entrada' }) ||
           extractPDFMoneyText([{ x: 0, text: rowText }], { defaultTipo: 'entrada' }))
        : null;
      if (dateItem && inlineValue) {
        const lancamento = textFromWords(rowItems.filter(i =>
          i.x >= 88 && i.x < 225 &&
          !DATE_PAT.test(i.text) &&
          !SKIP.test(i.text)
        ));
        const razao = textFromWords(rowItems.filter(i => i.x >= 225 && i.x < 365 && !SKIP.test(i.text)));
        const doc = textFromWords(rowItems.filter(i => i.x >= 365 && i.x < 455 && !SKIP.test(i.text)));
        let hist = textFromWords(rowItems.filter(i =>
          i.x >= 88 && i.x < 450 &&
          !DATE_PAT.test(i.text) &&
          !SKIP.test(i.text)
        ));
        if (!hist) hist = rowText.replace(dateItem.text, '').replace(inlineValue.text, '');
        if (!cleanItauHistory(hist)) {
          const nearRows = rows
            .filter(r => r !== row && Math.abs(r.y - row.y) <= 9)
            .sort((a, b) => a.y - b.y);
          const nearHist = nearRows.map(r => textFromWords(r.items.filter(i =>
            i.x >= 88 && i.x < 365 &&
            !DATE_PAT.test(i.text) &&
            !extractPDFMoneyText([i]) &&
            !SKIP.test(i.text) &&
            !/saldo|data|valor|cnpj|cpf/i.test(i.text)
          ))).filter(Boolean).join(' ');
          if (nearHist) hist = nearHist;
        }
        const complemento = cleanItauHistory([lancamento, razao, doc].filter(Boolean).join(' - ') || hist);
        hist = cleanItauHistory(hist);
        if (/aut mais/i.test(hist) && /rend/i.test(hist) && !/^rend/i.test(hist)) {
          hist = 'RENDIMENTOS REND PAGO APLIC AUT MAIS';
        }
        if (!hist || IGNORE.test(hist)) continue;

        const rawVal = inlineValue.tipo === 'saida' ? -inlineValue.value : inlineValue.value;
        if (!isFinite(rawVal) || rawVal === 0) continue;

        const [dd, mm, yyyy] = dateItem.text.split('/');
        const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
        const tipo = rawVal < 0 ? 'saida' : 'entrada';
        if (/rendimentos.*aut mais|aut mais.*rendimentos/i.test(hist)) {
          const exists = txns.some(t =>
            t.banco === 'Itaú' &&
            t.date === date &&
            Math.abs(t.value - Math.abs(rawVal)) < 0.001 &&
            /rendimentos.*aut mais|aut mais.*rendimentos/i.test(t.descFull || t.desc || '')
          );
          if (exists) continue;
        }
        txns.push(makeTxnWithComplement(date, monthKey, monthLabel, dateSerial, fixEnc(hist), fixEnc(complemento), tipo, Math.abs(rawVal), 'Itaú', bancoInfo, fname));
        continue;
      }

      if (!currentDate) continue;
      const valInfo = extractPDFMoneyText(rowItems.filter(i => i.x >= 500), { defaultTipo: 'entrada' }) ||
        extractPDFMoneyText([{ x: 0, text: rowText }], { defaultTipo: 'entrada' });
      if (!valInfo) continue;

      let hist = textFromWords(rowItems.filter(i =>
        i.x >= 88 && i.x < 500 &&
        !extractPDFMoneyText([i]) &&
        !DATE_PAT.test(i.text) &&
        !SKIP.test(i.text)
      ));
      if (!hist) hist = rowText.replace(valInfo.text, '');
      hist = cleanItauHistory(hist);
      if (!hist || IGNORE.test(hist)) continue;

      const rawVal = valInfo.tipo === 'saida' ? -valInfo.value : valInfo.value;
      if (!isFinite(rawVal) || rawVal === 0) continue;

      const [dd, mm, yyyy] = currentDate.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      const tipo = rawVal < 0 ? 'saida' : 'entrada';
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, fixEnc(hist), tipo, Math.abs(rawVal), 'Itaú', bancoInfo, fname));
    }

    // Itaú: algumas linhas de rendimento AUT MAIS vêm como data+valor,
    // com "AUT MAIS" acima e "RENDIMENTOS REND PAGO APLIC" abaixo.
    for (const row of rows) {
      const rowItems = row.items.slice().sort((a, b) => a.x - b.x);
      const dateItem = rowItems.find(i => i.x < 90 && DATE_PAT.test(i.text));
      if (!dateItem) continue;
      const valInfo = extractPDFMoneyText(rowItems.filter(i => i.x >= 450), { defaultTipo: 'entrada' });
      if (!valInfo || valInfo.tipo === 'saida') continue;
      const ownHist = textFromWords(rowItems.filter(i => i.x >= 88 && i.x < 450 && !DATE_PAT.test(i.text)));
      if (cleanItauHistory(ownHist)) continue;
      const nearText = rows
        .filter(r => r !== row && Math.abs(r.y - row.y) <= 9)
        .map(r => textFromWords(r.items.filter(i => i.x >= 88 && i.x < 365)))
        .join(' ');
      if (!/aut mais/i.test(nearText) || !/rendimentos/i.test(nearText)) continue;

      const [dd, mm, yyyy] = dateItem.text.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      const exists = txns.some(t =>
        t.banco === 'Itaú' &&
        t.date === date &&
        Math.abs(t.value - valInfo.value) < 0.001 &&
        /rendimentos.*aut mais|aut mais.*rendimentos/i.test(t.descFull || t.desc || '')
      );
      if (!exists) {
        const hist = 'RENDIMENTOS REND PAGO APLIC AUT MAIS';
        txns.push(makeTxnWithComplement(date, monthKey, monthLabel, dateSerial, hist, hist, 'entrada', valInfo.value, 'Itaú', bancoInfo, fname));
      }
    }
  }

  return txns;
}

function normBuscaLayout(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isItauMensalAplicacoesSection(text) {
  const n = normBuscaLayout(text);
  return /totalizador de aplicacoes automaticas|conta corrente aplicacoes automaticas|conta corrente aplicacoes|aplicacoes automaticas|aplic aut mais cdb|resumo mes|movimentacao aplicacoes|aplicacoes resgates|valor principal resgat|rendimento bruto|iof|irrf|saldo de principal aplicado/.test(n);
}

function extractItauMensalContaTotals(words) {
  const all = (words || [])
    .slice()
    .sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
  const marker = all.find(w => /na conta corrente/i.test(w.text));
  if (!marker) return null;
  const lineWords = all.filter(w => Math.abs(w.y - marker.y) < 16);
  const values = lineWords
    .filter(w => w.x > marker.x && /-?\d{1,3}(?:\.\d{3})*,\d{2}-?|-?\d+,\d{2}-?/.test(w.text))
    .sort((a, b) => a.x - b.x)
    .map(w => Math.abs(pdfMoneyToNumber(w.text)));
  if (values.length >= 2) return { entrada: values[0], saida: values[1] };
  return null;
}

async function parseItauMensalPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'Itaú';
  // Tenta pegar ano do nome do arquivo; se não achar, extrai do conteúdo da pág 1
  let year = (fname.match(/20\d{2}/) || [''])[0];
  const DATE_MMDD = /^\d{2}\/\d{2}$/;
  const IGNORE = /saldo anterior|saldo aplic aut mais|saldo\s+r\$|conta corrente|bolsa de valores|este material|minha conta|minha ag[eê]ncia|^apl aplic aut mais|^res aplic aut mais|saldo em c\/c|saldo final/i;

  const pageWords = [];
  let contaTotals = null;
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);
    pageWords.push({ p, words });
    if (!contaTotals) contaTotals = extractItauMensalContaTotals(words);
    if (p === 1) {
      const firstText = words.map(w => w.text).join(' ');
      const mConta = firstText.match(/ag[eê]ncia\s*[:\-]?\s*(\d+).*?conta\s*[:\-]?\s*([\d.-]+)/i);
      if (mConta) bancoInfo = `Itaú Ag.${mConta[1]} Cc.${mConta[2]}`;
      // Extrai ano do conteúdo se não veio do nome do arquivo
      if (!year) {
        const mAno = firstText.match(/\b(20\d{2})\b/);
        if (mAno) year = mAno[1];
        // Tenta também pelo padrão "saldo em DD/MM/AA" → pega o século
        const mSaldo = firstText.match(/saldo\s+em\s+\d{2}\/\d{2}\/(\d{2})/i);
        if (!year && mSaldo) year = '20' + mSaldo[1];
      }
      if (!year) year = String(new Date().getFullYear());

      // Captura saldo inicial e final direto do cabeçalho da pág 1
      // Layout: "saldo em 31/05/22" (x≈411) e "saldo em 30/06/22" (x≈491) na Y≈510
      //         "R$ 117.903,35" (x≈421) e "R$ 126.247,26" (x≈501) na Y≈500
      const saldoLabels = words.filter(w => /^saldo\s+em\s+\d{2}\/\d{2}\/\d{2}$/i.test(w.text));
      if (saldoLabels.length >= 2) {
        saldoLabels.sort((a, b) => a.x - b.x); // esquerda = anterior, direita = final
        // Valores ficam ~10px abaixo dos labels — busca com tolerância de 20px em Y
        const valWords = words.filter(w => /R\$/.test(w.text) &&
          Math.abs(w.y - saldoLabels[0].y) < 20);
        const getValNear = (labelX) => {
          if (!valWords.length) return null;
          const near = valWords.slice().sort((a,b) => Math.abs(a.x-labelX)-Math.abs(b.x-labelX))[0];
          return pdfMoneyToNumber(near.text.replace('R$','').replace(/\s/g,''));
        };
        const vInicial = getValNear(saldoLabels[0].x);
        const vFinal   = getValNear(saldoLabels[1].x);
        txns.validationPoints = txns.validationPoints || [];
        if (vInicial && isFinite(vInicial)) txns.validationPoints.push({ kind:'inicial', value:vInicial, text:'Saldo anterior ' + vInicial, date:'' });
        if (vFinal   && isFinite(vFinal))   txns.validationPoints.push({ kind:'final',   value:vFinal,   text:'Saldo final '   + vFinal,   date:'' });
      }
    } // fim if (p === 1)
  }

  let currentDate = null;
  let inContaCorrente = false;
  let stopFile = false;
  for (const { p, words } of pageWords) {
    if (stopFile) break;
    if (inContaCorrente && isItauMensalAplicacoesSection(words.map(w => w.text).join(' '))) {
      break;
    }
    const rows = [];
    for (const item of words) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 3);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.sort((a, b) => b.y - a.y);

    for (const row of rows) {
      const items = row.items.slice().sort((a, b) => a.x - b.x);
      const rowText = pdfLineText(items);
      if (inContaCorrente && /saldo\s+final/i.test(rowText)) {
        inContaCorrente = false;
        currentDate = null;
        stopFile = true;
        break;
      }
      if (inContaCorrente && isItauMensalAplicacoesSection(rowText)) {
        inContaCorrente = false;
        currentDate = null;
        stopFile = true;
        break;
      }
      const rowNorm = normBuscaLayout(rowText);
      if ((rowNorm === 'conta corrente' || /^conta corrente movimentacao\b/.test(rowNorm)) && row.y < 350) {
        inContaCorrente = true;
        currentDate = null;
        continue;
      }
      if (!inContaCorrente) continue;
      if (!rowText || IGNORE.test(rowText)) {
        const dateOnly = items.find(i => i.x >= 135 && i.x < 175 && DATE_MMDD.test(i.text));
        if (dateOnly) currentDate = `${dateOnly.text}/${year}`;
        continue;
      }

      const dateItem = items.find(i => i.x >= 135 && i.x < 175 && DATE_MMDD.test(i.text));
      if (dateItem) currentDate = `${dateItem.text}/${year}`;
      if (!currentDate) continue;

      const valueInfo = extractPDFMoneyText(items.filter(i => i.x >= 350 && i.x < 470), { defaultTipo: 'entrada' });
      if (!valueInfo || !isFinite(valueInfo.value) || valueInfo.value === 0) continue;

      let hist = pdfLineText(items.filter(i =>
        i.x >= 190 && i.x < 350 &&
        !DATE_MMDD.test(i.text) &&
        !extractPDFMoneyText([i])
      ));
      hist = cleanItauHistory(hist);
      if (!hist) hist = valueInfo.tipo === 'saida' ? 'Lançamento Itaú - saída' : 'Lançamento Itaú - entrada';
      if (IGNORE.test(hist)) continue;

      const [dd, mm, yyyy] = currentDate.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      const tipo = valueInfo.tipo === 'saida' ? 'saida' : 'entrada';
      const complemento = cleanItauHistory(rowText.replace(valueInfo.text, '')) || hist;
      txns.push(makeTxnWithComplement(date, monthKey, monthLabel, dateSerial, hist, complemento, tipo, valueInfo.value, 'Itaú', bancoInfo, fname));
    }
  }

  return txns;
}

function cleanItauHistory(hist) {
  return String(hist || '')
    .replace(/-?\s*R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi, '')
    .replace(/-?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*$/gi, '')
    .replace(/REDECARD\s+INSTITUICAO\s+DE\s*/gi, '')
    .replace(/\bPAGAMENTO\s+S\.A\.\b/gi, '')
    .replace(/\bCD\d+\b/gi, '')
    .replace(/\s*\d{2}\/\d{2}\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfLineText(items) {
  const sorted = items.slice().sort((a, b) => a.x - b.x);
  let out = '';
  let lastX = null;
  for (const item of sorted) {
    const text = String(item.text || '');
    if (lastX != null && item.x - lastX > 12) out += ' ';
    out += text;
    lastX = item.x + Math.max(4, text.length * 7);
  }
  return out.replace(/\s+/g, ' ').trim();
}

function bytesToLatin1(bytes) {
  return Array.from(bytes, b => String.fromCharCode(b)).join('');
}

function stringToBytes(str) {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 255;
  return out;
}

async function inflatePdfBytes(bytes) {
  if (window.pako?.inflate) return window.pako.inflate(bytes);
  try {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
  } catch (err) {
    console.warn('[PDF] DecompressionStream falhou, tentando Pako', err);
  }
  await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js', 'pako');
  if (window.pako?.inflate) return window.pako.inflate(bytes);
  throw new Error('Não foi possível descompactar o PDF Santander.');
}

function santanderHexToUnicode(hex) {
  const clean = String(hex || '').replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 4) {
    const cp = parseInt(clean.slice(i, i + 4), 16);
    if (Number.isFinite(cp)) out += String.fromCodePoint(cp);
  }
  return out;
}

function santanderParseCMap(text) {
  const map = new Map();
  for (const block of String(text || '').matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
      map.set(parseInt(m[1], 16), santanderHexToUnicode(m[2]));
    }
  }
  for (const block of String(text || '').matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/g)) {
      const first = parseInt(m[1], 16);
      const last = parseInt(m[2], 16);
      const dst = parseInt(m[3], 16);
      for (let c = first; c <= last; c++) map.set(c, String.fromCodePoint(dst + c - first));
    }
  }
  return map;
}

async function santanderDecodeStream(raw) {
  raw = String(raw || '');
  const st = raw.indexOf('stream');
  const en = raw.indexOf('endstream');
  if (st < 0 || en < 0) return '';
  let start = st + 6;
  if (raw[start] === '\r' && raw[start + 1] === '\n') start += 2;
  else if (raw[start] === '\n') start += 1;
  let end = en;
  if (raw[end - 1] === '\n') end -= 1;
  if (raw[end - 1] === '\r') end -= 1;
  const bytes = stringToBytes(raw.slice(start, end));
  const decoded = /\/FlateDecode/.test(raw.slice(0, st)) ? await inflatePdfBytes(bytes) : bytes;
  return bytesToLatin1(decoded);
}

function santanderDecodeHexText(hex, cmap) {
  const clean = String(hex || '').replace(/\s+/g, '');
  let text = '';
  const useTwoBytes = clean.length % 4 === 0 && cmap && cmap.has(parseInt(clean.slice(0, 4), 16));
  const step = useTwoBytes ? 4 : 2;
  for (let i = 0; i < clean.length; i += step) {
    const code = parseInt(clean.slice(i, i + step), 16);
    text += cmap?.get(code) || '';
  }
  return text;
}

function santanderParseFonts(raw) {
  const fonts = new Map();
  const fontBlock = String(raw || '').match(/\/Font\s*<<(.*?)>>/s);
  const fontText = fontBlock ? fontBlock[1] : raw;
  for (const f of String(fontText || '').matchAll(/\/(F\d+)\s+(\d+)\s+0\s+R/g)) {
    fonts.set(f[1], Number(f[2]));
  }
  return fonts;
}

function santanderExtractContent(content, page, fonts, cmaps) {
  const words = [];
  for (const bt of String(content || '').matchAll(/BT([\s\S]*?)ET/g)) {
    const block = bt[1];
    let font = null, x = 0, y = 0, size = 10;
    const re = /\/(F\d+)\s+([-\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+([-\d.]+)\s+([-\d.]+)\s+Tm|<([0-9A-Fa-f\s]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ/g;
    let m;
    while ((m = re.exec(block))) {
      if (m[1]) { font = m[1]; size = Number(m[2]) || size; continue; }
      if (m[3]) { x += Number(m[3]) || 0; y += Number(m[4]) || 0; continue; }
      if (m[5]) { x = Number(m[5]) || 0; y = Number(m[6]) || 0; continue; }
      if (m[7]) {
        const text = santanderDecodeHexText(m[7], cmaps.get(fonts.get(font)));
        if (text) words.push({ page, x, y, size, text });
      } else if (m[8]) {
        const cmap = cmaps.get(fonts.get(font));
        const text = [...m[8].matchAll(/<([0-9A-Fa-f\s]+)>/g)]
          .map(mm => santanderDecodeHexText(mm[1], cmap))
          .join('')
          .trim();
        if (text) words.push({ page, x, y, size, text });
      }
    }
  }
  return words;
}

async function collectSantanderRawWords(arrayBuffer) {
  if (!arrayBuffer) return [];
  const latin = bytesToLatin1(new Uint8Array(arrayBuffer));
  const objects = new Map();
  for (const m of latin.matchAll(/(\d+)\s+0\s+obj([\s\S]*?)endobj/g)) {
    objects.set(Number(m[1]), { id: Number(m[1]), raw: m[2], start: m.index });
  }

  const cmaps = new Map();
  for (const obj of objects.values()) {
    const m = obj.raw.match(/\/Type\s*\/Font[\s\S]*?\/ToUnicode\s+(\d+)\s+0\s+R/);
    if (!m) continue;
    const cmapObj = objects.get(Number(m[1]));
    if (cmapObj) cmaps.set(obj.id, santanderParseCMap(await santanderDecodeStream(cmapObj.raw)));
  }

  const pages = [];
  for (const obj of objects.values()) {
    if (!/\/Type\s*\/Page\b/.test(obj.raw)) continue;
    const xobj = obj.raw.match(/\/XObject\s*<<\s*\/Xf\d+\s+(\d+)\s+0\s+R/);
    const contents = [...obj.raw.matchAll(/\/Contents\s*\[\s*((?:\d+\s+0\s+R\s*)+)\]/g)]
      .flatMap(m => [...m[1].matchAll(/(\d+)\s+0\s+R/g)].map(x => Number(x[1])));
    const resources = obj.raw.match(/\/Resources\s+(\d+)\s+0\s+R/);
    if (xobj || contents.length) pages.push({
      order: obj.start,
      formId: xobj ? Number(xobj[1]) : null,
      contentIds: contents,
      resourceId: resources ? Number(resources[1]) : null
    });
  }
  pages.sort((a, b) => a.order - b.order);

  const out = [];
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].formId) {
      const form = objects.get(pages[i].formId);
      if (!form) continue;
      out.push(...santanderExtractContent(await santanderDecodeStream(form.raw), i + 1, santanderParseFonts(form.raw), cmaps));
    } else {
      const resource = objects.get(pages[i].resourceId);
      const fonts = santanderParseFonts(resource?.raw || '');
      let content = '';
      for (const id of pages[i].contentIds || []) {
        const obj = objects.get(id);
        if (obj) content += '\n' + await santanderDecodeStream(obj.raw);
      }
      out.push(...santanderExtractContent(content, i + 1, fonts, cmaps));
    }
  }
  return out;
}

function parseSantanderHeaderDate(text) {
  const meses = {
    'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09',
    'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };
  const m = String(text || '').toLowerCase().match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(20\d{2})/i);
  if (!m || !meses[m[2]]) return null;
  return `${m[1].padStart(2, '0')}/${meses[m[2]]}/${m[3]}`;
}

function santanderTipoFromText(text) {
  const s = String(text || '');
  if (/(DEBITO|DÉBITO)/i.test(s)) return 'saida';
  if (/(CREDITO|CRÉDITO)/i.test(s)) return 'entrada';
  return null;
}

function parseSantanderInlineLine(rowText) {
  const line = fixEnc(String(rowText || '').replace(/\s+/g, ' ').trim());
  const m = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(?:[A-Z]\s+)?(\d{4})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s+([DC])\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*$/i);
  if (!m) return null;
  let hist = m[3]
    .replace(/\s+\d{5,}\s*$/g, ' ')
    .replace(/\s+0{3,}\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!hist) hist = 'Lançamento Santander';
  const value = Math.abs(pdfMoneyToNumber(m[4]));
  if (!isFinite(value) || value === 0) return null;
  return {
    date: m[1],
    hist,
    tipo: /D/i.test(m[5]) ? 'saida' : 'entrada',
    value
  };
}

function isSantanderInlineDetail(rowText) {
  const line = fixEnc(String(rowText || '').replace(/\s+/g, ' ').trim());
  if (!line) return false;
  if (/^\d{2}\/\d{2}\/\d{4}\b/.test(line)) return false;
  if (/^(P[aá]gina|Santander|EXTRATO|Data in[ií]cio|Dt\.?\s+cont[aá]bil|-{4,})/i.test(line)) return false;
  if (/saldo|total dispon/i.test(line)) return false;
  if (extractPDFMoneyText([{ x: 0, text: line }], { defaultTipo: 'entrada' })) return false;
  return true;
}

async function parseSantanderPDF(pdfDoc, fname, sample, arrayBuffer) {
  const txns = [];
  let bancoInfo = 'Santander';
  const DATE_RE = /\d{2}\/\d{2}\/\d{4}/;
  const IGNORE = /saldo do dia|saldo anterior|saldo total|total dispon[ií]vel|central de atendimento|sac - atendimento/i;
  let rawWords = null;
  if (arrayBuffer) {
    try { rawWords = await collectSantanderRawWords(arrayBuffer); }
    catch (err) {
      if (!pdfDoc) throw err;
      console.warn('[Santander] fallback bruto indisponível', err);
    }
  }

  const pageCount = rawWords?.length
    ? Math.max(...rawWords.map(w => w.page || 1))
    : (pdfDoc?.numPages || 0);

  let currentDate = null;
  for (let p = 1; p <= pageCount; p++) {
    let words = rawWords?.length ? rawWords.filter(w => w.page === p) : await collectPDFWords(pdfDoc, p);
    const rows = [];
    for (const item of words) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 4);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.sort((a, b) => a.y - b.y);

    if (p === 1) {
      const header = rows.slice(0, 12).map(r => pdfLineText(r.items)).join(' ');
      const mConta = header.match(/Ag[eê]ncia:\s*([\d-]+).*?Conta:\s*([\d-]+)/i);
      if (mConta) bancoInfo = `Santander Ag.${mConta[1]} Cc.${mConta[2]}`;
    }

    const maxX = Math.max(600, ...words.map(w => w.x || 0));
    const dateEndX = maxX * 0.13;
    const histStartX = maxX * 0.11;
    const valueStartX = maxX * 0.72;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const fullRowText = pdfLineText(row.items);
      const inline = parseSantanderInlineLine(fullRowText);
      if (inline) {
        if (IGNORE.test(inline.hist)) continue;
        const details = [];
        for (let di = ri + 1; di < rows.length && details.length < 2; di++) {
          if (rows[di].page && row.page && rows[di].page !== row.page) break;
          if (Math.abs(rows[di].y - rows[di - 1].y) > 24) break;
          const detailText = pdfLineText(rows[di].items);
          if (!isSantanderInlineDetail(detailText)) break;
          details.push(detailText);
        }
        const histFull = sanitizeHistoryText([inline.hist, ...details].join(' '), 240);
        const [dd, mm, yyyy] = inline.date.split('/');
        const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
        txns.push(makeTxnWithComplement(date, monthKey, monthLabel, dateSerial, histFull, histFull, inline.tipo, inline.value, 'Santander', bancoInfo, fname));
        continue;
      }
      const headerDate = parseSantanderHeaderDate(fullRowText);
      if (headerDate) {
        currentDate = headerDate;
        continue;
      }

      const leftText = pdfLineText(row.items.filter(i => i.x <= dateEndX));
      const dateMatch = leftText.match(DATE_RE);
      if (!dateMatch && currentDate && /(CREDITO|CRÉDITO|DEBITO|DÉBITO)/i.test(fullRowText)) {
        const valueInfoLoose = extractPDFMoneyText([{ x: 0, text: fullRowText }], { defaultTipo: 'entrada' });
        if (!valueInfoLoose) continue;
        let histLoose = fixEnc(fullRowText)
          .replace(/-?\s*R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/gi, ' ')
          .replace(/(CREDITO|CRÉDITO|DEBITO|DÉBITO)/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!histLoose || IGNORE.test(histLoose)) continue;
        const tipoLoose = santanderTipoFromText(fullRowText) || 'entrada';
        const [dd, mm, yyyy] = currentDate.split('/');
        const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
        txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, histLoose, tipoLoose, valueInfoLoose.value, 'Santander', bancoInfo, fname));
        continue;
      }
      if (!dateMatch) continue;

      const valueInfo = extractPDFMoneyText(row.items.filter(i => i.x >= valueStartX), { defaultTipo: 'entrada' });
      if (!valueInfo) continue;

      const nearItems = rows
        .filter(r => Math.abs(r.y - row.y) <= 5)
        .flatMap(r => r.items.filter(i =>
          i.x >= histStartX &&
          i.x < valueStartX &&
          !DATE_RE.test(i.text) &&
          !extractPDFMoneyText([i])
        ));

      let hist = pdfLineText(nearItems)
        .replace(/\b\d{6,}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      hist = fixEnc(hist);
      if (!hist || IGNORE.test(hist)) continue;

      const rawVal = valueInfo.tipo === 'saida' ? -valueInfo.value : valueInfo.value;
      if (!isFinite(rawVal) || rawVal === 0) continue;
      const [dd, mm, yyyy] = dateMatch[0].split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      const tipo = rawVal < 0 ? 'saida' : 'entrada';
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, hist, tipo, Math.abs(rawVal), 'Santander', bancoInfo, fname));
    }
  }

  return txns;
}

async function parseBancoBrasilPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'Banco do Brasil';
  const DATE_PAT = /^\d{2}\/\d{2}\/\d{3,4}$/;
  const VAL_PAT = /^\d{1,3}(?:\.\d{3})*,\d{2}\s*\([+-]\)$|^\d+,\d{2}\s*\([+-]\)$/;
  const IGNORE_HIST = /saldo (anterior|do dia|bloq|bloqueado)|saldo anterior|saldo bloqueado|dep[oó]sito bloquead|deposito bloquead|ordem interna|ordens internas|lan[çc]amento futuro|pre[- ]?lan[çc]amento/i;
  const SKIP = /^(Saldo Anterior|Saldo|Valor Total|Valor Liberado|Lançamentos|Lancamentos|Dia|Lote|Documento|Histórico|Historico|Valor)$/i;
  let defaultYear = (fname.match(/20\d{2}/) || [String(new Date().getFullYear())])[0];

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);
    if (p === 1) {
      const pageText = words.map(w => w.text).join(' ');
      const mConta = pageText.match(/Ag[eê]ncia:\s*([\d-]+)\s+Conta:\s*([\d-]+)/i);
      if (mConta) bancoInfo = `Banco do Brasil Ag.${mConta[1]} Cc.${mConta[2]}`;
      const fullDate = words.find(w => /^\d{2}\/\d{2}\/\d{4}$/.test(w.text) && !/^00\/00/.test(w.text));
      if (fullDate) defaultYear = fullDate.text.split('/')[2];
    }

    const rows = [];
    for (const item of words) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 3);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.sort((a, b) => b.y - a.y);

    const anchors = rows.map((row, idx) => {
      const dateItem = row.items.find(t => t.x < 80 && DATE_PAT.test(t.text));
      if (!dateItem) return null;
      const valInfo = extractPDFMoneyText(words.filter(v =>
        Math.abs(v.y - dateItem.y) <= 7 &&
        v.x > 500 && v.x < 585
      ));
      return valInfo ? { idx, y: dateItem.y, date: dateItem.text, val: valInfo.text, valInfo } : null;
    }).filter(Boolean);

    for (let i = 0; i < anchors.length; i++) {
      const anc = anchors[i];
      const nextY = anchors[i + 1]?.y ?? -9999;
      const histItems = [];
      for (const row of rows) {
        histItems.push(...row.items.filter(t =>
          t.x >= 250 && t.x < 500 &&
          t.y <= anc.y + 8 &&
          t.y > nextY + 7 &&
          !SKIP.test(t.text) &&
          !DATE_PAT.test(t.text) &&
          !extractPDFMoneyText([t])
        ));
      }
      let hist = textFromWords(histItems).trim();
      if (!hist || SKIP.test(hist)) hist = 'Lançamento Banco do Brasil';

      if (IGNORE_HIST.test(hist) && !/bb rende|rende facil|rende f[aá]cil|cdb/i.test(hist)) continue;
      const rawVal = anc.valInfo.value;
      if (!isFinite(rawVal) || rawVal === 0) continue;
      const tipo = anc.valInfo.tipo || (/\(-\)|-/.test(anc.val) ? 'saida' : 'entrada');
      let [dd, mm, yyyy] = anc.date.split('/');
      if (yyyy.length < 4 && defaultYear.startsWith(yyyy)) yyyy = defaultYear;
      if (yyyy.length < 4) yyyy = defaultYear;
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, fixEnc(hist), tipo, Math.abs(rawVal), 'Banco do Brasil', bancoInfo, fname));
    }
  }

  return txns;
}

function parseBancoOFX(text) {
  const get = (tag, t) => { const m = t.match(new RegExp('<' + tag + '>([^<\\r\\n]+)', 'i')); return m ? m[1].trim() : ''; };
  const bankid = get('BANKID', text) || get('FID', text) || '';
  const acctid = get('ACCTID', text) || '';
  const branchid = get('BRANCHID', text) || '';
  const org = get('ORG', text) || '';
  const nomes = { '001': 'Banco do Brasil', '033': 'Santander', '041': 'Banrisul', '104': 'Caixa', '237': 'Bradesco', '341': 'Itaú', '756': 'Sicoob', '748': 'Sicredi', '077': 'Inter', '260': 'Nubank', '336': 'C6 Bank', '212': 'Banco Original', '422': 'Safra', '070': 'BRB' };
  const nome = nomes[bankid] || org || `Banco ${bankid || '?'}`;
  let info = nome;
  if (branchid) info += ` Ag.${branchid}`;
  if (acctid) info += ` Cc.${acctid}`;
  return { nome, info };
}

function parseOFX(text, fname) {
  const banco = parseBancoOFX(text);
  const txns = [];
  (text.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) || []).forEach(block => {
    const get = tag => { const m = block.match(new RegExp('<' + tag + '>([^<\\r\\n]+)', 'i')); return m ? m[1].trim() : ''; };
    const dp = get('DTPOSTED'), amt = parseFloat(get('TRNAMT').replace(',', '.')), memo = fixEnc(get('MEMO') || get('NAME') || '');
    if (!dp || isNaN(amt)) return;
    const y = dp.substring(0, 4), mo = dp.substring(4, 6), d = dp.substring(6, 8);
    const { date, monthKey, monthLabel, dateSerial } = mkMk(d, mo, y);
    const tipo = amt >= 0 ? 'entrada' : 'saida';
    txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, memo, tipo, Math.abs(amt), banco.nome, banco.info, fname));
  });
  return txns;
}

// ── PARSER PDF GENÉRICO ────────────────────────────────────────────────────────
function parsePDFGenerico(text, fname) {
  const txns = [], bancoLabel = fname.replace(/\.[^.]+$/, '');
  text.split('\n').forEach(line => {
    const dm = line.match(/(\d{2}\/\d{2}\/\d{2,4})/);
    const vm = line.match(/([\-]?\d{1,3}(?:\.\d{3})*,\d{2})/g);
    if (!dm || !vm) return;
    let [d, m, y] = dm[1].split('/');
    if (y && y.length === 2) y = '20' + y;
    if (!y) return;
    const desc = fixEnc(line.replace(dm[0], '').replace(/[\-]?\d{1,3}(?:\.\d{3})*,\d{2}/g, '').replace(/\s+/g, ' ').trim());
    if (!desc) return;
    vm.forEach(vs => {
      const raw = parseFloat(vs.replace(/\./g, '').replace(',', '.'));
      const val = Math.round(Math.abs(raw) * 100) / 100;
      if (!val) return;
      const tipo = raw < 0 ? 'saida' : 'entrada';
      const { date, monthKey, monthLabel, dateSerial } = mkMk(d, m, y);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, desc, tipo, val, bancoLabel, bancoLabel, fname));
    });
  });
  return txns;
}


// ── PARSER NUBANK PJ ─────────────────────────────────────────────────────────
// Layout real por coordenadas X:
//   x≈58  → data "10 FEV 2023"
//   x≈120 → tipo: "Total de saídas", "Pagamento de boleto efetuado", "Saldo do dia"
//   x≈261 → favorecido: "MALTONI CONTADORES ASSOCIADOS"
//   x≈490 → valor: "909,12" ou "- 909,12" ou "+ 34.785,50"
// ─────────────────────────────────────────────────────────────────────────────
async function parseNubankPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'Nubank';
  // validationPoints acumula TODOS os saldos do dia em ordem de página/posição
  const validationPoints = [];

  const MESES = { jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06',
                  jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12' };

  function parseNubankDate(txt) {
    const m = String(txt||'').match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(20\d{2})$/i);
    if (!m) return null;
    const key = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,3);
    const mm = MESES[key];
    if (!mm) return null;
    return { dd: m[1].padStart(2,'0'), mm, yyyy: m[3] };
  }

  // Enriquece histórico para que categorize() funcione corretamente
  // O favorecido é usado para refinar a categoria do boleto
  function nubankDesc(textTipo, favCompleto) {
    const fav = favCompleto.trim();
    if (/transferencia\s+enviada\s+pelo\s+pix/i.test(normBuscaLayout(textTipo))) {
      return `PIX enviado - ${fav}`;
    }
    if (/transferencia\s+recebida/i.test(normBuscaLayout(textTipo))) {
      return `TED recebida - ${fav}`;
    }
    if (/pagamento\s+de\s+boleto/i.test(normBuscaLayout(textTipo))) {
      // Tenta inferir categoria pelo nome do favorecido
      if (/contad|contabil|contador|maltoni|honorar/i.test(fav))   return `Honorários contábeis - ${fav}`;
      if (/sofisa|financ|emprest|banco\s+\w+\s+s[./]a/i.test(fav)) return `Empréstimo / Financiamento - ${fav}`;
      if (/pcrj|prefeitura|municipio|munic[ií]pio|sefaz|sefin/i.test(fav)) return `Taxas e tributos prefeitura - ${fav}`;
      if (/inss|prev|gps|fgts/i.test(fav))                         return `INSS / GPS - ${fav}`;
      if (/receita\s+federal|rfb|\bdarf\b/i.test(fav))             return `DARF / IRPJ / CSLL - ${fav}`;
      if (/aluguel|loca[çc]/i.test(fav))                           return `Aluguel - ${fav}`;
      return `Pagamento boleto - ${fav}`;
    }
    return `${textTipo} ${fav}`.trim();
  }

  // currentDate e currentTipo ficam FORA do loop de páginas
  // para persistirem quando um lançamento começa numa página e termina na próxima
  let currentDate = null;
  let currentTipo = null;

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);

    // Agrupa por Y com tolerância de 4px
    const rows = [];
    for (const w of words) {
      let row = rows.find(r => Math.abs(r.y - w.y) < 4);
      if (!row) { row = { y: w.y, cols: [] }; rows.push(row); }
      row.cols.push(w);
    }
    rows.sort((a, b) => b.y - a.y); // top → bottom (Y maior = topo da página)

    if (p === 1) {
      const allText = words.map(w => w.text).join(' ');
      const mConta = allText.match(/Conta\s+([\d-]+)/i);
      if (mConta) bancoInfo = `Nubank Cc.${mConta[1]}`;
    }

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];

      const colData  = row.cols.filter(w => w.x < 100);
      const colTipo  = row.cols.filter(w => w.x >= 100 && w.x < 240);
      const colFav   = row.cols.filter(w => w.x >= 240 && w.x < 475);
      const colValor = row.cols.filter(w => w.x >= 475);

      const textData  = fixEnc(colData.map(w=>w.text).join(' ').trim());
      const textTipo  = fixEnc(colTipo.map(w=>w.text).join(' ').trim());
      const textFav   = fixEnc(colFav.map(w=>w.text).join(' ').trim());
      const textValor = fixEnc(colValor.map(w=>w.text).join(' ').replace(/[+\-\s]/g,'').trim());

      // Atualiza data
      const dateParts = parseNubankDate(textData);
      if (dateParts) currentDate = dateParts;

      // Atualiza tipo
      if (/^total de entradas/i.test(normBuscaLayout(textTipo))) { currentTipo = 'entrada'; continue; }
      if (/^total de saidas/i.test(normBuscaLayout(textTipo))) { currentTipo = 'saida';  continue; }

      // Captura saldo do dia (em ordem real de página+Y para saldo inicial/final)
      if (/^saldo do dia$/i.test(normBuscaLayout(textTipo)) && textValor) {
        const v = pdfMoneyToNumber(textValor);
        if (isFinite(v)) validationPoints.push({ kind:'saldo', value:v, text:'Saldo do dia '+textValor, date:'', page:p, y:row.y });
        continue;
      }

      // Ignora rodapé e cabeçalho
      if (!textTipo || /^(valores|01 de|ouvidoria|extrato gerado|o saldo|nao nos|asseguramos|nu financeira|nu pagamentos|cnpj)/i.test(normBuscaLayout(textTipo))) continue;
      if (!currentDate || !currentTipo) continue;

      // Lançamento
      const isTxn = /^(pagamento|transferencia|compra|saque|rendimento|estorno|reembolso|iof|tarifa)/i.test(normBuscaLayout(textTipo));
      if (!isTxn) continue;

      // Valor
      let valorStr = textValor;
      if (!valorStr) { const mv = textFav.match(/([\d.]+,\d{2})$/); if (mv) valorStr = mv[1]; }
      if (!valorStr) continue;
      const valor = Math.abs(pdfMoneyToNumber(valorStr));
      if (!isFinite(valor) || valor === 0) continue;

      // Favorecido com continuações
      let favCompleto = textFav.replace(/([\d.]+,\d{2})$/, '').trim();
      for (let ci = ri + 1; ci < rows.length && ci <= ri + 3; ci++) {
        const nr = rows[ci];
        const nData = fixEnc(nr.cols.filter(w=>w.x<100).map(w=>w.text).join(' ').trim());
        const nTipo = fixEnc(nr.cols.filter(w=>w.x>=100&&w.x<240).map(w=>w.text).join(' ').trim());
        const nFav  = fixEnc(nr.cols.filter(w=>w.x>=240&&w.x<475).map(w=>w.text).join(' ').trim());
        if (parseNubankDate(nData)) break;
        if (/^(total de|saldo do dia)/i.test(normBuscaLayout(nTipo))) break;
        if (/^(pagamento|transferencia)/i.test(normBuscaLayout(nTipo))) break;
        if (nFav && !nTipo) { favCompleto += ' - ' + nFav; ri = ci; }
      }

      const descFinal = sanitizeHistoryText(nubankDesc(textTipo, favCompleto), 240);
      const { dd, mm, yyyy } = currentDate;
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, descFinal, currentTipo, valor, 'Nubank', bancoInfo, fname));
    }
  }

  // Ordena saldos por página crescente e Y decrescente (topo da pág = primeiro do extrato)
  // Isso garante que funcione com extratos de qualquer número de páginas
  validationPoints.sort((a, b) => a.page !== b.page ? a.page - b.page : b.y - a.y);
  if (validationPoints.length > 0) {
    validationPoints[0].kind = 'inicial';
    validationPoints[validationPoints.length - 1].kind = 'final';
  }

  txns.validationPoints = validationPoints;
  return txns;
}
// ─────────────────────────────────────────────────────────────────────────────

async function parseBancoOriginalPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'Banco Original';

  const page1Words = await collectPDFWords(pdfDoc, 1);
  const fullText1 = page1Words.map(w => w.text).join(' ');

  const validationPoints = [];
  const mSaldoAnterior = fullText1.match(/Saldo\s+Anterior\s+R\$\s*([\d.,]+)/i);
  const mSaldoAtual = fullText1.match(/Saldo\s+Atual[^R]*R\$\s*([\d.,]+)/i);
  if (mSaldoAnterior) validationPoints.push({ kind: 'inicial', value: pdfMoneyToNumber(mSaldoAnterior[1]), text: 'Saldo Anterior ' + mSaldoAnterior[1], date: '' });
  if (mSaldoAtual) validationPoints.push({ kind: 'final', value: pdfMoneyToNumber(mSaldoAtual[1]), text: 'Saldo Atual ' + mSaldoAtual[1], date: '' });

  function normOriginalText(txt) {
    return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
  }

  function isComplementLine(txt) {
    const n = normOriginalText(txt);
    if (!txt || txt.length < 2) return false;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(txt)) return false;
    if (/(?:debito|credito)/i.test(n)) return false;
    if (/^(saldo|total dispon|limite de cheque|extrato|atendimento|os saldos|internet banking|original empresas)/i.test(n)) return false;
    if (/R\$\s*[\d.,]+/.test(txt) && !/Ag\s*-|Conta\s*-|<\d/.test(txt)) return false;
    return true;
  }

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);
    const rows = [];
    for (const item of words) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 3);
      if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
      row.items.push(item);
    }
    rows.sort((a, b) => b.y - a.y);
    const lines = rows.map(r => pdfLineText(r.items).trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const rowText = lines[i];
      const dateMatch = rowText.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+)$/);
      if (!dateMatch) continue;

      const norm = normOriginalText(rowText);
      if (/saldo/.test(norm) && !/(?:debito|credito)/.test(norm)) continue;

      let tipo = null;
      if (/debito/.test(norm)) tipo = 'saida';
      if (/credito/.test(norm)) tipo = 'entrada';
      if (!tipo) continue;

      const mValor = rowText.match(/R\$\s*([\d.]+,\d{2})/);
      if (!mValor) continue;
      const valor = Math.abs(pdfMoneyToNumber(mValor[1]));
      if (!isFinite(valor) || valor === 0) continue;

      let hist = rowText
        .replace(dateMatch[1], '')
        .replace(/D[ÉE]BITO|DEBITO|CR[ÉE]DITO|CREDITO/gi, '')
        .replace(/-?\s*R\$\s*[\d.,]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const complementParts = [];
      for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
        const nextText = lines[j].trim();
        if (!isComplementLine(nextText)) break;
        complementParts.push(nextText.replace(/-?\s*R\$\s*[\d.,]+/g, '').replace(/\s+/g, ' ').trim());
      }

      const descFinal = sanitizeHistoryText(fixEnc([hist, ...complementParts].filter(Boolean).join(' - ').replace(/\s+/g, ' ').trim() || 'Lançamento Banco Original'), 240);
      const [dd, mm, yyyy] = dateMatch[1].split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, descFinal, tipo, valor, 'Banco Original', bancoInfo, fname));
    }
  }

  txns.validationPoints = validationPoints;
  return txns;
}
function cloudWalkMonthNumber(mon) {
  const key = fixEnc(String(mon || '')).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().slice(0, 3);
  return ({ jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' })[key] || '01';
}

function cloudWalkParseDate(s) {
  const m = fixEnc(String(s || '')).match(/^(\d{2})\s+([A-Za-zÁÃ‰ÍÃ“ÃšÃ‚ÃŠÃ”ÃƒÃ•Ã‡Ã¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ´Ã£ÃµÃ§]{3,})\s*,\s*(20\d{2})$/i);
  if (!m) return null;
  return { dd: m[1], mm: cloudWalkMonthNumber(m[2]), yyyy: m[3] };
}

function cloudWalkLinesFromItems(items) {
  const rawLines = items.map(i => fixEnc(i.str || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (rawLines.some(l => /Relat.rio de movimenta|CloudWalk|InfinitePay|Data Hora Tipo/i.test(l))) return rawLines;

  const rows = [];
  for (const item of items) {
    const text = fixEnc(item.str || '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const y = item.transform?.[5] || 0;
    const x = item.transform?.[4] || 0;
    let row = rows.find(r => Math.abs(r.y - y) < 3);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ x, text });
  }
  return rows.sort((a, b) => b.y - a.y).map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseCloudWalkTransactionRow(row, dateParts, bancoNome, bancoInfo, fname) {
  const line = fixEnc(String(row || '')).replace(/\s+/g, ' ').trim();
  const m = line.match(/^(\d{2}:\d{2})\s+(.+?)\s+([+-]\s*\d{1,3}(?:\.\d{3})*,\d{2}|[+-]\s*\d+,\d{2})$/);
  if (!m || !dateParts) return null;
  const raw = pdfMoneyToNumber(m[3]);
  if (!isFinite(raw) || raw === 0) return null;
  const tipo = raw < 0 ? 'saida' : 'entrada';
  let desc = m[2].trim();
  desc = desc.replace(/Dep[oó]sito de vendas\s+Vendas\s+Dep[oó]sito InfinitePay/i, 'Depósito de vendas InfinitePay');
  desc = desc.replace(/Pix\s+Pix\s+/i, 'PIX ');
  desc = desc.replace(/([A-Za-zÁÃ‰ÍÃ“ÃšÃ‚ÃŠÃ”ÃƒÃ•Ã‡Ã¡Ã©Ã­Ã³ÃºÃ¢ÃªÃ´Ã£ÃµÃ§])Enviado\b/g, '$1 Enviado');
  desc = desc.replace(/\b(?:Enviado|Recebido)\s*$/i, '').trim();
  desc = `${desc} ${tipo === 'saida' ? 'Enviado' : 'Recebido'}`.replace(/\s+/g, ' ').trim();
  const { date, monthKey, monthLabel, dateSerial } = mkMk(dateParts.dd, dateParts.mm, dateParts.yyyy);
  return makeTxn(date, monthKey, monthLabel, dateSerial, desc, tipo, Math.abs(raw), bancoNome, bancoInfo, fname);
}

function binaryFromBytes(bytes) {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return out;
}

function bytesFromBinary(bin) {
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
  return out;
}

async function inflatePdfStreamBytes(bytes) {
  if (typeof DecompressionStream === 'undefined') return null;
  let clean = bytes;
  while (clean.length && (clean[0] === 10 || clean[0] === 13)) clean = clean.slice(1);
  while (clean.length && (clean[clean.length - 1] === 10 || clean[clean.length - 1] === 13)) clean = clean.slice(0, -1);
  try {
    if (window.pako?.inflate) return window.pako.inflate(clean);
    await loadScriptOnce('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js', 'pako');
    if (window.pako?.inflate) return window.pako.inflate(clean);
  } catch (err) {}
  for (const format of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      await writer.write(clean);
      await writer.close();
      return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    } catch (err) {}
  }
  return null;
}

function unicodeFromHexBE(hex) {
  let out = '';
  for (let i = 0; i + 3 < hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  return out;
}

function parsePdfCMap(text, map) {
  const re = /<([0-9A-Fa-f]{4})>\s+<([0-9A-Fa-f]+)>/g;
  let m;
  while ((m = re.exec(text))) map[m[1].toLowerCase()] = unicodeFromHexBE(m[2]);
}

function decodePdfHexText(hex, cmap) {
  let out = '';
  for (let i = 0; i + 3 < hex.length; i += 4) out += cmap[hex.slice(i, i + 4).toLowerCase()] || '';
  return out;
}

function decodeCloudWalkContentText(contentText, cmap) {
  const tokens = [];
  const re = /\[([^\]]+)\]\s*TJ/g;
  let m;
  while ((m = re.exec(contentText))) {
    let out = '';
    const hexes = m[1].match(/<([0-9A-Fa-f]+)>/g) || [];
    hexes.forEach(h => { out += decodePdfHexText(h.slice(1, -1), cmap); });
    out = fixEnc(out).replace(/\s+/g, ' ').trim();
    if (out) tokens.push(out);
  }
  return tokens;
}
function normalizeCloudWalkRawTokens(tokens) {
  const lines = [];
  const amountPat = /^[+-]\s*\d{1,3}(?:\.\d{3})*,\d{2}$|^[+-]\s*\d+,\d{2}$/;
  for (let i = 0; i < tokens.length; i++) {
    const t = fixEnc(tokens[i] || '').replace(/\s+/g, ' ').trim();
    if (!t) continue;

    if (/^Data$/i.test(t) && /^Hora$/i.test(tokens[i + 1] || '') && /Tipo de transa/i.test(tokens[i + 2] || '')) {
      lines.push('Data Hora Tipo de transação Nome Detalhe Valor (R$)');
      i += 5;
      continue;
    }

    if (/^\d{2}:\d{2}$/.test(t)) {
      const parts = [t];
      for (i = i + 1; i < tokens.length; i++) {
        const cur = fixEnc(tokens[i] || '').replace(/\s+/g, ' ').trim();
        if (!cur) continue;
        parts.push(cur);
        if (amountPat.test(cur)) break;
        if (/^Saldo do dia$/i.test(cur) || /^Data$/i.test(cur) || cloudWalkParseDate(cur) || /^P[aá]gina\b|^A Central de Ajuda/i.test(cur)) {
          parts.pop();
          i--;
          break;
        }
      }
      lines.push(parts.join(' ').replace(/\s+/g, ' ').trim());
      continue;
    }

    if (/^Saldo do dia$/i.test(t)) {
      const next = fixEnc(tokens[i + 1] || '').replace(/\s+/g, ' ').trim();
      if (amountPat.test(next)) { lines.push(`${t} ${next}`); i++; }
      else lines.push(t);
      continue;
    }

    lines.push(t);
  }
  return lines;
}

async function extractCloudWalkRawPages(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const bin = binaryFromBytes(bytes);
  const streamRe = /\d+\s+0\s+obj([\s\S]*?)stream\r?\n([\s\S]*?)\r?\nendstream/g;
  const decoded = [];
  let m;
  while ((m = streamRe.exec(bin))) {
    if (!/FlateDecode/i.test(m[1])) continue;
    try {
      const inflated = await inflatePdfStreamBytes(bytesFromBinary(m[2]));
      if (!inflated) continue;
      decoded.push(binaryFromBytes(inflated));
    } catch (err) {}
  }
  const cmap = {};
  decoded.forEach(s => { if (/begincmap|beginbfchar/i.test(s)) parsePdfCMap(s, cmap); });
  if (!Object.keys(cmap).length) return [];
  const pages = [];
  decoded.forEach(s => {
    if (!/\]\s*TJ/.test(s)) return;
    const tokens = decodeCloudWalkContentText(s, cmap);
    if (tokens.some(t => /Relat.rio de movimenta|CLOUDWALK|InfinitePay|Data|Saldo inicial/i.test(t))) pages.push(normalizeCloudWalkRawTokens(tokens));
  });
  return pages;
}

async function parseCloudWalkRawPDF(arrayBuffer, fname) {
  const pages = await extractCloudWalkRawPages(arrayBuffer);
  if (!pages.length || !pages.flat().some(t => /CLOUDWALK|InfinitePay|Relat.rio de movimenta/i.test(t))) return [];
  const fakePdf = {
    numPages: pages.length,
    async getPage(n) {
      return { async getTextContent() { return { items: pages[n - 1].map((str, idx) => ({ str, transform: [1, 0, 0, 1, 0, 800 - idx * 10] })) }; } };
    }
  };
  return parseCloudWalkPDF(fakePdf, fname);
}
// ── PARSER INFINITEPAY (layout tabular por colunas X) ────────────────────────
// Layout real por coordenadas X:
//   x≈12  → data "02 Abr, 2026" (só na 1ª linha do grupo)
//   x≈96  → hora "01:30"
//   x≈164 → tipo "Depósito de vendas" / "Pix" / "Saldo do dia"
//   x≈299 → nome/favorecido (pode quebrar em 2 linhas)
//   x≈568 → detalhe "Enviado" / "Depósito InfinitePay"
//   x≈797 → valor "+839,73" / "-839,73"
// Cada grupo de dias tem cabeçalho "Data Hora Tipo de transação..."
// ─────────────────────────────────────────────────────────────────────────────
async function parseInfinitePayPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'InfinitePay';
  const validationPoints = [];
  let headerText = '';

  const MESES = { jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06',
                  jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12' };

  function parseInfiniteDate(txt) {
    // "02 Abr, 2026"
    const m = String(txt||'').match(/^(\d{1,2})\s+([A-Za-z]{3}),?\s+(20\d{2})$/i);
    if (!m) return null;
    const key = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,3);
    const mm = MESES[key];
    if (!mm) return null;
    return { dd: m[1].padStart(2,'0'), mm, yyyy: m[3] };
  }

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);

    // Agrupa por Y com tolerância de 4px
    const rows = [];
    for (const w of words) {
      let row = rows.find(r => Math.abs(r.y - w.y) < 4);
      if (!row) { row = { y: w.y, cols: [] }; rows.push(row); }
      row.cols.push(w);
    }
    rows.sort((a, b) => b.y - a.y); // top → bottom

    if (p === 1) {
      headerText = words.map(w => w.text).join(' ');
      // Conta InfinitePay: "CLOUDWALK - 0001 - 25648903-1"
      const mConta = headerText.match(/CLOUDWALK\s*-\s*(\d+)\s*-\s*([\d.-]+)/i);
      if (mConta) bancoInfo = `InfinitePay Ag.${mConta[1]} Cc.${mConta[2]}`;

      // Saldo inicial e final do cabeçalho
      const mIni = headerText.match(/Saldo\s+inicial\s*\+?\s*([\d.]+,\d{2})/i);
      const mFim = headerText.match(/Saldo\s+final\s+do\s+per[ií]odo\s*\+?\s*([\d.]+,\d{2})/i);
      if (mIni) validationPoints.push({ kind:'inicial', value:pdfMoneyToNumber(mIni[1]), text:'Saldo inicial '+mIni[1], date:'' });
      if (mFim) validationPoints.push({ kind:'final',   value:pdfMoneyToNumber(mFim[1]), text:'Saldo final '+mFim[1],   date:'' });
    }

    let currentDate = null; // persiste entre páginas

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];

      // Separa por faixas de X
      const colData   = row.cols.filter(w => w.x < 80);                     // x≈12 data
      const colHora   = row.cols.filter(w => w.x >= 80 && w.x < 150);       // x≈96 hora
      const colTipo   = row.cols.filter(w => w.x >= 150 && w.x < 280);      // x≈164 tipo
      const colNome   = row.cols.filter(w => w.x >= 280 && w.x < 550);      // x≈299 nome
      const colValor  = row.cols.filter(w => w.x >= 730);                   // x≈797 valor

      const textData  = fixEnc(colData.map(w=>w.text).join(' ').trim());
      const textHora  = fixEnc(colHora.map(w=>w.text).join(' ').trim());
      const textTipo  = fixEnc(colTipo.map(w=>w.text).join(' ').trim());
      const textNome  = fixEnc(colNome.map(w=>w.text).join(' ').trim());
      const textValor = fixEnc(colValor.map(w=>w.text).join(' ').trim());

      // Atualiza data se linha tem data
      const dateParts = parseInfiniteDate(textData);
      if (dateParts) currentDate = dateParts;

      // Ignora cabeçalho, saldo do dia, rodapé
      if (!textTipo || /^(Data|Saldo do dia|Saldo (inicial|final)|Total de|A Central de Ajuda|Relatório|Valor em R\$)/i.test(textTipo)) continue;
      if (!currentDate) continue;
      if (!textHora || !/^\d{2}:\d{2}$/.test(textHora)) continue;

      // Valor
      if (!textValor) continue;
      const raw = pdfMoneyToNumber(textValor.replace(/[+\s]/g,''));
      if (!isFinite(raw) || raw === 0) continue;
      const valor = Math.abs(raw);
      const tipo  = raw < 0 ? 'saida' : 'entrada';

      // Nome/favorecido: pode vir na linha atual, na linha ANTERIOR (y maior)
      // ou na linha POSTERIOR (y menor) — o Pix quebra em 2 linhas ao redor da linha de hora/tipo
      let nomeCompleto = textNome;

      // Busca nome na linha imediatamente anterior (ri-1) se não tem nome na atual
      if (!nomeCompleto && ri > 0) {
        const pr = rows[ri - 1];
        const pNome = fixEnc(pr.cols.filter(w => w.x >= 280 && w.x < 550).map(w=>w.text).join(' ').trim());
        const pHora = fixEnc(pr.cols.filter(w => w.x >= 80 && w.x < 150).map(w=>w.text).join(' ').trim());
        const pValor = fixEnc(pr.cols.filter(w => w.x >= 730).map(w=>w.text).join(' ').trim());
        // Linha anterior é só nome (sem hora e sem valor) — é continuação
        if (pNome && !pHora && !pValor) nomeCompleto = pNome;
      }

      // Busca nome na linha seguinte (ri+1) — continuação do nome
      if (ri + 1 < rows.length) {
        const nr = rows[ri + 1];
        const nNome  = fixEnc(nr.cols.filter(w => w.x >= 280 && w.x < 550).map(w=>w.text).join(' ').trim());
        const nHora  = fixEnc(nr.cols.filter(w => w.x >= 80 && w.x < 150).map(w=>w.text).join(' ').trim());
        const nValor = fixEnc(nr.cols.filter(w => w.x >= 730).map(w=>w.text).join(' ').trim());
        if (nNome && !nHora && !nValor) {
          nomeCompleto = nomeCompleto ? nomeCompleto + ' ' + nNome : nNome;
          ri++;
        }
      }

      // Monta histórico informativo
      let desc = '';
      if (/dep[oó]sito\s+de\s+vendas/i.test(textTipo)) {
        desc = 'Depósito de vendas InfinitePay';
      } else if (/^pix$/i.test(textTipo)) {
        desc = nomeCompleto ? `PIX enviado - ${nomeCompleto}` : 'PIX enviado';
      } else {
        desc = [textTipo, nomeCompleto].filter(Boolean).join(' - ');
      }

      const descFinal = sanitizeHistoryText(desc || 'Lançamento InfinitePay', 240);
      const { dd, mm, yyyy } = currentDate;
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, descFinal, tipo, valor, 'InfinitePay', bancoInfo, fname));
    }
  }

  txns.validationPoints = validationPoints;
  txns.headerText = headerText;
  return txns;
}
// ─────────────────────────────────────────────────────────────────────────────

async function parseCloudWalkPDF(pdfDoc, fname) {
  const bancoNome = 'InfinitePay';
  let bancoInfo = 'InfinitePay';
  let headerText = '';
  const txns = [];
  const validationPoints = [];

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const page = await pdfDoc.getPage(p);
    const tc = await page.getTextContent();
    const lines = cloudWalkLinesFromItems(tc.items);
    if (p === 1) headerText = lines.join(' ');

    const conta = lines.join(' ').match(/CLOUDWALK\s*-\s*(\d+)\s*-\s*([\d.-]+)/i);
    if (conta) bancoInfo = `InfinitePay Ag.${conta[1]} Cc.${conta[2]}`;

    const joined = lines.join('\n');
    const mIni = joined.match(/Saldo inicial\s*\+?\s*([\d.]+,\d{2})/i);
    const mFim = joined.match(/Saldo final do per[ií]odo\s*\+?\s*([\d.]+,\d{2})/i);
    if (mIni) validationPoints.push({ kind: 'inicial', value: pdfMoneyToNumber(mIni[1]), text: 'Saldo inicial ' + mIni[1], date: '' });
    if (mFim) validationPoints.push({ kind: 'final', value: pdfMoneyToNumber(mFim[1]), text: 'Saldo final do período ' + mFim[1], date: '' });

    const pageDates = lines.map(cloudWalkParseDate).filter(Boolean);
    const groups = [];
    let current = null;
    for (const line of lines) {
      if (/^Data\s+Hora\s+Tipo de transa/i.test(line)) {
        if (current && current.length) groups.push(current);
        current = [];
        continue;
      }
      if (!current) continue;
      if (/^Saldo do dia/i.test(line)) {
        if (current.length) groups.push(current);
        current = null;
        continue;
      }
      if (cloudWalkParseDate(line) || /^Relat.rio de movimenta|^CLOUDWALK|Central de Ajuda|P.gina \d+/i.test(line)) continue;
      current.push(line);
    }
    if (current && current.length) groups.push(current);

    groups.forEach((group, idx) => {
      const dateParts = pageDates[idx] || pageDates[pageDates.length - 1] || null;
      const rows = [];
      let row = '';
      for (const line of group) {
        if (/^\d{2}:\d{2}\s+/.test(line)) {
          if (row) rows.push(row);
          row = line;
        } else if (row) {
          row += ' ' + line;
        }
      }
      if (row) rows.push(row);
      rows.forEach(r => {
        const txn = parseCloudWalkTransactionRow(r, dateParts, bancoNome, bancoInfo, fname);
        if (txn) txns.push(txn);
      });
    });
  }

  txns.validationPoints = validationPoints;
  txns.headerText = headerText;
  return txns;
}
// ── PARSER PAGBANK CONTA CORRENTE (Extrato da conta corrente) ────────────────
// Layout: 3 colunas — x≈61 data, x≈166 descrição, x≈519 valor "R$ 44,61" / "-R$ 20,00"
// Tem "Saldo do dia" intercalado — ignorar como lançamento
// Tipos: Vendas - Plano de Recebimento, Pix Recebido, Pix Enviado,
//        Pagamento de conta, Rendimento da conta
// ─────────────────────────────────────────────────────────────────────────────
async function parsePagBankContaCorrentePDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'PagBank';
  const validationPoints = [];

  const page1Words = await collectPDFWords(pdfDoc, 1);
  const fullText1 = fixEnc(page1Words.map(w => w.text).join(' '));

  const mConta = fullText1.match(/Conta\s+Corrente\s+([\d-]+)/i);
  const mAg    = fullText1.match(/Ag[eê]ncia\s+([\d-]+)/i);
  if (mConta) bancoInfo = `PagBank${mAg ? ' Ag.'+mAg[1] : ''} Cc.${mConta[1]}`;

  // Saldo inicial e final via "Saldo do dia" — primeiro = inicial, último = final
  const DATE_PAT = /^\d{2}\/\d{2}\/\d{4}$/;
  const IGNORE   = /^(Data|Descrição|Valor|Extrato|Emitido|Período|PagBank|PagSeguro|Agência|Conta|CNPJ|Empresa)/i;

  let currentDate = null; // persiste entre páginas

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);

    const rows = [];
    for (const w of words) {
      let row = rows.find(r => Math.abs(r.y - w.y) < 4);
      if (!row) { row = { y: w.y, cols: [] }; rows.push(row); }
      row.cols.push(w);
    }
    rows.sort((a, b) => b.y - a.y); // top → bottom

    // currentDate persiste entre linhas e páginas
    // porque data e descrição podem estar em linhas Y diferentes
    for (const row of rows) {
      const colData  = row.cols.filter(w => w.x < 130);
      const colDesc  = row.cols.filter(w => w.x >= 130 && w.x < 490);
      const colValor = row.cols.filter(w => w.x >= 490);

      const textData  = fixEnc(colData.map(w=>w.text).join(' ').trim());
      const textDesc  = fixEnc(colDesc.map(w=>w.text).join(' ').trim());
      const textValor = fixEnc(colValor.map(w=>w.text).join(' ').trim());

      // Atualiza data corrente se essa linha tem data
      if (textData && DATE_PAT.test(textData)) currentDate = textData;

      // Linhas sem descrição ou sem data corrente: ignora
      if (!textDesc || IGNORE.test(textDesc)) continue;
      if (!currentDate) continue;

      // Saldo do dia → validação
      if (/^Saldo do dia$/i.test(textDesc) && textValor) {
        const v = pdfMoneyToNumber(textValor.replace('R$','').trim());
        if (isFinite(v)) validationPoints.push({ kind:'saldo', value:v, text:'Saldo do dia '+textValor, date:currentDate, page:p, y:row.y });
        continue;
      }

      // Lançamento precisa ter valor
      if (!textValor) continue;

      const valStr = textValor.replace('R$','').replace(/\s/g,'');
      const raw = pdfMoneyToNumber(valStr);
      if (!isFinite(raw) || raw === 0) continue;
      const valor = Math.abs(raw);
      const tipo  = raw < 0 ? 'saida' : 'entrada';

      let desc = textDesc;
      if (/^Vendas\s*-\s*Plano\s+de\s+Recebimento/i.test(desc)) desc = 'Recebimento de clientes - cartão - ' + desc;
      else if (/^Pix\s+Recebido/i.test(desc))  desc = 'TED recebida - ' + desc;
      else if (/^Pix\s+Enviado/i.test(desc))   desc = 'PIX enviado - ' + desc;
      else if (/^Pagamento\s+de\s+conta/i.test(desc)) desc = 'Pagamento boleto - ' + desc;
      else if (/^Rendimento\s+da\s+conta/i.test(desc)) desc = 'Rendimento de aplicação - ' + desc;

      const [dd, mm, yyyy] = currentDate.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial,
        sanitizeHistoryText(desc, 240), tipo, valor, 'PagBank', bancoInfo, fname));
    }
  }

  // Primeiro saldo = inicial, último = final
  validationPoints.sort((a,b) => a.page !== b.page ? a.page - b.page : b.y - a.y);
  if (validationPoints.length > 0) {
    validationPoints[0].kind = 'inicial';
    validationPoints[validationPoints.length-1].kind = 'final';
  }
  txns.validationPoints = validationPoints;
  return txns;
}

// ── PARSER PAGBANK EXTRATO FINANCEIRO (A receber) ────────────────────────────
// Layout: x≈20 data+hora, x≈114 UUID, x≈319 descrição, x≈450 conta, x≈510 valor
// Tipos relevantes: "Venda pela Moderninha", "Pagamento de PIX do PagBank a receber"
// Ignorar: "Taxa de intermediação", "Pagamento liberado" (são deduções automáticas)
// ─────────────────────────────────────────────────────────────────────────────
async function parsePagBankFinanceiroPDF(pdfDoc, fname) {
  const txns = [];
  let bancoInfo = 'PagBank';

  const page1Words = await collectPDFWords(pdfDoc, 1);
  const fullText1 = fixEnc(page1Words.map(w => w.text).join(' '));
  const mConta = fullText1.match(/Conta\s+Corrente/i);
  if (mConta) bancoInfo = 'PagBank';

  // Extrai período do extrato
  const mPeriodo = fullText1.match(/Periodo:\s*(\d{2}\/\d{2}\/\d{4})/i);

  // Só importa lançamentos com valor POSITIVO (entradas reais)
  // Ignora: Taxa de intermediação, Pagamento liberado (deduções automáticas)
  const IGNORE_DESC = /^(Taxa de intermediação|Pagamento liberado|Data|Código|Descrição)/i;
  const DATE_HORA   = /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}$/;

  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);

    const rows = [];
    for (const w of words) {
      let row = rows.find(r => Math.abs(r.y - w.y) < 3);
      if (!row) { row = { y: w.y, cols: [] }; rows.push(row); }
      row.cols.push(w);
    }
    rows.sort((a, b) => b.y - a.y);

    for (const row of rows) {
      const colData = row.cols.filter(w => w.x < 110);
      const colDesc = row.cols.filter(w => w.x >= 310 && w.x < 445);
      const colValor = row.cols.filter(w => w.x >= 500);

      const textData  = fixEnc(colData.map(w=>w.text).join(' ').trim());
      const textDesc  = fixEnc(colDesc.map(w=>w.text).join(' ').trim());
      const textValor = fixEnc(colValor.map(w=>w.text).join(' ').trim());

      if (!textData || !DATE_HORA.test(textData)) continue;
      if (!textDesc || IGNORE_DESC.test(textDesc)) continue;
      if (!textValor) continue;

      const raw = pdfMoneyToNumber(textValor);
      if (!isNaN(raw) && raw <= 0) continue; // só entradas positivas
      if (!isFinite(raw) || raw === 0) continue;

      // Monta histórico
      let desc = textDesc;
      if (/Venda\s+pela\s+Moderninha/i.test(desc))  desc = 'Recebimento de clientes - cartão - Venda pela Moderninha PagBank';
      else if (/Pagamento\s+de\s+PIX/i.test(desc))  desc = 'PIX recebido - ' + desc;
      else desc = 'Recebimento de clientes - ' + desc;

      // Data: pega só a parte da data sem hora
      const [datePart] = textData.split(' ');
      const [dd, mm, yyyy] = datePart.split('/');
      const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
      txns.push(makeTxn(date, monthKey, monthLabel, dateSerial,
        sanitizeHistoryText(desc, 240), 'entrada', raw, 'PagBank', bancoInfo, fname));
    }
  }

  txns.validationPoints = [];
  return txns;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── REGISTRO DE BANCOS ──────────────────────────────────────────────────────
// Para adicionar um novo banco PDF:
//   1. Crie parseXxxPDF(pdfDoc, fname, sample) retornando txns[]
//   2. Adicione entrada em BANCO_PARSERS ANTES da entrada "Genérico"
// Cada parser é isolado — mudar um não afeta os outros.
function loadScriptOnce(src, globalName) {
  return new Promise((resolve, reject) => {
    if (globalName && window[globalName]) return resolve(window[globalName]);
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function parseOCRExtratoText(text, fname) {
  const txns = [], bancoLabel = /ita[uú]/i.test(fname) ? 'Itaú' : fname.replace(/\.[^.]+$/, '');
  const lines = text.split(/\r?\n/).map(l => fixEnc(l).replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const line of lines) {
    const dm = line.match(/(\d{2}[\/\.-]\d{2}[\/\.-]\d{4})/);
    if (!dm) continue;
    const values = line.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g);
    if (!values || !values.length) continue;
    const valRawText = values[values.length - 1];
    let raw = pdfMoneyToNumber(valRawText);
    if (!isFinite(raw) || raw === 0) continue;

    const [dd, mm, yyyy] = dm[1].replace(/[.-]/g, '/').split('/');
    const desc = line
      .replace(dm[0], '')
      .replace(valRawText, '')
      .replace(/\b\d{2}[\/\.-]\d{2}[\/\.-]\d{4}\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!desc || /saldo|total|limite|disponivel|disponível/i.test(desc)) continue;

    let tipo = raw < 0 ? 'saida' : 'entrada';
    if (raw > 0 && /enviado|pagamento|boleto|tarifa|d[eé]bito|pix enviado|ted enviada|saque/i.test(desc)) tipo = 'saida';
    if (/receb|cr[eé]dito|deposit|rede|pix recebido|ted recebida/i.test(desc)) tipo = 'entrada';
    const { date, monthKey, monthLabel, dateSerial } = mkMk(dd, mm, yyyy);
    txns.push(makeTxn(date, monthKey, monthLabel, dateSerial, desc, tipo, Math.abs(raw), bancoLabel, bancoLabel, fname));
  }
  return txns;
}

async function parsePDFWithOCR(pdf, fname) {
  const procSub = document.getElementById('proc-sub');
  if (procSub) procSub.textContent = 'PDF sem texto detectado. Rodando OCR...';
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', 'Tesseract');
  const chunks = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    if (procSub) procSub.textContent = `OCR página ${p}/${pdf.numPages}...`;
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const result = await Tesseract.recognize(canvas, 'por');
    chunks.push(result?.data?.text || '');
    canvas.remove();
  }
  if (procSub) procSub.textContent = 'Interpretando texto do OCR...';
  return parseOCRExtratoText(chunks.join('\n'), fname);
}

const BANCO_PARSERS = [
  {
    nome: 'Sicoob',
    detect: (s, fname) => /SICOOB|INTERCREDIS|CREDICITRUS|Cooperativa:|HIST.RICO DE MOVIMENTA..O/i.test(`${s} ${fname}`),
    parse: (pdf, fname, sample) => parseSicoobPDFCoords(pdf, fname, sample),
  },
  {
    nome: 'Unicred',
    detect: (s, fname) => /UNICRED/i.test(`${s} ${fname}`),
    parse: (pdf, fname, sample) => parseUnicredPDF(pdf, fname, sample),
  },
  {
    nome: 'Nubank',
    detect: (s, fname) => /nu\s*pagamentos|nu\s*financeira/i.test(`${s} ${fname}`) || /nubank/i.test(fname),
    parse: (pdf, fname, sample) => parseNubankPDF(pdf, fname, sample),
  },
  {
    nome: 'Banco Original',
    detect: (s, fname) => /banco\s*original|Atendimento\s+Original/i.test(`${s} ${fname}`) || /original/i.test(fname),
    parse: (pdf, fname, sample) => parseBancoOriginalPDF(pdf, fname, sample),
  },
  {
    nome: 'Itaú Extrato Mensal',
    detect: (s, fname) => /Extrato-Mensal|Conta Corrente e Aplicaç(?:ões|oes) Automáticas|Minha conta|saldo em \d{2}\/\d{2}\/\d{2}/i.test(`${s} ${fname}`),
    parse: (pdf, fname, sample) => parseItauMensalPDF(pdf, fname, sample),
  },
  {
    nome: 'Itaú',
    detect: (s, fname) => /ita[uú]/i.test(`${s} ${fname}`),
    parse: (pdf, fname, sample) => parseItauPDF(pdf, fname, sample),
  },
  {
    nome: 'Banco do Brasil',
    detect: (s, fname) => /Banco do Brasil|BB Rende|Extrato de Conta Corrente|Ag[eê]ncia:\s*[\d-]+\s+Conta:/i.test(`${s} ${fname}`),
    parse: (pdf, fname, sample) => parseBancoBrasilPDF(pdf, fname, sample),
  },
  {
    nome: 'Santander',
    detect: (s, fname) => /Santander|Internet Banking Empresarial|ContaMax|EXTRATO SANTANDER/i.test(`${s} ${fname}`),
    parse: (pdf, fname, sample, arrayBuffer) => parseSantanderPDF(pdf, fname, sample, arrayBuffer),
  },
  // ── Adicione novos bancos aqui, antes do Genérico ──
  {
    nome: 'PagBank Extrato Financeiro',
    detect: (s, fname) => /Extrato\s+Financeiro|PagSeguro\s+Internet\s+Institui/i.test(`${s} ${fname}`) || /pagbank.*02|financeiro/i.test(fname),
    parse: (pdf, fname, sample) => parsePagBankFinanceiroPDF(pdf, fname, sample),
  },
  {
    nome: 'PagBank',
    detect: (s, fname) => /PagBank|PagSeguro|Extrato\s+da\s+conta\s+corrente.*Plano\s+de\s+Recebimento/i.test(`${s} ${fname}`) || /pagbank/i.test(fname),
    parse: (pdf, fname, sample) => parsePagBankContaCorrentePDF(pdf, fname, sample),
  },
  // {
  //   nome: 'Bradesco',
  //   detect: s => /bradesco|Banco 237/i.test(s),
  //   parse: (pdf, fname, sample) => parseBradescoPDF(pdf, fname, sample),
  // },
  {
    nome: 'Genérico',
    detect: () => true,
    parse: async (pdf, fname) => {
      let fullText = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        let lastY = null, line = '';
        for (const item of tc.items) {
          const y = Math.round(item.transform[5]);
          if (lastY !== null && Math.abs(y - lastY) > 2) { fullText += line.trimEnd() + '\n'; line = ''; }
          line += item.str; lastY = y;
        }
        if (line) fullText += line + '\n';
      }
      return parsePDFGenerico(fullText, fname);
    },
  },
];

async function detectAndParse(pdfDoc, fname, sample, arrayBuffer) {
  for (const banco of BANCO_PARSERS) {
    if (banco.detect(sample, fname)) {
      console.log('[PDF] ' + banco.nome + ' detectado — ' + fname);
      return banco.parse(pdfDoc, fname, sample, arrayBuffer);
    }
  }
}

// ── LEITURA ───────────────────────────────────────────────────────────────────
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropzone').classList.remove('drag');
  handleFiles(e.dataTransfer.files);
}

async function handleFiles(files) {
  if (!files || !files.length) return;
  showScreen('proc');
  allTxns = [];
  sourceCompanies = {};
  importValidations = {};
  const arr = Array.from(files);
  const fileErrors = [];

  // Monta lista de arquivos na tela de processo
  const pf = document.getElementById('proc-files');
  pf.innerHTML = arr.map((f, i) =>
    `<div class="proc-file" id="pf-${i}"><div class="dot"></div><span>${f.name}</span><span style="margin-left:auto;color:var(--text3);font-size:10px">${(f.size / 1024).toFixed(0)} KB</span></div>`
  ).join('');

  for (let i = 0; i < arr.length; i++) {
    const file = arr[i];
    const el = document.getElementById(`pf-${i}`);
    if (el) el.classList.add('processing');
    document.getElementById('proc-sub').textContent = `${file.name} (${i + 1}/${arr.length})`;

    try {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf')) {
        const txns = await readPDF(file);
        allTxns = allTxns.concat(txns);
      } else {
        const text = await readText(file);
        const txns = parseOFX(fixEnc(text), file.name);
        const empresa = extractStatementCompany(text, file.name);
        txns.forEach(t => { t.empresa = empresa; refreshTxnCategory(t); });
        sourceCompanies[file.name] = empresa;
        importValidations[file.name] = validateImportedStatement(file.name, txns, []);
        allTxns = allTxns.concat(txns);
      }
    } catch (e) {
      console.error(file.name, e);
      fileErrors.push(`${file.name}: ${e.message || e}`);
    }

    const el2 = document.getElementById(`pf-${i}`);
    if (el2) { el2.classList.remove('processing'); el2.classList.add('done'); }
  }

  allTxns = dedupeTxns(allTxns);

  if (allTxns.length === 0) {
    alert(fileErrors.length
      ? `Nenhuma transação encontrada.\n\nDetalhe:\n${fileErrors.join('\n')}`
      : 'Nenhuma transação encontrada. Verifique se os arquivos são válidos.');
    showScreen('upload'); return;
  }
  buildResults(arr);
}

async function readPDF(file) {
  const ab = await file.arrayBuffer();
  const rawAb = ab.slice(0);

  // Tenta InfinitePay (layout tabular por colunas X, detecção por PDF.js normal)
  try {
    const pdf0 = await pdfjsLib.getDocument({ data: rawAb.slice(0) }).promise;
    const s0 = (await (await pdf0.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');
    if (/infinitepay|Relat.rio de movimenta|CLOUDWALK.*25\d{6}/i.test(s0 + ' ' + file.name)) {
      const txnsIP = await parseInfinitePayPDF(pdf0, file.name);
      if (txnsIP?.length) {
        const empresa = extractStatementCompany(txnsIP.headerText || s0, file.name);
        sourceCompanies[file.name] = empresa;
        txnsIP.forEach(t => { t.empresa = empresa; refreshTxnCategory(t); });
        importValidations[file.name] = validateImportedStatement(file.name, txnsIP, []);
        return txnsIP;
      }
    }
  } catch (err) {
    console.warn('[InfinitePay] Leitura ignorada:', err);
  }

  try {
    const txnsCloudWalk = await parseCloudWalkRawPDF(rawAb, file.name);
    if (txnsCloudWalk?.length) {
      const empresa = extractStatementCompany(txnsCloudWalk.headerText || '', file.name);
      sourceCompanies[file.name] = empresa;
      txnsCloudWalk.forEach(t => { t.empresa = empresa; refreshTxnCategory(t); });
      importValidations[file.name] = validateImportedStatement(file.name, txnsCloudWalk, []);
      return txnsCloudWalk;
    }
  } catch (err) {
    console.warn('[InfinitePay] Leitura direta ignorada:', err);
  }
  if (/santander/i.test(file.name)) {
    const txnsSantander = await parseSantanderPDF(null, file.name, '', rawAb);
    if (txnsSantander?.length) {
      const empresa = extractStatementCompany('', file.name);
      sourceCompanies[file.name] = empresa;
      txnsSantander.forEach(t => { t.empresa = empresa; refreshTxnCategory(t); });
      let validationWords = [];
      try { validationWords = await collectSantanderRawWords(rawAb); }
      catch (err) { console.warn('[Santander] Conferência de saldo ignorada:', err); }
      importValidations[file.name] = validateImportedStatement(file.name, txnsSantander, validationWords);
      return txnsSantander;
    }
    throw new Error('Layout Santander detectado, mas nenhum lançamento foi identificado na leitura direta.');
  }

  if (typeof pdfjsLib === 'undefined') {
    throw new Error('PDF.js não carregado — verifique conexão com internet na primeira abertura');
  }
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

  // Lê amostra da pág. 1 para detectar o banco
  const page1 = await pdf.getPage(1);
  const tc1 = await page1.getTextContent();
  const fullSample = tc1.items.map(i => i.str).join(' ');
  // Nubank: identificação fica no rodapé da última página — inclui última página no sample de detecção
  let sampleExtra = '';
  if (pdf.numPages > 1) {
    try {
      const lastPage = await pdf.getPage(pdf.numPages);
      const tcLast = await lastPage.getTextContent();
      sampleExtra = ' ' + tcLast.items.map(i => i.str).join(' ');
    } catch(e) {}
  }
  const sample = fullSample.substring(0, 2000) + sampleExtra;

  // Delega para o parser correto via registro de bancos
  let txns = await detectAndParse(pdf, file.name, sample, rawAb);
  if ((!txns || txns.length === 0) && !sample.trim()) {
    throw new Error('PDF em imagem/OCR não suportado. Envie OFX ou PDF com texto selecionável.');
  }
  const empresa = extractStatementCompany(fullSample, file.name);
  sourceCompanies[file.name] = empresa;
  (txns || []).forEach(t => { t.empresa = empresa; refreshTxnCategory(t); });
  let validationWords = [];
  try {
    validationWords = await collectAllPDFWords(pdf);
  } catch (err) {
    console.warn('[PDF] Conferência de saldo ignorada por falha na leitura complementar:', file.name, err);
  }
  importValidations[file.name] = validateImportedStatement(file.name, txns || [], validationWords);
  return txns || [];
}

function readText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => {
      const c = e.target.result;
      const bad = (c.match(/\uFFFD/g) || []).length;
      if (bad > 5) {
        const r2 = new FileReader();
        r2.onload = e2 => res(e2.target.result);
        r2.onerror = rej;
        r2.readAsText(file, 'iso-8859-1');
      } else res(c);
    };
    r.onerror = rej;
    r.readAsText(file, 'utf-8');
  });
}

async function collectAllPDFWords(pdfDoc) {
  const all = [];
  for (let p = 1; p <= pdfDoc.numPages; p++) {
    const words = await collectPDFWords(pdfDoc, p);
    words.forEach(w => all.push({ ...w, page: p }));
  }
  return all;
}

function signedMoneyFromText(text) {
  const m = String(text || '').match(/-?\s*(?:R\$)?\s*\d{1,3}(?:\.\d{3})*,\d{2}[DC]?|-?\s*(?:R\$)?\s*\d+,\d{2}[DC]?/i);
  if (!m) return null;
  const raw = m[0];
  const val = pdfMoneyToNumber(raw);
  const abs = Math.abs(val);
  if (/D$/i.test(raw) || /^-/.test(raw.trim())) return -abs;
  return abs;
}

function extractBalancePoints(words) {
  if (!words || !words.length) return [];
  const rows = [];
  for (const item of words) {
    let row = rows.find(r => r.page === item.page && Math.abs(r.y - item.y) < 3);
    if (!row) { row = { page: item.page, y: item.y, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  rows.sort((a, b) => a.page - b.page || b.y - a.y);
  const points = [];
  for (const row of rows) {
    const ordered = row.items.slice().sort((a, b) => a.x - b.x);
    const text = ordered.map(i => i.text).join(' ').replace(/\s+/g, ' ').trim();
    let norm = fixEnc(text);
    const isSaldoLine = /saldo/i.test(norm);
    const isBalanceLine = /saldo\s+(anterior|do\s+dia|total\s+dispon[ií]vel\s+dia|final|em\s+conta|em\s+c\.?\s*corrente|final\s+do\s+per[ií]odo)|saldo\s+em\s+\d{2}\/\d{2}\/\d{4}/i.test(norm);
    const santanderLine = norm.match(/^\d{2}\/\d{2}\/\d{4}\s+.*?\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s+[DC]\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*$/i);
    if (santanderLine) {
      points.push({ kind: 'saldo', value: pdfMoneyToNumber(santanderLine[2]), text: norm, date: norm.slice(0, 10), page: row.page, y: row.y });
      continue;
    }
    if (!isSaldoLine || !isBalanceLine) continue;
    if (/bloq|bloqueado|disponível|disponivel|limite|futuro/i.test(norm) && !/saldo (anterior|do dia|total disponível dia|total disponivel dia|final do período|final do periodo)|saldo total dispon/i.test(norm)) continue;

    let value = signedMoneyFromText(norm);
    if (value == null) {
      const nearMoney = words
        .filter(w => w.page === row.page && Math.abs(w.y - row.y) <= 8 && extractPDFMoneyText([w]))
        .sort((a, b) => a.x - b.x)
        .map(w => w.text)
        .join(' ');
      if (nearMoney) {
        norm = `${norm} ${nearMoney}`.replace(/\s+/g, ' ').trim();
        value = signedMoneyFromText(norm);
      }
    }
    if (value == null) continue;

    const dm = norm.match(/(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2})/);
    const kind = /anterior|saldo em\s+\d{2}\/\d{2}\/\d{4}/i.test(norm) ? 'inicial'
      : /final do per|saldo final|saldo em conta|saldo em\s+c\.?\s*corrente/i.test(norm) ? 'final'
      : 'saldo';
    points.push({ kind, value, text: norm, date: dm?.[1] || '', page: row.page, y: row.y });
  }
  return points;
}

function balancePointDateSerial(point, fallbackYear) {
  const raw = String(point?.date || '').trim();
  const m = raw.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?$/);
  if (!m) return null;
  const yyyy = m[3] || fallbackYear;
  if (!yyyy) return null;
  return new Date(Number(yyyy), Number(m[2]) - 1, Number(m[1]));
}

function orderedBalancePoints(points, fallbackYear) {
  return (points || []).slice().sort((a, b) => {
    const da = balancePointDateSerial(a, fallbackYear);
    const db = balancePointDateSerial(b, fallbackYear);
    if (da && db && da.getTime() !== db.getTime()) return da - db;
    if ((a.page || 0) !== (b.page || 0)) return (a.page || 0) - (b.page || 0);
    return (b.y || 0) - (a.y || 0);
  });
}

function deriveInitialFromDailyBalance(firstSaldo, txns, fallbackYear) {
  const dt = balancePointDateSerial(firstSaldo, fallbackYear);
  const baseDate = dt || txns.find(t => t.dateSerial)?.dateSerial || null;
  if (!baseDate) return null;
  const dayMov = txns
    .filter(t => t.dateSerial && t.dateSerial.getFullYear() === baseDate.getFullYear() && t.dateSerial.getMonth() === baseDate.getMonth() && t.dateSerial.getDate() === baseDate.getDate())
    .reduce((s, t) => s + (t.tipo === 'entrada' ? t.value : -t.value), 0);
  const value = Math.round((firstSaldo.value - dayMov) * 100) / 100;
  return { kind: 'inicial', value, text: `Saldo anterior calculado a partir de ${firstSaldo.text || 'saldo do dia'}`, date: firstSaldo.date || '' };
}
function validateImportedStatement(fname, txns, words) {
  const entradas = txns.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.value, 0);
  const saidas = txns.filter(t => t.tipo === 'saida').reduce((s, t) => s + t.value, 0);
  const movimento = Math.round((entradas - saidas) * 100) / 100;
  const orderedTxns = txns.slice().sort((a, b) => a.dateSerial - b.dateSerial);
  const firstTxn = orderedTxns[0] || {};
  const fallbackYear = firstTxn.dateSerial ? String(firstTxn.dateSerial.getFullYear()) : '';
  const rawPoints = (txns.validationPoints && txns.validationPoints.length) ? txns.validationPoints : extractBalancePoints(words);
  const points = orderedBalancePoints(rawPoints, fallbackYear);
  const explicitInitial = points.find(p => p.kind === 'inicial') || null;
  const saldoCandidates = points.filter(p => p.kind === 'final' || p.kind === 'saldo');
  let inicial = explicitInitial;
  if (!inicial && saldoCandidates.length) {
    inicial = deriveInitialFromDailyBalance(saldoCandidates[0], orderedTxns, fallbackYear);
    if (!inicial && saldoCandidates.length === 1) {
      inicial = { kind: 'inicial', value: Math.round((saldoCandidates[0].value - movimento) * 100) / 100, text: 'Saldo anterior calculado pelo movimento do período', date: saldoCandidates[0].date || '' };
    }
  }

  const expectedFinal = inicial ? Math.round((inicial.value + movimento) * 100) / 100 : null;
  const explicitFinal = points.find(p => p.kind === 'final') || null;
  let final = null;
  if (explicitFinal) final = explicitFinal;
  else if (!explicitInitial && saldoCandidates.length) final = saldoCandidates[saldoCandidates.length - 1];
  else if (expectedFinal == null) final = [...points].reverse().find(p => p.kind === 'final') || null;
  else if (saldoCandidates.length) final = saldoCandidates.sort((a, b) => Math.abs(a.value - expectedFinal) - Math.abs(b.value - expectedFinal))[0] || null;
  else final = { kind: 'final', value: expectedFinal, text: 'Saldo final calculado pelo movimento do período', date: '' };

  let diff = inicial && final ? Math.round((movimento - (final.value - inicial.value)) * 100) / 100 : null;
  const onlyDailyBalances = !explicitInitial && !explicitFinal && saldoCandidates.length > 1;
  if (onlyDailyBalances && diff != null && Math.abs(diff) > 1) {
    inicial = null;
    final = null;
    diff = null;
  }
  return {
    fname,
    count: txns.length,
    entradas: Math.round(entradas * 100) / 100,
    saidas: Math.round(saidas * 100) / 100,
    movimento,
    saldoAnterior: inicial?.value ?? null,
    saldoFinal: final?.value ?? null,
    bankKey: firstTxn.bancoInfo || firstTxn.banco || fname,
    startTime: firstTxn.dateSerial ? firstTxn.dateSerial.getTime() : 0,
    endTime: orderedTxns.at(-1)?.dateSerial ? orderedTxns.at(-1).dateSerial.getTime() : 0,
    diff,
    status: diff == null ? 'sem-saldo' : Math.abs(diff) <= 1 ? 'ok' : 'erro'
  };
}
// ── BUILD RESULTS ─────────────────────────────────────────────────────────────
function buildResults(fileArr) {
  allTxns.sort((a, b) => a.dateSerial - b.dateSerial);
  const months = [...new Set(allTxns.map(t => t.monthKey))].sort();
  const bancos = [...new Set(allTxns.map(t => t.banco))].filter(Boolean);

  document.getElementById('res-title').textContent =
    `${allTxns.length.toLocaleString('pt-BR')} transações · ${months.length} ${months.length === 1 ? 'mês' : 'meses'}`;
  document.getElementById('file-chips').innerHTML =
    fileArr.map(f => `<span class="file-chip">📄 ${f.name}</span>`).join('');
  renderCompanyCheck(fileArr);
  document.getElementById('btn-novo').style.display = 'block';

  // Month selector
  document.getElementById('month-row').innerHTML =
    '<button class="month-btn active" onclick="selMes(this,\'\')">Todos</button>' +
    months.map(mk => `<button class="month-btn" onclick="selMes(this,'${mk}')">${allTxns.find(t => t.monthKey === mk)?.monthLabel || mk}</button>`).join('');

  // Filters
  const cats = [...new Set(allTxns.map(t => t.cat))].sort();
  document.getElementById('f-cat').innerHTML = '<option value="">Todas as categorias</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  document.getElementById('f-banco').innerHTML = '<option value="">Todos os bancos</option>' + bancos.map(b => `<option value="${b}">${b}</option>`).join('');
  const mOpts = '<option value="">Todos os meses</option>' + months.map(mk => `<option value="${mk}">${allTxns.find(t => t.monthKey === mk)?.monthLabel || mk}</option>`).join('');
  document.getElementById('f-trf-mes').innerHTML = mOpts;

  renderAll();
  showScreen('results');
  document.getElementById('hdr-info').textContent = `${fileArr.length} arquivo(s) · ${allTxns.length} lançamentos`;
}

function renderCompanyCheck(fileArr) {
  const el = document.getElementById('company-check');
  const issues = renderImportValidationIssues(fileArr);
  const found = fileArr
    .map(f => ({ file: f.name, empresa: sourceCompanies[f.name] || '' }))
    .filter(x => x.empresa);
  const distinct = [...new Set(found.map(x => x.empresa.toLowerCase()))];
  if (!found.length) {
    el.className = 'company-check';
    el.innerHTML = 'Empresa do cabeçalho: não identificada nos arquivos enviados.' + issues;
    return;
  }
  if (distinct.length === 1 && found.length === fileArr.length) {
    el.className = 'company-check ok';
    el.innerHTML = `Empresa conferida nos cabeçalhos: ${found[0].empresa}.` + issues;
    return;
  }
  if (distinct.length === 1) {
    el.className = 'company-check';
    el.innerHTML = `Empresa identificada em parte dos arquivos: ${found[0].empresa}. Alguns extratos não trouxeram cabeçalho suficiente.` + issues;
    return;
  }
  el.className = 'company-check warn';
  el.innerHTML = 'Atenção: os cabeçalhos indicam empresas diferentes. Confira antes de exportar.' + issues;
}

function renderImportValidationHTML(fileArr) {
  const vals = fileArr.map(f => importValidations[f.name]).filter(Boolean);
  if (!vals.length) return '';
  return '<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px">' + vals.map(v => {
    const cls = v.status === 'ok' ? 'var(--green)' : v.status === 'erro' ? 'var(--red)' : 'var(--text2)';
    const status = v.status === 'ok' ? 'saldo validado'
      : v.status === 'erro' ? `diferença R$ ${fmtBRL(v.diff)}`
      : 'saldo não detectado no extrato';
    const saldos = v.saldoAnterior != null && v.saldoFinal != null
      ? ` · saldo ant. R$ ${fmtBRL(v.saldoAnterior)} · saldo final R$ ${fmtBRL(v.saldoFinal)}`
      : '';
    return `<span style="color:${cls}">${v.fname}: ${v.count} lanç. · entradas R$ ${fmtBRL(v.entradas)} · saídas R$ ${fmtBRL(v.saidas)} · mov. R$ ${fmtBRL(v.movimento)}${saldos} · ${status}</span>`;
  }).join('') + '</div>';
}

function renderImportValidationIssues(fileArr) {
  const vals = fileArr.map(f => importValidations[f.name]).filter(Boolean);
  if (!vals.length) return '';
  const erros = vals.filter(v => v.status === 'erro');
  const parts = [];
  if (erros.length) {
    parts.push('Diferença em: ' + erros.map(v => `${v.fname} (R$ ${fmtBRL(v.diff)})`).join('; '));
  }
  if (!parts.length) return '';
  return `<div style="margin-top:6px;color:var(--red);font-weight:600">${parts.join(' · ')}</div>`;
}

function selMes(btn, mk) {
  document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentMes = mk;
  renderAll();
}

function base() { return currentMes ? allTxns.filter(x => x.monthKey === currentMes) : allTxns; }

function filt() {
  let t = base();
  const tipo = document.getElementById('f-tipo').value;
  const cat = document.getElementById('f-cat').value;
  const banco = document.getElementById('f-banco').value;
  if (tipo) t = t.filter(x => x.tipo === tipo);
  if (cat) t = t.filter(x => x.cat === cat);
  if (banco) t = t.filter(x => x.banco === banco);
  return t;
}

function renderAll() {
  renderMetrics();
  renderResumo();
  renderCats();
  renderTxns();
  renderTrf();
  renderMaiores();
  renderExport();
}

// ── MÉTRICAS ─────────────────────────────────────────────────────────────────
function currentValidationSummary() {
  const t = base();
  const sources = [...new Set(t.map(x => x.source).filter(Boolean))];
  const vals = sources.map(src => importValidations[src]).filter(Boolean);
  if (!vals.length) return null;

  const withBalance = vals.filter(v => v.saldoAnterior != null && v.saldoFinal != null);
  if (!withBalance.length) return { saldoAnterior: null, saldoFinal: null, diff: null, status: 'sem-saldo' };

  if (withBalance.length === 1) return withBalance[0];

  const groups = {};
  withBalance.forEach(v => {
    const key = v.bankKey || v.fname;
    (groups[key] ||= []).push(v);
  });
  const ranges = Object.values(groups).map(group => {
    const ordered = group.slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    return {
      saldoAnterior: ordered[0].saldoAnterior,
      saldoFinal: ordered[ordered.length - 1].saldoFinal
    };
  });
  const saldoAnterior = ranges.reduce((s, v) => s + v.saldoAnterior, 0);
  const saldoFinal = ranges.reduce((s, v) => s + v.saldoFinal, 0);
  const diff = withBalance.reduce((s, v) => s + (v.diff || 0), 0);
  return {
    saldoAnterior: Math.round(saldoAnterior * 100) / 100,
    saldoFinal: Math.round(saldoFinal * 100) / 100,
    diff: Math.round(diff * 100) / 100,
    status: Math.abs(diff) <= 1 ? 'ok' : 'erro'
  };
}

function metricMoneyHTML(label, val, cls = '') {
  if (val == null || !isFinite(val)) {
    return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value blue">--</div></div>`;
  }
  const color = cls || (val >= 0 ? 'green' : 'red');
  return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value money ${color}" title="R$ ${fmtBRL(val)}">R$ ${fmtBRL(val)}</div></div>`;
}

function renderMetrics() {
  const t = base();
  const ent = t.filter(x => x.tipo === 'entrada').reduce((a, x) => a + x.value, 0);
  const sai = t.filter(x => x.tipo === 'saida').reduce((a, x) => a + x.value, 0);
  const sal = ent - sai;
  const val = currentValidationSummary();
  const diffCls = val?.diff == null ? 'blue' : Math.abs(val.diff) <= 1 ? 'green' : 'red';
  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="metric-label">Entradas</div><div class="metric-value money green" title="R$ ${fmtBRL(ent)}">R$ ${fmtBRL(ent)}</div></div>
    <div class="metric"><div class="metric-label">Saídas</div><div class="metric-value money red" title="R$ ${fmtBRL(sai)}">R$ ${fmtBRL(sai)}</div></div>
    <div class="metric"><div class="metric-label">Saldo</div><div class="metric-value money ${sal >= 0 ? 'green' : 'red'}" title="R$ ${fmtBRL(sal)}">R$ ${fmtBRL(sal)}</div></div>
    <div class="metric"><div class="metric-label">Lançamentos</div><div class="metric-value blue">${t.length.toLocaleString('pt-BR')}</div></div>
    ${metricMoneyHTML('Saldo anterior', val?.saldoAnterior, 'blue')}
    ${metricMoneyHTML('Saldo final', val?.saldoFinal)}
    ${metricMoneyHTML('Diferença', val?.diff, diffCls)}`;
}

// ── RESUMO ────────────────────────────────────────────────────────────────────
function renderResumo() {
  const months = [...new Set(allTxns.map(t => t.monthKey))].sort();
  const show = currentMes ? [currentMes] : months;
  const labels = show.map(mk => allTxns.find(t => t.monthKey === mk)?.monthLabel || mk);
  const entD = show.map(mk => allTxns.filter(t => t.monthKey === mk && t.tipo === 'entrada').reduce((a, t) => a + t.value, 0));
  const saiD = show.map(mk => allTxns.filter(t => t.monthKey === mk && t.tipo === 'saida').reduce((a, t) => a + t.value, 0));
  if (chartR) chartR.destroy();
  const ctx = document.getElementById('chartResumo').getContext('2d');
  const gradEnt = ctx.createLinearGradient(0, 0, 0, 300);
  gradEnt.addColorStop(0, 'rgba(0,184,148,.42)');
  gradEnt.addColorStop(1, 'rgba(0,184,148,.10)');
  const gradSai = ctx.createLinearGradient(0, 0, 0, 300);
  gradSai.addColorStop(0, 'rgba(239,71,111,.36)');
  gradSai.addColorStop(1, 'rgba(239,71,111,.10)');
  chartR = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Entradas', data: entD, backgroundColor: gradEnt, borderColor: '#00b894', borderWidth: 1.5, borderRadius: 8, borderSkipped: false, maxBarThickness: 34 },
      { label: 'Saídas', data: saiD, backgroundColor: gradSai, borderColor: '#ef476f', borderWidth: 1.5, borderRadius: 8, borderSkipped: false, maxBarThickness: 34 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 8, right: 2, bottom: 0, left: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#e8eaf0',
          borderColor: 'rgba(255,255,255,.12)',
          borderWidth: 1,
          padding: 10,
          displayColors: true,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: R$ ${fmtBRL(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          border: { display: false },
          ticks: { callback: v => 'R$ ' + Number(v).toLocaleString('pt-BR'), font: { size: 11, family: 'DM Sans' }, color: '#6b7894', padding: 8 },
          grid: { color: 'rgba(101,116,140,.18)', drawTicks: false }
        },
        x: {
          border: { display: false },
          grid: { display: false },
          ticks: { font: { size: 11, family: 'DM Sans', weight: 600 }, color: '#6b7894', autoSkip: false, maxRotation: 0, padding: 8 }
        }
      }
    }
  });
}

// ── CATEGORIAS ────────────────────────────────────────────────────────────────
function renderCats() {
  const t = base();
  const sai = t.filter(x => x.tipo === 'saida');
  const tot = sai.reduce((a, x) => a + x.value, 0);
  const bycat = {};
  sai.forEach(x => { bycat[x.cat] = (bycat[x.cat] || 0) + x.value; });
  const sorted = Object.entries(bycat).sort((a, b) => b[1] - a[1]);
  document.getElementById('cat-grid').innerHTML = sorted.map(([cat, val]) => {
    const pct = tot > 0 ? (val / tot * 100).toFixed(1) : 0;
    const col = getCatColor(cat);
    return `<div class="cat-card" onclick='openCategory(${JSON.stringify(cat)})' title="Ver lançamentos de ${cat}">
      <div class="cat-name">${cat}</div>
      <div class="cat-val" style="color:${col}">R$ ${fmtBRL(val)}</div>
      <div class="cat-bar" style="background:${col};width:${pct}%;max-width:100%"></div>
      <div class="cat-pct">${pct}% das saídas · clique para ver</div>
    </div>`;
  }).join('');
  if (chartC) chartC.destroy();
  chartC = new Chart(document.getElementById('chartCat'), {
    type: 'doughnut',
    data: { labels: sorted.map(([c]) => c), datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: sorted.map(([c]) => getCatColor(c)), borderWidth: 0, hoverOffset: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'right', labels: { font: { size: 11 }, color: '#7c8299', boxWidth: 12, padding: 10 } } }
    }
  });
}

// ── TABELA TRANSAÇÕES ─────────────────────────────────────────────────────────
function openCategory(cat) {
  const tipoEl = document.getElementById('f-tipo');
  const catEl = document.getElementById('f-cat');
  const bancoEl = document.getElementById('f-banco');
  if (tipoEl) tipoEl.value = 'saida';
  if (catEl) {
    const exists = [...catEl.options].some(opt => opt.value === cat);
    if (!exists) catEl.add(new Option(cat, cat));
    catEl.value = cat;
  }
  if (bancoEl) bancoEl.value = '';
  const tabBtn = [...document.querySelectorAll('.tab')].find(b => b.textContent.trim().startsWith('Transa'));
  if (tabBtn) switchTab('transacoes', tabBtn);
  renderTxns();
}

function descHTML(x) {
  const full = x.descFull || x.desc || '—';
  const safeFull = String(full).replace(/"/g, '&quot;');
  if (x.nome) {
    let h = `<div class="txn-desc" title="${safeFull}">${x.nome}</div>`;
    const m = [];
    if (x.cnpj) m.push('CNPJ ' + x.cnpj);
    if (x.meio) m.push(x.meio);
    if (m.length) h += `<div class="txn-meta" title="${safeFull}">${m.join(' · ')}</div>`;
    return h;
  }
  return `<div class="txn-desc" title="${safeFull}">${full}</div>${x.meio ? `<div class="txn-meta">${x.meio}</div>` : ''}`;
}

function renderTxns() {
  const t = filt();
  document.getElementById('tbody-txns').innerHTML = t.slice(0, 500).map(x => {
    const col = getCatColor(x.cat);
    const tipoBadge = x.tipo === 'entrada'
      ? `<span class="badge" style="background:${getCatColor('Recebimento de clientes')}22;color:${getCatColor('Recebimento de clientes')}">Entrada</span>`
      : `<span class="badge" style="background:var(--red-dim);color:var(--red)">Saída</span>`;
    return `<tr>
      <td style="white-space:nowrap;font-family:'DM Mono',monospace;font-size:11px;color:var(--text2)">${x.date}</td>
      <td style="min-width:360px;max-width:520px">${descHTML(x)}<span class="badge txn-cat" style="background:${col}22;color:${col};display:inline-block">${x.cat}</span></td>
      <td style="font-size:11px;color:var(--text2);white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis">${x.bancoInfo || '—'}</td>
      <td>${tipoBadge}</td>
      <td style="text-align:right;font-weight:500;font-family:'DM Mono',monospace;white-space:nowrap;color:${x.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${x.tipo === 'entrada' ? '+' : '-'} R$ ${fmtBRL(x.value)}</td>
    </tr>`;
  }).join('');
  document.getElementById('txns-count').textContent = `Exibindo ${Math.min(t.length, 500).toLocaleString('pt-BR')} de ${t.length.toLocaleString('pt-BR')} transações`;
}

// ── TRANSFERÊNCIAS ────────────────────────────────────────────────────────────
function renderTrf() {
  const dir = document.getElementById('f-trf-dir').value;
  const mk = document.getElementById('f-trf-mes').value;
  let t = allTxns.filter(x => isTrf(x.cat));
  if (mk) t = t.filter(x => x.monthKey === mk);
  if (dir) t = t.filter(x => x.tipo === dir);
  t = t.slice().sort((a, b) => b.dateSerial - a.dateSerial || b.value - a.value);
  document.getElementById('tbody-trf').innerHTML = t.slice(0, 300).map(x => `<tr>
    <td style="white-space:nowrap;font-family:'DM Mono',monospace;font-size:11px;color:var(--text2)">${x.date}</td>
    <td style="max-width:280px">
      ${x.nome ? `<div style="font-size:12px;font-weight:500">${x.nome}</div><div style="font-size:10px;color:var(--text2);margin-top:1px">${x.cnpj ? 'CNPJ ' + x.cnpj + ' · ' : ''}${x.meio || ''}</div>` : ''}
      <div style="font-size:11px;color:var(--text2);margin-top:2px;word-break:break-word">${x.descFull || x.desc || '—'}</div>
    </td>
    <td style="font-size:11px;color:var(--text2);white-space:nowrap">${x.bancoInfo || '—'}</td>
    <td>${x.tipo === 'entrada' ? `<span class="badge" style="background:var(--green-dim);color:var(--green)">Recebida</span>` : `<span class="badge" style="background:var(--red-dim);color:var(--red)">Enviada</span>`}</td>
    <td style="text-align:right;font-weight:500;font-family:'DM Mono',monospace;white-space:nowrap;color:${x.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${x.tipo === 'entrada' ? '+' : '-'} R$ ${fmtBRL(x.value)}</td>
  </tr>`).join('');
  document.getElementById('trf-count').textContent = `${t.length.toLocaleString('pt-BR')} transferência(s)`;
}

// ── MAIORES ───────────────────────────────────────────────────────────────────
function renderMaiores() {
  const t = base();
  const sai = t.filter(x => x.tipo === 'saida').sort((a, b) => b.value - a.value).slice(0, 10);
  const ent = t.filter(x => x.tipo === 'entrada').sort((a, b) => b.value - a.value).slice(0, 10);
  const maxS = sai[0]?.value || 1, maxE = ent[0]?.value || 1;
  const li = (x, maxV, barCol, valCol) => `<li class="top-item">
    <div class="top-desc">
      <div class="top-name">${(x.nome || x.desc || '').substring(0, 65)}</div>
      <div class="top-bar" style="background:${barCol};width:${(x.value / maxV * 100).toFixed(0)}%"></div>
      <div class="top-meta">${x.date} · ${x.cat}</div>
    </div>
    <div class="top-val" style="color:${valCol}">R$ ${fmtBRL(x.value)}</div>
  </li>`;
  document.getElementById('top-saidas').innerHTML = sai.map(x => li(x, maxS, '#f05c5c', 'var(--red)')).join('');
  document.getElementById('top-entradas').innerHTML = ent.map(x => li(x, maxE, '#2dd4a0', 'var(--green)')).join('');
}

// ── EXPORTAR ──────────────────────────────────────────────────────────────────
function renderExport() {
  const sel = document.getElementById('export-bank');
  const bancos = [...new Set(base().map(x => x.bancoInfo || x.banco).filter(Boolean))].sort();
  const prev = sel?.value || '';
  if (sel) {
    sel.innerHTML = '<option value="">Todos os bancos</option>' + bancos.map(b => `<option value="${b}">${b}</option>`).join('');
    sel.value = bancos.includes(prev) ? prev : '';
  }
  const t = exportBase();
  document.getElementById('tbody-export').innerHTML = t.map((x, i) => `<tr>
    <td style="white-space:nowrap;font-family:'DM Mono',monospace;font-size:11px">${x.date}</td>
    <td style="font-size:11px;color:var(--text2);max-width:160px;word-break:break-word">${cleanDominioText(x.codDebito)}</td>
    <td style="font-size:11px;color:var(--text2);max-width:160px;word-break:break-word">${cleanDominioText(x.codCredito)}</td>
    <td style="text-align:right;font-weight:500;font-family:'DM Mono',monospace;font-size:11px;color:${x.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}">${fmtBRL(x.value)}</td>
    <td style="font-size:11px;max-width:200px;word-break:break-word;color:var(--text2)">${dominioComplemento(x)}</td>
    <td style="font-size:11px;color:var(--text2)">${i === 0 ? '1' : ''}</td>
  </tr>`).join('');
}

function exportBase() {
  const bank = document.getElementById('export-bank')?.value || '';
  let t = base();
  if (bank) t = t.filter(x => (x.bancoInfo || x.banco) === bank);
  return t;
}

const DOMINIO_HEADERS = [
  'Data',
  'Cód. Conta Débito',
  'Cód. Conta Crédito',
  'Valor',
  'Cód. Histórico',
  'Complemento Histórico',
  'Inicia Lote',
  'Código Matriz/Filial',
  'Centro de Custo Débito',
  'Centro de Custo Crédito'
];

function cleanDominioText(s) {
  return sanitizeHistoryText(s, 240);
}

function dominioComplemento(x) {
  const raw = cleanDominioText(x.complemento || x.desc || x.descFull);
  const onlyDoc = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$|^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(raw.trim());
  const tooShort = raw.trim().length < 8;
  if (onlyDoc || tooShort) {
    return cleanDominioText([x.cat, raw].filter(Boolean).join(' - '));
  }
  return raw;
}

function dominioRow(x, index = 0) {
  return [
    x.date,
    cleanDominioText(x.codDebito),
    cleanDominioText(x.codCredito),
    Number((+x.value || 0).toFixed(2)),
    '',
    dominioComplemento(x),
    index === 0 ? 1 : '',
    '',
    '',
    ''
  ];
}

function dominioTSV() {
  const rows = [DOMINIO_HEADERS, ...exportBase().map((x, i) => dominioRow(x, i))];
  return rows.map(row => row.map(v => {
    const value = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : String(v ?? '');
    return value.replace(/[\t\r\n]/g, ' ');
  }).join('\t')).join('\n');
}

async function copiarDominioExcel() {
  const s = document.getElementById('export-status');
  const text = dominioTSV();
  try {
    await navigator.clipboard.writeText(text);
    s.style.color = 'var(--green)';
    s.textContent = `Copiado para a área de transferência — cole na Plan1 do modelo Domínio.`;
  } catch (e) {
    s.style.color = 'var(--gold)';
    s.innerHTML = '<div style="margin-bottom:8px">Não consegui copiar automaticamente. Selecione o quadro abaixo e copie com Ctrl+C.</div>' +
      `<textarea style="width:100%;height:220px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:10px;font-family:'DM Mono',monospace;font-size:11px">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</textarea>`;
  }
}

async function saveFile(blob, filename, okMessage) {
  const s = document.getElementById('export-status');
  s.style.color = 'var(--green)';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.textContent = `Clique aqui para baixar ${filename}`;
  a.style.color = 'var(--green)';
  a.style.fontWeight = '600';
  a.style.textDecoration = 'underline';
  a.onclick = () => setTimeout(() => URL.revokeObjectURL(url), 30000);
  s.innerHTML = `Arquivo pronto (${(blob.size / 1024).toFixed(1)} KB). `;
  s.appendChild(a);
}

async function downloadExcel() {
  const t = exportBase();
  if (typeof XLSX === 'undefined') {
    document.getElementById('export-status').textContent = 'SheetJS não carregou. Use o CSV ou abra com internet e tente de novo.';
    return;
  }
  const wsData = [DOMINIO_HEADERS, ...t.map((x, i) => dominioRow(x, i))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  for (let r = 1; r < wsData.length; r++) {
    const c = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (c) {
      c.t = 'n';
      c.z = '#,##0.00';
    }
  }
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 55 }, { wch: 10 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Plan1');
  const mes = (currentMes || 'completo').replace('-', '_');
  const bankSlug = (document.getElementById('export-bank')?.value || 'todos').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const filename = `lancamentos_dominio_${mes}_${bankSlug}.xlsx`;
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    await saveFile(blob, filename, `Excel salvo - ${filename} (${t.length.toLocaleString('pt-BR')} lançamentos).`);
    return;
    const url = URL.createObjectURL(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    const s = document.getElementById('export-status');
    s.style.color = 'var(--green)';
    s.textContent = `Download iniciado — ${filename} (${t.length.toLocaleString('pt-BR')} lançamentos).`;
  } catch (e) {
    console.error(e);
    document.getElementById('export-status').textContent = 'Erro ao gerar Excel. Tente o CSV.';
  }
}

async function downloadCSV() {
  const t = exportBase();
  const lines = t.map((x, i) => {
    const row = dominioRow(x, i);
    row[3] = row[3].toFixed(2).replace('.', ',');
    return row.map(v => cleanDominioText(v)).join(';');
  });
  const csv = '\uFEFF' + [DOMINIO_HEADERS.join(';'), ...lines].join('\r\n');
  const bankSlug = (document.getElementById('export-bank')?.value || 'todos').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const csvName = `lancamentos_dominio_${(currentMes || 'completo').replace('-', '_')}_${bankSlug}.csv`;
  await saveFile(new Blob([csv], { type: 'text/csv;charset=utf-8' }), csvName, `CSV salvo - ${csvName} (${t.length.toLocaleString('pt-BR')} lançamentos).`);
  return;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lancamentos_dominio_${(currentMes || 'completo').replace('-', '_')}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  const s = document.getElementById('export-status');
  s.style.color = 'var(--green)';
  s.textContent = `✓ CSV gerado — ${t.length.toLocaleString('pt-BR')} lançamentos.`;
}

// ── UTILS ─────────────────────────────────────────────────────────────────────
function ofxDate(d) {
  const [dd, mm, yyyy] = d.split('/');
  return `${yyyy}${mm}${dd}120000[-3:BRT]`;
}

function escapeOFX(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
}

function ofxBankId(banco) {
  const b = String(banco || '');
  if (/brasil/i.test(b)) return '001';
  if (/ita/i.test(b)) return '341';
  if (/sicoob/i.test(b)) return '756';
  if (/unicred/i.test(b)) return '136';
  return '000';
}

function ofxAcctId(info) {
  const s = String(info || '');
  const m = s.match(/(?:Cc\.|Conta:?\s*)([\d.-]+)/i) || s.match(/(\d[\d.-]{3,})/);
  return (m?.[1] || s || 'CONTA').replace(/[^\dA-Za-z.-]/g, '');
}

function ofxFitId(x, i) {
  return `${x.source || 'APP'}-${x.date}-${i}-${Math.round(x.value * 100)}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 80);
}

async function downloadOFX() {
  const t = exportBase().slice().sort((a, b) => a.dateSerial - b.dateSerial);
  if (!t.length) return;
  const contas = [...new Set(t.map(x => `${x.banco || ''}|${x.bancoInfo || ''}`))];
  if (contas.length > 1) {
    const s = document.getElementById('export-status');
    s.style.color = 'var(--red)';
    s.textContent = 'OFX deve ser gerado por uma conta/banco por vez. Filtre um banco ou importe apenas um extrato dessa conta.';
    return;
  }
  const first = t[0], last = t[t.length - 1];
  const bankName = cleanDominioText(first.banco || 'Banco');
  const bankId = ofxBankId(first.banco);
  const acctId = ofxAcctId(first.bancoInfo || first.banco || 'CONTA');
  const val = currentValidationSummary();
  const ledger = val?.saldoFinal != null
    ? val.saldoFinal
    : t.reduce((s, x) => s + (x.tipo === 'entrada' ? x.value : -x.value), 0);
  const stmt = t.map((x, i) => {
    const amt = (x.tipo === 'entrada' ? x.value : -x.value).toFixed(2);
    const fitid = ofxFitId(x, i);
    return `<STMTTRN>
<TRNTYPE>${x.tipo === 'entrada' ? 'CREDIT' : 'DEBIT'}
<DTPOSTED>${ofxDate(x.date)}
<TRNAMT>${amt}
<FITID>${escapeOFX(fitid)}
<NAME>${escapeOFX(x.cat)}
<MEMO>${escapeOFX(x.complemento || x.descFull || x.desc)}
</STMTTRN>`;
  }).join('\n');
  const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:UTF-8
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>${ofxDate(last.date)}<LANGUAGE>POR<FI><ORG>${escapeOFX(bankName)}<FID>${escapeOFX(bankId)}</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>${escapeOFX(bankId)}<ACCTID>${escapeOFX(acctId)}<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>${ofxDate(first.date)}<DTEND>${ofxDate(last.date)}
${stmt}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>${ledger.toFixed(2)}<DTASOF>${ofxDate(last.date)}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;
  const name = `extrato_convertido_${(currentMes || 'completo').replace('-', '_')}.ofx`;
  await saveFile(new Blob([ofx], { type: 'application/x-ofx;charset=utf-8' }), name, name);
}

function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
}

function showScreen(s) {
  ['upload', 'proc', 'results'].forEach(n => document.getElementById('screen-' + n).classList.remove('active'));
  document.getElementById('screen-' + s).classList.add('active');
}

function resetApp() {
  allTxns = []; currentMes = '';
  sourceCompanies = {};
  importValidations = {};
  document.getElementById('btn-novo').style.display = 'none';
  document.getElementById('hdr-info').textContent = '';
  if (chartR) chartR.destroy(); chartR = null;
  if (chartC) chartC.destroy(); chartC = null;
  showScreen('upload');
}
