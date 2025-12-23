const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "scenarios.json");

function ensureDataFile() {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    if (!fs.existsSync(dataFile)) {
        const initial = { nextScenarioId: 1, scenarios: [] };
        fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2));
    }
}

function loadData() {
    ensureDataFile();
    const raw = fs.readFileSync(dataFile, "utf8");
    return JSON.parse(raw);
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

app.post("/api/scenarios", (req, res) => {
    const data = loadData();
    const titleRaw = req.body && typeof req.body.title === "string" ? req.body.title : "";
    const title = titleRaw.trim() ? titleRaw.trim() : "Neimenovani scenarij";

    const scenario = {
        id: data.nextScenarioId,
        title: title,
        content: [
            {
                lineId: 1,
                nextLineId: null,
                text: "",
                lockedBy: null
            }
        ],
        characterLocks: {}
    };

    data.scenarios.push(scenario);
    data.nextScenarioId += 1;
    saveData(data);

    res.status(200).json(scenario);
});

app.post("/api/scenarios/:scenarioId/lines/:lineId/lock", (req, res) => {
    const data = loadData();
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

    if (line.lockedBy !== null && line.lockedBy !== undefined && line.lockedBy !== userId) {
        res.status(409).json({ message: "Linija je vec zakljucana!" });
        return;
    }

    // User can only lock one line globally, so clear previous lock(s).
    data.scenarios.forEach(scen => {
        scen.content.forEach(l => {
            if (l.lockedBy === userId) l.lockedBy = null;
        });
    });

    line.lockedBy = userId;
    saveData(data);

    res.status(200).json({ message: "Linija je uspjesno zakljucana!" });
});

app.post("/api/scenarios/:scenarioId/characters/lock", (req, res) => {
    const data = loadData();
    const scenarioId = parseInt(req.params.scenarioId, 10);
    const userId = req.body ? req.body.userId : null;
    const characterName = req.body ? req.body.characterName : null;

    const scenario = data.scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
        res.status(404).json({ message: "Scenario ne postoji!" });
        return;
    }

    if (!scenario.characterLocks) scenario.characterLocks = {};
    const currentLock = scenario.characterLocks[characterName];

    if (currentLock !== undefined && currentLock !== null && currentLock !== userId) {
        res.status(409).json({ message: "Konflikt! Ime lika je vec zakljucano!" });
        return;
    }

    scenario.characterLocks[characterName] = userId;
    saveData(data);

    res.status(200).json({ message: "Ime lika je uspjesno zakljucano!" });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
