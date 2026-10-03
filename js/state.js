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
  var MEIOS = ["Pix", "Débito", "Cartão de crédito", "Vale alimentação", "Dinheiro", "Boleto"];
  // meio de pagamento -> recurso/tipo de conta que ele exige
  var TIPO_MEIO = { "Pix": "pix", "Débito": "debito", "Cartão de crédito": "credito", "Vale alimentação": "alimentacao" };
  // Tipos de conta: "conta" (com recursos Pix/Crédito/Débito, combináveis) e "alimentacao" (saldo com renovação).
  var TIPOS_CONTA = { conta: "Conta", alimentacao: "Alimentação" };
  var RECURSOS = { pix: "Pix", credito: "Crédito", debito: "Débito" };
  var CORES_CATEGORIA = ["#3532E8", "#E58A00", "#D23A4E", "#0C9A76", "#8B5CF6", "#06A5D6", "#E0679B", "#6B7089"];
  var CORES_CARTAO = ["#3532E8", "#8B5CF6", "#D23A4E", "#E58A00", "#06A5D6", "#0C9A76", "#E0679B", "#2F6690"];

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
      cartoes: [],             // contas: [{id, nome, tipo: credito|debito|pix, limite, ...}]
      poupancas: [],           // [{id, nome, meta, cor}]
      movPoupanca: [],         // [{id, poupancaId, contaId, tipo: deposito|retirada|rendimento, valor, data, descricao}]
      lancamentos: [],
      entradas: [],             // [{id, contaId, valor, data, descricao}] — saldo adicionado às contas
      versaoSaldo: 1,           // 1 = lançamentos Pix/Débito já descontam do saldo da conta (ver migrarEstado)
      categoriasCustom: [],     // categorias extras criadas pelo usuário
      metas: {},                // { "YYYY-MM": valorAlvo }
      metasCategoria: {},       // { "YYYY-MM": { categoria: valorAlvo } }
      pinHash: null,            // trava de acesso (hash simples, ver security.js)
      prefs: { ofuscarValores: false, notificacoesPush: false, ultimaChecagemNotif: null }
    };
  }

  // Migração de contas antigas: antes cada conta tinha UM tipo (credito|debito|pix,
  // e sem tipo = crédito). Agora toda conta comum tem `tipo: "conta"` e uma lista
  // `recursos` (qualquer combinação de pix/credito/debito). Contas "alimentacao"
  // ficam como estão.
  function normalizarContas(arr) {
    return arr.map(function (c) {
      var n = Object.assign({}, c);
      if (n.tipo === "alimentacao") return n;
      if (!Array.isArray(n.recursos) || !n.recursos.length) {
        n.recursos = [(n.tipo === "debito" || n.tipo === "pix") ? n.tipo : "credito"];
      }
      n.tipo = "conta";
      return n;
    });
  }

  // Conta Alimentação / meio "Vale alimentação": o valor sai do saldo NO MOMENTO
  // da transação — não existe vencimento nem "conta a vencer".
  function ehTransacaoEm(l, cartoes) {
    if (!l) return false;
    if (l.meioPagamento === "Vale alimentação") return true;
    var c = l.cartaoId ? cartoes.filter(function (x) { return x.id === l.cartaoId; })[0] : null;
    return !!c && c.tipo === "alimentacao";
  }

  // Migrações idempotentes (usadas ao carregar e ao importar backup):
  //  - entradas: garante o array de saldo adicionado às contas;
  //  - versaoSaldo: contas passaram a ter saldo próprio. Os Pix/Débito JÁ
  //    lançados antes dessa versão ficam marcados `semSaldo` e não descontam
  //    de saldo nenhum (senão toda conta existente nasceria negativa). Só os
  //    lançamentos novos descontam; o usuário informa o saldo real da conta
  //    com "Adicionar saldo";
  //  - lançamentos de Alimentação nunca ficam "em aberto".
  function migrarEstado(st) {
    if (!Array.isArray(st.entradas)) st.entradas = [];
    if (!st.versaoSaldo) {
      st.lancamentos.forEach(function (l) {
        if (l.meioPagamento === "Pix" || l.meioPagamento === "Débito") l.semSaldo = true;
      });
      st.versaoSaldo = 1;
    }
    st.lancamentos.forEach(function (l) {
      if (ehTransacaoEm(l, st.cartoes)) l.status = "pago";
    });
    return st;
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
          cartoes: normalizarContas(parsed.cartoes || []),
          poupancas: parsed.poupancas || [],
          movPoupanca: parsed.movPoupanca || [],
          lancamentos: parsed.lancamentos || [],
          entradas: parsed.entradas || [],
          versaoSaldo: parsed.versaoSaldo || 0, // 0 = estado anterior ao saldo por conta (migrarEstado trata)
          prefs: Object.assign(base.prefs, parsed.prefs || {})
        });
        migrarEstado(merged);
        // Migração: quem já tinha um salário único fixo vira o valor "base"
        // a partir do mês corrente, sem apagar nada — os meses passados
        // continuam usando o mesmo valor até o usuário definir outro.
        if (Object.keys(merged.salarios).length === 0 && merged.salario) {
          var mesAtualMig = u.todayISO().slice(0, 7);
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
    // Conta Alimentação tem saldo próprio (vale): nunca desconta da renda.
    return !!(c && (c.beneficio || c.tipo === "alimentacao"));
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
      if (l.meioPagamento && l.meioPagamento !== "Cartão de crédito") return; // conta combinada: Pix/débito não consomem limite
      var k = l.grupoId || l.id;
      if (!primeiraAberta[k] || l.vencimento < primeiraAberta[k]) primeiraAberta[k] = l.vencimento;
    });
    var recorrente = 0, parcelado = 0;
    App.state.lancamentos.forEach(function (l) {
      if (l.cartaoId !== cartaoId || l.status !== "aberto") return;
      if (l.meioPagamento && l.meioPagamento !== "Cartão de crédito") return;
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
      .filter(function (l) { return l.status === "aberto" && !ehTransacaoImediata(l) && u.diasAte(l.vencimento) <= 7; })
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

  // ---- Tipos de conta ----
  function tipoConta(c) { return (c && c.tipo === "alimentacao") ? "alimentacao" : "conta"; }
  function temRecurso(c, r) { return !!c && tipoConta(c) === "conta" && (c.recursos || []).indexOf(r) !== -1; }
  // Contas que aceitam determinado meio: recurso pix/credito/debito, ou o tipo alimentacao.
  function contasDoTipo(t) {
    return App.state.cartoes.filter(function (c) { return t === "alimentacao" ? tipoConta(c) === "alimentacao" : temRecurso(c, t); });
  }
  function rotuloRecursos(c) {
    if (tipoConta(c) === "alimentacao") return "Alimentação";
    return (c.recursos || []).map(function (r) { return RECURSOS[r]; }).join(" · ");
  }

  // ---- Conta Alimentação ----
  // O saldo é DERIVADO (nada é "descontado" à mão, então editar/excluir/desfazer
  // lançamentos sempre mantém o saldo correto):
  //   saldo = saldoBase − soma dos lançamentos da conta com data entre baseData e hoje.
  // `saldoBase`/`baseData` são reposicionados quando o usuário ajusta o saldo ou
  // quando uma renovação é aplicada. Lançamentos com data futura só descontam
  // quando a data chega.
  function isoDeDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function diaSeguinteISO(iso) {
    var p = iso.split("-").map(Number);
    return isoDeDate(new Date(p[0], p[1] - 1, p[2] + 1));
  }
  // Soma lançamentos da conta com vencimento em [de, ate) (ate = exclusivo).
  // Lançamentos retroativos (data anterior ao início do ciclo atual do saldo, ex.:
  // um gasto do dia 01 registrado depois) trazem `retroativoEm` = início do ciclo
  // em que foram lançados e descontam do saldo desse ciclo. Ao renovar ou ajustar
  // o saldo, o ciclo muda e eles deixam de contar (o novo saldo já os reflete).
  function somaConta(id, de, ate) {
    return App.state.lancamentos.reduce(function (s, l) {
      if (l.cartaoId !== id) return s;
      var noPeriodo = l.vencimento >= de && l.vencimento < ate;
      var retro = !!l.retroativoEm && l.retroativoEm === de && l.vencimento < de;
      return (noPeriodo || retro) ? s + l.valor : s;
    }, 0);
  }
  function dataRenovacao(c, ano, mesIdx) {
    return isoDeDate(new Date(ano, mesIdx, clampDia(ano, mesIdx, c.diaRenovacao)));
  }
  function saldoAlimentacao(c) {
    if (!c || !c.baseData) return (c && c.saldoBase) || 0;
    return c.saldoBase - somaConta(c.id, c.baseData, diaSeguinteISO(u.todayISO()));
  }
  // Define o saldo disponível ATUAL (ajuste manual ou criação da conta).
  function definirSaldoAtual(c, valor) {
    var hoje = u.todayISO();
    // O valor informado é o saldo real agora: retroativos anteriores já estão nele.
    App.state.lancamentos.forEach(function (l) { if (l.cartaoId === c.id) delete l.retroativoEm; });
    // Lançamentos de hoje já estão refletidos no valor informado: soma de volta
    // pra não descontá-los duas vezes.
    c.saldoBase = valor + somaConta(c.id, hoje, diaSeguinteISO(hoje));
    c.baseData = hoje;
  }
  function proximaRenovacao(c) {
    if (!c || !c.diaRenovacao) return null;
    var hoje = u.todayISO(), t = new Date(), ano = t.getFullYear(), mes = t.getMonth();
    for (var i = 0; i < 3; i++) {
      var d = dataRenovacao(c, ano, mes + i);
      if (d > hoje) return d;
    }
    return null;
  }
  // Aplica as renovações cuja data já chegou (inclusive várias, se o app ficou
  // meses sem abrir). Regras: "repor" = saldo vira o valor da renovação (sobra
  // não acumula); "somar" = valor da renovação é somado ao que sobrou.
  function aplicarRenovacoes() {
    var hoje = u.todayISO(), mudou = false;
    App.state.cartoes.forEach(function (c) {
      if (tipoConta(c) !== "alimentacao" || !c.diaRenovacao || !(c.valorRenovacao > 0)) return;
      if (!c.baseData) { c.baseData = hoje; c.saldoBase = c.saldoBase || 0; mudou = true; }
      var p = c.baseData.split("-").map(Number), ano = p[0], mes = p[1] - 1, guard = 0;
      while (guard++ < 600) {
        var d = dataRenovacao(c, ano, mes);
        if (d <= c.baseData) { mes++; continue; }
        if (d > hoje) break;
        var antes = c.saldoBase - somaConta(c.id, c.baseData, d);
        c.saldoBase = c.modoRenovacao === "somar" ? antes + c.valorRenovacao : c.valorRenovacao;
        c.baseData = d;
        c.ultimaRenovacao = d;
        mudou = true;
        mes++;
      }
    });
    if (mudou) saveState();
    return mudou;
  }

  // Gastos do mês por conta/cartão (lançamentos sem conta agrupam pelo meio de
  // pagamento). Cartões de benefício ficam fora, igual às despesas do mês.
  function gastosPorConta(mes) {
    var m = {};
    lancamentosDoMes(mes).forEach(function (l) {
      if (ehBeneficio(l.cartaoId)) return;
      var c = App.state.cartoes.filter(function (x) { return x.id === l.cartaoId; })[0];
      var k = c ? c.id : "m:" + l.meioPagamento;
      if (!m[k]) m[k] = { rotulo: c ? c.nome : l.meioPagamento + " (sem conta)", valor: 0, cor: c ? corCartao(c.id) : "#6B7280" };
      m[k].valor += l.valor;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.valor - a.valor; });
  }
  function gastoMesConta(id, mes) {
    return lancamentosDoMes(mes).reduce(function (s, l) { return l.cartaoId === id ? s + l.valor : s; }, 0);
  }

  // ---- Contas: saldo disponível x limite de crédito ----
  // Duas coisas SEPARADAS: o saldo (dinheiro na conta, usado em Pix/Débito) e o
  // limite do crédito (usadoCartao). Pix/Débito nunca mexem no limite — o
  // cálculo do limite já ignora lançamentos que não sejam "Cartão de crédito".
  function arred(n) { return Math.round(n * 100) / 100; }
  function contaPorId(id) { return id ? App.state.cartoes.filter(function (x) { return x.id === id; })[0] || null : null; }
  function ehTransacaoImediata(l) { return ehTransacaoEm(l, App.state.cartoes); }
  // Tem saldo próprio: conta com Pix e/ou Débito (Alimentação tem o saldo do vale, à parte).
  function contaTemSaldo(c) { return !!c && tipoConta(c) === "conta" && (temRecurso(c, "pix") || temRecurso(c, "debito")); }
  function contasComSaldo() { return App.state.cartoes.filter(contaTemSaldo); }
  function contaTemCredito(c) { return temRecurso(c, "credito"); }
  function limiteDisponivel(c) { return contaTemCredito(c) ? arred(c.limite - usadoCartao(c.id)) : 0; }

  // saldo = entradas (até hoje) − depósitos na poupança + retiradas da poupança
  //         − Pix/Débito já pagos. Derivado, então editar/excluir qualquer
  //         lançamento mantém tudo consistente (nada é "descontado à mão").
  function saldoConta(c) {
    if (!c) return 0;
    if (tipoConta(c) === "alimentacao") return arred(saldoAlimentacao(c));
    var hoje = u.todayISO(), s = 0;
    App.state.entradas.forEach(function (e) { if (e.contaId === c.id && e.data <= hoje) s += e.valor; });
    App.state.movPoupanca.forEach(function (m) {
      if (m.contaId !== c.id || m.data > hoje) return;
      if (m.tipo === "deposito") s -= m.valor; else if (m.tipo === "retirada") s += m.valor;
    });
    App.state.lancamentos.forEach(function (l) {
      if (l.cartaoId !== c.id || l.status !== "pago" || l.semSaldo) return;
      if (l.meioPagamento === "Pix" || l.meioPagamento === "Débito") s -= l.valor;
    });
    return arred(s);
  }

  // ---- Poupança ----
  // Cada depósito sai do saldo de UMA conta e cada retirada volta para UMA conta
  // (`contaId`). Rendimento pode (opcionalmente) ser atribuído a uma conta: conta
  // como "poupado" dela, mas não mexe no saldo da conta. Movimentos antigos, sem
  // conta, ficam no balde "sem conta" (saldo da poupança − soma por conta).
  function movSinal(m) { return m.tipo === "retirada" ? -m.valor : m.valor; }
  function saldoPoupanca(id) {
    return arred(App.state.movPoupanca.reduce(function (s, m) { return m.poupancaId === id ? s + movSinal(m) : s; }, 0));
  }
  function saldoPoupancaTotal() {
    return arred(App.state.poupancas.reduce(function (s, p) { return s + saldoPoupanca(p.id); }, 0));
  }
  function poupadoNaConta(poupancaId, contaId) {
    return arred(App.state.movPoupanca.reduce(function (s, m) {
      return (m.poupancaId === poupancaId && m.contaId === contaId) ? s + movSinal(m) : s;
    }, 0));
  }
  function poupadoSemConta(poupancaId) {
    var atribuido = App.state.cartoes.reduce(function (s, c) { return s + poupadoNaConta(poupancaId, c.id); }, 0);
    return arred(saldoPoupanca(poupancaId) - atribuido);
  }
  // Soma, em todas as poupanças, do que cada conta guardou. `semConta` reúne o
  // resto (movimentos antigos e rendimentos sem conta).
  function poupadoPorConta() {
    var lista = App.state.cartoes.map(function (c) {
      var v = arred(App.state.poupancas.reduce(function (s, p) { return s + poupadoNaConta(p.id, c.id); }, 0));
      return { conta: c, valor: v };
    }).filter(function (x) { return Math.abs(x.valor) > 0.004; });
    var semConta = arred(saldoPoupancaTotal() - lista.reduce(function (s, x) { return s + x.valor; }, 0));
    return { porConta: lista, semConta: semConta };
  }

  // Valida um depósito/retirada ANTES de gravar. Retorna a mensagem de erro ou null.
  //  - depósito: a conta precisa ter saldo disponível suficiente;
  //  - retirada: só pode tirar o que aquela conta (ou o balde "sem conta") guardou.
  function validarMovPoupanca(poupancaId, tipo, contaId, valor) {
    valor = arred(valor);
    if (tipo === "deposito") {
      var c = contaPorId(contaId);
      if (!c) return "Escolha a conta de onde sai o valor";
      var saldo = saldoConta(c);
      if (valor > saldo + 0.004) {
        return saldo > 0
          ? "Saldo insuficiente em " + c.nome + ": disponível " + u.fmtBRL.format(saldo)
          : c.nome + " não tem saldo disponível. Adicione saldo antes de guardar.";
      }
    } else if (tipo === "retirada") {
      var disp = contaId ? poupadoNaConta(poupancaId, contaId) : poupadoSemConta(poupancaId);
      var nome = contaId ? (contaPorId(contaId) || {}).nome : "valores sem conta";
      if (valor > disp + 0.004) return "Só há " + u.fmtBRL.format(Math.max(0, disp)) + " guardados em " + nome + " nesta poupança";
    }
    return null;
  }

  // Impede excluir um movimento se isso deixaria a poupança (ou o que uma conta
  // guardou, ou o saldo da conta) negativo. Retorna a mensagem ou null.
  function validarRemocaoMov(m) {
    var orig = App.state.movPoupanca, conta = contaPorId(m.contaId);
    var antes = {
      p: saldoPoupanca(m.poupancaId), pc: m.contaId ? poupadoNaConta(m.poupancaId, m.contaId) : 0,
      sc: poupadoSemConta(m.poupancaId), c: conta ? saldoConta(conta) : 0
    };
    App.state.movPoupanca = orig.filter(function (x) { return x !== m; });
    var depois;
    try {
      depois = {
        p: saldoPoupanca(m.poupancaId), pc: m.contaId ? poupadoNaConta(m.poupancaId, m.contaId) : 0,
        sc: poupadoSemConta(m.poupancaId), c: conta ? saldoConta(conta) : 0
      };
    } finally { App.state.movPoupanca = orig; }
    function piorou(k) { return depois[k] < -0.004 && depois[k] < antes[k] - 0.004; }
    if (piorou("p")) return "Não dá para excluir: a poupança ficaria com saldo negativo.";
    if (piorou("pc")) return "Não dá para excluir: o valor guardado por " + conta.nome + " ficaria negativo.";
    if (piorou("sc")) return "Não dá para excluir: o saldo sem conta da poupança ficaria negativo.";
    if (piorou("c")) return "Não dá para excluir: " + conta.nome + " ficaria com saldo negativo.";
    return null;
  }

  // ---- Extrato ----
  // Linha do tempo do mês: lançamentos (só pagos se `soRealizadas`), renda do
  // mês e movimentos de poupança. Valor negativo = saiu da conta.
  function extratoDoMes(mes, soRealizadas, contaId) {
    var out = [], mesHoje = u.todayISO().slice(0, 7), hoje = u.todayISO();
    lancamentosDoMes(mes).forEach(function (l) {
      if (soRealizadas && l.status !== "pago") return;
      if (contaId && l.cartaoId !== contaId) return;
      out.push({ kind: "lanc", id: l.id, data: l.vencimento, titulo: l.titulo, valor: -l.valor, l: l, beneficio: ehBeneficio(l.cartaoId) });
    });
    // Saldo adicionado às contas (entradas).
    App.state.entradas.forEach(function (e) {
      if (e.data.slice(0, 7) !== mes) return;
      if (soRealizadas && e.data > hoje) return;
      if (contaId && e.contaId !== contaId) return;
      var c = contaPorId(e.contaId);
      out.push({ kind: "entrada", id: e.id, data: e.data, titulo: e.descricao || "Saldo adicionado", valor: e.valor, e: e, contaNome: c ? c.nome : "" });
    });
    if (!contaId) {
      if (mes <= mesHoje || !soRealizadas) {
        if (salarioDoMes(mes) > 0) out.push({ kind: "renda", id: "sal-" + mes, data: mes + "-01", titulo: "Salário", valor: salarioDoMes(mes) });
        App.state.receitasExtras.forEach(function (r) {
          if (r.mes === mes) out.push({ kind: "renda", id: r.id, data: mes + "-01", titulo: r.titulo, valor: r.valor });
        });
      }
    }
    // Poupança: no extrato de uma conta só entram depósitos/retiradas ligados a ela.
    App.state.movPoupanca.forEach(function (m) {
      if (m.data.slice(0, 7) !== mes) return;
      if (contaId && (m.contaId !== contaId || m.tipo === "rendimento")) return;
      var p = App.state.poupancas.filter(function (x) { return x.id === m.poupancaId; })[0];
      var c = contaPorId(m.contaId);
      var rot = { deposito: "Depósito", retirada: "Retirada", rendimento: "Rendimento" }[m.tipo];
      out.push({ kind: "poup", id: m.id, data: m.data, titulo: (p ? p.nome : "Poupança") + " · " + rot + (c && !contaId ? " (" + c.nome + ")" : ""), valor: m.tipo === "deposito" ? -m.valor : m.valor, mov: m });
    });
    return out.sort(function (a, b) { return b.data.localeCompare(a.data); });
  }

  App.data = {
    TIPO_MEIO: TIPO_MEIO, TIPOS_CONTA: TIPOS_CONTA, RECURSOS: RECURSOS, normalizarContas: normalizarContas,
    tipoConta: tipoConta, temRecurso: temRecurso, rotuloRecursos: rotuloRecursos, contasDoTipo: contasDoTipo,
    saldoAlimentacao: saldoAlimentacao, definirSaldoAtual: definirSaldoAtual,
    proximaRenovacao: proximaRenovacao, aplicarRenovacoes: aplicarRenovacoes, gastosPorConta: gastosPorConta, gastoMesConta: gastoMesConta,
    saldoPoupanca: saldoPoupanca, saldoPoupancaTotal: saldoPoupancaTotal, extratoDoMes: extratoDoMes,
    migrarEstado: migrarEstado, ehTransacaoImediata: ehTransacaoImediata, contaPorId: contaPorId,
    contaTemSaldo: contaTemSaldo, contasComSaldo: contasComSaldo, contaTemCredito: contaTemCredito,
    saldoConta: saldoConta, limiteDisponivel: limiteDisponivel, arred: arred,
    poupadoNaConta: poupadoNaConta, poupadoSemConta: poupadoSemConta, poupadoPorConta: poupadoPorConta,
    validarMovPoupanca: validarMovPoupanca, validarRemocaoMov: validarRemocaoMov,
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
