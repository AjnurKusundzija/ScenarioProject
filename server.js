const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "html")));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));

const dataDir = path.join(__dirname, "data");
const scenariosDir = path.join(dataDir, "scenarios");
const deltasFile = path.join(dataDir, "deltas.json");

const lineLocks = [];
const characterLocks = [];

async function ensureScenariosDir() {
    await fsp.mkdir(scenariosDir, { recursive: true });
}

function scenarioFilePath(scenarioId) {
    return path.join(scenariosDir, `scenario-${scenarioId}.json`);
}

async function loadScenario(scenarioId) {
    await ensureScenariosDir();
    try {
        const raw = await fsp.readFile(scenarioFilePath(scenarioId), "utf8");
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

async function saveScenario(scenario) {
    await ensureScenariosDir();
    await fsp.writeFile(
        scenarioFilePath(scenario.id),
        JSON.stringify(scenario, null, 2)
    );
}

async function listScenarioIds() {
    await ensureScenariosDir();
    const entries = await fsp.readdir(scenariosDir, { withFileTypes: true });
    const ids = [];
    entries.forEach(entry => {
        if (!entry.isFile()) return;
        const match = /^scenario-(\d+)\.json$/.exec(entry.name);
        if (match) ids.push(parseInt(match[1], 10));
    });
    return ids;
}

async function getNextScenarioId() {
    const ids = await listScenarioIds();
    return ids.length ? Math.max(...ids) + 1 : 1;
}

async function ensureDeltasFile() {
    await fsp.mkdir(dataDir, { recursive: true });
    try {
        await fsp.access(deltasFile);
    } catch (error) {
        await fsp.writeFile(deltasFile, JSON.stringify([], null, 2));
    }
}

async function loadDeltas() {
    await ensureDeltasFile();
    const raw = await fsp.readFile(deltasFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
}

async function saveDeltas(deltas) {
    await fsp.writeFile(deltasFile, JSON.stringify(deltas, null, 2));
}

function wrapText(text, maxWords) {
    const safeText = typeof text === "string" ? text : "";
    const trimmed = safeText.trim();
    if (!trimmed) return [""];
    const words = trimmed.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(" "));
    }
    return chunks;
}

function getNextLineId(scenario) {
    const maxId = scenario.content.reduce((max, line) => {
        return line.lineId > max ? line.lineId : max;
    }, 0);
    return maxId + 1;
}

function orderScenarioContent(scenario) {
    const map = new Map();
    const referenced = new Set();
    scenario.content.forEach(line => {
        map.set(line.lineId, line);
        if (line.nextLineId !== null && line.nextLineId !== undefined) {
            referenced.add(line.nextLineId);
        }
    });

    const start = scenario.content.find(line => !referenced.has(line.lineId));
    if (!start) {
        return [...scenario.content].sort((a, b) => a.lineId - b.lineId);
    }

    const ordered = [];
    const visited = new Set();
    let current = start;
    while (current && !visited.has(current.lineId)) {
        ordered.push(current);
        visited.add(current.lineId);
        if (current.nextLineId === null || current.nextLineId === undefined) break;
        current = map.get(current.nextLineId);
    }

    if (ordered.length < scenario.content.length) {
        scenario.content
            .filter(line => !visited.has(line.lineId))
            .sort((a, b) => a.lineId - b.lineId)
            .forEach(line => ordered.push(line));
    }

    return ordered;
}

function replaceAll(text, search, replacement) {
    if (typeof text !== "string") return text;
    if (!search) return text;
    return text.split(search).join(replacement);
}

function removeUserLineLocks(userId, keepScenarioId, keepLineId) {
    for (let i = lineLocks.length - 1; i >= 0; i -= 1) {
        const lock = lineLocks[i];
        if (lock.userId !== userId) continue;
        if (lock.scenarioId === keepScenarioId && lock.lineId === keepLineId) continue;
        lineLocks.splice(i, 1);
    }
}

function removeLineLock(scenarioId, lineId) {
    for (let i = lineLocks.length - 1; i >= 0; i -= 1) {
        const lock = lineLocks[i];
        if (lock.scenarioId === scenarioId && lock.lineId === lineId) {
            lineLocks.splice(i, 1);
        }
    }
}

function removeCharacterLock(scenarioId, characterName) {
    for (let i = characterLocks.length - 1; i >= 0; i -= 1) {
        const lock = characterLocks[i];
        if (lock.scenarioId === scenarioId && lock.characterName === characterName) {
            characterLocks.splice(i, 1);
        }
    }
}

app.post("/api/scenarios", async (req, res) => {
    try {
        const titleRaw = req.body && typeof req.body.title === "string" ? req.body.title : "";
        const title = titleRaw.trim() ? titleRaw.trim() : "Neimenovani scenarij";
        const scenarioId = await getNextScenarioId();

        const scenario = {
            id: scenarioId,
            title: title,
            content: [
                {
                    lineId: 1,
                    nextLineId: null,
                    text: ""
                }
            ]
        };

        await saveScenario(scenario);
        res.status(200).json(scenario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.post("/api/scenarios/:scenarioId/lines/:lineId/lock", async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const lineId = parseInt(req.params.lineId, 10);
        const userId = req.body ? req.body.userId : null;

        const scenario = await loadScenario(scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const line = scenario.content.find(l => l.lineId === lineId);
        if (!line) {
            res.status(404).json({ message: "Linija ne postoji!" });
            return;
        }

        const existingLock = lineLocks.find(lock => (
            lock.scenarioId === scenarioId && lock.lineId === lineId
        ));

        if (existingLock && existingLock.userId !== userId) {
            res.status(409).json({ message: "Linija je vec zakljucana!" });
            return;
        }

        removeUserLineLocks(userId, scenarioId, lineId);

        if (!existingLock) {
            lineLocks.push({ scenarioId: scenarioId, lineId: lineId, userId: userId });
        }

        res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.put("/api/scenarios/:scenarioId/lines/:lineId", async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const lineId = parseInt(req.params.lineId, 10);
        const userId = req.body ? req.body.userId : null;
        const newText = req.body ? req.body.newText : null;

        if (!Array.isArray(newText) || newText.length === 0) {
            res.status(400).json({ message: "Niz new_text ne smije biti prazan!" });
            return;
        }

        const scenario = await loadScenario(scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const line = scenario.content.find(l => l.lineId === lineId);
        if (!line) {
            res.status(404).json({ message: "Linija ne postoji!" });
            return;
        }

        const existingLock = lineLocks.find(lock => (
            lock.scenarioId === scenarioId && lock.lineId === lineId
        ));

        if (!existingLock) {
            res.status(409).json({ message: "Linija nije zakljucana!" });
            return;
        }

        if (existingLock.userId !== userId) {
            res.status(409).json({ message: "Linija je vec zakljucana!" });
            return;
        }

        const wrappedLines = [];
        newText.forEach(item => {
            wrapText(item, 20).forEach(chunk => wrappedLines.push(chunk));
        });

        const oldNext = line.nextLineId === undefined ? null : line.nextLineId;
        line.text = wrappedLines[0] || "";

        const newLineIds = [];
        if (wrappedLines.length > 1) {
            let nextId = getNextLineId(scenario);
            for (let i = 1; i < wrappedLines.length; i += 1) {
                newLineIds.push(nextId);
                nextId += 1;
            }

            line.nextLineId = newLineIds[0];

            for (let i = 0; i < newLineIds.length; i += 1) {
                scenario.content.push({
                    lineId: newLineIds[i],
                    nextLineId: i < newLineIds.length - 1 ? newLineIds[i + 1] : oldNext,
                    text: wrappedLines[i + 1]
                });
            }
        } else {
            line.nextLineId = oldNext;
        }

        await saveScenario(scenario);
        removeLineLock(scenarioId, lineId);

        const deltas = await loadDeltas();
        const timestamp = Math.floor(Date.now() / 1000);
        const affectedLineIds = [lineId, ...newLineIds];

        affectedLineIds.forEach(id => {
            const updatedLine = scenario.content.find(l => l.lineId === id);
            if (!updatedLine) return;
            deltas.push({
                scenarioId: scenarioId,
                type: "line_update",
                lineId: updatedLine.lineId,
                nextLineId: updatedLine.nextLineId === undefined ? null : updatedLine.nextLineId,
                content: updatedLine.text,
                timestamp: timestamp
            });
        });

        await saveDeltas(deltas);
        res.status(200).json({ message: "Linija je uspjesno azurirana!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.post("/api/scenarios/:scenarioId/characters/lock", async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const userId = req.body ? req.body.userId : null;
        const characterName = req.body ? req.body.characterName : null;

        const scenario = await loadScenario(scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const currentLock = characterLocks.find(lock => (
            lock.scenarioId === scenarioId && lock.characterName === characterName
        ));

        if (currentLock && currentLock.userId !== userId) {
            res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
            return;
        }

        removeCharacterLock(scenarioId, characterName);
        characterLocks.push({ scenarioId: scenarioId, characterName: characterName, userId: userId });

        res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.post("/api/scenarios/:scenarioId/characters/update", async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const userId = req.body ? req.body.userId : null;
        const oldName = req.body ? req.body.oldName : null;
        const newName = req.body ? req.body.newName : null;

        const scenario = await loadScenario(scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const currentLock = characterLocks.find(lock => (
            lock.scenarioId === scenarioId && lock.characterName === oldName
        ));

        if (currentLock && currentLock.userId !== userId) {
            res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
            return;
        }

        const lineConflict = scenario.content.find(line => {
            if (typeof line.text !== "string") return false;
            if (oldName === null || oldName === undefined || oldName === "") return false;
            if (!line.text.includes(oldName)) return false;
            const lock = lineLocks.find(item => item.scenarioId === scenarioId && item.lineId === line.lineId);
            return lock && lock.userId !== userId;
        });

        if (lineConflict) {
            res.status(409).json({ message: "Linija je vec zakljucana!" });
            return;
        }

        scenario.content.forEach(line => {
            if (typeof line.text === "string") {
                line.text = replaceAll(line.text, oldName, newName);
            }
        });

        await saveScenario(scenario);
        removeCharacterLock(scenarioId, oldName);

        const deltas = await loadDeltas();
        const timestamp = Math.floor(Date.now() / 1000);
        deltas.push({
            scenarioId: scenarioId,
            type: "char_rename",
            oldName: oldName,
            newName: newName,
            timestamp: timestamp
        });
        await saveDeltas(deltas);

        res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.get("/api/scenarios/:scenarioId/deltas", async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const sinceRaw = req.query ? req.query.since : null;
        const sinceParsed = parseInt(sinceRaw, 10);
        const since = Number.isFinite(sinceParsed) ? sinceParsed : 0;

        const scenario = await loadScenario(scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const deltas = await loadDeltas();
        const result = deltas
            .filter(delta => delta.scenarioId === scenarioId)
            .filter(delta => typeof delta.timestamp === "number" && delta.timestamp > since)
            .map(delta => {
                if (delta.type === "line_update") {
                    return {
                        type: "line_update",
                        lineId: delta.lineId,
                        nextLineId: delta.nextLineId,
                        content: delta.content,
                        timestamp: delta.timestamp
                    };
                }
                if (delta.type === "char_rename") {
                    return {
                        type: "char_rename",
                        oldName: delta.oldName,
                        newName: delta.newName,
                        timestamp: delta.timestamp
                    };
                }
                return null;
            })
            .filter(item => item !== null)
            .sort((a, b) => a.timestamp - b.timestamp);

        res.status(200).json({ deltas: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.get("/api/scenarios/:scenarioId", async (req, res) => {
    try {
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const scenario = await loadScenario(scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const orderedContent = orderScenarioContent(scenario);
        res.status(200).json({
            id: scenario.id,
            title: scenario.title,
            content: orderedContent.map(line => ({
                lineId: line.lineId,
                nextLineId: line.nextLineId === undefined ? null : line.nextLineId,
                text: line.text
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server radi na portu " + PORT);
});
