const express = require("express");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const app = express();
app.use(express.json());

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "scenarios.json");
const deltasFile = path.join(dataDir, "deltas.json");
const locksFile = path.join(dataDir, "locks.json");

async function ensureDataFile() {
    await fsp.mkdir(dataDir, { recursive: true });
    try {
        await fsp.access(dataFile);
    } catch (error) {
        const initial = { nextScenarioId: 1, scenarios: [] };
        await fsp.writeFile(dataFile, JSON.stringify(initial, null, 2));
    }
}

async function loadData() {
    await ensureDataFile();
    const raw = await fsp.readFile(dataFile, "utf8");
    return JSON.parse(raw);
}

async function saveData(data) {
    await fsp.writeFile(dataFile, JSON.stringify(data, null, 2));
}

async function ensureDeltasFile() {
    await fsp.mkdir(dataDir, { recursive: true });
    try {
        await fsp.access(deltasFile);
    } catch (error) {
        const initial = { nextDeltaId: 1, deltas: [] };
        await fsp.writeFile(deltasFile, JSON.stringify(initial, null, 2));
    }
}

async function loadDeltas() {
    await ensureDeltasFile();
    const raw = await fsp.readFile(deltasFile, "utf8");
    return JSON.parse(raw);
}

async function saveDeltas(data) {
    await fsp.writeFile(deltasFile, JSON.stringify(data, null, 2));
}

async function ensureLocksFile() {
    await fsp.mkdir(dataDir, { recursive: true });
    try {
        await fsp.access(locksFile);
    } catch (error) {
        const initial = { lineLocks: [], characterLocks: [] };
        await fsp.writeFile(locksFile, JSON.stringify(initial, null, 2));
    }
}

async function loadLocks() {
    await ensureLocksFile();
    const raw = await fsp.readFile(locksFile, "utf8");
    const parsed = JSON.parse(raw);
    const locks = parsed && typeof parsed === "object" ? parsed : {};
    if (!Array.isArray(locks.lineLocks)) locks.lineLocks = [];
    if (!Array.isArray(locks.characterLocks)) locks.characterLocks = [];
    return locks;
}

async function saveLocks(locks) {
    await fsp.writeFile(locksFile, JSON.stringify(locks, null, 2));
}

function migrateLegacyLocks(data, locks) {
    let migrated = false;

    if (!Array.isArray(locks.lineLocks)) {
        locks.lineLocks = [];
        migrated = true;
    }

    if (!Array.isArray(locks.characterLocks)) {
        locks.characterLocks = [];
        migrated = true;
    }

    data.scenarios.forEach(scenario => {
        if (scenario.characterLocks && typeof scenario.characterLocks === "object") {
            Object.entries(scenario.characterLocks).forEach(([characterName, userId]) => {
                if (userId !== null && userId !== undefined) {
                    const exists = locks.characterLocks.some(lock => (
                        lock.scenarioId === scenario.id && lock.characterName === characterName
                    ));
                    if (!exists) {
                        locks.characterLocks.push({
                            scenarioId: scenario.id,
                            characterName: characterName,
                            userId: userId
                        });
                    }
                }
            });
            delete scenario.characterLocks;
            migrated = true;
        }

        scenario.content.forEach(line => {
            if (Object.prototype.hasOwnProperty.call(line, "lockedBy")) {
                const userId = line.lockedBy;
                if (userId !== null && userId !== undefined) {
                    const exists = locks.lineLocks.some(lock => (
                        lock.scenarioId === scenario.id && lock.lineId === line.lineId
                    ));
                    if (!exists) {
                        locks.lineLocks.push({
                            scenarioId: scenario.id,
                            lineId: line.lineId,
                            userId: userId
                        });
                    }
                }
                delete line.lockedBy;
                migrated = true;
            }
        });
    });

    return migrated;
}

