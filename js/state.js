// ==== STATE & PERSISTENCE ===================================================
// Todo o dado do app vive no objeto `App.state`, persistido no localStorage
// a cada mudança via saveState(). É a única fonte de verdade; cada render()
// reconstrói o DOM a partir dele.
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils;

  var STORAGE_KEY = "controle-financeiro:v2";
  var CATEGORIAS_FIXAS = ["Alimentação", "Transporte", "Moradia", "Educação", "Lazer", "Outros"];
  var MEIOS = ["Pix", "Cartão de crédito", "Dinheiro", "Boleto"];
  var CORES_CATEGORIA = ["#0E6B5C", "#B96A22", "#A83B32", "#5B7FBB", "#8B5FBF", "#3E8A72", "#C9944A", "#6B7280"];

  function defaultState() {
    return {
      salario: 0,
      salarios: {},             // { "YYYY-MM": valor } — renda fixa por mês
      receitasExtras: [],       // [{id, titulo, valor, mes: "YYYY-MM"}]
      cartoes: [],
      lancamentos: [],
      categoriasCustom: [],     // categorias extras criadas pelo usuário
      metas: {},                // { "YYYY-MM": valorAlvo }
      pinHash: null,            // trava de acesso (hash simples, ver security.js)
      prefs: { ofuscarValores: false }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var base = defaultState();
        var merged = Object.assign(base, parsed, {
          receitasExtras: parsed.receitasExtras || [],
          categoriasCustom: parsed.categoriasCustom || [],
          metas: parsed.metas || {},
          salarios: parsed.salarios || {},
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
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(App.state)); }
    catch (e) { console.warn("storage write failed", e); }
  }

  App.state = loadState();

  function categoriasTodas() { return CATEGORIAS_FIXAS.concat(App.state.categoriasCustom); }
  function corCategoria(cat) {
    var idx = categoriasTodas().indexOf(cat);
    return CORES_CATEGORIA[idx >= 0 ? idx % CORES_CATEGORIA.length : 0];
  }

  function lancamentosDoMes(mes) {
    return App.state.lancamentos.filter(function (l) { return l.vencimento.slice(0, 7) === mes; });
  }
  function despesasDoMes(mes) {
    return lancamentosDoMes(mes).reduce(function (s, l) { return s + l.valor; }, 0);
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

  // Uso do cartão: soma os lançamentos em aberto vinculados a ele. Lançamentos
  // recorrentes só entram na conta no mês em que vencem — cada mês futuro já
  // foi pré-criado no banco, mas eles não devem se acumular todos de uma vez
  // (senão um streaming de R$30/mês por 12 meses pareceria R$360 de uso hoje).
  // Assim que o mês é pago, o valor libera; no mês seguinte a parcela
  // recorrente daquele mês passa a contar no lugar.
  function usadoCartao(cartaoId) {
    var mesAtual = u.todayISO().slice(0, 7);
    return App.state.lancamentos
      .filter(function (l) {
        if (l.cartaoId !== cartaoId || l.status !== "aberto") return false;
        if (l.recorrente) return l.vencimento.slice(0, 7) === mesAtual;
        return true;
      })
      .reduce(function (s, l) { return s + l.valor; }, 0);
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

  App.data = {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIAS_FIXAS: CATEGORIAS_FIXAS,
    MEIOS: MEIOS,
    defaultState: defaultState,
    saveState: saveState,
    categoriasTodas: categoriasTodas,
    corCategoria: corCategoria,
    lancamentosDoMes: lancamentosDoMes,
    despesasDoMes: despesasDoMes,
    receitasExtrasDoMes: receitasExtrasDoMes,
    salarioDoMes: salarioDoMes,
    definirSalarioDoMes: definirSalarioDoMes,
    rendaTotalDoMes: rendaTotalDoMes,
    saldoDoMes: saldoDoMes,
    usadoCartao: usadoCartao,
    lembretesPendentes: lembretesPendentes,
    gastosPorCategoria: gastosPorCategoria,
    saldoUltimosMeses: saldoUltimosMeses,
    comparativoMesAnterior: comparativoMesAnterior,
    metaDoMes: metaDoMes,
    metaRestante: metaRestante
  };
})(window.App);
