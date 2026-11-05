
/**
 * SECURITYMASTER INTELLIGENCE
 * Motor de Auditoria Operacional - Versão 4.5
 *
 * Atualização 4.5:
 * - Auditoria de DISPARO OU TESTE EFETUADO PELA TECNICA.
 * - Exige identificação do responsável técnico no local.
 * - Campo ausente, vazio ou sem nome: revisão necessária.
 *
 * Mantém as regras anteriores:
 * - Modo de comunicação GPRS / INTERNET.
 * - Verificação do padrão de energia.
 * - Verificações de contato e palavra-chave.
 * - Verificações de atendimento com viatura.
 * - Identificação do rondista.
 * - Verificação de ordem de serviço.
 * - Motivos fora do escopo.
 *
 * A auditoria verifica a conformidade do registro,
 * não comprova a execução das ações relatadas.
 */

export function auditarOcorrencias(clientes) {

    // ========================================
    // FUNÇÕES AUXILIARES
    // ========================================

    function normalizar(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[ \t]+/g, " ")
            .trim();
    }

    function linhasDoRelato(relato) {
        return normalizar(relato)
            .split(/\r?\n/)
            .map(linha => linha.trim());
    }

    function textoContinuo(relato) {
        return normalizar(relato)
            .replace(/\s+/g, " ");
    }

    // ========================================
    // RÓTULOS CONHECIDOS DO MONI
    // ========================================

    const rotulosConhecidos = [
        "RESPONSAVEL OPERACIONAL:",
        "MOTIVO DA DISPENSA:",
        "CONTATO COM O SR(A):",
        "CONTATO COM O RESPONSAVEL:",
        "PALAVRA CHAVE CONFIRMADA:",
        "MOTIVO DO DISPARO:",
        "MOTIVO DO DESARME:",
        "MOTIVO DA QUEDA DE ENERGIA:",
        "MOTIVO:",
        "RESPONSAVEL CIENTE:",
        "MODO DE COMUNICACAO:",
        "RESPONSAVEL TECNICO NO LOCAL:",
        "RELATO DO OCORRIDO:",
        "NUMERO DA O.S:",
        "NUMERO DA OS:",
        "O.S ABERTA:",
        "O.S:",
        "OS:",
        "TIPO DE VISTORIA:",
        "PADRAO DE ENERGIA VERIFICADO:",
        "PARECER PASSADO PELO RONDA:"
    ];

    function escaparRegex(texto) {
        return texto.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
    }

    // ========================================
    // EXTRAÇÃO DOS CAMPOS
    // ========================================

    function obterCampo(linhas, rotulos) {

        const texto = linhas.join("\n");

        for (const rotulo of rotulos) {

            const marcador = normalizar(rotulo);

            const expressao = new RegExp(
                escaparRegex(marcador),
                "g"
            );

            const correspondencia = expressao.exec(texto);

            if (!correspondencia) {
                continue;
            }

            const inicioValor =
                correspondencia.index +
                correspondencia[0].length;

            let fimValor = texto.length;

            for (const outroRotulo of rotulosConhecidos) {

                const expressaoProximoCampo = new RegExp(
                    escaparRegex(outroRotulo),
                    "g"
                );

                expressaoProximoCampo.lastIndex = inicioValor;

                const proximoCampo =
                    expressaoProximoCampo.exec(texto);

                if (
                    proximoCampo &&
                    proximoCampo.index < fimValor
                ) {
                    fimValor = proximoCampo.index;
                }
            }

            let valor = texto
                .substring(inicioValor, fimValor)
                .trim();

            // Evita incorporar o rodapé de conclusão.
            valor = valor
                .split(/»[-─]{3,}/)[0]
                .trim();

            return {
                encontrado: true,
                valor
            };
        }

        return {
            encontrado: false,
            valor: ""
        };
    }

    function valorInvalido(valor) {
        return /^(N\/A|NA|NAO|N|NAO INFORMADO|NAO SE APLICA|SEM INFORMACAO|_+|-+|\.+)$/.test(
            normalizar(valor)
        );
    }

    function adicionarVerificacao(
        resultado,
        campo,
        situacao,
        detalhe = ""
    ) {

        resultado.camposVerificados.push({
            campo,
            situacao,
            detalhe
        });

        if (situacao !== "PREENCHIDO") {

            resultado.camposParaRevisao.push(
                detalhe
                    ? `${campo}: ${detalhe}`
                    : `${campo}: ${situacao}`
            );
        }
    }

    function verificarCampo(
        resultado,
        linhas,
        campo,
        rotulos,
        validar = null
    ) {

        const encontrado = obterCampo(
            linhas,
            rotulos
        );

        if (!encontrado.encontrado) {

            adicionarVerificacao(
                resultado,
                campo,
                "NÃO ENCONTRADO"
            );

            return;
        }

        if (!encontrado.valor) {

            adicionarVerificacao(
                resultado,
                campo,
                "SEM PREENCHIMENTO"
            );

            return;
        }

        if (valorInvalido(encontrado.valor)) {

            adicionarVerificacao(
                resultado,
                campo,
                "REVISÃO NECESSÁRIA",
                "Preenchimento inválido ou incompleto"
            );

            return;
        }

        if (validar) {

            const avaliacao = validar(
                encontrado.valor
            );

            if (avaliacao !== true) {

                adicionarVerificacao(
                    resultado,
                    campo,
                    "REVISÃO NECESSÁRIA",
                    avaliacao
                );

                return;
            }
        }

        adicionarVerificacao(
            resultado,
            campo,
            "PREENCHIDO"
        );
    }

    function verificarPadrao(
        resultado,
        texto,
        campo,
        expressao
    ) {

        adicionarVerificacao(
            resultado,
            campo,
            expressao.test(texto)
                ? "PREENCHIDO"
                : "NÃO ENCONTRADO"
        );
    }

    // ========================================
    // VERIFICAÇÕES GERAIS
    // ========================================

    function verificarContato(resultado, linhas) {

        verificarCampo(
            resultado,
            linhas,
            "Contato com o responsável",
            [
                "CONTATO COM O SR(A):",
                "CONTATO COM O RESPONSAVEL:"
            ]
        );
    }

    function verificarPalavraChave(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Confirmação da palavra-chave",
            ["PALAVRA CHAVE CONFIRMADA:"],
            valor => valor === "SIM"
                ? true
                : "Palavra-chave não confirmada"
        );
    }

    function verificarMotivo(resultado, linhas) {

        verificarCampo(
            resultado,
            linhas,
            "Motivo do disparo",
            [
                "MOTIVO DO DISPARO:",
                "MOTIVO:"
            ]
        );
    }

    function verificarResponsavelCiente(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Responsável ciente",
            ["RESPONSAVEL CIENTE:"],
            valor => {

                if (
                    /^(NAO|N|SEM CONTATO|NINGUEM)$/.test(
                        valor
                    )
                ) {
                    return "Responsável não confirmado como ciente";
                }

                return true;
            }
        );
    }

    function verificarRelatoOcorrido(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Relato do ocorrido",
            ["RELATO DO OCORRIDO:"]
        );
    }

    function verificarOrdemServico(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Número da ordem de serviço",
            [
                "NUMERO DA O.S:",
                "NUMERO DA OS:",
                "O.S ABERTA:",
                "O.S:",
                "OS:"
            ],
            valor => /\d/.test(valor)
                ? true
                : "Número da O.S. não identificado"
        );
    }

    // ========================================
    // PADRÃO DE ENERGIA - VERSÃO 4.3
    // ========================================

    function verificarPadraoEnergia(
        resultado,
        linhas
    ) {

        const campo = "Padrão de energia verificado";

        const encontrado = obterCampo(
            linhas,
            ["PADRAO DE ENERGIA VERIFICADO:"]
        );

        if (!encontrado.encontrado) {

            adicionarVerificacao(
                resultado,
                campo,
                "NÃO ENCONTRADO"
            );

            return;
        }

        const resposta = normalizar(
            encontrado.valor
        );

        if (!resposta) {

            adicionarVerificacao(
                resultado,
                campo,
                "SEM PREENCHIMENTO"
            );

            return;
        }

        if (resposta === "SIM") {

            adicionarVerificacao(
                resultado,
                campo,
                "PREENCHIDO"
            );

            return;
        }

        if (
            resposta === "NAO" ||
            resposta === "N"
        ) {

            adicionarVerificacao(
                resultado,
                campo,
                "REVISÃO NECESSÁRIA",
                "Verificação não confirmada"
            );

            return;
        }

        adicionarVerificacao(
            resultado,
            campo,
            "REVISÃO NECESSÁRIA",
            "Resposta inválida. Esperado: SIM"
        );
    }

    // ========================================
    // INFORMAÇÕES DA RONDA
    // ========================================

    function verificarDadosRonda(
        resultado,
        relato,
        exigirRelatorio = false
    ) {

        const texto = textoContinuo(relato);

        verificarPadrao(
            resultado,
            texto,
            "Acionamento da ronda",
            /\bRONDA ACIONAD[OA]\b/
        );

        verificarPadrao(
            resultado,
            texto,
            "Horário de acionamento",
            /\bRONDA ACIONAD[OA]\s+AS\s*\d{1,2}:\d{2}\b/
        );

        // Identificação independente do horário.
        verificarPadrao(
            resultado,
            texto,
            "Identificação do rondista",
            /\bRONDA ACIONAD[OA]\s+AS\s+(?:\d{1,2}:\d{2}|_+:_+)\s+SR\.?\s+[A-Z]+/
        );

        verificarPadrao(
            resultado,
            texto,
            "Horário de chegada",
            /\bCHEGADA DO RONDA\s+AS\s+\d{1,2}:\d{2}\b/
        );

        verificarPadrao(
            resultado,
            texto,
            "Horário de saída",
            /\bSAIDA\s+AS\s+\d{1,2}:\d{2}\b/
        );

        if (exigirRelatorio) {

            const numeroRelatorio = texto.match(
                /RELATORIO ELABORADO\s+N[Oº°.]?\s*([^\s]+)/
            );

            if (!numeroRelatorio) {

                adicionarVerificacao(
                    resultado,
                    "Número do relatório da ronda",
                    "NÃO ENCONTRADO"
                );

            } else {

                const numero = numeroRelatorio[1];

                const valido =
                    /\d/.test(numero) &&
                    !/_/.test(numero);

                adicionarVerificacao(
                    resultado,
                    "Número do relatório da ronda",
                    valido
                        ? "PREENCHIDO"
                        : "REVISÃO NECESSÁRIA",
                    valido
                        ? ""
                        : "Número ausente ou incompleto"
                );
            }
        }
    }

    function verificarTipoVistoria(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Tipo de vistoria",
            ["TIPO DE VISTORIA:"],
            valor => {

                if (
                    /^(SEMI EXTERNA|EXTERNA|INTERNA)$/.test(
                        valor
                    )
                ) {
                    return true;
                }

                return "Tipo de vistoria não reconhecido";
            }
        );
    }

    // ========================================
    // REGRAS POR MOTIVO
    // ========================================

    function verificarContatoOperacional(
        resultado,
        relato,
        linhas
    ) {

        verificarContato(resultado, linhas);
        verificarPalavraChave(resultado, linhas);
        verificarMotivo(resultado, linhas);

        if (
            /RONDA ACIONAD[OA]|CHEGADA DO RONDA|TIPO DE VISTORIA/.test(
                normalizar(relato)
            )
        ) {

            adicionarVerificacao(
                resultado,
                "Compatibilidade entre motivo e relato",
                "REVISÃO NECESSÁRIA",
                "Relato menciona atendimento com viatura"
            );
        }
    }

    function verificarDispensaApoio(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Responsável operacional",
            ["RESPONSAVEL OPERACIONAL:"]
        );

        verificarCampo(
            resultado,
            linhas,
            "Motivo da dispensa",
            ["MOTIVO DA DISPENSA:"]
        );
    }

    function verificarErroUso(
        resultado,
        linhas
    ) {

        verificarContato(resultado, linhas);
        verificarPalavraChave(resultado, linhas);
        verificarMotivo(resultado, linhas);
    }

    function verificarViatura(
        resultado,
        relato,
        linhas
    ) {

        verificarDadosRonda(
            resultado,
            relato,
            true
        );

        verificarTipoVistoria(resultado, linhas);
        verificarResponsavelCiente(resultado, linhas);
        verificarRelatoOcorrido(resultado, linhas);
    }

    function verificarViaturaErroUso(
        resultado,
        relato,
        linhas
    ) {

        verificarDadosRonda(
            resultado,
            relato,
            true
        );

        verificarContato(resultado, linhas);
        verificarPalavraChave(resultado, linhas);
        verificarMotivo(resultado, linhas);
    }

    // ========================================
    // NOVA REGRA - VERSÃO 4.5
    // DISPARO OU TESTE EFETUADO PELA TÉCNICA
    // ========================================

    function verificarTesteTecnica(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Responsável técnico no local",
            [
                "RESPONSAVEL TECNICO NO LOCAL:"
            ],
            valor => {

                const tecnico = normalizar(valor);

                if (
                    !tecnico ||
                    valorInvalido(tecnico)
                ) {
                    return "Responsável técnico não identificado";
                }

                // Impede aceitar somente o cargo,
                // sem identificação do profissional.
                if (
                    /^(TECNICO|TECNICA|SR|SRA)\.?$/.test(
                        tecnico
                    )
                ) {
                    return "Nome do responsável técnico não informado";
                }

                // Remove o título para verificar
                // se existe uma identificação.
                const identificacao = tecnico
                    .replace(
                        /^(TECNICO|TECNICA|SR|SRA)\.?\s+/,
                        ""
                    )
                    .trim();

                if (
                    !identificacao ||
                    valorInvalido(identificacao) ||
                    /^[_\W\d]+$/.test(identificacao)
                ) {
                    return "Identificação do técnico inválida";
                }

                return true;
            }
        );
    }

    // ========================================
    // DISPARO SEM ENVIO DE APOIO - O.S.
    // ========================================

    function verificarSemApoioOS(
        resultado,
        linhas
    ) {

        verificarCampo(
            resultado,
            linhas,
            "Responsável operacional",
            ["RESPONSAVEL OPERACIONAL:"]
        );

        verificarOrdemServico(resultado, linhas);
    }

    // ========================================
    // DESARMADO COM VIATURA
    // ========================================

    function verificarDesarmadoComViatura(
        resultado,
        relato,
        linhas
    ) {

        verificarDadosRonda(
            resultado,
            relato,
            false
        );

        verificarContato(resultado, linhas);
        verificarPalavraChave(resultado, linhas);

        verificarCampo(
            resultado,
            linhas,
            "Motivo do atendimento",
            [
                "MOTIVO DO DISPARO:",
                "MOTIVO:",
                "MOTIVO DO DESARME:"
            ]
        );
    }

    // ========================================
    // FALHA DE AUTO TESTE - VERSÃO 4.4
    // ========================================

    function verificarFalhaAutoTeste(
        resultado,
        linhas
    ) {

        /*
         * GPRS:
         * Responsável ciente opcional.
         *
         * INTERNET:
         * Responsável ciente obrigatório.
         *
         * Modo ausente, vazio ou inválido:
         * Revisão necessária.
         *
         * Número da O.S:
         * Sempre obrigatório.
         */

        const campo = "Modo de comunicação";

        const encontrado = obterCampo(
            linhas,
            ["MODO DE COMUNICACAO:"]
        );

        let modo = "";

        if (!encontrado.encontrado) {

            adicionarVerificacao(
                resultado,
                campo,
                "NÃO ENCONTRADO"
            );

        } else {

            modo = normalizar(encontrado.valor);

            if (!modo) {

                adicionarVerificacao(
                    resultado,
                    campo,
                    "SEM PREENCHIMENTO"
                );

            } else if (
                modo === "GPRS" ||
                modo === "INTERNET"
            ) {

                adicionarVerificacao(
                    resultado,
                    campo,
                    "PREENCHIDO"
                );

            } else {

                adicionarVerificacao(
                    resultado,
                    campo,
                    "REVISÃO NECESSÁRIA",
                    "Modo não reconhecido. Esperado: GPRS ou INTERNET"
                );
            }
        }

        // INTERNET exige responsável ciente.
        if (modo === "INTERNET") {

            verificarResponsavelCiente(
                resultado,
                linhas
            );
        }

        // GPRS: responsável ciente opcional.
        if (modo === "GPRS") {

            adicionarVerificacao(
                resultado,
                "Responsável ciente",
                "PREENCHIDO",
                "Campo opcional para comunicação GPRS"
            );
        }

        // A ordem de serviço é sempre obrigatória.
        verificarOrdemServico(
            resultado,
            linhas
        );
    }

    // ========================================
    // FALHA DE AUTO TESTE COM VIATURA
    // ========================================

    function verificarFalhaAutoTesteViatura(
        resultado,
        relato,
        linhas
    ) {

        verificarDadosRonda(
            resultado,
            relato,
            false
        );

        verificarTipoVistoria(resultado, linhas);
        verificarResponsavelCiente(resultado, linhas);
        verificarRelatoOcorrido(resultado, linhas);
    }

    // ========================================
    // QUEDA DE ENERGIA PELO RESPONSÁVEL
    // ========================================

    function verificarEnergiaResponsavel(
        resultado,
        linhas
    ) {

        verificarContato(resultado, linhas);
        verificarPalavraChave(resultado, linhas);

        verificarCampo(
            resultado,
            linhas,
            "Motivo da queda de energia",
            [
                "MOTIVO DA QUEDA DE ENERGIA:",
                "MOTIVO DO DISPARO:",
                "MOTIVO:"
            ]
        );
    }

    // ========================================
    // QUEDA DE ENERGIA COM VIATURA
    // ========================================

    function verificarEnergiaViatura(
        resultado,
        relato,
        linhas
    ) {

        verificarDadosRonda(
            resultado,
            relato,
            false
        );

        verificarTipoVistoria(resultado, linhas);
        verificarResponsavelCiente(resultado, linhas);
        verificarRelatoOcorrido(resultado, linhas);

        // Somente SIM é considerado válido.
        verificarPadraoEnergia(
            resultado,
            linhas
        );
    }

    // ========================================
    // FALHA DE ENERGIA COM APOIO
    // ========================================

    function verificarFalhaEnergiaApoio(
        resultado,
        relato,
        linhas
    ) {

        verificarDadosRonda(
            resultado,
            relato,
            false
        );

        verificarTipoVistoria(resultado, linhas);
        verificarResponsavelCiente(resultado, linhas);
        verificarRelatoOcorrido(resultado, linhas);
    }

    // ========================================
    // MOTIVOS EXCLUÍDOS DA AUDITORIA
    // ========================================

    const motivosExcluidos = new Set([
        "DESARMADO",
        "QUEDA DE ENERGIA GERAL",
        "TESTE DIARIO DE PANICO ( PORTARIAS )",
        "TESTE EFETUADO PELO (A) CLIENTE",
        "DESARMADO CONTATO COM O (A) RESPONSAVEL"
    ]);

    // ========================================
    // PROCESSAMENTO DOS ATENDIMENTOS
    // ========================================

    const resultados = [];

    clientes.forEach(cliente => {

        cliente.atendimentos.forEach(atendimento => {

            const motivo = normalizar(
                atendimento.motivo
            ).replace(/\s+/g, " ");

            const relato = atendimento.relato || "";

            const linhas = linhasDoRelato(relato);

            const resultado = {

                codigoCliente: cliente.codigoCliente,

                nomeCliente: cliente.nomeCliente,

                dataHora: atendimento.dataHora,

                operador:
                    atendimento.operador ||
                    "NÃO IDENTIFICADO",

                conclusao:
                    atendimento.conclusao || null,

                motivo: atendimento.motivo,

                relatoOriginal: relato,

                status: "",

                camposVerificados: [],

                camposParaRevisao: []
            };

            // ====================================
            // MOTIVOS FORA DO ESCOPO
            // ====================================

            if (motivosExcluidos.has(motivo)) {

                resultado.status = "FORA DO ESCOPO";

                resultados.push(resultado);

                return;
            }

            // ====================================
            // DISPARO COM CONTATO OPERACIONAL
            // ====================================

            if (
                motivo ===
                "DISPARO COM CONTATO OPERACIONAL"
            ) {

                verificarContatoOperacional(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // DISPENSA DE APOIO
            // ====================================

            } else if (
                motivo ===
                "DISPARO COM DISPENSA DE APOIO OPERACIONAL"
            ) {

                verificarDispensaApoio(
                    resultado,
                    linhas
                );

            // ====================================
            // DISPARO ACIDENTAL / EM FALSO
            // ====================================

            } else if (
                motivo ===
                "DISPARO ACIDENTAL - ERRO DE USO" ||
                motivo === "DISPARO EM FALSO"
            ) {

                verificarErroUso(
                    resultado,
                    linhas
                );

            // ====================================
            // DISPARO COM VIATURA
            // ====================================

            } else if (
                motivo ===
                "DISPARO ACIDENTAL COM VIATURA - OCORRENCIA" ||
                motivo ===
                "DISPARO EM FALSO COM VIATURA"
            ) {

                verificarViatura(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // DISPARO COM VIATURA - ERRO DE USO
            // ====================================

            } else if (
                motivo ===
                "DISPARO ACIDENTAL COM VIATURA - ERRO DE USO"
            ) {

                verificarViaturaErroUso(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // NOVA REGRA 4.5 - TESTE DA TÉCNICA
            // ====================================

            } else if (
                motivo ===
                "DISPARO OU TESTE EFETUADO PELA TECNICA"
            ) {

                verificarTesteTecnica(
                    resultado,
                    linhas
                );

            // ====================================
            // DISPARO SEM APOIO - O.S.
            // ====================================

            } else if (
                motivo ===
                "DISPARO SEM ENVIO DE APOIO - O.S ABERTA"
            ) {

                verificarSemApoioOS(
                    resultado,
                    linhas
                );

            // ====================================
            // DESARMADO COM VIATURA
            // ====================================

            } else if (
                motivo ===
                "DESARMADO SEM CONTATO COM ENVIO DE VIATURA"
            ) {

                verificarDesarmadoComViatura(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // FALHA DE AUTO TESTE
            // ====================================

            } else if (
                motivo === "FALHA DE AUTO TESTE"
            ) {

                verificarFalhaAutoTeste(
                    resultado,
                    linhas
                );

            // ====================================
            // FALHA DE AUTO TESTE COM VIATURA
            // ====================================

            } else if (
                motivo ===
                "FALHA DE AUTO TESTE COM VIATURA"
            ) {

                verificarFalhaAutoTesteViatura(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // ENERGIA CAUSADA PELO RESPONSÁVEL
            // ====================================

            } else if (
                motivo ===
                "QUEDA DE ENERGIA CAUSADA PELO (A) RESPONSAVEL"
            ) {

                verificarEnergiaResponsavel(
                    resultado,
                    linhas
                );

            // ====================================
            // QUEDA DE ENERGIA COM VIATURA
            // ====================================

            } else if (
                motivo ===
                "QUEDA DE ENERGIA COM ENVIO DE VIATURA"
            ) {

                verificarEnergiaViatura(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // FALHA DE ENERGIA COM APOIO
            // ====================================

            } else if (
                motivo ===
                "FALHA DE ENERGIA COM APOIO"
            ) {

                verificarFalhaEnergiaApoio(
                    resultado,
                    relato,
                    linhas
                );

            // ====================================
            // MOTIVO NÃO MAPEADO
            // ====================================

            } else {

                resultado.status = "FORA DO ESCOPO";

                resultados.push(resultado);

                return;
            }

            // ====================================
            // CLASSIFICAÇÃO FINAL
            // ====================================

            resultado.status =
                resultado.camposParaRevisao.length > 0
                    ? "REVISÃO NECESSÁRIA"
                    : "SEM DIVERGÊNCIA DETECTADA";

            resultados.push(resultado);
        });
    });

    // ========================================
    // DIAGNÓSTICO NO CONSOLE
    // ========================================

    console.log("=================================");

    console.log("AUDITORIA OPERACIONAL - VERSÃO 4.5");

    console.log("=================================");

    console.table(
        resultados.map(resultado => ({

            cliente: resultado.codigoCliente,

            operador: resultado.operador,

            conclusao: resultado.conclusao,

            motivo: resultado.motivo,

            status: resultado.status,

            camposParaRevisao:
                resultado.camposParaRevisao.join(" | ")
        }))
    );

    return resultados;
}
