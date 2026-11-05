
export function agruparOcorrencias(registros) {

    const clientes = new Map();

    function normalizar(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    function converterData(dataHora) {

        const resultado = String(dataHora || "").match(
            /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
        );

        if (!resultado) return null;

        const [, dia, mes, ano, hora, minuto, segundo] = resultado;

        const data = new Date(
            Number(ano),
            Number(mes) - 1,
            Number(dia),
            Number(hora),
            Number(minuto),
            Number(segundo)
        );

        if (
            data.getFullYear() !== Number(ano) ||
            data.getMonth() !== Number(mes) - 1 ||
            data.getDate() !== Number(dia)
        ) {
            return null;
        }

        return data.getTime();
    }

    // Identifica a data e o horário de conclusão.
    function obterConclusao(registro) {

        const texto = String(registro.ocorrencia || "");

        const resultado = texto.match(
            /Conclu[ií]da em:\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i
        );

        return resultado ? resultado[1] : null;
    }

    // NOVO: identifica o operador que concluiu a ocorrência.
    function obterOperador(registro) {

        const texto = String(registro.ocorrencia || "");

        const resultado = texto.match(
            /»\s*Pl:\s*(.*?)\s+Conclu[ií]da em:/i
        );

        if (!resultado) {
            return "NÃO IDENTIFICADO";
        }

        const operador = resultado[1].trim();

        return operador || "NÃO IDENTIFICADO";
    }

    function ehMensagemAutomatica(registro) {

        return normalizar(registro.relato).includes(
            "RESULTADO JA DIGITADO EM OCORRENCIA PADRAO"
        );
    }

    function ehOcorrenciaPrincipal(registro) {

        return !ehMensagemAutomatica(registro) &&
            Boolean(normalizar(registro.motivo)) &&
            Boolean(normalizar(registro.relato));
    }

    // Organiza os registros por cliente.
    registros.forEach((registro, indice) => {

        const codigo = String(
            registro.codigoCliente || ""
        ).trim();

        const nome = String(
            registro.nomeCliente || ""
        ).trim();

        const chave = codigo ||
            (
                nome
                    ? `NOME:${normalizar(nome)}`
                    : "NAO_IDENTIFICADO"
            );

        if (!clientes.has(chave)) {

            clientes.set(chave, {
                codigoCliente: codigo,
                nomeCliente:
                    nome || "Cliente não identificado",
                atendimentos: [],
                registrosNaoAssociados: []
            });
        }

        clientes.get(chave).registrosNaoAssociados.push({
            ...registro,
            indiceOriginal: indice
        });
    });

    clientes.forEach(cliente => {

        const registrosCliente =
            cliente.registrosNaoAssociados;

        const principais = registrosCliente.filter(
            ehOcorrenciaPrincipal
        );

        const complementares = registrosCliente.filter(
            ehMensagemAutomatica
        );

        const outros = registrosCliente.filter(
            registro =>
                !ehOcorrenciaPrincipal(registro) &&
                !ehMensagemAutomatica(registro)
        );

        const atendimentos = principais.map(
            (registro, indice) => {

                const conclusao = obterConclusao(registro);

                // NOVO: captura o operador do encerramento.
                const operador = obterOperador(registro);

                return {
                    id: `${cliente.codigoCliente || "SEM_CODIGO"}-${indice + 1}`,
                    codigoCliente: cliente.codigoCliente,
                    nomeCliente: cliente.nomeCliente,
                    dataHora: registro.dataHora,
                    motivo: registro.motivo,
                    setor: registro.setor,
                    tipoEvento: registro.tipoEvento,
                    relato: registro.relato,

                    // Informações do encerramento.
                    operador,
                    conclusao,

                    eventoPrincipal: registro,
                    eventosComplementares: [],
                    statusAssociacao:
                        "principal_identificado"
                };
            }
        );

        const naoAssociados = [...outros];

        complementares.forEach(complementar => {

            const horarioComplementar = converterData(
                complementar.dataHora
            );

            const candidatos = atendimentos.filter(
                atendimento => {

                    const inicio = converterData(
                        atendimento.dataHora
                    );

                    const fim = converterData(
                        atendimento.conclusao
                    );

                    if (
                        inicio === null ||
                        fim === null ||
                        horarioComplementar === null
                    ) {
                        return false;
                    }

                    return (
                        horarioComplementar >= inicio &&
                        horarioComplementar <= fim
                    );
                }
            );

            if (candidatos.length === 1) {

                candidatos[0].eventosComplementares.push(
                    complementar
                );

            } else {

                naoAssociados.push({
                    ...complementar,
                    motivoNaoAssociacao:
                        candidatos.length > 1
                            ? "Mais de um atendimento possível"
                            : "Atendimento principal não identificado"
                });
            }
        });

        cliente.atendimentos = atendimentos;
        cliente.registrosNaoAssociados = naoAssociados;
    });

    const resultado = Array.from(clientes.values());

    console.log("=================================");
    console.log("AGRUPAMENTO DE OCORRÊNCIAS");
    console.log("=================================");

    console.log("Clientes:", resultado.length);

    console.log(
        "Atendimentos principais:",
        resultado.reduce(
            (total, cliente) =>
                total + cliente.atendimentos.length,
            0
        )
    );

    console.log(
        "Registros não associados:",
        resultado.reduce(
            (total, cliente) =>
                total + cliente.registrosNaoAssociados.length,
            0
        )
    );

    // NOVO: exibe os operadores identificados.
    console.table(
        resultado.flatMap(cliente =>
            cliente.atendimentos.map(atendimento => ({
                cliente: atendimento.codigoCliente,
                operador: atendimento.operador,
                motivo: atendimento.motivo,
                conclusao: atendimento.conclusao
            }))
        )
    );

    return resultado;
}
