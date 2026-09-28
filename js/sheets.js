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
  // Sem `existing`: cria cartão novo. Com `existing`: edita nome, limite e dia
  // de vencimento do cartão já cadastrado, sem precisar excluir e recriar.
  function openCartaoSheet(existing) {
    var editMode = !!existing;
    var root = document.getElementById("modalRoot");
    var corAtual = (editMode && existing.cor) ? existing.cor : data.corCartao(editMode ? existing.id : "__novo__");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>' + (editMode ? "Editar cartão" : "Novo cartão") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Nome<input id="fNome" type="text" placeholder="Ex: Nubank" value="' + (editMode ? u.escapeHtml(existing.nome) : "") + '">' +
            '<span class="field-error-msg" id="errNome"></span></label>' +
          '<div class="row2">' +
            '<label class="field">Limite<input id="fLimite" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="' + (editMode ? existing.limite : "") + '">' +
              '<span class="field-error-msg" id="errLimite"></span></label>' +
            '<label class="field">Cor de destaque<input id="fCor" type="color" value="' + corAtual + '" style="height:42px;padding:4px"></label>' +
          "</div>" +
          '<div class="row2">' +
            '<label class="field">Dia de fechamento (opcional)<input id="fDiaFech" type="number" inputmode="numeric" min="1" max="31" placeholder="Ex: 3" value="' + (editMode && existing.diaFechamento ? existing.diaFechamento : "") + '">' +
              '<span class="field-error-msg" id="errDiaFech"></span></label>' +
            '<label class="field">Dia de vencimento (opcional)<input id="fDiaVenc" type="number" inputmode="numeric" min="1" max="31" placeholder="Ex: 10" value="' + (editMode && existing.diaVencimento ? existing.diaVencimento : "") + '">' +
              '<span class="field-error-msg" id="errDiaVenc"></span></label>' +
          "</div>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:-6px 0 12px">Com fechamento e vencimento definidos, o app calcula sozinho em qual fatura cada compra cai — como no cartão de verdade.</p>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSave">Salvar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    document.getElementById("fSave").addEventListener("click", function () {
      clearAllErrors([["fNome", "errNome"], ["fLimite", "errLimite"], ["fDiaVenc", "errDiaVenc"], ["fDiaFech", "errDiaFech"]]);
      var nome = document.getElementById("fNome").value.trim();
      var limite = document.getElementById("fLimite").value;
      var cor = document.getElementById("fCor").value;
      var diaVencRaw = document.getElementById("fDiaVenc").value;
      var diaFechRaw = document.getElementById("fDiaFech").value;
      var ok = true;
      if (!nome) { setFieldError("fNome", "errNome", "Dê um nome ao cartão"); ok = false; }
      var limiteNum = parseFloat(limite);
      if (limite === "" || isNaN(limiteNum) || limiteNum < 0) { setFieldError("fLimite", "errLimite", "Informe um limite válido"); ok = false; }
      var diaVencNum = null;
      if (diaVencRaw !== "") {
        diaVencNum = parseInt(diaVencRaw, 10);
        if (isNaN(diaVencNum) || diaVencNum < 1 || diaVencNum > 31) { setFieldError("fDiaVenc", "errDiaVenc", "Dia entre 1 e 31"); ok = false; }
      }
      var diaFechNum = null;
      if (diaFechRaw !== "") {
        diaFechNum = parseInt(diaFechRaw, 10);
        if (isNaN(diaFechNum) || diaFechNum < 1 || diaFechNum > 31) { setFieldError("fDiaFech", "errDiaFech", "Dia entre 1 e 31"); ok = false; }
      }
      if (!ok) return;

      if (editMode) {
        Object.assign(existing, { nome: nome, limite: limiteNum, diaVencimento: diaVencNum, diaFechamento: diaFechNum, cor: cor });
        data.saveState();
        closeSheet();
        App.ui.render();
        App.ui.toastSuccess("Cartão atualizado");
        return;
      }

      App.state.cartoes.push({ id: u.uid(), nome: nome, limite: limiteNum, diaVencimento: diaVencNum, diaFechamento: diaFechNum, cor: cor });
      data.saveState();
      closeSheet();
      App.ui.render();
      App.ui.toastSuccess("Cartão adicionado");
    });
  }

  // ---- Lançamento ----
  // Sem `existing`: cria um lançamento novo (com opção de recorrência/parcelamento).
  // Com `existing`: edita os campos básicos daquele lançamento específico (a
  // recorrência/parcelamento em si não é alterada — só o item selecionado).
  function openLancamentoSheet(existing) {
    var editMode = !!existing;
    var root = document.getElementById("modalRoot");
    var cartaoOptions = App.state.cartoes.map(function (c) {
      return '<option value="' + c.id + '"' + (editMode && existing.cartaoId === c.id ? " selected" : "") + '>' + u.escapeHtml(c.nome) + "</option>";
    }).join("");
    var catOptions = data.categoriasTodas().map(function (c) {
      return '<option value="' + c + '"' + (editMode && existing.categoria === c ? " selected" : "") + '>' + c + "</option>";
    }).join("");
    var meioOptions = data.MEIOS.map(function (m) {
      return '<option value="' + m + '"' + (editMode && existing.meioPagamento === m ? " selected" : "") + '>' + m + "</option>";
    }).join("");

    var tipoInfo = "";
    if (editMode && existing.totalParcelas > 1) {
      tipoInfo = '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Parcela ' + existing.parcelaAtual + "/" + existing.totalParcelas + " — editar aqui altera só esta parcela.</p>";
    } else if (editMode && existing.recorrente) {
      tipoInfo = '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 12px">Lançamento recorrente — editar aqui altera só este mês.</p>';
    }

    var comprovanteAtual = editMode ? (existing.comprovante || null) : null;

    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>' + (editMode ? "Editar lançamento" : "Novo lançamento") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          tipoInfo +
          '<label class="field">Descrição<input id="fTitulo" type="text" placeholder="Ex: Supermercado" autocomplete="off" value="' + (editMode ? u.escapeHtml(existing.titulo) : "") + '">' +
            '<span class="field-error-msg" id="errTitulo"></span>' +
            '<span class="cat-suggest-hint" id="catSuggestHint" style="display:none"></span>' +
          "</label>" +
          '<div class="row2">' +
            '<label class="field">Valor<input id="fValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="' + (editMode ? existing.valor : "") + '">' +
              '<span class="field-error-msg" id="errValor"></span></label>' +
            '<label class="field" id="dataCompraWrap" style="display:none">Data da compra<input id="fDataCompra" type="date" value="' + u.todayISO() + '"></label>' +
          "</div>" +
          '<label class="field" id="vencimentoWrap">Vencimento<input id="fData" type="date" value="' + (editMode ? existing.vencimento : new Date().toISOString().slice(0, 10)) + '">' +
            '<span class="field-error-msg" id="errData"></span>' +
            '<span class="fatura-hint" id="faturaHint" style="display:none"></span></label>' +
          '<label class="field">Categoria<select id="fCategoria">' + catOptions + "</select>" +
            '<button type="button" class="meta-edit-link" id="btnGerenciarCategorias" style="margin-top:6px">gerenciar categorias</button></label>' +
          '<label class="field">Pagamento<select id="fMeio">' + meioOptions + "</select></label>" +
          '<div id="cartaoWrap" style="display:none"><label class="field">Cartão<select id="fCartao"><option value="">Nenhum</option>' + cartaoOptions + "</select></label></div>" +
          (editMode ? "" :
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
            "</div>"
          ) +
          '<label class="field">Comprovante (opcional)' +
            '<div class="comprovante-box" id="comprovanteBox">' +
              (comprovanteAtual
                ? '<img src="' + comprovanteAtual + '" id="comprovantePreview" class="comprovante-thumb"><button type="button" class="meta-edit-link" id="btnRemoverComprovante" style="color:var(--red)">remover</button>'
                : '<button type="button" class="btn btn-ghost" id="btnAnexarComprovante">' + ICONS.camera.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Anexar foto</button>") +
              '<input type="file" id="fComprovante" accept="image/*" capture="environment" style="display:none">' +
            "</div>" +
          "</label>" +
          '<div class="btn-row"><button class="btn btn-primary" id="fSave">' + (editMode ? "Salvar alterações" : "Salvar") + "</button></div>" +
        "</div>" +
      "</div>";
    bindBackdropClose(root);

    var meioSelect = document.getElementById("fMeio");
    var cartaoWrap = document.getElementById("cartaoWrap");
    var cartaoSelect = document.getElementById("fCartao");
    var dataInput = document.getElementById("fData");
    var dataCompraWrap = document.getElementById("dataCompraWrap");
    var dataCompraInput = document.getElementById("fDataCompra");
    var faturaHint = document.getElementById("faturaHint");
    var vencimentoWrap = document.getElementById("vencimentoWrap");

    function syncCartaoWrap() { cartaoWrap.style.display = meioSelect.value === "Cartão de crédito" ? "block" : "none"; }
    meioSelect.addEventListener("change", function () { syncCartaoWrap(); syncFechamento(); });
    syncCartaoWrap();

    // Quando o cartão selecionado tem dia de fechamento configurado, troca
    // pro fluxo "data da compra → vencimento calculado automaticamente",
    // igual à fatura de um cartão de verdade. Sem fechamento configurado,
    // mantém o comportamento simples de antes (escolher o vencimento direto,
    // com sugestão da próxima data de vencimento do cartão).
    function cartaoSelecionado() {
      return App.state.cartoes.filter(function (c) { return c.id === cartaoSelect.value; })[0];
    }
    function syncFechamento() {
      var c = (!editMode && meioSelect.value === "Cartão de crédito") ? cartaoSelecionado() : null;
      if (c && c.diaFechamento) {
        dataCompraWrap.style.display = "block";
        vencimentoWrap.style.display = "none";
        recalcularFatura();
      } else {
        dataCompraWrap.style.display = "none";
        vencimentoWrap.style.display = "block";
        faturaHint.style.display = "none";
      }
    }
    function recalcularFatura() {
      var c = cartaoSelecionado();
      if (!c || !c.diaFechamento) return;
      var venc = data.calcularVencimentoFatura(c, dataCompraInput.value || u.todayISO());
      if (venc) {
        dataInput.value = venc;
        faturaHint.style.display = "block";
        faturaHint.textContent = "Cai na fatura que vence em " + u.fmtDate(venc) + ".";
      }
    }
    dataCompraInput.addEventListener("change", recalcularFatura);

    // Sem fechamento configurado: ao escolher um cartão com dia de
    // vencimento, preenche a data automaticamente com a próxima data de
    // vencimento dele.
    cartaoSelect.addEventListener("change", function () {
      syncFechamento();
      if (!cartaoSelect.value) return;
      var c = cartaoSelecionado();
      if (!editMode && c && c.diaFechamento) return; // já tratado por syncFechamento/recalcularFatura
      var proxima = data.proximoVencimentoCartao(cartaoSelect.value);
      if (proxima) dataInput.value = proxima;
    });
    syncFechamento();

    var tipoSelect = document.getElementById("fTipo");
    if (tipoSelect) {
      var recorrenteWrap = document.getElementById("recorrenteWrap");
      var parceladoWrap = document.getElementById("parceladoWrap");
      var syncTipoWrap = function () {
        recorrenteWrap.style.display = tipoSelect.value === "recorrente" ? "block" : "none";
        parceladoWrap.style.display = tipoSelect.value === "parcelado" ? "block" : "none";
      };
      tipoSelect.addEventListener("change", syncTipoWrap);
      syncTipoWrap();
    }

    // ---- Categorização automática ----
    // Só sugere em lançamentos novos (editar um já existente não deveria
    // ficar "adivinhando" por cima do que o usuário já escolheu). Se o
    // usuário mexer manualmente na categoria, para de sugerir a partir daí.
    var categoriaSelect = document.getElementById("fCategoria");
    var tituloInput = document.getElementById("fTitulo");
    var catSuggestHint = document.getElementById("catSuggestHint");
    var categoriaTocadaManualmente = false;
    categoriaSelect.addEventListener("change", function () { categoriaTocadaManualmente = true; catSuggestHint.style.display = "none"; });
    if (!editMode) {
      var onTituloInput = u.debounce(function () {
        if (categoriaTocadaManualmente) return;
        var sugestao = data.sugerirCategoria(tituloInput.value);
        if (sugestao) {
          categoriaSelect.value = sugestao;
          catSuggestHint.style.display = "inline";
          catSuggestHint.textContent = "Categoria sugerida com base no histórico";
        } else {
          catSuggestHint.style.display = "none";
        }
      }, 300);
      tituloInput.addEventListener("input", onTituloInput);
    }

    // ---- Comprovante ----
    var fComprovante = document.getElementById("fComprovante");
    function bindAnexarBtn() {
      var btn = document.getElementById("btnAnexarComprovante");
      if (btn) btn.addEventListener("click", function () { fComprovante.click(); });
      var btnRemover = document.getElementById("btnRemoverComprovante");
      if (btnRemover) btnRemover.addEventListener("click", function () {
        comprovanteAtual = null;
        document.getElementById("comprovanteBox").innerHTML =
          '<button type="button" class="btn btn-ghost" id="btnAnexarComprovante">' + ICONS.camera.replace("<svg ", '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px" ') + "Anexar foto</button>";
        document.getElementById("comprovanteBox").appendChild(fComprovante);
        bindAnexarBtn();
      });
    }
    bindAnexarBtn();
    fComprovante.addEventListener("change", async function () {
      var file = fComprovante.files[0];
      if (!file) return;
      try {
        var dataUrl = await u.comprimirImagem(file, 900, 0.7);
        comprovanteAtual = dataUrl;
        document.getElementById("comprovanteBox").innerHTML =
          '<img src="' + dataUrl + '" id="comprovantePreview" class="comprovante-thumb"><button type="button" class="meta-edit-link" id="btnRemoverComprovante" style="color:var(--red)">remover</button>';
        document.getElementById("comprovanteBox").appendChild(fComprovante);
        bindAnexarBtn();
      } catch (e) {
        console.warn("comprimir comprovante falhou", e);
        App.ui.toast("Não foi possível anexar essa imagem");
      }
    });

    document.getElementById("btnGerenciarCategorias").addEventListener("click", function () {
      openCategoriaManageSheet(function () { closeSheet(); openLancamentoSheet(existing); });
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
      var categoria = categoriaSelect.value;

      if (editMode) {
        Object.assign(existing, {
          titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, comprovante: comprovanteAtual
        });
        data.saveState();
        closeSheet();
        App.ui.render();
        App.ui.toastSuccess("Lançamento atualizado");
        return;
      }

      var tipo = tipoSelect.value;

      function addLancamento(overrides) {
        App.state.lancamentos.push(Object.assign({
          id: u.uid(), titulo: titulo, valor: valor, categoria: categoria,
          vencimento: vencimento, meioPagamento: meio, cartaoId: cartaoId, status: "aberto",
          recorrente: false, totalParcelas: 1, parcelaAtual: 1, grupoId: null, comprovante: comprovanteAtual
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

  // ---- Edição em massa de lançamentos ----
  function openBulkEditSheet(ids) {
    var root = document.getElementById("modalRoot");
    var catOptions = '<option value="">Não alterar</option>' + data.categoriasTodas().map(function (c) {
      return '<option value="' + c + '">' + c + "</option>";
    }).join("");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Editar ' + ids.length + (ids.length === 1 ? " lançamento" : " lançamentos") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<label class="field">Categoria<select id="fBulkCategoria">' + catOptions + "</select></label>" +
          '<label class="field">Status<select id="fBulkStatus">' +
            '<option value="">Não alterar</option>' +
            '<option value="aberto">Em aberto</option>' +
            '<option value="pago">Pago</option>' +
          "</select></label>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px">Só os campos escolhidos serão alterados nos lançamentos selecionados.</p>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fSaveBulk">Aplicar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    document.getElementById("fSaveBulk").addEventListener("click", function () {
      var cat = document.getElementById("fBulkCategoria").value;
      var status = document.getElementById("fBulkStatus").value;
      if (!cat && !status) { App.ui.toast("Escolha ao menos um campo para alterar"); return; }
      App.state.lancamentos.forEach(function (l) {
        if (ids.indexOf(l.id) === -1) return;
        if (cat) l.categoria = cat;
        if (status) l.status = status;
      });
      data.saveState();
      closeSheet();
      App.ui.exitSelecao();
      App.ui.render();
      App.ui.toastSuccess("Lançamentos atualizados");
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

  // ---- Metas por categoria ----
  function openMetaCategoriaSheet(mes) {
    var root = document.getElementById("modalRoot");
    function renderLista() {
      var status = data.metasCategoriaStatus(mes);
      if (!status.length) return '<p style="font-size:13px;color:var(--ink-soft);margin:0 0 14px">Nenhuma meta por categoria ainda.</p>';
      return '<div class="cat-meta-list">' + status.map(function (m) {
        return '<div class="cat-meta-row">' +
          '<span class="chart-legend-dot" style="background:' + m.cor + '"></span>' +
          '<span class="cat-meta-nome">' + m.categoria + "</span>" +
          '<span class="cat-meta-valores num">' + u.fmtBRL.format(m.gasto) + " / " + u.fmtBRL.format(m.alvo) + "</span>" +
          '<button class="icon-btn icon-btn-del" data-del-meta-cat="' + m.categoria + '" aria-label="Remover">' + ICONS.trash + "</button>" +
        "</div>";
      }).join("") + "</div>";
    }
    var catOptions = data.categoriasTodas().map(function (c) { return '<option value="' + c + '">' + c + "</option>"; }).join("");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Metas por categoria — ' + u.fmtMonth(mes) + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<div id="metaCatList">' + renderLista() + "</div>" +
          '<div class="row2">' +
            '<label class="field">Categoria<select id="fMetaCatCategoria">' + catOptions + "</select></label>" +
            '<label class="field">Valor máximo<input id="fMetaCatValor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"></label>' +
          "</div>" +
          '<div class="btn-row"><button class="btn btn-primary" id="fSaveMetaCat">Adicionar / atualizar</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    function bindDelButtons() {
      document.querySelectorAll("[data-del-meta-cat]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          data.removerMetaCategoria(mes, btn.getAttribute("data-del-meta-cat"));
          data.saveState();
          document.getElementById("metaCatList").innerHTML = renderLista();
          bindDelButtons();
          App.ui.render();
        });
      });
    }
    bindDelButtons();
    document.getElementById("fSaveMetaCat").addEventListener("click", function () {
      var cat = document.getElementById("fMetaCatCategoria").value;
      var valor = parseFloat(document.getElementById("fMetaCatValor").value);
      if (isNaN(valor) || valor <= 0) { App.ui.toast("Informe um valor maior que zero"); return; }
      data.definirMetaCategoria(mes, cat, valor);
      data.saveState();
      document.getElementById("fMetaCatValor").value = "";
      document.getElementById("metaCatList").innerHTML = renderLista();
      bindDelButtons();
      App.ui.render();
      App.ui.toastSuccess("Meta salva");
    });
  }

  // ---- Visualizar comprovante em tela cheia ----
  function openComprovanteViewSheet(dataUrl, titulo) {
    var root = document.getElementById("modalRoot");
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet sheet-comprovante">' +
          '<div class="sheet-head"><h2>' + u.escapeHtml(titulo || "Comprovante") + '</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<img src="' + dataUrl + '" class="comprovante-full">' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
  }

  // ---- Perfis (múltiplos usuários) ----
  function openPerfilSheet() {
    var root = document.getElementById("modalRoot");
    function renderLista() {
      var atual = data.perfilAtual();
      return data.listaPerfis().map(function (nome) {
        return '<div class="perfil-row' + (nome === atual ? " ativo" : "") + '" data-perfil="' + u.escapeHtml(nome) + '">' +
          '<span class="perfil-nome">' + ICONS.user.replace("<svg ", '<svg style="width:15px;height:15px;vertical-align:-3px;margin-right:6px" ') + u.escapeHtml(nome) + (nome === atual ? ' <span class="badge badge-em-breve">atual</span>' : "") + "</span>" +
          '<div>' +
            (nome === atual ? "" : '<button class="btn-bulk" data-usar-perfil="' + u.escapeHtml(nome) + '">Usar</button>') +
            '<button class="icon-btn" data-renomear-perfil="' + u.escapeHtml(nome) + '" aria-label="Renomear">' + ICONS.edit + "</button>" +
            (data.listaPerfis().length > 1 ? '<button class="icon-btn icon-btn-del" data-excluir-perfil="' + u.escapeHtml(nome) + '" aria-label="Excluir">' + ICONS.trash + "</button>" : "") +
          "</div>" +
        "</div>";
      }).join("");
    }
    root.innerHTML =
      '<div class="sheet-backdrop" id="backdrop">' +
        '<div class="sheet">' +
          '<div class="sheet-head"><h2>Perfis</h2><button class="icon-btn" id="closeSheet">' + ICONS.close + "</button></div>" +
          '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 14px">Cada perfil guarda seus próprios dados neste aparelho — útil pra separar contas ou dividir o app com alguém. Pra levar um perfil pra outro aparelho, use exportar/importar backup em Ajustes.</p>' +
          '<div id="perfilList">' + renderLista() + "</div>" +
          '<label class="field" style="margin-top:14px">Novo perfil<input id="fNovoPerfil" type="text" placeholder="Ex: Maria"></label>' +
          '<div class="btn-row"><button class="btn btn-primary" id="fAddPerfil">Criar perfil</button></div>' +
        "</div>" +
      "</div>";
    bindBackdropClose(root);
    function bind() {
      document.querySelectorAll("[data-usar-perfil]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          data.trocarPerfil(btn.getAttribute("data-usar-perfil"));
          closeSheet();
          App.ui.render();
          App.ui.toastSuccess("Perfil alterado");
        });
      });
      document.querySelectorAll("[data-renomear-perfil]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nome = btn.getAttribute("data-renomear-perfil");
          var novo = window.prompt("Novo nome para \"" + nome + "\":", nome);
          if (!novo || novo.trim() === nome) return;
          if (!data.renomearPerfil(nome, novo.trim())) { App.ui.toast("Já existe um perfil com esse nome"); return; }
          document.getElementById("perfilList").innerHTML = renderLista();
          bind();
          App.ui.render();
        });
      });
      document.querySelectorAll("[data-excluir-perfil]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var nome = btn.getAttribute("data-excluir-perfil");
          if (!window.confirm('Excluir o perfil "' + nome + '" e todos os seus dados? Essa ação não pode ser desfeita.')) return;
          data.excluirPerfil(nome);
          document.getElementById("perfilList").innerHTML = renderLista();
          bind();
          App.ui.render();
        });
      });
    }
    bind();
    document.getElementById("fAddPerfil").addEventListener("click", function () {
      var input = document.getElementById("fNovoPerfil");
      var nome = input.value.trim();
      if (!nome) return;
      if (!data.criarPerfil(nome)) { App.ui.toast("Já existe um perfil com esse nome"); return; }
      input.value = "";
      document.getElementById("perfilList").innerHTML = renderLista();
      bind();
      App.ui.toastSuccess("Perfil criado");
    });
  }

  App.sheets = {
    openCartaoSheet: openCartaoSheet, openLancamentoSheet: openLancamentoSheet,
    openCategoriaManageSheet: openCategoriaManageSheet, openMetaSheet: openMetaSheet,
    openReceitaExtraSheet: openReceitaExtraSheet, openPinConfigSheet: openPinConfigSheet,
    openBulkEditSheet: openBulkEditSheet, openMetaCategoriaSheet: openMetaCategoriaSheet,
    openComprovanteViewSheet: openComprovanteViewSheet, openPerfilSheet: openPerfilSheet,
    closeSheet: closeSheet
  };
})(window.App);
