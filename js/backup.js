// ==== EXPORT / IMPORT (backup) ==============================================
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils;

  // Salva um arquivo de texto. Tenta a capability de downloads do runtime de
  // artifacts da Claude primeiro, e cai para um download via Blob comum, que
  // funciona também fora do Claude (GitHub Pages, hospedagem própria etc).
  async function baixarArquivo(filename, content, mimeType) {
    try {
      var downloads = window.claude && (await window.claude.use("downloads"));
      if (downloads) { await downloads.save({ filename: filename, data: content }); return true; }
    } catch (e) { console.warn("downloads capability failed", e); }
    try {
      var blob = new Blob([content], { type: mimeType + ";charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch (e2) { console.warn("fallback download failed", e2); return false; }
  }

  async function exportarCSV() {
    var linhas = ["Titulo,Valor,Categoria,Vencimento,Status,Recorrente,Parcela,Pagamento"];
    App.state.lancamentos.forEach(function (l) {
      var parcelaInfo = l.totalParcelas > 1 ? (l.parcelaAtual + "/" + l.totalParcelas) : "";
      linhas.push([l.titulo, l.valor.toFixed(2), l.categoria, l.vencimento, l.status, l.recorrente ? "Sim" : "Não", parcelaInfo, l.meioPagamento || ""].map(function (v) {
        var s = String(v);
        return s.indexOf(",") >= 0 ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(","));
    });
    var ok = await baixarArquivo("lancamentos.csv", linhas.join("\n"), "text/csv");
    App.ui.toast(ok ? "CSV exportado" : "Não foi possível exportar agora");
  }

  async function exportarBackup() {
    var payload = JSON.stringify({ tipo: "controle-financeiro-backup", versao: 2, exportadoEm: u.todayISO(), dados: App.state }, null, 2);
    var ok = await baixarArquivo("backup-controle-financeiro.json", payload, "application/json");
    App.ui.toast(ok ? "Backup exportado" : "Não foi possível exportar agora");
  }

  function importarBackup(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var dados = parsed && parsed.dados ? parsed.dados : parsed;
        if (!dados || !Array.isArray(dados.lancamentos) || !Array.isArray(dados.cartoes)) {
          App.ui.toast("Arquivo de backup inválido");
          return;
        }
        if (!window.confirm("Importar este backup vai substituir todos os dados atuais. Continuar?")) return;
        var base = App.data.defaultState();
        var salariosImportados = dados.salarios || {};
        // Compatibilidade com backups antigos (v2 sem salário por mês): se não
        // houver mapa de salários mas existir o antigo campo único, usa-o a
        // partir do mês da exportação.
        if (Object.keys(salariosImportados).length === 0 && dados.salario) {
          var mesRef = (parsed && parsed.exportadoEm ? parsed.exportadoEm : u.todayISO()).slice(0, 7);
          salariosImportados[mesRef] = Number(dados.salario) || 0;
        }
        App.state = Object.assign(base, {
          salario: Number(dados.salario) || 0,
          salarios: salariosImportados,
          cartoes: App.data.normalizarContas(dados.cartoes),
          poupancas: dados.poupancas || [],
          movPoupanca: dados.movPoupanca || [],
          lancamentos: dados.lancamentos,
          entradas: dados.entradas || [],
          versaoSaldo: dados.versaoSaldo || 0, // backup antigo (0): migrarEstado não deixa o histórico negativar as contas
          receitasExtras: dados.receitasExtras || [],
          categoriasCustom: dados.categoriasCustom || [],
          metas: dados.metas || {},
          metasCategoria: dados.metasCategoria || {},
          pinHash: dados.pinHash || null,
          prefs: Object.assign(base.prefs, dados.prefs || {})
        });
        App.data.migrarEstado(App.state);
        App.data.saveState();
        App.ui.render();
        App.ui.toast("Backup importado");
      } catch (e) {
        console.warn("import failed", e);
        App.ui.toast("Não foi possível ler esse arquivo");
      }
    };
    reader.readAsText(file);
  }

  // Força uma sincronização completa do app: desregistra o service worker
  // atual, apaga todo o Cache Storage (os arquivos estáticos que ficam
  // guardados no aparelho para uso offline) e recarrega a página ignorando
  // o cache do navegador. Isso resolve o caso comum de PWA instalado na
  // tela inicial que continua preso numa versão antiga porque o service
  // worker serve os arquivos em cache antes de checar a rede. Não mexe no
  // localStorage, então nenhum lançamento, cartão ou configuração é apagado.
  async function forcarSincronizacao() {
    if (App.ui && App.ui.toast) App.ui.toast("Sincronizando...");
    try {
      if ("serviceWorker" in navigator) {
        var regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(function (r) { return r.unregister().catch(function () {}); }));
      }
    } catch (e) { console.warn("unregister sw failed", e); }
    try {
      if (window.caches && caches.keys) {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }
    } catch (e2) { console.warn("clear caches failed", e2); }
    setTimeout(function () {
      var base = location.href.split("#")[0].split("?")[0];
      location.href = base + "?sync=" + Date.now();
    }, 300);
  }

  // ---- Relatório mensal (para exportar/imprimir como PDF) ----
  // Sem biblioteca de PDF, a forma mais confiável e 100% offline de gerar um
  // PDF é montar uma página HTML bem formatada e abrir o diálogo de
  // impressão do navegador — "Salvar como PDF" é uma opção nativa em
  // praticamente todo navegador/celular.
  function gerarRelatorioMensal(mes) {
    var data = App.data;
    var despesas = data.despesasDoMes(mes);
    var renda = data.rendaTotalDoMes(mes);
    var saldo = renda - despesas;
    var categorias = data.gastosPorCategoria(mes);
    var lancamentos = data.lancamentosDoMes(mes).slice().sort(function (a, b) { return a.vencimento.localeCompare(b.vencimento); });
    var metasCat = data.metasCategoriaStatus(mes);
    var mesLabel = u.capitalize(u.fmtMonth(mes));

    var linhasCategorias = categorias.map(function (c) {
      var pct = despesas > 0 ? ((c.valor / despesas) * 100).toFixed(0) : 0;
      return "<tr><td><span class=\"dot\" style=\"background:" + c.cor + "\"></span>" + c.categoria + "</td><td class=\"num\">" +
        u.fmtBRL.format(c.valor) + "</td><td class=\"num\">" + pct + "%</td></tr>";
    }).join("") || "<tr><td colspan=\"3\" class=\"vazio\">Sem gastos neste mês.</td></tr>";

    var linhasMetas = metasCat.map(function (m) {
      return "<tr><td>" + m.categoria + "</td><td class=\"num\">" + u.fmtBRL.format(m.gasto) + " / " + u.fmtBRL.format(m.alvo) +
        "</td><td class=\"num\">" + m.pct.toFixed(0) + "%</td></tr>";
    }).join("");

    var linhasLancamentos = lancamentos.map(function (l) {
      return "<tr><td>" + u.fmtDate(l.vencimento) + "</td><td>" + u.escapeHtml(l.titulo) + "</td><td>" + l.categoria +
        "</td><td>" + (l.status === "pago" ? "Pago" : "Em aberto") + "</td><td class=\"num\">" + u.fmtBRL.format(l.valor) + "</td></tr>";
    }).join("") || "<tr><td colspan=\"5\" class=\"vazio\">Nenhum lançamento neste mês.</td></tr>";

    var html =
      "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\"><title>Relatório · " + mesLabel + "</title><style>" +
      "body{font-family:Arial,Helvetica,sans-serif;color:#16211C;margin:32px;}" +
      "h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;color:#57645C;font-weight:normal;margin:0 0 22px}" +
      ".cards{display:flex;gap:14px;margin-bottom:26px}.card{flex:1;border:1px solid #D9DCD4;border-radius:10px;padding:12px 14px}" +
      ".card .label{font-size:11px;color:#57645C;margin-bottom:4px}.card .val{font-size:19px;font-weight:bold}" +
      ".pos{color:#0C9A76}.neg{color:#D23A4E}" +
      "table{width:100%;border-collapse:collapse;margin-bottom:26px;font-size:12.5px}" +
      "th{text-align:left;font-size:11px;color:#57645C;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid #D9DCD4;padding:6px 8px}" +
      "td{padding:7px 8px;border-bottom:1px solid #EEF0EC}.num{text-align:right;font-variant-numeric:tabular-nums}" +
      ".dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}" +
      ".vazio{text-align:center;color:#97A399;padding:16px}" +
      "h3{font-size:13px;margin:0 0 8px}" +
      "footer{font-size:10.5px;color:#97A399;margin-top:30px;text-align:center}" +
      "@media print{body{margin:12mm}}" +
      "</style></head><body>" +
      "<h1>Controle Financeiro</h1><h2>Relatório de " + mesLabel + "</h2>" +
      "<div class=\"cards\">" +
        "<div class=\"card\"><div class=\"label\">Renda total</div><div class=\"val\">" + u.fmtBRL.format(renda) + "</div></div>" +
        "<div class=\"card\"><div class=\"label\">Despesas</div><div class=\"val\">" + u.fmtBRL.format(despesas) + "</div></div>" +
        "<div class=\"card\"><div class=\"label\">Saldo</div><div class=\"val " + (saldo >= 0 ? "pos" : "neg") + "\">" + u.fmtBRL.format(saldo) + "</div></div>" +
      "</div>" +
      "<h3>Gastos por categoria</h3>" +
      "<table><thead><tr><th>Categoria</th><th class=\"num\">Valor</th><th class=\"num\">%</th></tr></thead><tbody>" + linhasCategorias + "</tbody></table>" +
      (linhasMetas ? "<h3>Metas por categoria</h3><table><thead><tr><th>Categoria</th><th class=\"num\">Gasto / meta</th><th class=\"num\">%</th></tr></thead><tbody>" + linhasMetas + "</tbody></table>" : "") +
      "<h3>Lançamentos do mês</h3>" +
      "<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Status</th><th class=\"num\">Valor</th></tr></thead><tbody>" + linhasLancamentos + "</tbody></table>" +
      "<footer>Gerado em " + u.fmtDate(u.todayISO()) + " pelo Controle Financeiro</footer>" +
      "<script>window.onload=function(){setTimeout(function(){window.print();},300);};<" + "/script>" +
      "</body></html>";

    var win = window.open("", "_blank");
    if (!win) { App.ui.toast("Permita pop-ups para gerar o relatório"); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  App.backup = {
    exportarCSV: exportarCSV,
    exportarBackup: exportarBackup,
    importarBackup: importarBackup,
    baixarArquivo: baixarArquivo,
    forcarSincronizacao: forcarSincronizacao,
    gerarRelatorioMensal: gerarRelatorioMensal
  };
})(window.App);
