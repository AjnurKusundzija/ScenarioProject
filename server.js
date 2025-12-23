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
                text: ""
            }
        ]
    };

    data.scenarios.push(scenario);
    data.nextScenarioId += 1;
    saveData(data);

    res.status(200).json(scenario);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