async function loadState() {
    const [data, locks] = await Promise.all([loadData(), loadLocks()]);
    const migrated = migrateLegacyLocks(data, locks);
    if (migrated) {
        await Promise.all([saveData(data), saveLocks(locks)]);
    }
    return { data, locks };
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

function toUnixSeconds(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return Math.floor(value);
    }
    if (typeof value === "string") {
        const parsed = Date.parse(value);
        if (!Number.isNaN(parsed)) {
            return Math.floor(parsed / 1000);
        }
    }
    return null;
}

function buildLineDelta(scenario, lineId, timestamp) {
    const line = scenario.content.find(item => item.lineId === lineId);
    if (!line) return null;
    return {
        type: "line_update",
        lineId: line.lineId,
        nextLineId: line.nextLineId === undefined ? null : line.nextLineId,
        content: line.text,
        timestamp: timestamp
    };
}

function buildCharDelta(delta, timestamp) {
    return {
        type: "char_rename",
        oldName: delta.oldName,
        newName: delta.newName,
        timestamp: timestamp
    };
}

app.post("/api/scenarios", async (req, res) => {
    try {
        const { data } = await loadState();
        const titleRaw = req.body && typeof req.body.title === "string" ? req.body.title : "";
        const title = titleRaw.trim() ? titleRaw.trim() : "Neimenovani scenarij";

        const scenario = {
            id: data.nextScenarioId,
            title: title,
            content: [
                {
                    lineId: 1,
                    nextLineId: null,
                    text: ""
                }
            ]
        };

        data.scenarios.push(scenario);
        data.nextScenarioId += 1;
        await saveData(data);

        res.status(200).json(scenario);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.post("/api/scenarios/:scenarioId/lines/:lineId/lock", async (req, res) => {
    try {
        const { data, locks } = await loadState();
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const lineId = parseInt(req.params.lineId, 10);
        const userId = req.body ? req.body.userId : null;

        const scenario = data.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const line = scenario.content.find(l => l.lineId === lineId);
        if (!line) {
            res.status(404).json({ message: "Linija ne postoji!" });
            return;
        }

        const existingLock = locks.lineLocks.find(lock => (
            lock.scenarioId === scenarioId && lock.lineId === lineId
        ));

        if (existingLock && existingLock.userId !== userId) {
            res.status(409).json({ message: "Linija je vec zakljucana!" });
            return;
        }

        locks.lineLocks = locks.lineLocks.filter(lock => (
            lock.userId !== userId || (lock.scenarioId === scenarioId && lock.lineId === lineId)
        ));

        const hasLock = locks.lineLocks.some(lock => (
            lock.scenarioId === scenarioId && lock.lineId === lineId && lock.userId === userId
        ));
        if (!hasLock) {
            locks.lineLocks.push({ scenarioId: scenarioId, lineId: lineId, userId: userId });
        }
        await saveLocks(locks);

        res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.put("/api/scenarios/:scenarioId/lines/:lineId", async (req, res) => {
    try {
        const { data, locks } = await loadState();
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const lineId = parseInt(req.params.lineId, 10);
        const userId = req.body ? req.body.userId : null;
        const newText = req.body ? req.body.newText : null;

        if (!Array.isArray(newText) || newText.length === 0) {
            res.status(400).json({ message: "Niz new_text ne smije biti prazan!" });
            return;
        }

        const scenario = data.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const line = scenario.content.find(l => l.lineId === lineId);
        if (!line) {
            res.status(404).json({ message: "Linija ne postoji!" });
            return;
        }

        const existingLock = locks.lineLocks.find(lock => (
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

        let newLineIds = [];
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

        await saveData(data);

        locks.lineLocks = locks.lineLocks.filter(lock => !(
            lock.scenarioId === scenarioId && lock.lineId === lineId
        ));
        await saveLocks(locks);

        const deltas = await loadDeltas();
        const timestamp = Math.floor(Date.now() / 1000);
        const affectedLineIds = [lineId, ...newLineIds];
        affectedLineIds.forEach(id => {
            const entry = buildLineDelta(scenario, id, timestamp);
            if (!entry) return;
            deltas.deltas.push({
                id: deltas.nextDeltaId,
                scenarioId: scenarioId,
                type: "line_update",
                userId: userId,
                lineId: entry.lineId,
                nextLineId: entry.nextLineId,
                content: entry.content,
                time: timestamp
            });
            deltas.nextDeltaId += 1;
        });
        await saveDeltas(deltas);

        res.status(200).json({ message: "Linija je uspjesno azurirana!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.get("/api/scenarios/:scenarioId/deltas", async (req, res) => {
    try {
        const { data } = await loadState();
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const sinceRaw = req.query ? req.query.since : null;
        const since = sinceRaw === undefined || sinceRaw === null ? 0 : parseInt(sinceRaw, 10);

        const scenario = data.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const deltas = await loadDeltas();
        const result = [];

        deltas.deltas.forEach(delta => {
            if (delta.scenarioId !== scenarioId) return;
            const timestamp = toUnixSeconds(delta.time);
            if (timestamp === null) return;
            if (timestamp <= since) return;

            if (delta.type === "line_update") {
                const entry = {
                    type: "line_update",
                    lineId: delta.lineId,
                    nextLineId: delta.nextLineId,
                    content: delta.content,
                    timestamp: timestamp
                };
                if (entry.content === undefined || entry.nextLineId === undefined) {
                    const fallback = buildLineDelta(scenario, delta.lineId, timestamp);
                    if (fallback) {
                        result.push(fallback);
                    }
                } else {
                    result.push(entry);
                }
            } else if (delta.type === "char_rename") {
                result.push(buildCharDelta(delta, timestamp));
            }
        });

        result.sort((a, b) => a.timestamp - b.timestamp);
        res.status(200).json({ deltas: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.post("/api/scenarios/:scenarioId/characters/lock", async (req, res) => {
    try {
        const { data, locks } = await loadState();
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const userId = req.body ? req.body.userId : null;
        const characterName = req.body ? req.body.characterName : null;

        const scenario = data.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        const currentLock = locks.characterLocks.find(lock => (
            lock.scenarioId === scenarioId && lock.characterName === characterName
        ));

        if (currentLock && currentLock.userId !== userId) {
            res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
            return;
        }

        locks.characterLocks = locks.characterLocks.filter(lock => !(
            lock.scenarioId === scenarioId && lock.characterName === characterName
        ));
        locks.characterLocks.push({ scenarioId: scenarioId, characterName: characterName, userId: userId });
        await saveLocks(locks);

        res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});

app.post("/api/scenarios/:scenarioId/characters/update", async (req, res) => {
    try {
        const { data, locks } = await loadState();
        const scenarioId = parseInt(req.params.scenarioId, 10);
        const userId = req.body ? req.body.userId : null;
        const oldName = req.body ? req.body.oldName : null;
        const newName = req.body ? req.body.newName : null;

        const scenario = data.scenarios.find(s => s.id === scenarioId);
        if (!scenario) {
            res.status(404).json({ message: "Scenario ne postoji!" });
            return;
        }

        scenario.content.forEach(line => {
            if (line && typeof line.text === "string" && line.text === oldName) {
                line.text = newName;
            }
        });

        await saveData(data);

        if (oldName !== null && oldName !== undefined) {
            locks.characterLocks.forEach(lock => {
                if (lock.scenarioId === scenarioId && lock.characterName === oldName) {
                    lock.characterName = newName;
                }
            });
            await saveLocks(locks);
        }

        const deltas = await loadDeltas();
        const deltaEntry = {
            id: deltas.nextDeltaId,
            scenarioId: scenarioId,
            type: "char_rename",
            userId: userId,
            oldName: oldName,
            newName: newName,
            time: Math.floor(Date.now() / 1000)
        };
        deltas.deltas.push(deltaEntry);
        deltas.nextDeltaId += 1;
        await saveDeltas(deltas);

        res.status(200).json({ message: "Ime lika je uspjesno promijenjeno!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Greska na serveru!" });
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
