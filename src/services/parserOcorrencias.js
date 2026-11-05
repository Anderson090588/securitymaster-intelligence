
/*
 * SECURITYMASTER INTELLIGENCE
 * Parser de Ocorrências do Moni - Versão 2.2
 *
 * Atualização 2.2:
 * - Remove o período do relatório do nome do cliente.
 * - Remove a data de emissão do nome do cliente.
 * - Preserva os códigos com zeros à esquerda.
 *
 * Funcionalidades mantidas:
 * - Identificação do cliente pelo cabeçalho.
 * - Associação de eventos aos clientes.
 * - Continuidade entre páginas.
 * - Extração de setor, motivo e relato.
 */

export function parserOcorrencias(html) {

    const documento = new DOMParser().parseFromString(
        html,
        "text/html"
    );

    const tabelas = documento.querySelectorAll("table");

    const registros = [];

    let registroAtual = null;
    let aguardandoSetor = false;
    let aguardandoOcorrencia = false;

    let codigoClienteAtual = "";
    let nomeClienteAtual = "";

    const tiposEventos = [
        "RESTAURAÇÃO DE SETOR",
        "DISPARO DE ALARME",
        "TESTE PERIÓDICO",
        "DESARMADO",
        "ARMADO"
    ];

    // ========================================
    // FUNÇÕES AUXILIARES
    // ========================================

    function normalizarEspacos(texto) {
        return String(texto || "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function extrairTextoFormatado(celula) {

        const copia = celula.cloneNode(true);

        copia.querySelectorAll("br").forEach(br => {
            br.replaceWith("\n");
        });

        return (copia.textContent || "")
            .replace(/\r\n?/g, "\n")
            .replace(/[ \t]+/g, " ")
            .split("\n")
            .map(linha => linha.trim())
            .join("\n")
            .trim();
    }

    function salvarRegistro() {

        if (registroAtual) {
            registros.push(registroAtual);
            registroAtual = null;
        }
    }

    function obterValor(dados, campo) {

        const indice = dados.findIndex(
            valor => valor.trim() === campo
        );

        if (indice === -1) {
            return "";
        }

        return dados[indice + 1] || "";
    }

    // ========================================
    // LIMPEZA DO NOME DO CLIENTE
    // ========================================

    function limparNomeCliente(nome) {

        let nomeLimpo = String(nome || "");

        /*
         * O FastReport pode juntar o nome
         * do cliente diretamente ao período:
         *
         * SECURITY MASTERDe 29/10/2026...
         *
         * Por isso, não dependemos de existir
         * um espaço antes da palavra "De".
         */

        nomeLimpo = nomeLimpo.replace(
            /\s*De\s+\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?[\s\S]*$/i,
            ""
        );

        /*
         * Caso a exportação apresente uma data
         * sem a palavra "De", removemos a parte
         * que começa com uma data completa.
         */

        nomeLimpo = nomeLimpo.replace(
            /\s+\d{2}\/\d{2}\/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?[\s\S]*$/,
            ""
        );

        return normalizarEspacos(nomeLimpo);
    }

    // ========================================
    // IDENTIFICAÇÃO DO CLIENTE
    // ========================================

    function interpretarCliente(texto) {

        const conteudo = normalizarEspacos(texto);

        /*
         * Exemplos:
         *
         * Cliente: 0261 - SECURITY MASTER
         *
         * Cliente: 0261 - SECURITY MASTERDe
         * 29/10/2026 11:24:02 até ...
         */

        const identificacao = conteudo.match(
            /\bCliente:\s*(\d+)\s*-\s*(.+)$/i
        );

        if (!identificacao) {
            return null;
        }

        const codigoCliente = identificacao[1];

        const nomeCliente = limparNomeCliente(
            identificacao[2]
        );

        if (!nomeCliente) {
            return null;
        }

        return {
            codigoCliente,
            nomeCliente
        };
    }

    function atualizarCliente(texto) {

        const cliente = interpretarCliente(texto);

        if (!cliente) {
            return false;
        }

        codigoClienteAtual = cliente.codigoCliente;
        nomeClienteAtual = cliente.nomeCliente;

        return true;
    }

    // ========================================
    // LEITURA DAS TABELAS
    // ========================================

    tabelas.forEach(tabela => {

        const linhas = tabela.querySelectorAll("tr");

        linhas.forEach(linha => {

            const dados = Array.from(
                linha.querySelectorAll("th, td")
            )
                .map(celula => ({
                    simples: normalizarEspacos(
                        celula.textContent
                    ),
                    formatado: extrairTextoFormatado(
                        celula
                    )
                }))
                .filter(item =>
                    item.simples.length > 0 ||
                    item.formatado.length > 0
                );

            if (dados.length === 0) {
                return;
            }

            const valores = dados.map(
                item => item.simples
            );

            const texto = valores.join(" | ");

            // ========================================
            // CABEÇALHO DO CLIENTE
            // ========================================

            const textoCabecalho = valores.join(" ");

            if (atualizarCliente(textoCabecalho)) {
                return;
            }

            // ========================================
            // INÍCIO DE UM NOVO EVENTO
            // ========================================

            const dataHora = obterValor(
                valores,
                "Data / Hora:"
            );

            if (dataHora) {

                salvarRegistro();

                /*
                 * Mantém a possibilidade de
                 * encontrar o cliente na própria
                 * linha do evento.
                 */

                const clienteNaLinha = interpretarCliente(
                    texto
                );

                if (clienteNaLinha) {
                    codigoClienteAtual =
                        clienteNaLinha.codigoCliente;

                    nomeClienteAtual =
                        clienteNaLinha.nomeCliente;
                }

                registroAtual = {
                    codigoCliente: codigoClienteAtual,
                    nomeCliente: nomeClienteAtual,
                    dataHora,
                    setor: "",
                    motivo: "",
                    ocorrencia: "",
                    tipoEvento: "",
                    relato: ""
                };

                aguardandoSetor = false;
                aguardandoOcorrencia = false;

                return;
            }

            if (!registroAtual) {
                return;
            }

            // ========================================
            // CABEÇALHO DE SETOR E MOTIVO
            // ========================================

            if (
                texto.includes(
                    "Setor / Usuário / Complemento"
                )
            ) {

                aguardandoSetor = true;
                aguardandoOcorrencia = false;

                return;
            }

            // ========================================
            // CABEÇALHO DA OCORRÊNCIA
            // ========================================

            if (texto === "Ocorrência") {

                aguardandoSetor = false;
                aguardandoOcorrencia = true;

                return;
            }

            // ========================================
            // CAPTURA SETOR E MOTIVO
            // ========================================

            if (aguardandoSetor) {

                registroAtual.setor =
                    valores[0] || "";

                registroAtual.motivo =
                    valores[1] || "";

                aguardandoSetor = false;

                return;
            }

            // ========================================
            // CAPTURA O RELATO
            // ========================================

            if (aguardandoOcorrencia) {

                const relatoFormatado = dados
                    .map(item => item.formatado)
                    .filter(Boolean)
                    .join("\n");

                const relatoSimples = normalizarEspacos(
                    relatoFormatado
                );

                registroAtual.ocorrencia =
                    relatoFormatado;

                const tipoIdentificado = tiposEventos.find(
                    tipo => relatoSimples.startsWith(tipo)
                );

                if (tipoIdentificado) {

                    registroAtual.tipoEvento =
                        tipoIdentificado;

                    const inicioTipo =
                        relatoFormatado.indexOf(
                            tipoIdentificado
                        );

                    registroAtual.relato =
                        relatoFormatado
                            .substring(
                                inicioTipo +
                                tipoIdentificado.length
                            )
                            .trim();

                } else {

                    registroAtual.tipoEvento =
                        "NÃO IDENTIFICADO";

                    registroAtual.relato =
                        relatoFormatado;
                }

                aguardandoOcorrencia = false;
            }
        });
    });

    salvarRegistro();

    // ========================================
    // DIAGNÓSTICO NO CONSOLE
    // ========================================

    console.log("=================================");
    console.log("REGISTROS EXTRAÍDOS DO MONI");
    console.log("PARSER - VERSÃO 2.2");
    console.log("=================================");

    console.log(
        "Quantidade de eventos:",
        registros.length
    );

    const clientesIdentificados = new Map();

    registros.forEach(registro => {

        if (registro.codigoCliente) {
            clientesIdentificados.set(
                registro.codigoCliente,
                registro.nomeCliente
            );
        }
    });

    console.log(
        "Clientes identificados:",
        clientesIdentificados.size
    );

    console.table(
        Array.from(
            clientesIdentificados,
            ([codigo, nome]) => ({
                codigo,
                nome
            })
        )
    );

    const semCliente = registros.filter(
        registro => !registro.codigoCliente
    );

    console.log(
        "Eventos sem cliente identificado:",
        semCliente.length
    );

    console.table(registros);

    return registros;
}
