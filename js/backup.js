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
    var linhas = ["Titulo,Valor,Categoria,Vencimento,Status,Recorrente,Parcela"];
    App.state.lancamentos.forEach(function (l) {
      var parcelaInfo = l.totalParcelas > 1 ? (l.parcelaAtual + "/" + l.totalParcelas) : "";
      linhas.push([l.titulo, l.valor.toFixed(2), l.categoria, l.vencimento, l.status, l.recorrente ? "Sim" : "Não", parcelaInfo].map(function (v) {
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
          cartoes: dados.cartoes,
          lancamentos: dados.lancamentos,
          receitasExtras: dados.receitasExtras || [],
          categoriasCustom: dados.categoriasCustom || [],
          metas: dados.metas || {},
          pinHash: dados.pinHash || null,
          prefs: Object.assign(base.prefs, dados.prefs || {})
        });
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

  App.backup = { exportarCSV: exportarCSV, exportarBackup: exportarBackup, importarBackup: importarBackup, baixarArquivo: baixarArquivo };
})(window.App);
