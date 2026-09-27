// ==== SHEETS (modais em bottom-sheet) =======================================
window.App = window.App || {};

(function (App) {
  "use strict";
  var u = App.utils, ICONS = App.ICONS, data = App.data;

  function closeSheet() { document.getElementById("modalRoot").innerHTML = ""; }

  function setFieldError(inputId, msgId, message) {
    var input = document.getElementById(inputId), msg = document.getElementById(msgId);
    if (input) input.classList.add("field-error");
    if (msg) { msg.textContent = message; msg.classList.add("show"); }
  }
  function clearFieldError(inputId, msgId) {
    var input = document.getElementById(inputId), msg = document.getElementById(msgId);
    if (input) input.classList.remove("field-error");
    if (msg) { msg.textContent = ""; msg.classList.remove("show"); }
  }
  function clearAllErrors(ids) { ids.forEach(function (pair) { clearFieldError(pair[0], pair[1]); }); }

  function bindBackdropClose(root) {
    document.getElementById("closeSheet").addEventListener("click", closeSheet);
    document.getElementById("backdrop").addEventListener("click", function (e) { if (e.target.id === "backdrop") closeSheet(); });
  }

  // ---- Cartão ----
  function openCartaoSheet() {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Novo cartão</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Nome<input id="fNome" type="text" placeholder="Ex: Nubank">' +
            '<span class="field-error-msg" id="errNome"></span></label>' +
          '<label class="field">Limite<input id="fLimite" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00">' +
            '<span class="field-error-msg" id="errLimite"></span></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSave">Salvar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    document.getElementById("fSave").addEventListener("click", function () {
      clearAllErrors([["fNome", "errNome"], ["fLimite", "errLimite"]]);
      var nome = document.getElementById("fNome").value.trim();
      var limite = document.getElementById("fLimite").value;
      var ok = true;
      if (!nome) { setFieldError("fNome", "errNome", "Dê um nome ao cartão"); ok = false; }
      var limiteNum = parseFloat(limite);
      if (limite === "" || isNaN(limiteNum) || limiteNum < 0) { setFieldError("fLimite", "errLimite", "Informe um limite válido"); ok = false; }
      if (!ok) return;
      App.state.cartoes.push({ id: u.uid(), nome: nome, limite: limiteNum });
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Cartão adicionado");
    });
  }

  // ---- Lançamento ----
  function openLancamentoSheet() {
    var root = document.getElementById("modalRoot");
    var cartaoOptions = App.state.cartoes.map(function (c) { return '<option value="' + c.id + '">' + u.escapeHtml(c.nome) + "</option>"; }).join("");
    var catOptions = data.categoriasTodas().map(function (c) { return '<option value="' + c + '">' + c + "</option>"; }).join("");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Novo lançamento</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Descrição<input id="fTitulo" type="text" placeholder="Ex: Supermercado">' +
            '<span class="field-error-msg" id="errTitulo"></span></label>' +
          '<div class="row2">' +
            '<label class="field">Valor<input id="fValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00">' +
              '<span class="field-error-msg" id="errValor"></span></label>' +
            '<label class="field">Vencimento<input id="fData" type="date" value="' + new Date().toISOString().slice(0, 10) + '">' +
              '<span class="field-error-msg" id="errData"></span></label>' +
          "</div>" +
          '<label class="field">Categoria<select id="fCategoria">' + catOptions + "</select>" +
            '<button type="button" class="meta-edit-link" id="btnGerenciarCategorias" style="margin-top:6px">gerenciar categorias</button></label>' +
          '<label class="field">Pagamento<select id="fMeio">' + data.MEIOS.map(function (m) { return '<option value="' + m + '">' + m + "</option>"; }).join("") + "</select></label>" +
          '<div id="cartaoWrap" style="display:none"><label class="field">Cartão<select id="fCartao"><option value="">Nenhum</option>' + cartaoOptions + "</select></label></div>" +
          '<label class="field">Repetição<select id="fTipo">' +
            '<option value="unico">Único</option>' +
            '<option value="recorrente">Recorrente (repete todo mês)</option>' +
            '<option value="parcelado">Parcelado</option>' +
          "</select></label>" +
          '<div id="recorrenteWrap" class="tipo-fields" style="display:none">' +
            '<label class="field" style="margin-bottom:0">Repetir por quantos meses<input id="fMeses" type="number" min="2" max="60" value="12"></label>' +
          "</div>" +
          '<div id="parceladoWrap" class="tipo-fields" style="display:none">' +
            '<label class="field" style="margin-bottom:0">Número de parcelas (valor acima = valor de cada parcela)<input id="fParcelas" type="number" min="2" max="60" value="2"></label>' +
          "</div>" +
          '<div class="btn-row"><button class="btn btn-primary" id="fSave">Salvar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);

    var meioSelect = document.getElementById("fMeio");
    var cartaoWrap = document.getElementById("cartaoWrap");
    function syncCartaoWrap() { cartaoWrap.style.display = meioSelect.value === "Cartão de crédito" ? "block" : "none"; }
    meioSelect.addEventListener("change", syncCartaoWrap);
    syncCartaoWrap();

    var tipoSelect = document.getElementById("fTipo");
    var recorrenteWrap = document.getElementById("recorrenteWrap");
    var parceladoWrap = document.getElementById("parceladoWrap");
    function syncTipoWrap() {
      recorrenteWrap.style.display = tipoSelect.value === "recorrente" ? "block" : "none";
      parceladoWrap.style.display = tipoSelect.value === "parcelado" ? "block" : "none";
    }
    tipoSelect.addEventListener("change", syncTipoWrap);
    syncTipoWrap();

    document.getElementById("btnGerenciarCategorias").addEventListener("click", function () {
      openCategoriaManageSheet(function () { closeSheet(); openLancamentoSheet(); });
    });

    document.getElementById("fSave").addEventListener("click", function () {
      clearAllErrors([["fTitulo", "errTitulo"], ["fValor", "errValor"], ["fData", "errData"]]);
      var titulo = document.getElementById("fTitulo").value.trim();
      var valorRaw = document.getElementById("fValor").value;
      var valor = parseFloat(valorRaw);
      var vencimento = document.getElementById("fData").value;
      var ok = true;
      if (!titulo) { setFieldError("fTitulo", "errTitulo", "Dê uma descrição pro lançamento"); ok = false; }
      if (valorRaw === "" || isNaN(valor) || valor <= 0) { setFieldError("fValor", "errValor", "Informe um valor maior que zero"); ok = false; }
      if (!vencimento) { setFieldError("fData", "errData", "Escolha uma data de vencimento"); ok = false; }
      if (!ok) return;

      var meio = meioSelect.value;
      var cartaoId = meio === "Cartão de crédito" ? (document.getElementById("fCartao").value || null) : null;
      var categoria = document.getElementById("fCategoria").value;
      var tipo = tipoSelect.value;

      function addLancamento(overrides) {
        App.state.lancamentos.push(Object.assign({
          id: u.uid(), titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, status: "aberto",
          recorrente: false, totalParcelas: 1, parcelaAtual: 1, grupoId: null
        }, overrides));
      }

      if (tipo === "recorrente") {
        var meses = Math.max(2, Math.min(60, parseInt(document.getElementById("fMeses").value, 10) || 12));
        var grupoRec = u.uid();
        for (var i = 0; i < meses; i++) addLancamento({ vencimento: u.addMonthsToDate(vencimento, i), recorrente: true, grupoId: grupoRec });
        App.ui.toastSuccess("Lançamento recorrente criado (" + meses + " meses)");
      } else if (tipo === "parcelado") {
        var totalParc = Math.max(2, Math.min(60, parseInt(document.getElementById("fParcelas").value, 10) || 2));
        var grupoParc = u.uid();
        for (var j = 0; j < totalParc; j++) {
          addLancamento({
            titulo: titulo + " (" + (j + 1) + "/" + totalParc + ")",
            vencimento: u.addMonthsToDate(vencimento, j),
            totalParcelas: totalParc, parcelaAtual: j + 1, grupoId: grupoParc
          });
        }
        App.ui.toastSuccess("Lançamento parcelado em " + totalParc + "x");
      } else {
        addLancamento({});
        App.ui.toastSuccess("Lançamento adicionado");
      }

      data.saveState();
      closeSheet();
      App.ui.render();
    });
  }

  // ---- Categorias personalizadas ----
  function openCategoriaManageSheet(onClose) {
    var root = document.getElementById("modalRoot");
    function renderLista() {
      return App.state.categoriasCustom.map(function (c) {
        return '<span class="cat-chip">' + u.escapeHtml(c) + '<button data-del-cat="' + u.escapeHtml(c) + '">' + ICONS.close + "</button></span>";
      }).join("") || '<p style="font-size:13px;color:var(--ink-soft)">Nenhuma categoria personalizada ainda.</p>';
    }
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Categorias</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 4px">Fixas: ' + data.CATEGORIAS_FIXAS.join(", ") + "</p>" +
          '<p class="card-label" style="margin-top:14px">Suas categorias</p>' +
          '<div class="cat-manage-list" id="catList">' + renderLista() + "</div>" +
          '<label class="field">Nova categoria<input id="fNovaCat" type="text" placeholder="Ex: Pets"></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fAddCat">Adicionar</button></div>' +
        "</div>" +
      "</div>";
    document.getElementById("closeSheet").addEventListener("click", function () { closeSheet(); if (onClose) onClose(); });
    document.getElementById("backdrop").addEventListener("click", function (e) { if (e.target.id === "backdrop") { closeSheet(); if (onClose) onClose(); } });
    function bindDelButtons() {
      document.querySelectorAll("[data-del-cat]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var cat = btn.getAttribute("data-del-cat");
          App.state.categoriasCustom = App.state.categoriasCustom.filter(function (c) { return c !== cat; });
          data.saveState();
          document.getElementById("catList").innerHTML = renderLista();
          bindDelButtons();
        });
      });
    }
    bindDelButtons();
    document.getElementById("fAddCat").addEventListener("click", function () {
      var input = document.getElementById("fNovaCat");
      var nome = input.value.trim();
      if (!nome) return;
      if (data.categoriasTodas().indexOf(nome) !== -1) { App.ui.toast("Essa categoria já existe"); return; }
      App.state.categoriasCustom.push(nome);
      data.saveState();
      input.value = "";
      document.getElementById("catList").innerHTML = renderLista();
      bindDelButtons();
    });
  }

  // ---- Meta de economia ----
  function openMetaSheet(mes) {
    var root = document.getElementById("modalRoot");
    var atual = data.metaDoMes(mes);
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Meta para ' + u.fmtMonth(mes) + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Valor máximo de gastos<input id="fMeta" type="number" inputmode="decimal" step="0.01" min="0" value="' + (atual || "") + '" placeholder="0,00">' +
            '<span class="field-error-msg" id="errMeta"></span></label>' +
          '<div class="btn-row">' +
            (atual ? '<button class="btn btn-ghost" id="fRemoveMeta">Remover meta</button>' : "") +
            '<button class="btn btn-primary" id="fSaveMeta">Salvar</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    if (document.getElementById("fRemoveMeta")) {
      document.getElementById("fRemoveMeta").addEventListener("click", function () {
        delete App.state.metas[mes];
        data.saveState(); closeSheet(); App.ui.render();
      });
    }
    document.getElementById("fSaveMeta").addEventListener("click", function () {
      clearFieldError("fMeta", "errMeta");
      var v = parseFloat(document.getElementById("fMeta").value);
      if (isNaN(v) || v <= 0) { setFieldError("fMeta", "errMeta", "Informe um valor maior que zero"); return; }
      App.state.metas[mes] = v;
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Meta definida");
    });
  }

  // ---- Receita extra ----
  function openReceitaExtraSheet(mes) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Receita extra</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Descrição<input id="fTituloR" type="text" placeholder="Ex: Freelance, bônus">' +
            '<span class="field-error-msg" id="errTituloR"></span></label>' +
          '<label class="field">Valor<input id="fValorR" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00">' +
            '<span class="field-error-msg" id="errValorR"></span></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSaveR">Adicionar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    document.getElementById("fSaveR").addEventListener("click", function () {
      clearAllErrors([["fTituloR", "errTituloR"], ["fValorR", "errValorR"]]);
      var titulo = document.getElementById("fTituloR").value.trim();
      var valor = parseFloat(document.getElementById("fValorR").value);
      var ok = true;
      if (!titulo) { setFieldError("fTituloR", "errTituloR", "Dê uma descrição"); ok = false; }
      if (isNaN(valor) || valor <= 0) { setFieldError("fValorR", "errValorR", "Informe um valor maior que zero"); ok = false; }
      if (!ok) return;
      App.state.receitasExtras.push({ id: u.uid(), titulo: titulo, valor: valor, mes: mes });
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Receita extra adicionada");
    });
  }

  // ---- PIN ----
  function openPinConfigSheet() {
    var root = document.getElementById("modalRoot");
    var ativo = App.security.pinAtivo();
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>' + (ativo ? "Alterar PIN" : "Ativar PIN") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Novo PIN (4 dígitos)<input id="fPin1" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*">' +
            '<span class="field-error-msg" id="errPin1"></span></label>' +
          '<label class="field">Confirme o PIN<input id="fPin2" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]*">' +
            '<span class="field-error-msg" id="errPin2"></span></label>' +
          '<div class="btn-row">' +
            (ativo ? '<button class="btn btn-ghost" id="fRemovePin">Remover PIN</button>' : "") +
            '<button class="btn btn-primary" id="fSavePin">Salvar</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    if (document.getElementById("fRemovePin")) {
      document.getElementById("fRemovePin").addEventListener("click", function () {
        App.security.removerPin(); closeSheet(); App.ui.render(); App.ui.toast("PIN removido");
      });
    }
    document.getElementById("fSavePin").addEventListener("click", function () {
      clearAllErrors([["fPin1", "errPin1"], ["fPin2", "errPin2"]]);
      var p1 = document.getElementById("fPin1").value;
      var p2 = document.getElementById("fPin2").value;
      var ok = true;
      if (!/^[0-9]{4}$/.test(p1)) { setFieldError("fPin1", "errPin1", "Use exatamente 4 números"); ok = false; }
      if (p1 !== p2) { setFieldError("fPin2", "errPin2", "Os PINs não coincidem"); ok = false; }
      if (!ok) return;
      App.security.definirPin(p1);
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("PIN salvo");
    });
  }

  App.sheets = {
    openCartaoSheet: openCartaoSheet, openLancamentoSheet: openLancamentoSheet,
    openCategoriaManageSheet: openCategoriaManageSheet, openMetaSheet: openMetaSheet,
    openReceitaExtraSheet: openReceitaExtraSheet, openPinConfigSheet: openPinConfigSheet,
    closeSheet: closeSheet
  };
})(window.App);
