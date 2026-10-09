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
        chaveArmazenamento: 'cloneFinder.clientesAdicionados'
    };

    var $campoBusca = $('#campo-busca');
    var $botaoLimpar = $('#botao-limpar');
    var $lista = $('#lista-clientes');
    var $resumo = $('#resumo');

    var $botaoAdicionar = $('#botao-adicionar');
    var $botaoExportar = $('#botao-exportar');
    var dialogo = document.getElementById('dialogo-cliente');
    var $form = $('#form-cliente');
    var $campoCliente = $('#campo-cliente');
    var $campoBanco = $('#campo-banco');
    var $campoServidor = $('#campo-servidor');
    var $erroCliente = $('#erro-cliente');

    var clientes = [];            // lista exibida (arquivo + adicionados)
    var clientesArquivo = [];     // vindos de data/clientes.json / clientes.js
    var clientesAdicionados = []; // cadastrados pela tela, guardados no navegador
    var servidores = CONFIG.servidoresPadrao.slice();
    var bancoEditadoManualmente = false;
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
                '<path d="M15 3h6v6"/><path d="M10 14 21 3"/></svg>'
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

    function renderizarMarcaAdicionado(cliente) {
        if (!cliente.adicionado) {
            return '';
        }
        return '<span class="tag-novo" title="Cadastrado nesta tela e salvo apenas neste navegador">novo</span>' +
            '<button type="button" class="botao-remover" title="Remover cliente cadastrado" aria-label="Remover ' +
            escaparHtml(cliente.cliente) + '" data-banco="' + escaparHtml(cliente.banco) +
            '" data-servidor="' + escaparHtml(cliente.servidor) + '">&times;</button>';
    }

    function renderizarLinha(cliente, termo) {
        return [
            '<tr>',
            '  <td class="tabela__cliente">', destacar(cliente.cliente, termo), renderizarMarcaAdicionado(cliente), '</td>',
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

    function existeNoArquivo(cliente) {
        return $.grep(clientesArquivo, function (c) { return mesmoRegistro(c, cliente); }).length > 0;
    }

    // Junta os clientes do arquivo com os cadastrados na tela. Cadastrados que já
    // passaram a existir no arquivo (ex.: após exportar) são descartados do navegador.
    function montarListaClientes() {
        var pendentes = $.grep(clientesAdicionados, function (c) { return !existeNoArquivo(c); });
        if (pendentes.length !== clientesAdicionados.length) {
            clientesAdicionados = pendentes;
            salvarAdicionados();
        }

        var marcados = $.map(clientesAdicionados, function (c) {
            return $.extend({}, c, { adicionado: true });
        });
        clientes = ordenarPorCliente(clientesArquivo.concat(marcados));
        $botaoExportar.prop('hidden', clientesAdicionados.length === 0);
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
                    'O arquivo data/clientes.js não foi encontrado. Rode .\\gerar-clientes.ps1 para gerá-lo.'
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
    // Clientes adicionados (armazenamento local do navegador)
    // ------------------------------------------------------------------

    function carregarAdicionados() {
        try {
            var salvo = JSON.parse(window.localStorage.getItem(CONFIG.chaveArmazenamento) || '[]');
            clientesAdicionados = $.isArray(salvo) ? salvo : [];
        } catch (e) {
            clientesAdicionados = [];
        }
    }

    function salvarAdicionados() {
        try {
            window.localStorage.setItem(CONFIG.chaveArmazenamento, JSON.stringify(clientesAdicionados));
            return true;
        } catch (e) {
            return false;
        }
    }

    function removerAdicionado(banco, servidor) {
        var alvo = { banco: banco, servidor: servidor };
        clientesAdicionados = $.grep(clientesAdicionados, function (c) { return !mesmoRegistro(c, alvo); });
        salvarAdicionados();
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
        $form[0].reset();
        bancoEditadoManualmente = false;
        mostrarErro('');
        dialogo.showModal();
        $campoCliente.trigger('focus');
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
        var duplicado = $.grep(clientes, function (c) { return mesmoRegistro(c, novo); }).length > 0;
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

        clientesAdicionados.push(novo);
        if (!salvarAdicionados()) {
            clientesAdicionados.pop();
            mostrarErro('Não foi possível salvar no navegador (armazenamento local bloqueado).');
            return;
        }

        fecharCadastro();
        montarListaClientes();
        $campoBusca.val(novo.cliente);
        aplicarBusca();
    }

    // Preenche o banco como <cliente>_erp_head até o usuário editá-lo.
    function sugerirBanco() {
        if (!bancoEditadoManualmente) {
            var cliente = $.trim($campoCliente.val());
            $campoBanco.val(cliente ? cliente + CONFIG.sufixoBanco : '');
        }
    }

    // ------------------------------------------------------------------
    // Exportação (gera clientes.json e clientes.js atualizados)
    // ------------------------------------------------------------------

    function baixarArquivo(nome, conteudo, tipo) {
        var blob = new Blob([conteudo], { type: tipo });
        var url = URL.createObjectURL(blob);
        var $link = $('<a>').attr({ href: url, download: nome }).appendTo('body');
        $link[0].click();
        $link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function dataHoraLocal() {
        var agora = new Date();
        var deslocamento = agora.getTimezoneOffset() * 60000;
        return new Date(agora - deslocamento).toISOString().slice(0, 19);
    }

    function exportarClientes() {
        var dados = {
            geradoEm: dataHoraLocal(),
            servidores: servidores,
            clientes: $.map(clientes, function (c) {
                return { cliente: c.cliente, banco: c.banco, servidor: c.servidor };
            })
        };
        var json = JSON.stringify(dados, null, 4);

        baixarArquivo('clientes.json', json, 'application/json;charset=utf-8');
        baixarArquivo('clientes.js', 'window.CLONE_FINDER_DADOS = ' + json + ';\n', 'application/javascript;charset=utf-8');

        window.alert(
            'Foram baixados clientes.json e clientes.js.\n\n' +
            'Substitua os arquivos da pasta "data" do Clone Finder por eles para que ' +
            'os clientes cadastrados fiquem disponíveis para todos.'
        );
    }

    // ------------------------------------------------------------------
    // Eventos
    // ------------------------------------------------------------------

    $botaoAdicionar.on('click', abrirCadastro);
    $botaoExportar.on('click', exportarClientes);
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

    $lista.on('click', '.botao-remover', function () {
        var $botao = $(this);
        var banco = $botao.attr('data-banco');
        var servidor = $botao.attr('data-servidor');
        if (window.confirm('Remover o banco ' + banco + ' (' + servidor + ') da lista?')) {
            removerAdicionado(banco, servidor);
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

    carregarAdicionados();
    preencherServidores();
    $(carregarClientes);

}(jQuery));
