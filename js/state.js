// ==== STATE & PERSISTENCE ===================================================
// Todo o dado do app vive no objeto `App.state`, persistido no localStorage
// a cada mudança via saveState(). É a única fonte de verdade; cada render()
// reconstrói o DOM a partir dele. Suporta múltiplos perfis: cada perfil tem
// sua própria chave de armazenamento, e um pequeno registro separado guarda
// a lista de perfis e qual está ativo.
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils;

  var STORAGE_PREFIX = "controle-financeiro:v2";
  var STORAGE_KEY_LEGADO = STORAGE_PREFIX; // formato antigo, sem perfil
  var PERFIS_KEY = "controle-financeiro:perfis";
  var CATEGORIAS_FIXAS = ["Alimentação", "Transporte", "Moradia", "Educação", "Lazer", "Outros"];
  var MEIOS = ["Pix", "Cartão de crédito", "Dinheiro", "Boleto"];
  var CORES_CATEGORIA = ["#0E6B5C", "#B96A22", "#A83B32", "#5B7FBB", "#8B5FBF", "#3E8A72", "#C9944A", "#6B7280"];
  var CORES_CARTAO = ["#0E6B5C", "#8B5FBF", "#A83B32", "#B96A22", "#5B7FBB", "#3E8A72", "#C9944A", "#2F6690"];

  // ---- Perfis ----
  function lerRegistroPerfis() {
    try {
      var raw = localStorage.getItem(PERFIS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn("perfis read failed", e); }
    return null;
  }
  function salvarRegistroPerfis(reg) {
    try { localStorage.setItem(PERFIS_KEY, JSON.stringify(reg)); }
    catch (e) { console.warn("perfis write failed", e); }
  }
  function chaveDoPerfil(nome) { return STORAGE_PREFIX + ":perfil:" + nome; }

  function inicializarPerfis() {
    var reg = lerRegistroPerfis();
    if (reg && reg.lista && reg.lista.length) return reg;
    // Primeira vez com o sistema de perfis: migra o storage antigo (sem
    // perfil) para um perfil "Principal", sem apagar nada.
    reg = { lista: ["Principal"], atual: "Principal" };
    var legado = null;
    try { legado = localStorage.getItem(STORAGE_KEY_LEGADO); } catch (e) {}
    if (legado) {
      try { localStorage.setItem(chaveDoPerfil("Principal"), legado); } catch (e) {}
    }
    salvarRegistroPerfis(reg);
    return reg;
  }

  var perfis = inicializarPerfis();

  function perfilAtual() { return perfis.atual; }
  function listaPerfis() { return perfis.lista.slice(); }
  function criarPerfil(nome) {
    nome = (nome || "").trim();
    if (!nome || perfis.lista.indexOf(nome) !== -1) return false;
    perfis.lista.push(nome);
    salvarRegistroPerfis(perfis);
    return true;
  }
  function renomearPerfil(nomeAntigo, nomeNovo) {
    nomeNovo = (nomeNovo || "").trim();
    if (!nomeNovo || perfis.lista.indexOf(nomeNovo) !== -1) return false;
    var idx = perfis.lista.indexOf(nomeAntigo);
    if (idx === -1) return false;
    try {
      var raw = localStorage.getItem(chaveDoPerfil(nomeAntigo));
      if (raw) localStorage.setItem(chaveDoPerfil(nomeNovo), raw);
      localStorage.removeItem(chaveDoPerfil(nomeAntigo));
    } catch (e) { console.warn("renomear perfil failed", e); }
    perfis.lista[idx] = nomeNovo;
    if (perfis.atual === nomeAntigo) perfis.atual = nomeNovo;
    salvarRegistroPerfis(perfis);
    return true;
  }
  function excluirPerfil(nome) {
    if (perfis.lista.length <= 1) return false;
    var idx = perfis.lista.indexOf(nome);
    if (idx === -1) return false;
    perfis.lista.splice(idx, 1);
    try { localStorage.removeItem(chaveDoPerfil(nome)); } catch (e) {}
    if (perfis.atual === nome) perfis.atual = perfis.lista[0];
    salvarRegistroPerfis(perfis);
    return true;
  }
  function trocarPerfil(nome) {
    if (perfis.lista.indexOf(nome) === -1) return false;
    perfis.atual = nome;
    salvarRegistroPerfis(perfis);
    App.state = loadState();
    return true;
  }

  function defaultState() {
    return {
      salario: 0,
      salarios: {},             // { "YYYY-MM": valor } — renda fixa por mês
      receitasExtras: [],       // [{id, titulo, valor, mes: "YYYY-MM"}]
      cartoes: [],
      lancamentos: [],
      categoriasCustom: [],     // categorias extras criadas pelo usuário
      metas: {},                // { "YYYY-MM": valorAlvo }
      metasCategoria: {},       // { "YYYY-MM": { categoria: valorAlvo } }
      pinHash: null,            // trava de acesso (hash simples, ver security.js)
      prefs: { ofuscarValores: false, notificacoesPush: false, ultimaChecagemNotif: null }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(chaveDoPerfil(perfis.atual));
      if (raw) {
        var parsed = JSON.parse(raw);
        var base = defaultState();
        var merged = Object.assign(base, parsed, {
          receitasExtras: parsed.receitasExtras || [],
          categoriasCustom: parsed.categoriasCustom || [],
          metas: parsed.metas || {},
          metasCategoria: parsed.metasCategoria || {},
          salarios: parsed.salarios || {},
          cartoes: parsed.cartoes || [],
          lancamentos: parsed.lancamentos || [],
          prefs: Object.assign(base.prefs, parsed.prefs || {})
        });
        // Migração: quem já tinha um salário único fixo vira o valor "base"
        // a partir do mês corrente, sem apagar nada — os meses passados
        // continuam usando o mesmo valor até o usuário definir outro.
        if (Object.keys(merged.salarios).length === 0 && merged.salario) {
          var mesAtualMig = new Date().toISOString().slice(0, 7);
          merged.salarios[mesAtualMig] = merged.salario;
        }
        return merged;
      }
    } catch (e) { console.warn("storage read failed", e); }
    return defaultState();
  }

  function saveState() {
    try { localStorage.setItem(chaveDoPerfil(perfis.atual), JSON.stringify(App.state)); }
    catch (e) { console.warn("storage write failed", e); }
  }

  App.state = loadState();

  function categoriasTodas() { return CATEGORIAS_FIXAS.concat(App.state.categoriasCustom); }
  function corCategoria(cat) {
    var idx = categoriasTodas().indexOf(cat);
    return CORES_CATEGORIA[idx >= 0 ? idx % CORES_CATEGORIA.length : 0];
  }
  function corCartao(cartaoId) {
    var c = App.state.cartoes.filter(function (x) { return x.id === cartaoId; })[0];
    if (c && c.cor) return c.cor;
    var idx = App.state.cartoes.findIndex(function (x) { return x.id === cartaoId; });
    // Sem id (cartão ainda não criado): usa a próxima cor da sequência, pra
    // já sugerir algo diferente do último cartão cadastrado.
    if (idx === -1) idx = App.state.cartoes.length;
    return CORES_CARTAO[idx % CORES_CARTAO.length];
  }

  function lancamentosDoMes(mes) {
    return App.state.lancamentos.filter(function (l) { return l.vencimento.slice(0, 7) === mes; });
  }
  // Cartões marcados como "benefício" (ex: iFood Benefícios) têm limite
  // próprio e NÃO descontam da renda: ficam fora das despesas e do saldo.
  function ehBeneficio(cartaoId) {
    if (!cartaoId) return false;
    var c = App.state.cartoes.filter(function (x) { return x.id === cartaoId; })[0];
    return !!(c && c.beneficio);
  }
  function despesasDoMes(mes) {
    return lancamentosDoMes(mes).reduce(function (s, l) { return ehBeneficio(l.cartaoId) ? s : s + l.valor; }, 0);
  }
  function receitasExtrasDoMes(mes) {
    return App.state.receitasExtras
      .filter(function (r) { return r.mes === mes; })
      .reduce(function (s, r) { return s + r.valor; }, 0);
  }
  // Salário do mês: usa o valor definido especificamente para `mes`; se não
  // houver, repete o valor do mês definido mais recente anterior a ele (o
  // salário "vale" pra frente até ser alterado de novo). Alterar um mês
  // nunca muda os valores já usados nos meses anteriores.
  function salarioDoMes(mes) {
    var chaves = Object.keys(App.state.salarios).sort();
    if (chaves.length === 0) return 0;
    var melhor = null;
    for (var i = 0; i < chaves.length; i++) {
      if (chaves[i] <= mes) melhor = chaves[i]; else break;
    }
    if (melhor === null) return 0; // todos os valores definidos são de meses futuros
    return App.state.salarios[melhor];
  }
  function definirSalarioDoMes(mes, valor) {
    App.state.salarios[mes] = valor;
  }
  function rendaTotalDoMes(mes) { return salarioDoMes(mes) + receitasExtrasDoMes(mes); }
  function saldoDoMes(mes) { return rendaTotalDoMes(mes) - despesasDoMes(mes); }

  // Uso do cartão: soma os lançamentos em aberto vinculados a ele. Recorrentes
  // e parcelados agora seguem a MESMA regra, igual ao cartão de crédito real:
  // o valor consome limite assim que a fatura daquele mês "vence" (chega a
  // data), e continua consumindo até o usuário marcar como pago — não é mais
  // liberado sozinho quando o mês vira. Por isso somamos todo recorrente cujo
  // vencimento já chegou (mês atual ou algum mês passado que ficou em aberto,
  // ou seja, atrasado) e ainda não foi pago; meses futuros que ainda não
  // venceram não entram na conta. Parcelados continuam somando todas as
  // parcelas em aberto de qualquer mês, porque a compra inteira já consumiu o
  // limite no ato da compra, liberando conforme cada parcela é paga.
  function usadoCartaoDetalhado(cartaoId) {
    var hoje = u.todayISO();
    var proximo = proximoVencimentoCartao(cartaoId);
    // Recorrentes: consomem limite a partir da fatura em aberto, e não
    // só quando o mês vira. Conta toda parcela em aberto com vencimento até
    // o próximo vencimento do cartão (ou já vencida e não paga). Sem dia de
    // vencimento no cartão, conta a primeira ocorrência em aberto de cada
    // recorrente. Ao pagar, essa ocorrência sai da conta e o limite volta;
    // as dos meses seguintes só entram quando a próxima fatura chega.
    var primeiraAberta = {};
    App.state.lancamentos.forEach(function (l) {
      if (l.cartaoId !== cartaoId || l.status !== "aberto" || !l.recorrente) return;
      var k = l.grupoId || l.id;
      if (!primeiraAberta[k] || l.vencimento < primeiraAberta[k]) primeiraAberta[k] = l.vencimento;
    });
    var recorrente = 0, parcelado = 0;
    App.state.lancamentos.forEach(function (l) {
      if (l.cartaoId !== cartaoId || l.status !== "aberto") return;
      if (l.recorrente) {
        var k = l.grupoId || l.id;
        var corte = proximo || primeiraAberta[k];
        if (corte < hoje) corte = hoje;
        if (l.vencimento <= corte) recorrente += l.valor;
      } else {
        parcelado += l.valor;
      }
    });
    return { recorrente: recorrente, parcelado: parcelado, total: recorrente + parcelado };
  }
  function usadoCartao(cartaoId) { return usadoCartaoDetalhado(cartaoId).total; }

  // Próxima data de vencimento de um cartão a partir de hoje: se o dia de
  // vencimento configurado ainda não passou neste mês, usa este mês; senão,
  // pula pro mês seguinte. Retorna null se o cartão não tiver dia definido.
  function proximoVencimentoCartao(cartaoId) {
    var c = App.state.cartoes.filter(function (x) { return x.id === cartaoId; })[0];
    if (!c || !c.diaVencimento) return null;
    var hoje = new Date();
    var ano = hoje.getFullYear(), mes = hoje.getMonth(), diaHoje = hoje.getDate();
    if (c.diaVencimento < diaHoje) mes += 1;
    var lastDay = new Date(ano, mes + 1, 0).getDate();
    var dia = Math.min(c.diaVencimento, lastDay);
    var d = new Date(ano, mes, dia);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function clampDia(ano, mes, dia) {
    var lastDay = new Date(ano, mes + 1, 0).getDate();
    return Math.min(dia, lastDay);
  }

  // Calcula em qual fatura (data de vencimento) uma compra feita em
  // `dataCompraISO` vai cair, dado o dia de fechamento e o dia de vencimento
  // configurados no cartão. Regra: se a compra é feita ATÉ o dia de
  // fechamento (inclusive), ela entra na fatura que fecha nesse mês; se é
  // feita DEPOIS do fechamento, só entra na fatura seguinte. O vencimento
  // dessa fatura cai no mês da compra se o dia de vencimento for POSTERIOR
  // ao de fechamento (caso comum: fecha dia 3, vence dia 10 — mesmo mês);
  // se o dia de vencimento for anterior ou igual ao de fechamento (fecha
  // dia 25, vence dia 5), o vencimento vira pro mês seguinte.
  function calcularVencimentoFatura(cartao, dataCompraISO) {
    if (!cartao || !cartao.diaFechamento) return null;
    var partes = dataCompraISO.split("-").map(Number);
    var ano = partes[0], mesIdx = partes[1] - 1, dia = partes[2];
    var diaVenc = cartao.diaVencimento || cartao.diaFechamento;
    var mesFatura = mesIdx;
    if (dia > cartao.diaFechamento) mesFatura += 1; // fechou, vai pra próxima fatura
    var mesVencimento = mesFatura;
    if (diaVenc <= cartao.diaFechamento) mesVencimento += 1; // vencimento "atravessa" o mês
    var d = new Date(ano, mesVencimento, clampDia(ano, mesVencimento, diaVenc));
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // "Melhor dia de compra": último dia (o próprio dia de fechamento) em que
  // uma compra ainda cai na fatura corrente, e a partir de quando ela só
  // cairia na fatura seguinte. Retorna null se o cartão não tem fechamento.
  function melhorDiaCompra(cartao) {
    if (!cartao || !cartao.diaFechamento) return null;
    function iso(d) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    var hoje = new Date();
    // Próximo fechamento: neste mês se ainda não passou, senão no mês seguinte.
    var mesFech = hoje.getMonth() + (hoje.getDate() > cartao.diaFechamento ? 1 : 0);
    var fech = new Date(hoje.getFullYear(), mesFech, clampDia(hoje.getFullYear(), mesFech, cartao.diaFechamento));
    var diaSeguinte = new Date(fech.getFullYear(), fech.getMonth(), fech.getDate() + 1);
    return {
      diaFechamento: cartao.diaFechamento,
      fechamento: iso(fech),
      vencAtual: calcularVencimentoFatura(cartao, iso(fech)),
      vencProximo: calcularVencimentoFatura(cartao, iso(diaSeguinte))
    };
  }

  function lembretesPendentes() {
    return App.state.lancamentos
      .filter(function (l) { return l.status === "aberto" && u.diasAte(l.vencimento) <= 7; })
      .sort(function (a, b) { return a.vencimento.localeCompare(b.vencimento); });
  }

  function gastosPorCategoria(mes) {
    var mapa = {};
    lancamentosDoMes(mes).forEach(function (l) {
      mapa[l.categoria] = (mapa[l.categoria] || 0) + l.valor;
    });
    return Object.keys(mapa).map(function (cat) {
      return { categoria: cat, valor: mapa[cat], cor: corCategoria(cat) };
    }).sort(function (a, b) { return b.valor - a.valor; });
  }

  // Gastos por categoria nos últimos `n` meses (mais antigo primeiro), para
  // o gráfico de barras comparativo mês a mês.
  function gastosPorCategoriaUltimosMeses(mesRef, n) {
    var meses = [];
    var mes = mesRef;
    var pilha = [];
    for (var i = 0; i < n; i++) { pilha.unshift(mes); mes = u.shiftMonth(mes, -1); }
    var categoriasUsadas = {};
    var porMes = pilha.map(function (m) {
      var g = gastosPorCategoria(m);
      g.forEach(function (item) { categoriasUsadas[item.categoria] = true; });
      var mapa = {};
      g.forEach(function (item) { mapa[item.categoria] = item.valor; });
      return { mes: m, mapa: mapa };
    });
    var categorias = Object.keys(categoriasUsadas);
    return { meses: pilha, categorias: categorias, porMes: porMes };
  }

  // Saldo dos últimos `n` meses (incluindo o mês de referência), mais antigo primeiro.
  function saldoUltimosMeses(mesRef, n) {
    var out = [];
    var mes = mesRef;
    var pilha = [];
    for (var i = 0; i < n; i++) { pilha.unshift(mes); mes = u.shiftMonth(mes, -1); }
    pilha.forEach(function (m) { out.push({ mes: m, saldo: saldoDoMes(m), despesas: despesasDoMes(m) }); });
    return out;
  }

  function comparativoMesAnterior(mes) {
    var atual = despesasDoMes(mes);
    var anterior = despesasDoMes(u.shiftMonth(mes, -1));
    if (anterior === 0) return { atual: atual, anterior: anterior, pct: atual > 0 ? 100 : 0, temAnterior: false };
    var pct = ((atual - anterior) / anterior) * 100;
    return { atual: atual, anterior: anterior, pct: pct, temAnterior: true };
  }

  function metaDoMes(mes) { return App.state.metas[mes] || 0; }
  function metaRestante(mes) {
    var alvo = metaDoMes(mes);
    if (!alvo) return null;
    var gasto = despesasDoMes(mes);
    return { alvo: alvo, gasto: gasto, restante: alvo - gasto, pct: Math.min(100, (gasto / alvo) * 100) };
  }

  // ---- Metas por categoria ----
  function metasCategoriaDoMes(mes) { return App.state.metasCategoria[mes] || {}; }
  function metaCategoriaDoMes(mes, categoria) { return metasCategoriaDoMes(mes)[categoria] || 0; }
  function definirMetaCategoria(mes, categoria, valor) {
    if (!App.state.metasCategoria[mes]) App.state.metasCategoria[mes] = {};
    App.state.metasCategoria[mes][categoria] = valor;
  }
  function removerMetaCategoria(mes, categoria) {
    if (App.state.metasCategoria[mes]) delete App.state.metasCategoria[mes][categoria];
  }
  function metasCategoriaStatus(mes) {
    var metas = metasCategoriaDoMes(mes);
    var gastos = gastosPorCategoria(mes);
    var mapaGasto = {};
    gastos.forEach(function (g) { mapaGasto[g.categoria] = g.valor; });
    return Object.keys(metas).map(function (cat) {
      var alvo = metas[cat];
      var gasto = mapaGasto[cat] || 0;
      return {
        categoria: cat, cor: corCategoria(cat), alvo: alvo, gasto: gasto,
        restante: alvo - gasto, pct: Math.min(100, (gasto / alvo) * 100)
      };
    }).sort(function (a, b) { return b.pct - a.pct; });
  }

  // ---- Categorização automática ----
  // Sugere uma categoria olhando o histórico de lançamentos com título igual
  // (comparação sem acento/case, aparada), usando a categoria mais frequente
  // entre os candidatos. Também aceita correspondência por "contém" quando o
  // título digitado já tem 4+ caracteres, pra pegar variações tipo "Netflix set".
  function normalizarTitulo(s) {
    return String(s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  function sugerirCategoria(titulo) {
    var alvo = normalizarTitulo(titulo);
    if (!alvo) return null;
    var candidatos = App.state.lancamentos.filter(function (l) {
      var t = normalizarTitulo(l.titulo);
      return t === alvo || (alvo.length >= 4 && (t.indexOf(alvo) !== -1 || alvo.indexOf(t) !== -1));
    });
    if (!candidatos.length) return null;
    var contagem = {};
    candidatos.forEach(function (l) { contagem[l.categoria] = (contagem[l.categoria] || 0) + 1; });
    var melhor = null, melhorScore = -1;
    Object.keys(contagem).forEach(function (cat) {
      if (contagem[cat] > melhorScore) { melhor = cat; melhorScore = contagem[cat]; }
    });
    return melhor;
  }

  App.data = {
    STORAGE_KEY: STORAGE_PREFIX,
    CATEGORIAS_FIXAS: CATEGORIAS_FIXAS,
    MEIOS: MEIOS,
    defaultState: defaultState,
    saveState: saveState,
    categoriasTodas: categoriasTodas,
    corCategoria: corCategoria,
    corCartao: corCartao,
    lancamentosDoMes: lancamentosDoMes,
    despesasDoMes: despesasDoMes,
    ehBeneficio: ehBeneficio,
    receitasExtrasDoMes: receitasExtrasDoMes,
    salarioDoMes: salarioDoMes,
    definirSalarioDoMes: definirSalarioDoMes,
    rendaTotalDoMes: rendaTotalDoMes,
    saldoDoMes: saldoDoMes,
    usadoCartao: usadoCartao,
    usadoCartaoDetalhado: usadoCartaoDetalhado,
    proximoVencimentoCartao: proximoVencimentoCartao,
    calcularVencimentoFatura: calcularVencimentoFatura,
    melhorDiaCompra: melhorDiaCompra,
    lembretesPendentes: lembretesPendentes,
    gastosPorCategoria: gastosPorCategoria,
    gastosPorCategoriaUltimosMeses: gastosPorCategoriaUltimosMeses,
    saldoUltimosMeses: saldoUltimosMeses,
    comparativoMesAnterior: comparativoMesAnterior,
    metaDoMes: metaDoMes,
    metaRestante: metaRestante,
    metasCategoriaDoMes: metasCategoriaDoMes,
    metaCategoriaDoMes: metaCategoriaDoMes,
    definirMetaCategoria: definirMetaCategoria,
    removerMetaCategoria: removerMetaCategoria,
    metasCategoriaStatus: metasCategoriaStatus,
    sugerirCategoria: sugerirCategoria,
    // Perfis
    perfilAtual: perfilAtual,
    listaPerfis: listaPerfis,
    criarPerfil: criarPerfil,
    renomearPerfil: renomearPerfil,
    excluirPerfil: excluirPerfil,
    trocarPerfil: trocarPerfil
  };
})(window.App);
