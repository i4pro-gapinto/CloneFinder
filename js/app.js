/**
 * Clone Finder
 * Carrega a lista de clientes via AJAX e filtra dinamicamente
 * conforme o usuário digita.
 */
(function ($) {
    'use strict';

    var CONFIG = {
        urlDados: 'data/clientes.json',
        urlClone: 'https://{servidor}/i4proclone/',
        urlHead: 'https://{servidor}/{cliente}/',
        atrasoBuscaMs: 150,
        sufixoBanco: '_erp_head',
        servidoresPadrao: ['FLASH', 'FENIX', 'CICLOPE', 'WOLVERINE'],
        chaveArmazenamento: 'cloneFinder.clientesAdicionados',
        chaveAlteracoes: 'cloneFinder.clientesAlterados'
    };

    var $campoBusca = $('#campo-busca');
    var $botaoLimpar = $('#botao-limpar');
    var $lista = $('#lista-clientes');
    var $resumo = $('#resumo');

    var $botaoAdicionar = $('#botao-adicionar');
    var dialogo = document.getElementById('dialogo-cliente');
    var $form = $('#form-cliente');
    var $campoCliente = $('#campo-cliente');
    var $campoBanco = $('#campo-banco');
    var $campoServidor = $('#campo-servidor');
    var $erroCliente = $('#erro-cliente');
    var $tituloDialogo = $('#dialogo-titulo');

    var clientes = [];            // lista exibida (arquivo com alterações + adicionados)
    var clientesArquivo = [];     // vindos de data/clientes.json / clientes.js
    var clientesAdicionados = []; // cadastrados pela tela, guardados no navegador
    var clientesAlterados = {};   // alterações locais de clientes do arquivo, por chaveRegistro() do original
    var servidores = CONFIG.servidoresPadrao.slice();
    var bancoEditadoManualmente = false;
    var emEdicao = null;          // cliente exibido que está sendo alterado (null = cadastro novo)
    var temporizadorBusca = null;

    // ------------------------------------------------------------------
    // Utilitários
    // ------------------------------------------------------------------

    function escaparHtml(texto) {
        return $('<div>').text(texto == null ? '' : String(texto)).html();
    }

    function escaparRegex(texto) {
        return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function normalizar(texto) {
        return String(texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .trim();
    }

    function destacar(texto, termo) {
        var seguro = escaparHtml(texto);
        if (!termo) {
            return seguro;
        }
        var regex = new RegExp('(' + escaparRegex(termo) + ')', 'ig');
        return seguro.replace(regex, '<mark>$1</mark>');
    }

    function montarUrlClone(servidor) {
        return CONFIG.urlClone.replace('{servidor}', encodeURIComponent(servidor));
    }

    function montarUrlHead(servidor, cliente) {
        return CONFIG.urlHead
            .replace('{servidor}', encodeURIComponent(servidor))
            .replace('{cliente}', encodeURIComponent(cliente));
    }

    var ICONES = {
        clonar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
                '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        head:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
                '<path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>',
        editar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
        desfazer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>'
    };

    function renderizarBotao(classe, url, icone, texto) {
        return '<a class="botao ' + classe + '" href="' + escaparHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
            icone + texto + '</a>';
    }

    // ------------------------------------------------------------------
    // Renderização
    // ------------------------------------------------------------------

    function renderizarEstado(mensagem, classeExtra, detalhe) {
        var html = '<tr class="estado ' + (classeExtra || '') + '"><td colspan="5">' +
            escaparHtml(mensagem) +
            (detalhe ? '<small>' + escaparHtml(detalhe) + '</small>' : '') +
            '</td></tr>';
        $lista.html(html);
    }

    function renderizarTag(classe, texto, dica) {
        var dicaSegura = escaparHtml(dica);
        return '<span class="tag-local ' + classe + '" tabindex="0" data-dica="' + dicaSegura +
            '" aria-label="' + escaparHtml(texto) + ': ' + dicaSegura + '">' + escaparHtml(texto) + '</span>';
    }

    function renderizarBotaoLinha(classe, acao, indice, titulo, conteudo) {
        return '<button type="button" class="' + classe + '" data-acao="' + acao + '" data-indice="' + indice +
            '" title="' + escaparHtml(titulo) + '" aria-label="' + escaparHtml(titulo) + '">' + conteudo + '</button>';
    }

    // Marca (LOCAL / ALTERADO) e botões de editar, remover e desfazer ao lado do nome
    function renderizarControles(cliente) {
        var html = '';
        var nome = cliente.cliente;

        if (cliente.adicionado) {
            html += renderizarTag('', 'local',
                'Cliente inserido localmente, salvo apenas neste navegador. ' +
                'Outras pessoas não o veem e ele não faz parte do clientes.json.');
        } else if (cliente.original) {
            html += renderizarTag('tag-local--alterado', 'alterado',
                'Cliente alterado localmente, apenas neste navegador. No clientes.json: ' +
                cliente.original.cliente + ' / ' + cliente.original.banco + ' / ' + cliente.original.servidor + '.');
        }

        html += renderizarBotaoLinha('botao-linha', 'editar', cliente.indice, 'Alterar ' + nome, ICONES.editar);

        if (cliente.adicionado) {
            html += renderizarBotaoLinha('botao-linha botao-linha--perigo', 'remover', cliente.indice, 'Remover ' + nome, '&times;');
        } else if (cliente.original) {
            html += renderizarBotaoLinha('botao-linha', 'desfazer', cliente.indice, 'Desfazer alteração de ' + nome, ICONES.desfazer);
        }
        return html;
    }

    function renderizarLinha(cliente, termo) {
        return [
            '<tr>',
            '  <td class="tabela__cliente">', destacar(cliente.cliente, termo), renderizarControles(cliente), '</td>',
            '  <td class="tabela__banco">', escaparHtml(cliente.banco), '</td>',
            '  <td class="tabela__servidor"><span class="servidor">', destacar(cliente.servidor, termo), '</span></td>',
            '  <td class="tabela__acao">',
                 renderizarBotao('botao--clonar', montarUrlClone(cliente.servidor), ICONES.clonar, 'Clonar'),
            '  </td>',
            '  <td class="tabela__acao">',
                 renderizarBotao('botao--head', montarUrlHead(cliente.servidor, cliente.cliente), ICONES.head, 'Head'),
            '  </td>',
            '</tr>'
        ].join('');
    }

    function renderizarLista(itens, termo) {
        if (!itens.length) {
            renderizarEstado(termo
                ? 'Nenhum cliente encontrado para "' + termo + '".'
                : 'Nenhum cliente cadastrado.');
            return;
        }

        var html = $.map(itens, function (cliente) {
            return renderizarLinha(cliente, termo);
        }).join('');

        $lista.html(html);
    }

    function atualizarResumo(quantidade, termo) {
        var total = clientes.length;
        var texto = termo
            ? 'Exibindo <strong>' + quantidade + '</strong> de ' + total + ' clientes'
            : '<strong>' + total + '</strong> clientes cadastrados';
        $resumo.html(texto);
    }

    // ------------------------------------------------------------------
    // Filtro
    // ------------------------------------------------------------------

    function filtrar(termo) {
        var termoNormalizado = normalizar(termo);
        if (!termoNormalizado) {
            return clientes;
        }
        return $.grep(clientes, function (cliente) {
            return normalizar(cliente.cliente).indexOf(termoNormalizado) !== -1 ||
                   normalizar(cliente.servidor).indexOf(termoNormalizado) !== -1;
        });
    }

    function aplicarBusca() {
        var termo = $.trim($campoBusca.val());
        var resultado = filtrar(termo);

        $botaoLimpar.prop('hidden', termo === '');
        renderizarLista(resultado, termo);
        atualizarResumo(resultado.length, termo);
    }

    function agendarBusca() {
        clearTimeout(temporizadorBusca);
        temporizadorBusca = setTimeout(aplicarBusca, CONFIG.atrasoBuscaMs);
    }

    // ------------------------------------------------------------------
    // Carga dos dados (AJAX)
    // ------------------------------------------------------------------

    function ordenarPorCliente(lista) {
        return lista.slice().sort(function (a, b) {
            return normalizar(a.cliente).localeCompare(normalizar(b.cliente)) ||
                   normalizar(a.servidor).localeCompare(normalizar(b.servidor));
        });
    }

    function aplicarDados(dados) {
        clientesArquivo = $.isArray(dados) ? dados : (dados && dados.clientes) || [];
        servidores = obterServidores(dados);
        preencherServidores();
        montarListaClientes();
    }

    function obterServidores(dados) {
        if (dados && $.isArray(dados.servidores) && dados.servidores.length) {
            return dados.servidores.slice();
        }
        var unicos = [];
        $.each(clientesArquivo, function (_, cliente) {
            if (cliente.servidor && $.inArray(cliente.servidor, unicos) === -1) {
                unicos.push(cliente.servidor);
            }
        });
        return unicos.length ? unicos : CONFIG.servidoresPadrao.slice();
    }

    function mesmoRegistro(a, b) {
        return normalizar(a.banco) === normalizar(b.banco) &&
               normalizar(a.servidor) === normalizar(b.servidor);
    }

    function chaveRegistro(cliente) {
        return normalizar(cliente.banco) + '|' + normalizar(cliente.servidor);
    }

    function mesmosValores(a, b) {
        return a.cliente === b.cliente && a.banco === b.banco && a.servidor === b.servidor;
    }

    function dadosCliente(c) {
        return { cliente: c.cliente, banco: c.banco, servidor: c.servidor };
    }

    function existeNoArquivo(cliente) {
        return $.grep(clientesArquivo, function (c) { return mesmoRegistro(c, cliente); }).length > 0;
    }

    // Descarta do navegador o que deixou de fazer sentido após o clientes.json mudar:
    // cadastrados que passaram a existir no arquivo, alterações de clientes que saíram
    // do arquivo e alterações iguais ao que já está no arquivo.
    function limparArmazenamentoObsoleto() {
        var pendentes = $.grep(clientesAdicionados, function (c) { return !existeNoArquivo(c); });
        if (pendentes.length !== clientesAdicionados.length) {
            clientesAdicionados = pendentes;
            salvarAdicionados();
        }

        var porChave = {};
        $.each(clientesArquivo, function (_, c) { porChave[chaveRegistro(c)] = c; });

        var mudou = false;
        $.each(clientesAlterados, function (chave, alterado) {
            if (!porChave[chave] || mesmosValores(porChave[chave], alterado)) {
                delete clientesAlterados[chave];
                mudou = true;
            }
        });
        if (mudou) {
            salvarAlteracoes();
        }
    }

    // Junta os clientes do arquivo (com as alterações locais aplicadas) aos cadastrados na tela.
    function montarListaClientes() {
        limparArmazenamentoObsoleto();

        var doArquivo = $.map(clientesArquivo, function (c) {
            var alterado = clientesAlterados[chaveRegistro(c)];
            return alterado
                ? $.extend(dadosCliente(alterado), { original: dadosCliente(c) })
                : dadosCliente(c);
        });
        var adicionados = $.map(clientesAdicionados, function (c) {
            return $.extend(dadosCliente(c), { adicionado: true });
        });

        clientes = ordenarPorCliente(doArquivo.concat(adicionados));
        $.each(clientes, function (i, c) { c.indice = i; });
        aplicarBusca();
    }

    // Dados definidos por data/clientes.js. Carregados via <script>, funcionam
    // mesmo abrindo o index.html direto do disco (file://), onde o AJAX é bloqueado.
    function dadosEmbutidos() {
        return window.CLONE_FINDER_DADOS || null;
    }

    function carregarClientes() {
        var abertoDoDisco = window.location.protocol === 'file:';

        if (abertoDoDisco) {
            if (dadosEmbutidos()) {
                aplicarDados(dadosEmbutidos());
            } else {
                renderizarEstado(
                    'Não foi possível carregar os clientes.',
                    'estado--erro',
                    'O arquivo data/clientes.js não foi encontrado.'
                );
                $resumo.empty();
            }
            return;
        }

        $.ajax({
            url: CONFIG.urlDados,
            dataType: 'json',
            cache: false
        })
        .done(aplicarDados)
        .fail(function (xhr, status, erro) {
            if (dadosEmbutidos()) {
                aplicarDados(dadosEmbutidos());
                return;
            }
            renderizarEstado('Não foi possível carregar os clientes.', 'estado--erro', erro || status);
            $resumo.empty();
        });
    }

    // ------------------------------------------------------------------
    // Armazenamento local do navegador (adicionados e alterados)
    // ------------------------------------------------------------------

    function lerArmazenamento(chave, padrao) {
        try {
            var salvo = JSON.parse(window.localStorage.getItem(chave));
            return salvo != null && $.isArray(salvo) === $.isArray(padrao) ? salvo : padrao;
        } catch (e) {
            return padrao;
        }
    }

    function gravarArmazenamento(chave, valor) {
        try {
            window.localStorage.setItem(chave, JSON.stringify(valor));
            return true;
        } catch (e) {
            return false;
        }
    }

    function carregarArmazenamento() {
        clientesAdicionados = lerArmazenamento(CONFIG.chaveArmazenamento, []);
        clientesAlterados = lerArmazenamento(CONFIG.chaveAlteracoes, {});
    }

    function salvarAdicionados() {
        return gravarArmazenamento(CONFIG.chaveArmazenamento, clientesAdicionados);
    }

    function salvarAlteracoes() {
        return gravarArmazenamento(CONFIG.chaveAlteracoes, clientesAlterados);
    }

    function indiceAdicionado(cliente) {
        for (var i = 0; i < clientesAdicionados.length; i++) {
            if (mesmoRegistro(clientesAdicionados[i], cliente)) {
                return i;
            }
        }
        return -1;
    }

    function removerAdicionado(cliente) {
        var i = indiceAdicionado(cliente);
        if (i !== -1) {
            clientesAdicionados.splice(i, 1);
            salvarAdicionados();
        }
        montarListaClientes();
    }

    function desfazerAlteracao(cliente) {
        delete clientesAlterados[chaveRegistro(cliente.original)];
        salvarAlteracoes();
        montarListaClientes();
    }

    // ------------------------------------------------------------------
    // Cadastro de cliente
    // ------------------------------------------------------------------

    // O servidor é escolhido numa lista fechada, sem digitação livre.
    function preencherServidores() {
        var opcoes = ['<option value="">Selecione...</option>'];
        $.each(servidores, function (_, servidor) {
            opcoes.push('<option value="' + escaparHtml(servidor) + '">' + escaparHtml(servidor) + '</option>');
        });
        $campoServidor.html(opcoes.join(''));
    }

    function mostrarErro(mensagem, $campo) {
        $form.find('[aria-invalid]').removeAttr('aria-invalid');
        if (!mensagem) {
            $erroCliente.prop('hidden', true).text('');
            return;
        }
        $erroCliente.text(mensagem).prop('hidden', false);
        if ($campo) {
            $campo.attr('aria-invalid', 'true').trigger('focus');
        }
    }

    function abrirCadastro() {
        emEdicao = null;
        $form[0].reset();
        $tituloDialogo.text('Adicionar cliente');
        bancoEditadoManualmente = false;
        mostrarErro('');
        dialogo.showModal();
        $campoCliente.trigger('focus');
    }

    function abrirEdicao(cliente) {
        emEdicao = cliente;
        $form[0].reset();
        $tituloDialogo.text('Alterar cliente');
        $campoCliente.val(cliente.cliente);
        $campoBanco.val(cliente.banco);
        $campoServidor.val(cliente.servidor);
        // Mantém o banco acompanhando o nome só se ele ainda segue o padrão <cliente>_erp_head
        bancoEditadoManualmente = cliente.banco !== cliente.cliente + CONFIG.sufixoBanco;
        mostrarErro('');
        dialogo.showModal();
        $campoCliente.trigger('focus').trigger('select');
    }

    function fecharCadastro() {
        dialogo.close();
    }

    function validarCadastro(novo) {
        var formatoValido = /^[A-Za-z0-9_-]+$/;

        if (!novo.cliente) {
            return { mensagem: 'Informe o nome do cliente.', $campo: $campoCliente };
        }
        if (!formatoValido.test(novo.cliente)) {
            return { mensagem: 'O nome do cliente aceita apenas letras, números, "_" e "-".', $campo: $campoCliente };
        }
        if (!novo.banco) {
            return { mensagem: 'Informe o banco de dados.', $campo: $campoBanco };
        }
        if (!formatoValido.test(novo.banco)) {
            return { mensagem: 'O banco aceita apenas letras, números, "_" e "-".', $campo: $campoBanco };
        }
        if ($.inArray(novo.servidor, servidores) === -1) {
            return { mensagem: 'Selecione um servidor da lista.', $campo: $campoServidor };
        }
        // Confere a lista exibida e também os registros originais do arquivo
        // (um cliente alterado não aparece mais com os dados originais).
        var originalEmEdicao = emEdicao && (emEdicao.original || (!emEdicao.adicionado && emEdicao));
        var duplicado = $.grep(clientes, function (c) {
            return c !== emEdicao && mesmoRegistro(c, novo);
        }).length > 0 || (existeNoArquivo(novo) && !(originalEmEdicao && mesmoRegistro(originalEmEdicao, novo)));
        if (duplicado) {
            return { mensagem: 'O banco ' + novo.banco + ' já está cadastrado no servidor ' + novo.servidor + '.', $campo: $campoBanco };
        }
        return null;
    }

    function salvarCadastro(evento) {
        evento.preventDefault();

        var novo = {
            cliente: $.trim($campoCliente.val()),
            banco: $.trim($campoBanco.val()),
            servidor: $campoServidor.val()
        };

        var erro = validarCadastro(novo);
        if (erro) {
            mostrarErro(erro.mensagem, erro.$campo);
            return;
        }

        if (!gravarCliente(novo)) {
            mostrarErro('Não foi possível salvar no navegador (armazenamento local bloqueado).');
            return;
        }

        fecharCadastro();
        montarListaClientes();
    }

    // Grava no navegador: cadastro novo, alteração de cadastrado local ou
    // alteração de cliente do arquivo (guardada à parte, o clientes.json não muda).
    function gravarCliente(novo) {
        if (!emEdicao) {
            clientesAdicionados.push(novo);
            if (!salvarAdicionados()) {
                clientesAdicionados.pop();
                return false;
            }
            return true;
        }

        if (emEdicao.adicionado) {
            var i = indiceAdicionado(emEdicao);
            var anterior = clientesAdicionados[i];
            clientesAdicionados[i] = novo;
            if (!salvarAdicionados()) {
                clientesAdicionados[i] = anterior;
                return false;
            }
            return true;
        }

        var original = emEdicao.original || dadosCliente(emEdicao);
        var chave = chaveRegistro(original);
        var anteriorAlterado = clientesAlterados[chave];
        if (mesmosValores(original, novo)) {
            delete clientesAlterados[chave];
        } else {
            clientesAlterados[chave] = novo;
        }
        if (!salvarAlteracoes()) {
            if (anteriorAlterado) {
                clientesAlterados[chave] = anteriorAlterado;
            } else {
                delete clientesAlterados[chave];
            }
            return false;
        }
        return true;
    }

    // Preenche o banco como <cliente>_erp_head até o usuário editá-lo.
    function sugerirBanco() {
        if (!bancoEditadoManualmente) {
            var cliente = $.trim($campoCliente.val());
            $campoBanco.val(cliente ? cliente + CONFIG.sufixoBanco : '');
        }
    }

    // ------------------------------------------------------------------
    // Eventos
    // ------------------------------------------------------------------

    $botaoAdicionar.on('click', abrirCadastro);
    $('#botao-cancelar').on('click', fecharCadastro);
    $form.on('submit', salvarCadastro);

    $campoCliente.on('input', sugerirBanco);
    $campoBanco.on('input', function () {
        bancoEditadoManualmente = $.trim($campoBanco.val()) !== '';
    });

    // Fecha ao clicar fora do formulário
    $(dialogo).on('click', function (evento) {
        if (evento.target === dialogo) {
            fecharCadastro();
        }
    });

    $lista.on('click', '.botao-linha', function () {
        var cliente = clientes[Number($(this).attr('data-indice'))];
        if (!cliente) {
            return;
        }
        switch ($(this).attr('data-acao')) {
            case 'editar':
                abrirEdicao(cliente);
                break;
            case 'remover':
                if (window.confirm('Remover o banco ' + cliente.banco + ' (' + cliente.servidor + ') da lista?')) {
                    removerAdicionado(cliente);
                }
                break;
            case 'desfazer':
                if (window.confirm('Desfazer a alteração e voltar para ' + cliente.original.cliente + ' / ' +
                        cliente.original.banco + ' / ' + cliente.original.servidor + '?')) {
                    desfazerAlteracao(cliente);
                }
                break;
        }
    });

    $campoBusca.on('input', agendarBusca);

    $campoBusca.on('keydown', function (evento) {
        if (evento.key === 'Escape') {
            $campoBusca.val('');
            aplicarBusca();
        }
    });

    $botaoLimpar.on('click', function () {
        $campoBusca.val('').trigger('focus');
        aplicarBusca();
    });

    // ------------------------------------------------------------------
    // Inicialização
    // ------------------------------------------------------------------

    carregarArmazenamento();
    preencherServidores();
    $(carregarClientes);

}(jQuery));
