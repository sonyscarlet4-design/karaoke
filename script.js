(function () {
    'use strict';

    const TELEFONO_WHATSAPP = '59175273771';
    const API_URL = './api.php';
    let deferredPrompt = null;
    let avisoTimer = null;
    let timerConfirmacion = null;
    let segundosRestantes = 0;

    function svgOffline(bg1, bg2, accent, label, sublabel = 'Karaoke Stage Offline') {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg2}"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="32" y="32" width="576" height="296" rx="18" fill="none" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/><text x="56" y="175" fill="#f4f0ff" font-family="Arial, sans-serif" font-size="34" font-weight="bold">${label}</text><text x="56" y="218" fill="#b3a7d6" font-family="Arial, sans-serif" font-size="18">${sublabel}</text></svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    const IMG_SALA_1 = svgOffline('#141029', '#2b164d', '#22d3ee', 'SALA PRIVADA');
    const IMG_SALA_2 = svgOffline('#19102e', '#4c1d6b', '#f5b942', 'SUITE VIP');

    let SALAS_CATALOGO = [
        {
            id: 'sala-privada',
            nombre: 'Sala Privada Acústica',
            tag: 'Sala Privada',
            detalle: 'Cabina para grupos, 2 micrófonos y control de tono.',
            precio: 120,
            img: IMG_SALA_1,
            accion: 'Reservar Sala',
            habilitado: true
        },
        {
            id: 'suite-vip',
            nombre: 'Suite VIP Escénica',
            tag: 'Sala VIP',
            detalle: 'Espacio amplio, sofás VIP y sonido envolvente.',
            precio: 220,
            img: IMG_SALA_2,
            accion: 'Reservar Sala',
            habilitado: true
        },
        {
            id: 'duelo-ronda',
            nombre: 'Duelo Vocal Karaoke',
            tag: 'Modo Inactivo',
            detalle: 'Función deshabilitada en esta versión.',
            precio: 0,
            img: IMG_SALA_1,
            accion: 'Jugar Ronda',
            habilitado: false
        }
    ];

    let COCTELES_CATALOGO = [
        { categoria: 'Cóctel', nombre: 'Mojito Clásico', precio: 35 },
        { categoria: 'Cóctel', nombre: 'Gin Tonic Botanical', precio: 42 },
        { categoria: 'Cóctel', nombre: 'Sangría de la Casa', precio: 45 }
    ];

    let COMIDA_CATALOGO = [
        { categoria: 'Comida', nombre: 'Tabla Gourmet para Compartir', precio: 85 },
        { categoria: 'Comida', nombre: 'Sliders y Piqueo Lounge', precio: 65 },
        { categoria: 'Comida', nombre: 'Alitas Crocantes con Salsas', precio: 55 }
    ];

    const historialGeneral = [];

    function actualizarTextoConfirmacion(texto) {
        const lbl = document.getElementById('contadorConfirmacionPedido');
        if (lbl) lbl.textContent = texto;
    }

    function detenerTemporizadorConfirmacion(mensaje = '') {
        if (timerConfirmacion) {
            clearInterval(timerConfirmacion);
            timerConfirmacion = null;
        }
        segundosRestantes = 0;
        const btnCancelar = document.getElementById('btnCancelarConfirmacion');
        if (btnCancelar) btnCancelar.style.display = 'none';
        actualizarTextoConfirmacion(mensaje);
    }

    async function llamarAPI(payload = null) {
        try {
            const opciones = payload
                ? {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
                : { method: 'GET' };

            const resp = await fetch(API_URL, opciones);
            if (!resp.ok) return null;
            const data = await resp.json();
            return data && data.ok ? data : null;
        } catch (_err) {
            return null;
        }
    }

    function aplicarCatalogoDesdeBD(data) {
        if (!data) return;

        if (Array.isArray(data.salas) && data.salas.length > 0) {
            SALAS_CATALOGO = data.salas.map((s, idx) => {
                const habilitada = Number(s.habilitada) === 1;
                const esSuite = idx === 1 || String(s.nombre_sala || '').toLowerCase().includes('vip');
                return {
                    id: String(s.id_sala || idx + 1),
                    nombre: s.nombre_sala,
                    tag: s.tipo_sala || (habilitada ? 'Sala Disponible' : 'Modo Inactivo'),
                    detalle: habilitada
                        ? 'Cabina equipada con micrófonos, control de tono y sonido envolvente.'
                        : 'Función deshabilitada en esta versión.',
                    precio: Number(s.precio_bs) || 0,
                    img: esSuite ? IMG_SALA_2 : IMG_SALA_1,
                    accion: habilitada ? 'Reservar Sala' : 'Jugar Ronda',
                    habilitado: habilitada
                };
            });
        }

        if (Array.isArray(data.carta) && data.carta.length > 0) {
            const cocteles = data.carta
                .filter((it) => {
                    const cat = String(it.categoria || '').toLowerCase();
                    return cat.includes('coctel') || cat.includes('cóctel');
                })
                .map((it) => ({
                    categoria: 'Cóctel',
                    nombre: it.nombre_item,
                    precio: Number(it.precio_bs) || 0
                }));

            const comidas = data.carta
                .filter((it) => String(it.categoria || '').toLowerCase().includes('comida'))
                .map((it) => ({
                    categoria: 'Comida',
                    nombre: it.nombre_item,
                    precio: Number(it.precio_bs) || 0
                }));

            if (cocteles.length > 0) COCTELES_CATALOGO = cocteles;
            if (comidas.length > 0) COMIDA_CATALOGO = comidas;
        }

        if (Array.isArray(data.historial)) {
            historialGeneral.length = 0;
            data.historial.forEach((h) => {
                historialGeneral.push({
                    tipo: h.tipo_registro || 'Registro',
                    detalle: h.descripcion || '',
                    precio: Number(h.subtotal_bs) || 0
                });
            });
        }
    }

    async function sincronizarDesdeBD() {
        const data = await llamarAPI();
        if (data) {
            aplicarCatalogoDesdeBD(data);
            renderSalasInicio();
            poblarListasSeparadas();
            renderHistorialModal();
        }
    }

    async function confirmarPedidoEnBD() {
        const resp = await llamarAPI({
            accion: 'confirmar_pedido',
            items: historialGeneral
        });

        if (resp && Array.isArray(resp.historial)) {
            aplicarCatalogoDesdeBD(resp);
            renderHistorialModal();
        }

        detenerTemporizadorConfirmacion('✅ Pedido confirmado y guardado.');
    }

    function iniciarConfirmacionConContador() {
        if (historialGeneral.length === 0) {
            actualizarTextoConfirmacion('Agrega primero una sala, cóctel o comida.');
            return;
        }

        if (timerConfirmacion) {
            confirmarPedidoEnBD();
            return;
        }

        segundosRestantes = 8;
        const btnCancelar = document.getElementById('btnCancelarConfirmacion');
        if (btnCancelar) btnCancelar.style.display = 'inline-flex';

        actualizarTextoConfirmacion(`¿Estás seguro del pedido? Confirma de nuevo en ${segundosRestantes}s...`);

        timerConfirmacion = setInterval(() => {
            segundosRestantes -= 1;
            if (segundosRestantes > 0) {
                actualizarTextoConfirmacion(`¿Estás seguro del pedido? Confirma de nuevo en ${segundosRestantes}s...`);
            } else {
                detenerTemporizadorConfirmacion('Tiempo agotado: ¿estás seguro del pedido? Pulsa Confirmar Pedido otra vez.');
            }
        }, 1000);
    }

    const PALABRAS_PROHIBIDAS = [
        'mierda', 'puta', 'puto', 'idiota', 'estupido', 'estupida',
        'imbecil', 'carajo', 'maldito', 'maldita', 'basura', 'verga', 'cabron'
    ];

    function contieneMalaPalabra(texto) {
        const limpio = (texto || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        return PALABRAS_PROHIBIDAS.some((bad) => limpio.includes(bad));
    }

    function soloLetrasYEspacios(texto) {
        const limpio = (texto || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        return /^[A-Za-z\s]+$/.test(limpio);
    }

    function validarCampoTexto(valor, etiquetaCampo) {
        const limpio = (valor || '').trim();
        if (!limpio) {
            return `El campo "${etiquetaCampo}" es obligatorio.`;
        }
        if (contieneMalaPalabra(limpio)) {
            return `No se permiten malas palabras en "${etiquetaCampo}".`;
        }
        if (!soloLetrasYEspacios(limpio)) {
            return 'Solo letras';
        }
        return '';
    }

    function mostrarAvisoSoloLetras(campo, mensaje = 'Solo letras') {
        const errorBox = document.getElementById('errorReservaSala');
        if (errorBox) {
            errorBox.textContent = mensaje;
        }

        let badge = document.getElementById('avisoFlotanteSoloLetras');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'avisoFlotanteSoloLetras';
            badge.setAttribute('role', 'alert');
            badge.style.position = 'fixed';
            badge.style.zIndex = '9999';
            badge.style.padding = '6px 12px';
            badge.style.borderRadius = '8px';
            badge.style.background = '#dc2626';
            badge.style.color = '#ffffff';
            badge.style.fontWeight = '700';
            badge.style.fontSize = '0.82rem';
            badge.style.boxShadow = '0 6px 18px rgba(0,0,0,0.5)';
            badge.style.pointerEvents = 'none';
            document.documentElement.appendChild(badge);
        }

        if (campo && typeof campo.getBoundingClientRect === 'function') {
            const rect = campo.getBoundingClientRect();
            badge.style.left = Math.max(10, rect.left) + 'px';
            badge.style.top = Math.max(10, rect.top - 34) + 'px';
        } else {
            badge.style.left = '16px';
            badge.style.top = '72px';
        }

        badge.textContent = mensaje;
        badge.style.display = 'block';

        if (avisoTimer) clearTimeout(avisoTimer);
        avisoTimer = setTimeout(() => {
            badge.style.display = 'none';
        }, 2000);
    }

    function esCampoTextoRestringido(el) {
        if (!el || el.tagName !== 'INPUT') return false;
        const tipo = (el.type || 'text').toLowerCase();
        if (tipo !== 'text') return false;
        return Boolean(
            el.closest('#formReservaSala') ||
            el.id === 'clienteNombreInput' ||
            el.id === 'clienteMensajeInput'
        );
    }

    document.addEventListener('keydown', (e) => {
        const el = e.target;
        if (!esCampoTextoRestringido(el)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        const esNumero = /^[0-9]$/.test(e.key || '') || /^Numpad[0-9]$/.test(e.code || '');
        if (esNumero) {
            e.preventDefault();
            mostrarAvisoSoloLetras(el, 'Solo letras');
        }
    }, true);

    document.addEventListener('beforeinput', (e) => {
        const el = e.target;
        if (!esCampoTextoRestringido(el)) return;

        if (e.data && /[0-9]/.test(e.data)) {
            e.preventDefault();
            mostrarAvisoSoloLetras(el, 'Solo letras');
        }
    }, true);

    document.addEventListener('input', (e) => {
        const el = e.target;
        if (!esCampoTextoRestringido(el)) return;

        if (/[0-9]/.test(el.value)) {
            el.value = el.value.replace(/[0-9]/g, '');
            mostrarAvisoSoloLetras(el, 'Solo letras');
        }
    }, true);

    document.addEventListener('paste', (e) => {
        const el = e.target;
        if (!esCampoTextoRestringido(el)) return;

        const textoPegado = (e.clipboardData && e.clipboardData.getData('text')) || '';
        if (/[0-9]/.test(textoPegado)) {
            e.preventDefault();
            const limpio = textoPegado.replace(/[0-9]/g, '');
            const inicio = el.selectionStart || 0;
            const fin = el.selectionEnd || 0;
            el.value = el.value.slice(0, inicio) + limpio + el.value.slice(fin);
            mostrarAvisoSoloLetras(el, 'Solo letras');
        }
    }, true);

    // Módulos de Auditoría en Vivo (Smoke Test DOM y Semántica A11Y)
    function ejecutarSmokeTest() {
        const salida = document.getElementById('resultadoAuditoriaLive');
        if (!salida) return;

        const totalBotones = document.querySelectorAll('button').length;
        const imgsSinAlt = Array.from(document.querySelectorAll('img')).filter((img) => {
            const alt = img.getAttribute('alt');
            return alt === null || alt.trim() === '';
        }).length;
        const enlacesVacios = Array.from(document.querySelectorAll('a')).filter((a) => {
            const href = (a.getAttribute('href') || '').trim();
            return href === '' || href === '#';
        }).length;

        salida.textContent =
            `Smoke Test: ${totalBotones} botones | ${imgsSinAlt} imágenes sin alt | ${enlacesVacios} enlaces vacíos.`;
    }

    function ejecutarAuditoriaA11Y() {
        const salida = document.getElementById('resultadoAuditoriaLive');
        if (!salida) return;

        const semanticas = document.querySelectorAll('header, nav, main, section, article, footer').length;
        const imgsSinAlt = Array.from(document.querySelectorAll('img')).filter((img) => {
            const alt = img.getAttribute('alt');
            return alt === null || alt.trim() === '';
        }).length;

        salida.textContent =
            `Auditoría A11Y: ${semanticas} etiquetas semánticas HTML5 | ${imgsSinAlt} imágenes sin atributo alt.`;
    }

    function hidratarApp() {
        if (window.location) {
            window.location.reload();
        }
    }

    function sincronizarBotonTema() {
        const btn = document.getElementById('themeBtn');
        if (!btn) return;
        const esNocturno = document.body.classList.contains('dark-mode');
        btn.textContent = esNocturno ? '☀️ Claro' : '🌙 Nocturno';
        btn.setAttribute('aria-pressed', String(esNocturno));
    }

    function inicializarTema() {
        if (!document.body.classList.contains('dark-mode') && !document.body.classList.contains('light-mode')) {
            document.body.classList.add('dark-mode');
        }
        sincronizarBotonTema();
    }

    function alternarTema() {
        const esNocturno = document.body.classList.contains('dark-mode');
        if (esNocturno) {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
        }
        sincronizarBotonTema();
    }

    function actualizarAlturaAcordeones() {
        document.querySelectorAll('.accordion-item').forEach((item) => {
            const collapse = item.querySelector('.accordion-collapse');
            if (!collapse) return;
            if (item.classList.contains('accordion-item--open')) {
                collapse.style.maxHeight = collapse.scrollHeight + 'px';
            } else {
                collapse.style.maxHeight = '0px';
            }
        });
    }

    window.actualizarAlturaAcordeones = actualizarAlturaAcordeones;

    function renderSalasInicio() {
        const grid = document.getElementById('arsenalGrid');
        if (!grid) return;

        while (grid.firstChild) {
            grid.removeChild(grid.firstChild);
        }

        SALAS_CATALOGO.forEach((sala) => {
            const card = document.createElement('article');
            card.className = 'rpg-card';

            const img = document.createElement('img');
            img.className = 'rpg-card__img';
            img.src = sala.img;
            img.alt = sala.nombre;
            img.width = 360;
            img.height = 202;
            img.loading = 'lazy';

            const body = document.createElement('div');
            body.className = 'card-cuerpo';

            const badge = document.createElement('span');
            badge.className = 'rpg-badge';
            badge.textContent = sala.habilitado ? `${sala.tag} - Bs ${sala.precio}` : sala.tag;

            const title = document.createElement('h3');
            title.className = 'rpg-card__title';
            title.textContent = sala.nombre;

            const desc = document.createElement('p');
            desc.className = 'rpg-card__desc';
            desc.textContent = sala.detalle;

            const footer = document.createElement('div');
            footer.className = 'card-pie';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = sala.accion;

            if (!sala.habilitado) {
                btn.className = 'rpg-btn rpg-btn--disabled';
                btn.disabled = true;
                btn.setAttribute('aria-disabled', 'true');
            } else {
                btn.className = 'rpg-btn rpg-btn--gold';
                btn.addEventListener('click', () => {
                    const selectSala = document.getElementById('clienteSalaInput');
                    if (selectSala) {
                        selectSala.value = `${sala.nombre} (Bs ${sala.precio})`;
                    }
                    const errorBox = document.getElementById('errorReservaSala');
                    if (errorBox) errorBox.textContent = '';
                    const inputNombre = document.getElementById('clienteNombreInput');
                    if (inputNombre) inputNombre.focus();
                });
            }

            footer.appendChild(btn);
            body.appendChild(badge);
            body.appendChild(title);
            body.appendChild(desc);
            body.appendChild(footer);

            card.appendChild(img);
            card.appendChild(body);
            grid.appendChild(card);
        });

        actualizarAlturaAcordeones();
    }

    async function procesarReservaSala(e) {
        e.preventDefault();
        const inputNombre = document.getElementById('clienteNombreInput');
        const inputMensaje = document.getElementById('clienteMensajeInput');
        const inputSala = document.getElementById('clienteSalaInput');
        const inputDia = document.getElementById('reservaDiaInput');
        const inputHora = document.getElementById('reservaHoraInput');
        const errorBox = document.getElementById('errorReservaSala');
        const salidaResumen = document.getElementById('salidaSeguraText');

        const nombre = inputNombre ? inputNombre.value.trim() : '';
        const mensaje = inputMensaje ? inputMensaje.value.trim() : '';
        const sala = inputSala ? inputSala.value.trim() : 'Sala Privada Acústica (Bs 120)';
        const dia = inputDia ? inputDia.value : '';
        const hora = inputHora ? inputHora.value : '';

        const errNombre = validarCampoTexto(nombre, 'Tu nombre');
        if (errNombre) {
            mostrarAvisoSoloLetras(inputNombre, errNombre);
            return;
        }

        const errMensaje = validarCampoTexto(mensaje, 'Estilo musical o nota');
        if (errMensaje) {
            mostrarAvisoSoloLetras(inputMensaje, errMensaje);
            return;
        }

        if (!dia || !hora) {
            if (errorBox) errorBox.textContent = 'Selecciona el día y la hora de tu reserva.';
            return;
        }

        if (errorBox) errorBox.textContent = '';

        const matchPrecio = sala.match(/Bs\s*(\d+)/i);
        const precio = matchPrecio ? Number(matchPrecio[1]) : 120;
        const salaLimpia = sala.replace(/\s*\(Bs\s*\d+\)\s*/i, '').trim() || sala;

        const resp = await llamarAPI({
            accion: 'registrar_reserva',
            nombre,
            nota: mensaje,
            sala_nombre: salaLimpia,
            fecha: dia,
            hora,
            subtotal_bs: precio
        });

        if (resp && resp.ok) {
            await sincronizarDesdeBD();
        } else {
            historialGeneral.push({
                tipo: 'Sala',
                detalle: `${sala} | Día: ${dia} | Hora: ${hora} | Cliente: ${nombre} | Nota: ${mensaje}`,
                precio
            });
            renderHistorialModal();
        }

        if (salidaResumen) {
            salidaResumen.textContent =
                `Registro seguro [textContent]: Cliente="${nombre}" | Sala="${sala}" | Día="${dia}" | Hora="${hora}" | Nota="${mensaje}"`;
        }
    }

    async function agregarItemCarta(item) {
        const resp = await llamarAPI({
            accion: 'agregar_item',
            tipo: item.categoria,
            descripcion: item.nombre,
            subtotal_bs: item.precio
        });

        if (resp && resp.ok) {
            await sincronizarDesdeBD();
        } else {
            historialGeneral.push({
                tipo: item.categoria,
                detalle: item.nombre,
                precio: item.precio
            });
            renderHistorialModal();
        }
    }

    function abrirModalApartado(modo) {
        const modal = document.getElementById('modalCartaHistorial');
        const titulo = document.getElementById('tituloModalApartado');
        const secCocteles = document.getElementById('bloqueCoctelesSolo');
        const secComida = document.getElementById('bloqueComidaSolo');
        if (!modal) return;

        if (modo === 'cocteles') {
            if (titulo) titulo.textContent = '🍹 Apartado Cócteles';
            if (secCocteles) secCocteles.style.display = 'flex';
            if (secComida) secComida.style.display = 'none';
        } else if (modo === 'comida') {
            if (titulo) titulo.textContent = '🍽️ Apartado Comida';
            if (secCocteles) secCocteles.style.display = 'none';
            if (secComida) secComida.style.display = 'flex';
        } else {
            if (titulo) titulo.textContent = '📋 Historial de Salas, Cócteles y Comida';
            if (secCocteles) secCocteles.style.display = 'flex';
            if (secComida) secComida.style.display = 'flex';
        }

        renderHistorialModal();
        modal.classList.add('rpg-modal--open');
    }

    function poblarListasSeparadas() {
        const contCocteles = document.getElementById('listaCoctelesItems');
        const contComida = document.getElementById('listaComidaItems');

        if (contCocteles) {
            while (contCocteles.firstChild) {
                contCocteles.removeChild(contCocteles.firstChild);
            }
            COCTELES_CATALOGO.forEach((item) => {
                const fila = document.createElement('div');
                fila.style.display = 'flex';
                fila.style.justifyContent = 'space-between';
                fila.style.alignItems = 'center';
                fila.style.gap = '8px';

                const lbl = document.createElement('span');
                lbl.style.fontSize = '0.76rem';
                lbl.textContent = `${item.nombre} - Bs ${item.precio}`;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rpg-btn rpg-btn--gold';
                btn.textContent = '+ Cóctel';
                btn.addEventListener('click', () => agregarItemCarta(item));

                fila.appendChild(lbl);
                fila.appendChild(btn);
                contCocteles.appendChild(fila);
            });
        }

        if (contComida) {
            while (contComida.firstChild) {
                contComida.removeChild(contComida.firstChild);
            }
            COMIDA_CATALOGO.forEach((item) => {
                const fila = document.createElement('div');
                fila.style.display = 'flex';
                fila.style.justifyContent = 'space-between';
                fila.style.alignItems = 'center';
                fila.style.gap = '8px';

                const lbl = document.createElement('span');
                lbl.style.fontSize = '0.76rem';
                lbl.textContent = `${item.nombre} - Bs ${item.precio}`;

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rpg-btn rpg-btn--gold';
                btn.textContent = '+ Comida';
                btn.addEventListener('click', () => agregarItemCarta(item));

                fila.appendChild(lbl);
                fila.appendChild(btn);
                contComida.appendChild(fila);
            });
        }
    }

    function renderHistorialModal() {
        const ul = document.getElementById('listaHistorialGeneral');
        const totalBox = document.getElementById('totalGeneralBox');
        const btnConfirmar = document.getElementById('btnConfirmarPedido');
        if (!ul || !totalBox) return;

        while (ul.firstChild) {
            ul.removeChild(ul.firstChild);
        }

        if (historialGeneral.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No hay registros aún en tu historial.';
            ul.appendChild(li);
            totalBox.textContent = 'Total acumulado: Bs 0';
            if (btnConfirmar) btnConfirmar.style.display = 'none';
            detenerTemporizadorConfirmacion('');
            return;
        }

        if (btnConfirmar) btnConfirmar.style.display = 'inline-flex';

        let total = 0;
        historialGeneral.forEach((reg, idx) => {
            total += reg.precio;
            const li = document.createElement('li');
            li.textContent = `${idx + 1}. [${reg.tipo}] ${reg.detalle} - Bs ${reg.precio}`;
            ul.appendChild(li);
        });

        totalBox.textContent = `Registros: ${historialGeneral.length} | Total a pagar: Bs ${total}`;
    }

    function pagarTodoPorWhatsApp() {
        if (historialGeneral.length === 0) {
            const totalBox = document.getElementById('totalGeneralBox');
            if (totalBox) totalBox.textContent = 'Agrega primero una sala, cóctel o comida antes de pagar.';
            return;
        }

        let total = 0;
        const lineas = historialGeneral.map((reg, idx) => {
            total += reg.precio;
            return `${idx + 1}. [${reg.tipo}] ${reg.detalle} - Bs ${reg.precio}`;
        });

        const mensaje =
            `Resumen de pago - Karaoke Stage:\n` +
            `${lineas.join('\n')}\n` +
            `Total a pagar: Bs ${total}`;

        const url = `https://wa.me/${TELEFONO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('btnInstalarPWA');
        if (installBtn) {
            installBtn.style.display = 'inline-flex';
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        const installBtn = document.getElementById('btnInstalarPWA');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    });

    document.addEventListener('click', async (e) => {
        const btnAccion = e.target.closest('button, a');
        if (btnAccion) {
            const textoBtn = (btnAccion.textContent || '').trim().toLowerCase();
            if (textoBtn === 'jugar ronda') {
                e.preventDefault();
                return;
            }
        }

        if (e.target.closest('#hydrateBtn')) {
            hidratarApp();
            return;
        }

        if (e.target.closest('#themeBtn')) {
            alternarTema();
            return;
        }

        if (e.target.closest('#btnInstalarPWA') && deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            const installBtn = document.getElementById('btnInstalarPWA');
            if (installBtn) installBtn.style.display = 'none';
            return;
        }

        if (e.target.closest('#btnSmokeTest')) {
            ejecutarSmokeTest();
            return;
        }

        if (e.target.closest('#btnAuditarA11Y')) {
            ejecutarAuditoriaA11Y();
            return;
        }

        if (e.target.closest('#btnAbrirCocteles')) {
            abrirModalApartado('cocteles');
            return;
        }

        if (e.target.closest('#btnAbrirComida')) {
            abrirModalApartado('comida');
            return;
        }

        if (e.target.closest('#btnAbrirHistorial') || e.target.closest('#btnAbrirHistorialDesdeModal')) {
            const modalContacto = document.getElementById('modalContacto');
            if (modalContacto) modalContacto.classList.remove('rpg-modal--open');
            abrirModalApartado('todo');
            return;
        }

        if (e.target.closest('#btnConfirmarPedido')) {
            iniciarConfirmacionConContador();
            return;
        }

        if (e.target.closest('#btnCancelarConfirmacion')) {
            detenerTemporizadorConfirmacion('Confirmación cancelada.');
            return;
        }

        if (e.target.closest('#btnLimpiarHistorial')) {
            const resp = await llamarAPI({ accion: 'limpiar_historial' });
            if (resp && resp.ok) {
                await sincronizarDesdeBD();
            } else {
                historialGeneral.length = 0;
                renderHistorialModal();
            }
            return;
        }

        if (e.target.closest('#btnPagarWhatsApp')) {
            pagarTodoPorWhatsApp();
            return;
        }

        if (e.target.closest('#toggleSocialBtn')) {
            const widget = document.getElementById('socialWidget');
            if (widget) {
                widget.classList.toggle('social-widget--collapsed');
                const collapsed = widget.classList.contains('social-widget--collapsed');
                e.target.closest('#toggleSocialBtn').textContent = collapsed ? '▶' : '◀';
            }
            return;
        }

        const accTrigger = e.target.closest('.accordion-trigger');
        if (accTrigger) {
            const item = accTrigger.closest('.accordion-item');
            if (item) {
                item.classList.toggle('accordion-item--open');
                actualizarAlturaAcordeones();
            }
            return;
        }

        const modalTrigger = e.target.closest('[data-open-modal]');
        if (modalTrigger) {
            const targetId = modalTrigger.getAttribute('data-open-modal');
            const modal = document.getElementById(targetId);
            if (modal) modal.classList.add('rpg-modal--open');
            return;
        }

        if (e.target.closest('[data-close-modal]') || e.target.classList.contains('rpg-modal')) {
            const modal = e.target.closest('.rpg-modal');
            if (modal) modal.classList.remove('rpg-modal--open');
        }
    });

    window.addEventListener('DOMContentLoaded', async () => {
        inicializarTema();
        renderSalasInicio();
        poblarListasSeparadas();
        renderHistorialModal();
        actualizarAlturaAcordeones();

        const form = document.getElementById('formReservaSala');
        if (form) {
            form.addEventListener('submit', procesarReservaSala);
        }

        await sincronizarDesdeBD();
    });

    window.addEventListener('resize', actualizarAlturaAcordeones);
})();

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' })
            .catch(() => {});
    });
}