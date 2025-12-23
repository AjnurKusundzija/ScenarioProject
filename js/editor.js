document.addEventListener('DOMContentLoaded', function () {
    let div = document.getElementById('divEditor');
    let poruke = document.getElementById('poruke');
    
    function show(msg) {
        poruke.textContent = msg;
    }

    function formatGrupa(grupa) {
        return grupa.scena + ' [segment ' + grupa.segment + ']: ' + grupa.uloge.join(', ');
    }

    function formatScenarij(stavka) {
        const linije = stavka.trenutni.linije.replace(/\n/g, ' / ');
        const prethodni = stavka.prethodni ? (stavka.prethodni.uloga + ': ' + stavka.prethodni.linije.replace(/\n/g, ' / ')) : 'null';
        const sljedeci = stavka.sljedeci ? (stavka.sljedeci.uloga + ': ' + stavka.sljedeci.linije.replace(/\n/g, ' / ')) : 'null';
        return 'Scena: ' + stavka.scena +
            ' | pozicija: ' + stavka.pozicijaUTekstu +
            ' | uloga: ' + stavka.trenutni.uloga +
            ' | linije: ' + linije +
            ' | prethodni: ' + prethodni +
            ' | sljedeci: ' + sljedeci;
    }
    
    let editor;
    try {
        editor = EditorTeksta(div);
    } catch (e) {
        show('Greška pri inicijalizaciji editora: ' + e.message);
        return;
    }
    
    
    const ajaxAvailable = typeof window.PoziviAjax !== 'undefined';

    function readPageConfig() {
        const root = document.body || document.documentElement;
        const params = window.URLSearchParams ? new URLSearchParams(window.location.search) : null;
        const scenarioId = (root && root.getAttribute('data-scenario-id')) || (params ? params.get('scenarioId') : null);
        const userId = (root && root.getAttribute('data-user-id')) || (params ? params.get('userId') : null);
        return {
            scenarioId: scenarioId ? scenarioId.trim() : null,
            userId: userId ? userId.trim() : null
        };
    }

    function scenarioTextFromResponse(data) {
        if (!data) return null;
        if (typeof data === 'string') return data;
        if (typeof data.text === 'string') return data.text;
        if (typeof data.content === 'string') return data.content;
        if (typeof data.tekst === 'string') return data.tekst;
        const lines = data.lines || data.linije;
        if (Array.isArray(lines)) {
            return lines.map(function (line) {
                if (typeof line === 'string') return line;
                if (line && typeof line.text === 'string') return line.text;
                if (line && typeof line.tekst === 'string') return line.tekst;
                return '';
            }).join('\n');
        }
        return null;
    }

    function scenarioTitleFromResponse(data) {
        if (!data) return null;
        if (typeof data.title === 'string') return data.title;
        if (typeof data.naziv === 'string') return data.naziv;
        if (typeof data.name === 'string') return data.name;
        return null;
    }

    function applyScenarioResponse(data) {
        const text = scenarioTextFromResponse(data);
        if (text !== null) {
            div.textContent = text;
        }
        const title = scenarioTitleFromResponse(data);
        if (title) {
            const titleEl = document.querySelector('.naslov-projekta');
            if (titleEl) titleEl.textContent = title;
        }
    }

    function extractScenarioId(data) {
        if (!data) return null;
        if (data.id !== undefined && data.id !== null) return data.id;
        if (data.scenarioId !== undefined && data.scenarioId !== null) return data.scenarioId;
        if (data.scenarijId !== undefined && data.scenarijId !== null) return data.scenarijId;
        return null;
    }

    function getEditorText() {
        return (div.innerText || '').replace(/\r/g, '');
    }

    const pageConfig = readPageConfig();
    let scenarioId = pageConfig.scenarioId;
    const userId = pageConfig.userId || 'guest';

    function loadScenario() {
        if (!ajaxAvailable || !scenarioId) return;
        PoziviAjax.getScenario(scenarioId, function (status, data) {
            if (status >= 200 && status < 300) {
                applyScenarioResponse(data);
            } else {
                show('Scenario load failed (status ' + status + ').');
            }
        });
    }

    function lockAndUpdateLine(lineId, text, done) {
        if (!ajaxAvailable) {
            done(0, null);
            return;
        }
        PoziviAjax.lockLine(scenarioId, lineId, userId, function (status, data) {
            if (status >= 200 && status < 300) {
                PoziviAjax.updateLine(scenarioId, lineId, userId, text, done);
                return;
            }
            if (status === 404 || status === 405) {
                PoziviAjax.updateLine(scenarioId, lineId, userId, text, done);
                return;
            }
            done(status, data);
        });
    }

    function saveLines(lines) {
        if (!lines.length) {
            show('Nothing to save.');
            return;
        }
        let index = 0;
        function next() {
            if (index >= lines.length) {
                show('Saved ' + lines.length + ' lines.');
                return;
            }
            const lineId = index + 1;
            lockAndUpdateLine(lineId, lines[index], function (status) {
                if (status >= 200 && status < 300) {
                    index++;
                    next();
                } else {
                    show('Save failed for line ' + lineId + ' (status ' + status + ').');
                }
            });
        }
        next();
    }

    function getScenarioTitle() {
        const titleEl = document.querySelector('.naslov-projekta');
        const raw = titleEl ? titleEl.textContent : '';
        return raw ? raw.trim() : 'Scenario';
    }

    function saveScenario() {
        if (!ajaxAvailable) {
            show('PoziviAjax module is missing.');
            return;
        }
        const raw = getEditorText();
        const lines = raw ? raw.split('\n') : [];
        if (!scenarioId) {
            PoziviAjax.postScenario(getScenarioTitle(), function (status, data) {
                if (status >= 200 && status < 300) {
                    scenarioId = extractScenarioId(data);
                    if (!scenarioId) {
                        show('Scenario created but no id returned.');
                        return;
                    }
                    saveLines(lines);
                } else {
                    show('Scenario create failed (status ' + status + ').');
                }
            });
            return;
        }
        saveLines(lines);
    }

    loadScenario();

    const saveButton = document.querySelector('.dugme-spasi');
    if (saveButton) {
        saveButton.addEventListener('click', saveScenario);
    }

    document.getElementById('btnBrojRijeci').addEventListener('click', function () {
        let res = editor.dajBrojRijeci();
        show('Ukupno: ' + res.ukupno + ', Bold: ' + res.boldiranih + ', Italic: ' + res.italic);
    });
    
    document.getElementById('btnUloge').addEventListener('click', function () {
        let res = editor.dajUloge();
        show(res.length ? res.join(', ') : 'Nema pronađenih uloga');
    });
    
    document.getElementById('btnPogresne').addEventListener('click', function () {
        let res = editor.pogresnaUloga();
        show(res.length ? 'Potencijalno pogrešne uloge: ' + res.join(', ') : 'Nema potencijalno pogrešnih imena');
    });
    
    document.getElementById('btnGrupisi').addEventListener('click', function () {
        let res = editor.grupisiUloge();
        show(res.length ? res.map(formatGrupa).join('\n') : 'Nema grupa za prikaz');
    });
    
    document.getElementById('btnBrojLinija').addEventListener('click', function () {
        let u = prompt('Unesite ime uloge (kao u tekstu):');
        if (u === null) return;
        let res = editor.brojLinijaTeksta(u);
        show('Broj linija za ulogu "' + u + '": ' + res);
    });
    
    document.getElementById('btnScenarijUloge').addEventListener('click', function () {
        let u = prompt('Unesite ime uloge (može mala/velika slova):');
        if (u === null) return;
        let res = editor.scenarijUloge(u);
        show(res.length ? res.map(formatScenarij).join('\n\n') : 'Nema replika za tu ulogu');
    });

    document.getElementById('btnBold').addEventListener('click', function () {
        let ok = editor.formatirajTekst('bold');
        show(ok ? 'Formatirano (bold).' : 'Nije selektovano ili selekcija nije unutar editora.');
    });
    
    document.getElementById('btnItalic').addEventListener('click', function () {
        let ok = editor.formatirajTekst('italic');
        show(ok ? 'Formatirano (italic).' : 'Nije selektovano ili selekcija nije unutar editora.');
    });
    
    document.getElementById('btnUnderline').addEventListener('click', function () {
        let ok = editor.formatirajTekst('underline');
        show(ok ? 'Formatirano (underline).' : 'Nije selektovano ili selekcija nije unutar editora.');
    });
});

