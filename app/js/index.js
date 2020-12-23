const VERSION_NUMBER = "v2020.12.22";
document.getElementById("version-number").innerHTML = VERSION_NUMBER;

// TODO: Display these values at the top of the page if they are large enough
let perfLoggingDatabase;
try {
    perfLoggingDatabase = firebase.database();
} catch (_e) {
    // we don't care if this fails
}

function incrementTransaction(count) {
    return (count || 0) + 1;
}

const LOW_DPI = 48;
const HIGH_DPI = 96;

const interactionSelectors = [
    "input-image-selector",
    "input-image-selector-hidden",
    "stud-map-button",
    "mix-in-stud-map-button",
    "width-slider",
    "height-slider",
    "hue-slider",
    "saturation-slider",
    "value-slider",
    "reset-colors-button",
    "use-bleedthrough-check",
    "download-instructions-button",
    "add-custom-stud-button",
    "export-to-bricklink-button",
    "export-stud-map-button",
    "import-stud-map-file-input",
    "bricklink-piece-button",
    "clear-overrides-button",
    "clear-custom-studs-button",
    "color-ties-resolution-button",
    "resolution-limit-increase-button",
    "high-quality-insructions-check",
    "input-depth-image-selector",
    "generate-depth-image",
    "num-depth-levels-slider"
].map(id => document.getElementById(id));

const customStudTableBody = document.getElementById("custom-stud-table-body");

function disableInteraction() {
    customStudTableBody.hidden = true;
    interactionSelectors.forEach(button => (button.disabled = true));
    [...document.getElementsByClassName("btn")].forEach(
        button => (button.disabled = true)
    );
    [...document.getElementsByClassName("nav-link")].forEach(
        link => (link.className = link.className + " disabled")
    );
}

function enableInteraction() {
    customStudTableBody.hidden = false;
    interactionSelectors.forEach(button => (button.disabled = false));
    [...document.getElementsByClassName("btn")]
        .filter(
            e =>
                ![
                    "download-depth-instructions-button",
                    "high-quality-depth-insructions-check",
                    "export-depth-to-bricklink-button"
                ].includes(e.id)
        )
        .forEach(button => (button.disabled = false));
    [...document.getElementsByClassName("nav-link")].forEach(
        link => (link.className = link.className.replace(" disabled", ""))
    );
}

const CNN_INPUT_IMAGE_WIDTH = 256;
const CNN_INPUT_IMAGE_HEIGHT = 256;

let inputImage = null;

const inputCanvas = document.getElementById("input-canvas");
const inputCanvasContext = inputCanvas.getContext("2d");
const inputDepthCanvas = document.getElementById("input-depth-canvas");
const inputDepthCanvasContext = inputDepthCanvas.getContext("2d");

const webWorkerInputCanvas = document.getElementById("web-worker-input-canvas");
const webWorkerInputCanvasContext = webWorkerInputCanvas.getContext("2d");
const webWorkerOutputCanvas = document.getElementById(
    "web-worker-output-canvas"
);
const webWorkerOutputCanvasContext = webWorkerOutputCanvas.getContext("2d");

const step1Canvas = document.getElementById("step-1-canvas");
const step1CanvasContext = step1Canvas.getContext("2d");
const step1CanvasUpscaled = document.getElementById("step-1-canvas-upscaled");
const step1CanvasUpscaledContext = step1CanvasUpscaled.getContext("2d");
step1CanvasContext.imageSmoothingQuality = "high";
const step1DepthCanvas = document.getElementById("step-1-depth-canvas");
const step1DepthCanvasContext = step1DepthCanvas.getContext("2d");
const step1DepthCanvasUpscaled = document.getElementById(
    "step-1-depth-canvas-upscaled"
);
const step1DepthCanvasUpscaledContext = step1DepthCanvasUpscaled.getContext(
    "2d"
);

const step2Canvas = document.getElementById("step-2-canvas");
const step2CanvasContext = step2Canvas.getContext("2d");
const step2CanvasUpscaled = document.getElementById("step-2-canvas-upscaled");
const step2CanvasUpscaledContext = step2CanvasUpscaled.getContext("2d");
const step2DepthCanvas = document.getElementById("step-2-depth-canvas");
const step2DepthCanvasContext = step2DepthCanvas.getContext("2d");
const step2DepthCanvasUpscaled = document.getElementById(
    "step-2-depth-canvas-upscaled"
);
const step2DepthCanvasUpscaledContext = step2DepthCanvasUpscaled.getContext(
    "2d"
);

const step3Canvas = document.getElementById("step-3-canvas");
const step3CanvasContext = step3Canvas.getContext("2d");
const step3CanvasUpscaled = document.getElementById("step-3-canvas-upscaled");
const step3CanvasUpscaledContext = step3CanvasUpscaled.getContext("2d");
const step3DepthCanvas = document.getElementById("step-3-depth-canvas");
const step3DepthCanvasContext = step3DepthCanvas.getContext("3d");
const step3DepthCanvasUpscaled = document.getElementById(
    "step-3-depth-canvas-upscaled"
);
const step3DepthCanvasUpscaledContext = step3DepthCanvasUpscaled.getContext(
    "3d"
);

const step4Canvas = document.getElementById("step-4-canvas");
const step4CanvasContext = step4Canvas.getContext("2d");
const step4CanvasUpscaled = document.getElementById("step-4-canvas-upscaled");
const step4CanvasUpscaledContext = step4CanvasUpscaled.getContext("2d");
const step4Canvas3dUpscaled = document.getElementById(
    "step-4-canvas-3d-upscaled"
);

const bricklinkCacheCanvas = document.getElementById("bricklink-cache-canvas");

let targetResolution = [
    document.getElementById("width-slider").value,
    document.getElementById("height-slider").value
];
const SCALING_FACTOR = 40;
const PLATE_WIDTH = 16;

window.addEventListener("resize", () => {
    [step4Canvas].forEach(canvas => {
        canvas.height =
            (window.getComputedStyle(canvas).width * targetResolution[1]) /
            targetResolution[0];
    });
});

let depthEnabled = false;
function enableDepth() {
    [...document.getElementsByClassName("3d-selector-tabs")].forEach(
        tabsList => (tabsList.hidden = false)
    );
    document.getElementById("enable-depth-button-container").hidden = true;

    document.getElementById("download-instructions-button").innerHTML =
        "Generate Color Instructions PDF";

    document.getElementById("export-to-bricklink-button").innerHTML =
        "Copy Pixels Bricklink XML to Clipboard";

    create3dPreview();
    depthEnabled = true;
}
document
    .getElementById("enable-depth-button")
    .addEventListener("click", enableDepth);
if (window.location.href.includes("enable3d")) {
    enableDepth();
}

function updateStudCountText() {
    const requiredStuds = targetResolution[0] * targetResolution[1];
    let availableStuds = 0;
    Array.from(customStudTableBody.children).forEach(stud => {
        availableStuds += parseInt(stud.children[1].children[0].value);
    });
    const missingStuds = Math.max(requiredStuds - availableStuds, 0);
    document.getElementById("required-studs").innerHTML = requiredStuds;
    document.getElementById("available-studs").innerHTML = availableStuds;
    document.getElementById("missing-studs").innerHTML = missingStuds;
}

let overridePixelArray = new Array(
    targetResolution[0] * targetResolution[1] * 4
).fill(null);
let overrideDepthPixelArray = new Array(
    targetResolution[0] * targetResolution[1] * 4
).fill(null);

function handleResolutionChange() {
    overridePixelArray = new Array(
        targetResolution[0] * targetResolution[1] * 4
    ).fill(null);
    overrideDepthPixelArray = new Array(
        targetResolution[0] * targetResolution[1] * 4
    ).fill(null);
    runStep1();
}

document.getElementById("width-slider").addEventListener(
    "change",
    () => {
        document.getElementById(
            "width-text"
        ).innerHTML = document.getElementById("width-slider").value;
        targetResolution[0] = document.getElementById("width-slider").value;
        handleResolutionChange();
    },
    false
);

document.getElementById("height-slider").addEventListener(
    "change",
    () => {
        document.getElementById(
            "height-text"
        ).innerHTML = document.getElementById("height-slider").value;
        targetResolution[1] = document.getElementById("height-slider").value;
        handleResolutionChange();
    },
    false
);
document
    .getElementById("clear-overrides-button")
    .addEventListener("click", () => {
        overridePixelArray = new Array(
            targetResolution[0] * targetResolution[1] * 4
        ).fill(null);
        runStep1();
    });
document
    .getElementById("clear-depth-overrides-button")
    .addEventListener("click", () => {
        overrideDepthPixelArray = new Array(
            targetResolution[0] * targetResolution[1] * 4
        ).fill(null);
        runStep1();
    });

document
    .getElementById("resolution-limit-increase-button")
    .addEventListener("click", () => {
        document.getElementById("height-slider").max = 256;
        document.getElementById("width-slider").max = 256;
        document.getElementById(
            "resolution-limit-increase-button"
        ).hidden = true;
    });

const DEFAULT_STUD_MAP = "warhol_marilyn_monroe";
let selectedStudMap = STUD_MAPS[DEFAULT_STUD_MAP].studMap;
let selectedFullSetName = STUD_MAPS[DEFAULT_STUD_MAP].officialName;
let selectedSortedStuds = STUD_MAPS[DEFAULT_STUD_MAP].sortedStuds;
document.getElementById("stud-map-button").innerHTML =
    "Input Set: " + STUD_MAPS[DEFAULT_STUD_MAP].name;

function populateCustomStudSelectors(studMap) {
    customStudTableBody.innerHTML = "";
    studMap.sortedStuds.forEach(stud => {
        const studRow = getNewCustomStudRow();
        studRow.children[0].children[0].children[0].children[0].style.backgroundColor = stud;
        studRow.children[0].children[0].setAttribute(
            "title",
            HEX_TO_COLOR_NAME[stud] || stud
        );
        studRow.children[1].children[0].value = studMap.studMap[stud];
        customStudTableBody.appendChild(studRow);
    });
    runCustomStudMap();
}

function mixInStudMap(studMap) {
    document.getElementById("stud-map-button").innerHTML = "Custom set";
    studMap.sortedStuds.forEach(stud => {
        let existingRow = null;
        Array.from(customStudTableBody.children).forEach(row => {
            const rgb = row.children[0].children[0].children[0].children[0].style.backgroundColor
                .replace("rgb(", "")
                .replace(")", "")
                .split(/,\s*/)
                .map(shade => parseInt(shade));
            const rowHex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            if (rowHex == stud && existingRow == null) {
                existingRow = row;
            }
        });

        if (existingRow == null) {
            const newStudRow = getNewCustomStudRow();
            newStudRow.children[0].children[0].children[0].innerHTML = "";
            newStudRow.children[0].children[0].children[0].appendChild(
                getColorSquare(stud)
            );
            newStudRow.children[0].children[0].setAttribute(
                "title",
                HEX_TO_COLOR_NAME[stud] || stud
            );
            newStudRow.children[1].children[0].value = studMap.studMap[stud];
            customStudTableBody.appendChild(newStudRow);
        } else {
            existingRow.children[1].children[0].value = Math.min(
                parseInt(existingRow.children[1].children[0].value) +
                    studMap.studMap[stud],
                99999
            );
        }
    });
    runCustomStudMap();
}

populateCustomStudSelectors(STUD_MAPS[DEFAULT_STUD_MAP]);

const studMapOptions = document.getElementById("stud-map-options");
studMapOptions.innerHTML = "";
Object.keys(STUD_MAPS)
    .filter(key => key !== "rgb")
    .forEach(studMap => {
        const option = document.createElement("a");
        option.className = "dropdown-item btn";
        option.textContent = STUD_MAPS[studMap].name;
        option.value = studMap;
        option.addEventListener("click", () => {
            populateCustomStudSelectors(STUD_MAPS[studMap]);
            document.getElementById("stud-map-button").innerHTML =
                STUD_MAPS[studMap].name;
            selectedFullSetName = STUD_MAPS[studMap].officialName;
        });
        studMapOptions.appendChild(option);
    });

const mixInStudMapOptions = document.getElementById("mix-in-stud-map-options");

let selectedPixelPartNumber = BRICKLINK_PART_OPTIONS[0].number;
document.getElementById("bricklink-piece-button").innerHTML =
    BRICKLINK_PART_OPTIONS[0].name;
const bricklinkPieceOptions = document.getElementById(
    "bricklink-piece-options"
);
bricklinkPieceOptions.innerHTML = "";
BRICKLINK_PART_OPTIONS.forEach(part => {
    const option = document.createElement("a");
    option.className = "dropdown-item btn";
    option.textContent = part.name;
    option.value = part.number;
    option.addEventListener("click", () => {
        document.getElementById("bricklink-piece-button").innerHTML = part.name;
        selectedPixelPartNumber = part.number;
    });
    bricklinkPieceOptions.appendChild(option);
});

let selectedTiebreakTechnique = "none";
const TIEBREAK_TECHNIQUES = [
    {name: "No Color Tie Resolution", value: "none"},
    {name: "Random", value: "random"},
    {name: "Mod 2", value: "mod2"},
    {name: "Mod 3", value: "mod3"},
    {name: "Mod 4", value: "mod4"},
    {name: "Mod 5", value: "mod5"},
    {name: "Noisy Mod 2", value: "noisymod2"},
    {name: "Noisy Mod 3", value: "noisymod3"},
    {name: "Noisy Mod 4", value: "noisymod4"},
    {name: "Noisy Mod 5", value: "noisymod5"},
    {name: "Cascading Mod", value: "cascadingmod"},
    {name: "Cascading Noisy Mod", value: "cascadingnoisymod"}
];
TIEBREAK_TECHNIQUES.forEach(technique => {
    const option = document.createElement("a");
    option.className = "dropdown-item btn";
    option.textContent = technique.name;
    option.value = technique.value;
    option.addEventListener("click", () => {
        document.getElementById("color-ties-resolution-button").innerHTML =
            /*"Color Tie Resolution: " +*/ technique.name;
        selectedTiebreakTechnique = technique.value;
        runStep1();
    });
    document
        .getElementById("color-ties-resolution-options")
        .appendChild(option);
});

Object.keys(STUD_MAPS)
    .filter(key => key !== "rgb")
    .forEach(studMap => {
        const option = document.createElement("a");
        option.className = "dropdown-item btn";
        option.textContent = STUD_MAPS[studMap].name;
        option.value = studMap;
        option.addEventListener("click", () => {
            mixInStudMap(STUD_MAPS[studMap]);
        });
        mixInStudMapOptions.appendChild(option);
    });

const importOption = document.createElement("a");
importOption.className = "dropdown-item btn";
importOption.textContent = "Import From File";
importOption.value = null;
importOption.addEventListener("click", () => {
    document.getElementById("import-stud-map-file-input").click();
});
mixInStudMapOptions.appendChild(importOption);

document.getElementById("import-stud-map-file-input").addEventListener(
    "change",
    e => {
        const reader = new FileReader();
        reader.onload = function(event) {
            mixInStudMap(JSON.parse(reader.result));
            document.getElementById("import-stud-map-file-input").value = null;
        };
        reader.readAsText(e.target.files[0]);
    },
    false
);

document
    .getElementById("clear-custom-studs-button")
    .addEventListener("click", () => {
        document.getElementById("stud-map-button").innerHTML = "Custom set";
        customStudTableBody.innerHTML = "";
        runCustomStudMap();
    });

function runCustomStudMap() {
    const customStudMap = {};
    const customSortedStuds = [];
    Array.from(customStudTableBody.children).forEach(stud => {
        const rgb = stud.children[0].children[0].children[0].children[0].style.backgroundColor
            .replace("rgb(", "")
            .replace(")", "")
            .split(/,\s*/)
            .map(shade => parseInt(shade));
        const studHex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        customSortedStuds.push(studHex);
        const numStuds = parseInt(stud.children[1].children[0].value);
        customStudMap[studHex] = (customStudMap[studHex] || 0) + numStuds;
    });
    if (customSortedStuds.length > 0) {
        selectedStudMap = customStudMap;
        selectedFullSetName = "Custom";
        selectedSortedStuds = customSortedStuds;
    }
    runStep1();
}

const customOption = document.createElement("a");
customOption.className = "dropdown-item btn";
customOption.textContent = "Custom";
customOption.value = "custom";
customOption.addEventListener("click", () => {
    document.getElementById("stud-map-button").innerHTML = "Custom set";
    customStudTableBody.innerHTML = "";
    runCustomStudMap();
});
studMapOptions.appendChild(customOption);

function getColorSquare(hex) {
    const result = document.createElement("div");
    result.style.backgroundColor = hex;
    result.style.width = "1em";
    result.style.height = "1em";
    return result;
}

function getColorSelectorDropdown() {
    const DEFAULT_COLOR = "#42c0fb";
    const DEFAULT_COLOR_NAME = "Medium Azure";

    const container = document.createElement("a");
    const id = "color-selector" + uuidv4();

    const button = document.createElement("button");
    button.className = "btn ";
    button.type = "button";
    button.setAttribute("data-toggle", "dropdown");
    button.setAttribute("aria-haspopup", "true");
    button.setAttribute("aria-expanded", "false");
    button.id = id;
    button.appendChild(getColorSquare(DEFAULT_COLOR));
    button.value = DEFAULT_COLOR;

    const dropdown = document.createElement("div");
    dropdown.setAttribute("aria-labelledby", id);
    dropdown.className = "dropdown-menu pre-scrollable";

    ALL_VALID_BRICKLINK_COLORS.forEach(color => {
        const option = document.createElement("a");
        option.style.display = "flex";
        option.className = "dropdown-item btn";
        const text = document.createElement("span");
        text.innerHTML = "&nbsp;" + color.name;
        const colorSquare = getColorSquare(color.hex);
        colorSquare.style.marginTop = "3px";
        option.appendChild(colorSquare);
        option.appendChild(text);
        option.addEventListener("click", () => {
            button.innerHTML = "";
            button.appendChild(getColorSquare(color.hex));
            document.getElementById("stud-map-button").innerHTML = "Custom set";
            container.setAttribute("title", color.name);
            runCustomStudMap();
        });
        dropdown.appendChild(option);
    });

    container.setAttribute("data-toggle", "tooltip");
    container.setAttribute("data-placement", "top");
    container.setAttribute("title", DEFAULT_COLOR_NAME);
    container.appendChild(button);
    container.appendChild(dropdown);
    return container;
}

const paintbrushDropdown = getColorSelectorDropdown();
document.getElementById("paintbrush-controls").appendChild(paintbrushDropdown);

function getNewCustomStudRow() {
    const studRow = document.createElement("tr");

    const removeButton = document.createElement("button");
    removeButton.className = "btn btn-danger";
    removeButton.style = "padding: 2px";
    removeButton.innerHTML = "X";
    removeButton.addEventListener("click", () => {
        customStudTableBody.removeChild(studRow);
        runCustomStudMap();
    });

    const colorCell = document.createElement("td");
    const colorInput = getColorSelectorDropdown();
    colorCell.appendChild(colorInput);
    studRow.appendChild(colorCell);

    const numberCell = document.createElement("td");
    const numberInput = document.createElement("input");
    numberInput.style = "max-width: 80px";
    numberInput.type = "number";
    numberInput.value = 10;
    numberInput.addEventListener("change", v => {
        numberInput.value = Math.round(
            Math.min(Math.max(parseFloat(numberInput.value) || 0, 0), 99999)
        );
        document.getElementById("stud-map-button").innerHTML = "Custom set";
        runCustomStudMap();
    });
    numberCell.style = "display: flex; flex-direction: horizontal; width: 100%";
    numberCell.appendChild(numberInput);
    numberCell.appendChild(removeButton);
    studRow.appendChild(numberCell);
    return studRow;
}

document
    .getElementById("add-custom-stud-button")
    .addEventListener("click", () => {
        const studRow = getNewCustomStudRow();

        customStudTableBody.appendChild(studRow);
        runCustomStudMap();
    });

document.getElementById("hue-slider").addEventListener(
    "change",
    () => {
        document.getElementById("hue-text").innerHTML =
            document.getElementById("hue-slider").value + "<span>&#176;</span>";
        runStep1();
    },
    false
);

document.getElementById("saturation-slider").addEventListener(
    "change",
    () => {
        document.getElementById("saturation-text").innerHTML =
            document.getElementById("saturation-slider").value + "%";
        runStep1();
    },
    false
);

document.getElementById("value-slider").addEventListener(
    "change",
    () => {
        document.getElementById("value-text").innerHTML =
            document.getElementById("value-slider").value + "%";
        runStep1();
    },
    false
);

function onDepthMapCountChange() {
    const numLevels = Number(
        document.getElementById("num-depth-levels-slider").value
    );
    overrideDepthPixelArray = new Array(
        targetResolution[0] * targetResolution[1] * 4
    ).fill(null);
    document.getElementById("num-depth-levels-text").innerHTML = numLevels;
    const inputs = [];
    const inputsContainer = document.getElementById(
        "depth-threshold-sliders-containers"
    );
    inputsContainer.innerHTML = "";
    for (let i = 0; i < numLevels - 1; i++) {
        const input = document.createElement("input");
        input.type = "range";
        input.min = 0;
        input.max = 255;
        input.value = Math.floor(255 * ((i + 1) / numLevels));
        input.style = "width: 100%";
        input.addEventListener("change", () => {
            for (let j = 0; j < i; j++) {
                inputs[j].value = Math.min(inputs[j].value, input.value);
            }
            for (let j = i + 1; j < numLevels - 1; j++) {
                inputs[j].value = Math.max(inputs[j].value, input.value);
            }
            runStep1();
        });
        inputs.push(input);
        inputsContainer.appendChild(input);
    }

    [...document.getElementsByClassName("threshold-plural-s")].forEach(
        s => (s.hidden = numLevels < 3)
    );

    runStep1();
}

document
    .getElementById("num-depth-levels-slider")
    .addEventListener("change", onDepthMapCountChange, false);
onDepthMapCountChange();

document.getElementById("reset-colors-button").addEventListener(
    "click",
    () => {
        document.getElementById("hue-slider").value = 0;
        document.getElementById("saturation-slider").value = 0;
        document.getElementById("value-slider").value = 0;
        document.getElementById("hue-text").innerHTML =
            document.getElementById("hue-slider").value + "<span>&#176;</span>";
        document.getElementById("saturation-text").innerHTML =
            document.getElementById("saturation-slider").value + "%";
        document.getElementById("value-text").innerHTML =
            document.getElementById("value-slider").value + "%";
        runStep1();
    },
    false
);

document.getElementById("use-bleedthrough-check").addEventListener(
    "change",
    () => {
        runStep1();
    },
    false
);

function runStep1() {
    disableInteraction();
    updateStudCountText();

    window.URL.revokeObjectURL(
        document.getElementById("export-stud-map-button").href
    );
    document.getElementById(
        "export-stud-map-button"
    ).href = window.URL.createObjectURL(
        new Blob(
            [
                JSON.stringify({
                    studMap: selectedStudMap,
                    sortedStuds: Object.keys(selectedStudMap)
                })
            ],
            {
                type: "text/plain"
            }
        )
    );

    step1Canvas.width = targetResolution[0];
    step1Canvas.height = targetResolution[1];
    step1CanvasContext.drawImage(
        inputCanvas,
        0,
        0,
        targetResolution[0],
        targetResolution[1]
    );
    step1DepthCanvas.width = targetResolution[0];
    step1DepthCanvas.height = targetResolution[1];
    step1DepthCanvasContext.drawImage(
        inputDepthCanvas,
        0,
        0,
        targetResolution[0],
        targetResolution[1]
    );
    setTimeout(() => {
        runStep2();
        step1CanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step1CanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        step1CanvasUpscaledContext.imageSmoothingEnabled = false;
        step1CanvasUpscaledContext.drawImage(
            step1Canvas,
            0,
            0,
            targetResolution[0] * SCALING_FACTOR,
            targetResolution[1] * SCALING_FACTOR
        );
        step1DepthCanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step1DepthCanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        step1DepthCanvasUpscaledContext.imageSmoothingEnabled = false;
        step1DepthCanvasUpscaledContext.drawImage(
            step1DepthCanvas,
            0,
            0,
            targetResolution[0] * SCALING_FACTOR,
            targetResolution[1] * SCALING_FACTOR
        );
    }, 1); // TODO: find better way to check that input is finished
}

function runStep2() {
    const inputPixelArray = getPixelArrayFromCanvas(step1Canvas);
    const filteredPixelArray = applyHSVAdjustment(
        inputPixelArray,
        document.getElementById("hue-slider").value,
        document.getElementById("saturation-slider").value / 100,
        document.getElementById("value-slider").value / 100
    );
    step2Canvas.width = targetResolution[0];
    step2Canvas.height = targetResolution[1];
    drawPixelsOnCanvas(filteredPixelArray, step2Canvas);

    step2DepthCanvas.width = targetResolution[0];
    step2DepthCanvas.height = targetResolution[1];
    const inputDepthPixelArray = getPixelArrayFromCanvas(step1DepthCanvas);
    const discreteDepthPixels = getDiscreteDepthPixels(
        inputDepthPixelArray,
        [
            ...document.getElementById("depth-threshold-sliders-containers")
                .children
        ].map(slider => Number(slider.value))
    );
    drawPixelsOnCanvas(discreteDepthPixels, step2DepthCanvas);

    setTimeout(() => {
        runStep3();
        step2CanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step2CanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        step2CanvasUpscaledContext.imageSmoothingEnabled = false;
        step2CanvasUpscaledContext.drawImage(
            step2Canvas,
            0,
            0,
            targetResolution[0] * SCALING_FACTOR,
            targetResolution[1] * SCALING_FACTOR
        );
        step2DepthCanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step2DepthCanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        drawStudImageOnCanvas(
            scaleUpDiscreteDepthPixelsForDisplay(
                discreteDepthPixels,
                document.getElementById("num-depth-levels-slider").value
            ),
            targetResolution[0],
            SCALING_FACTOR,
            step2DepthCanvasUpscaled
        );
    }, 1); // TODO: find better way to check that input is finished
}

function runStep3() {
    const fiteredPixelArray = getPixelArrayFromCanvas(step2Canvas);
    const alignedPixelArray = alignPixelsToStudMap(
        fiteredPixelArray,
        document.getElementById("use-bleedthrough-check").checked
            ? getDarkenedStudMap(selectedStudMap)
            : selectedStudMap,
        document.getElementById("use-bleedthrough-check").checked
            ? getDarkenedImage(overridePixelArray)
            : overridePixelArray
    );
    step3Canvas.width = targetResolution[0];
    step3Canvas.height = targetResolution[1];
    drawPixelsOnCanvas(alignedPixelArray, step3Canvas);

    step3DepthCanvas.width = targetResolution[0];
    step3DepthCanvas.height = targetResolution[1];
    const inputDepthPixelArray = getPixelArrayFromCanvas(step2DepthCanvas);

    const adjustedDepthPixelArray = getArrayWithOverridesApplied(
        inputDepthPixelArray,
        overrideDepthPixelArray
    );

    drawPixelsOnCanvas(adjustedDepthPixelArray, step3DepthCanvas);

    setTimeout(() => {
        if (!isStep3ViewExpanded) {
            runStep4();
        } else {
            enableInteraction();
        }
        step3CanvasUpscaledContext.imageSmoothingEnabled = false;
        drawStudImageOnCanvas(
            document.getElementById("use-bleedthrough-check").checked
                ? revertDarkenedImage(
                      alignedPixelArray,
                      getDarkenedStudsToStuds(
                          ALL_BRICKLINK_SOLID_COLORS.map(color => color.hex)
                      )
                  )
                : alignedPixelArray,
            targetResolution[0],
            SCALING_FACTOR,
            step3CanvasUpscaled
        );
        step3DepthCanvasUpscaled.width = targetResolution[0] * SCALING_FACTOR;
        step3DepthCanvasUpscaled.height = targetResolution[1] * SCALING_FACTOR;
        drawStudImageOnCanvas(
            scaleUpDiscreteDepthPixelsForDisplay(
                adjustedDepthPixelArray,
                document.getElementById("num-depth-levels-slider").value
            ),
            targetResolution[0],
            SCALING_FACTOR,
            step3DepthCanvasUpscaled
        );
    }, 1); // TODO: find better way to check that input is finished
}

let isStep3ViewExpanded = false;

[
    document.getElementById("toggle-expansion-button"),
    document.getElementById("toggle-depth-expansion-button")
].forEach(button =>
    button.addEventListener("click", () => {
        isStep3ViewExpanded = !isStep3ViewExpanded;
        const toToggleElements = Array.from(
            document.getElementsByClassName("hide-on-step-3-expansion")
        );
        if (isStep3ViewExpanded) {
            toToggleElements.forEach(element => (element.hidden = true));
            document.getElementById("toggle-expansion-button").innerHTML =
                "Collapse Picture";
            document.getElementById("step-3").className = "col-12";
        } else {
            toToggleElements.forEach(element => (element.hidden = false));
            document.getElementById("toggle-expansion-button").innerHTML =
                "Expand Picture";
            document.getElementById("step-3").className = "col-6 col-md-3";
            runStep4();
        }
    })
);

function onPixelOverride(row, col, colorHex) {
    const colorRGB = hexToRgb(colorHex);
    const pixelIndex = 4 * (row * targetResolution[0] + col);
    const isAlreadySet =
        colorRGB[0] === overridePixelArray[pixelIndex] &&
        colorRGB[1] === overridePixelArray[pixelIndex + 1] &&
        colorRGB[2] === overridePixelArray[pixelIndex + 2];
    if (isAlreadySet) {
        for (var i = 0; i < 4; i++) {
            overridePixelArray[pixelIndex + i] = null;
        }
    } else {
        for (var i = 0; i < 3; i++) {
            overridePixelArray[pixelIndex + i] = colorRGB[i];
        }
        overridePixelArray[pixelIndex + 3] = 255;
    }
    runStep1();
}

function onDepthOverrideDecrease(row, col) {
    onDepthOverrideChange(row, col, false);
}
function onDepthOverrideIncrease(row, col) {
    onDepthOverrideChange(row, col, true);
}

function onDepthOverrideChange(row, col, isIncrease) {
    const pixelIndex = 4 * (row * targetResolution[0] + col);
    const step2DepthImagePixels = getPixelArrayFromCanvas(step2DepthCanvas);
    const currentVal =
        overrideDepthPixelArray[pixelIndex] != null
            ? overrideDepthPixelArray[pixelIndex]
            : step2DepthImagePixels[pixelIndex];

    let newVal = currentVal;
    if (isIncrease) {
        newVal = Math.min(
            newVal + 1,
            Number(document.getElementById("num-depth-levels-slider").value)
        );
    } else {
        newVal = Math.max(newVal - 1, 0);
    }

    if (newVal === step2DepthImagePixels[pixelIndex]) {
        newVal = null;
    }
    for (var i = 0; i < 3; i++) {
        overrideDepthPixelArray[pixelIndex + i] = newVal;
    }

    runStep1();
}

function onCherryPickColor(row, col) {
    const existingRGB = document
        .getElementById("paintbrush-controls")
        .children[0].children[0].children[0].style.backgroundColor.replace(
            "rgb(",
            ""
        )
        .replace(")", "")
        .split(/,\s*/)
        .map(shade => parseInt(shade));
    const pixelIndex = 4 * (row * targetResolution[0] + col);
    const isAlreadySet =
        existingRGB[0] === overridePixelArray[pixelIndex] &&
        existingRGB[1] === overridePixelArray[pixelIndex + 1] &&
        existingRGB[2] === overridePixelArray[pixelIndex + 2];

    const step3PixelArray = document.getElementById("use-bleedthrough-check")
        .checked
        ? revertDarkenedImage(
              getPixelArrayFromCanvas(step3Canvas),
              getDarkenedStudsToStuds(
                  ALL_BRICKLINK_SOLID_COLORS.map(color => color.hex)
              )
          )
        : getPixelArrayFromCanvas(step3Canvas);

    const colorHex = isAlreadySet
        ? rgbToHex(
              overridePixelArray[pixelIndex],
              overridePixelArray[pixelIndex + 1],
              overridePixelArray[pixelIndex + 2]
          )
        : rgbToHex(
              step3PixelArray[pixelIndex],
              step3PixelArray[pixelIndex + 1],
              step3PixelArray[pixelIndex + 2]
          );
    document.getElementById(
        "paintbrush-controls"
    ).children[0].children[0].children[0].style.backgroundColor = colorHex;
    const hexName = ALL_BRICKLINK_SOLID_COLORS.find(
        color => color.hex === colorHex
    ).name;
    document
        .getElementById("paintbrush-controls")
        .children[0].setAttribute("title", hexName);
}

step3CanvasUpscaled.addEventListener(
    "click",
    function(event) {
        const rawRow =
            event.clientY -
            step3CanvasUpscaled.getBoundingClientRect().y -
            step3CanvasUpscaled.offsetHeight / targetResolution[0] / 2;
        const rawCol =
            event.clientX -
            step3CanvasUpscaled.getBoundingClientRect().x -
            step3CanvasUpscaled.offsetHeight / targetResolution[0] / 2;
        const row = Math.round(
            (rawRow * targetResolution[0]) / step3CanvasUpscaled.offsetHeight
        );
        const col = Math.round(
            (rawCol * targetResolution[1]) / step3CanvasUpscaled.offsetHeight
        );
        const rgb = document
            .getElementById("paintbrush-controls")
            .children[0].children[0].children[0].style.backgroundColor.replace(
                "rgb(",
                ""
            )
            .replace(")", "")
            .split(/,\s*/)
            .map(shade => parseInt(shade));
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        onPixelOverride(row, col, hex);
    },
    false
);

step3CanvasUpscaled.addEventListener("contextmenu", function(event) {
    event.preventDefault();
    const rawRow =
        event.clientY -
        step3CanvasUpscaled.getBoundingClientRect().y -
        step3CanvasUpscaled.offsetHeight / targetResolution[0] / 2;
    const rawCol =
        event.clientX -
        step3CanvasUpscaled.getBoundingClientRect().x -
        step3CanvasUpscaled.offsetHeight / targetResolution[0] / 2;
    const row = Math.round(
        (rawRow * targetResolution[0]) / step3CanvasUpscaled.offsetHeight
    );
    const col = Math.round(
        (rawCol * targetResolution[1]) / step3CanvasUpscaled.offsetHeight
    );
    onCherryPickColor(row, col);
});

step3DepthCanvasUpscaled.addEventListener(
    "contextmenu",
    function(event) {
        event.preventDefault();
        const rawRow =
            event.clientY -
            step3DepthCanvasUpscaled.getBoundingClientRect().y -
            step3DepthCanvasUpscaled.offsetHeight / targetResolution[0] / 2;
        const rawCol =
            event.clientX -
            step3DepthCanvasUpscaled.getBoundingClientRect().x -
            step3DepthCanvasUpscaled.offsetHeight / targetResolution[0] / 2;
        const row = Math.round(
            (rawRow * targetResolution[0]) /
                step3DepthCanvasUpscaled.offsetHeight
        );
        const col = Math.round(
            (rawCol * targetResolution[1]) /
                step3DepthCanvasUpscaled.offsetHeight
        );
        onDepthOverrideIncrease(row, col);
    },
    false
);

step3DepthCanvasUpscaled.addEventListener(
    "click",
    function(event) {
        const rawRow =
            event.clientY -
            step3DepthCanvasUpscaled.getBoundingClientRect().y -
            step3DepthCanvasUpscaled.offsetHeight / targetResolution[0] / 2;
        const rawCol =
            event.clientX -
            step3DepthCanvasUpscaled.getBoundingClientRect().x -
            step3DepthCanvasUpscaled.offsetHeight / targetResolution[0] / 2;
        const row = Math.round(
            (rawRow * targetResolution[0]) /
                step3DepthCanvasUpscaled.offsetHeight
        );
        const col = Math.round(
            (rawCol * targetResolution[1]) /
                step3DepthCanvasUpscaled.offsetHeight
        );
        onDepthOverrideDecrease(row, col);
    },
    false
);

let step3CanvasHoveredPixel = null;
[step3CanvasUpscaled, step3DepthCanvasUpscaled].forEach(toHoverCanvas => {
    toHoverCanvas.addEventListener("mousemove", function(event) {
        const rawRow =
            event.clientY -
            toHoverCanvas.getBoundingClientRect().y -
            toHoverCanvas.offsetHeight / targetResolution[0] / 2;
        const rawCol =
            event.clientX -
            toHoverCanvas.getBoundingClientRect().x -
            toHoverCanvas.offsetHeight / targetResolution[0] / 2;
        const pixelRow = Math.round(
            (rawRow * targetResolution[0]) / toHoverCanvas.offsetHeight
        );
        const pixelCol = Math.round(
            (rawCol * targetResolution[1]) / toHoverCanvas.offsetHeight
        );
        const circleCircumferance = SCALING_FACTOR;
        const highlightCircleRadius = 0.1 * circleCircumferance;

        if (
            step3CanvasHoveredPixel == null ||
            step3CanvasHoveredPixel[0] != pixelRow ||
            step3CanvasHoveredPixel[1] != pixelCol
        ) {
            const ctx = toHoverCanvas.getContext("2d");

            [
                pixelRow * SCALING_FACTOR + highlightCircleRadius,
                pixelRow * SCALING_FACTOR +
                    circleCircumferance -
                    highlightCircleRadius
            ].forEach(row => {
                [
                    pixelCol * SCALING_FACTOR + highlightCircleRadius,
                    pixelCol * SCALING_FACTOR +
                        circleCircumferance -
                        highlightCircleRadius
                ].forEach(col => {
                    ctx.beginPath();
                    ctx.arc(col, row, highlightCircleRadius, 0, 2 * Math.PI);
                    ctx.fillStyle =
                        toHoverCanvas == step3CanvasUpscaled
                            ? "#FFFFFF"
                            : "#E83E8C";
                    ctx.fill();
                });
            });

            if (step3CanvasHoveredPixel != null) {
                [
                    step3CanvasHoveredPixel[0] * SCALING_FACTOR +
                        highlightCircleRadius,
                    step3CanvasHoveredPixel[0] * SCALING_FACTOR +
                        circleCircumferance -
                        highlightCircleRadius
                ].forEach(row => {
                    [
                        step3CanvasHoveredPixel[1] * SCALING_FACTOR +
                            highlightCircleRadius,
                        step3CanvasHoveredPixel[1] * SCALING_FACTOR +
                            circleCircumferance -
                            highlightCircleRadius
                    ].forEach(col => {
                        ctx.beginPath();
                        ctx.arc(
                            col,
                            row,
                            highlightCircleRadius,
                            0,
                            2 * Math.PI
                        );
                        ctx.fillStyle = "#000000";
                        ctx.fill();
                    });
                });
            }
            step3CanvasHoveredPixel = [pixelRow, pixelCol];
        }
    });

    toHoverCanvas.addEventListener("mouseleave", function(event) {
        const ctx = toHoverCanvas.getContext("2d");
        const circleCircumferance = SCALING_FACTOR;
        const highlightCircleRadius = 0.1 * circleCircumferance;

        if (step3CanvasHoveredPixel != null) {
            [
                step3CanvasHoveredPixel[0] * SCALING_FACTOR +
                    highlightCircleRadius,
                step3CanvasHoveredPixel[0] * SCALING_FACTOR +
                    circleCircumferance -
                    highlightCircleRadius
            ].forEach(row => {
                [
                    step3CanvasHoveredPixel[1] * SCALING_FACTOR +
                        highlightCircleRadius,
                    step3CanvasHoveredPixel[1] * SCALING_FACTOR +
                        circleCircumferance -
                        highlightCircleRadius
                ].forEach(col => {
                    ctx.beginPath();
                    ctx.arc(col, row, highlightCircleRadius, 0, 2 * Math.PI);
                    ctx.fillStyle = "#000000";
                    ctx.fill();
                });
            });
        }
        step3CanvasHoveredPixel = null;
    });
});

window.depthPreviewOptions = {};
function create3dPreview() {
    const app = new PIXI.Application({
        resizeTo: step4Canvas3dUpscaled,
        autoResize: true,
        resizeThrottle: 100
    });

    step4Canvas3dUpscaled.innerHTML = "";
    step4Canvas3dUpscaled.appendChild(app.view);

    const img = new PIXI.Sprite.from(
        step4CanvasUpscaled.toDataURL("image/png", 1.0)
    );

    img.width = Number(
        window.getComputedStyle(step4Canvas3dUpscaled).width.replace("px", "")
    );
    img.height = (img.width * targetResolution[1]) / targetResolution[0];
    app.stage.addChild(img);

    const depthMap = new PIXI.Sprite.from(
        step3DepthCanvasUpscaled.toDataURL("image/png", 1.0)
    );
    app.stage.addChild(depthMap);

    const displacementFilter = new PIXI.filters.DisplacementFilter(depthMap);
    app.stage.filters = [displacementFilter];
    displacementFilter.scale.x = 0;
    displacementFilter.scale.y = 0;

    window.depthPreviewOptions = {
        app,
        img,
        depthMap,
        displacementFilter
    };
    setTimeout(depthPreviewResize, 5);
}

document.getElementById("step-4-depth-tab").addEventListener("click", () => {
    const targetWidth = step4CanvasUpscaled.clientWidth;
    step4Canvas3dUpscaled.clientWidth = targetWidth;
    setTimeout(create3dPreview, 5);
});

function depthPreviewResize() {
    if (
        // for perf
        document.getElementById("step-4-depth-tab").className.includes("active")
    ) {
        const {app, img, depthMap} = window.depthPreviewOptions;
        const targetWidth = step4Canvas3dUpscaled.clientWidth;
        const targetHeight =
            (targetWidth * targetResolution[1]) / targetResolution[0];
        step4Canvas3dUpscaled.style.height = targetHeight + "px";
        app.renderer.resize(targetWidth, targetHeight);
        img.width = targetWidth;
        img.height = targetHeight;
        depthMap.width = targetWidth;
        depthMap.height = targetHeight;
    }
}

window.addEventListener("resize", depthPreviewResize);

step4Canvas3dUpscaled.addEventListener("mousemove", function(e) {
    if (
        // for perf
        document.getElementById("step-4-depth-tab").className.includes("active")
    ) {
        const {img, displacementFilter} = window.depthPreviewOptions;
        const displacementScale = 1 / 120;
        const rawX =
            event.clientX - step4Canvas3dUpscaled.getBoundingClientRect().x;
        const rawY =
            event.clientY - step4Canvas3dUpscaled.getBoundingClientRect().y;
        displacementFilter.scale.x = (img.width / 2 - rawX) * displacementScale;
        displacementFilter.scale.y =
            (img.height / 2 - rawY) * displacementScale;
    }
});
step4Canvas3dUpscaled.addEventListener("mouseleave", function(e) {
    if (
        // for perf
        document.getElementById("step-4-depth-tab").className.includes("active")
    ) {
        const {displacementFilter} = window.depthPreviewOptions;
        displacementFilter.scale.x = 0;
        displacementFilter.scale.y = 0;
    }
});

function runStep4(asyncCallback) {
    const step2PixelArray = getPixelArrayFromCanvas(step2Canvas);
    const step3PixelArray = getPixelArrayFromCanvas(step3Canvas);
    step4Canvas.width = 0;
    try {
        bricklinkCacheCanvas.width = targetResolution[0];
        bricklinkCacheCanvas.height = targetResolution[1];
        step4Canvas.width = targetResolution[0];
        step4Canvas.height = targetResolution[1];
        step4CanvasContext.clearRect(
            0,
            0,
            targetResolution[0],
            targetResolution[1]
        );
        step4CanvasUpscaledContext.clearRect(
            0,
            0,
            targetResolution[0] * SCALING_FACTOR,
            targetResolution[1] * SCALING_FACTOR
        );

        const availabilityCorrectedPixelArray = correctPixelsForAvailableStuds(
            step3PixelArray,
            document.getElementById("use-bleedthrough-check").checked
                ? getDarkenedStudMap(selectedStudMap)
                : selectedStudMap,
            step2PixelArray,
            document.getElementById("use-bleedthrough-check").checked
                ? getDarkenedImage(overridePixelArray)
                : overridePixelArray,
            selectedTiebreakTechnique,
            targetResolution[0]
        );

        drawPixelsOnCanvas(availabilityCorrectedPixelArray, step4Canvas);
        setTimeout(async () => {
            step4CanvasUpscaledContext.imageSmoothingEnabled = false;
            drawPixelsOnCanvas(
                document.getElementById("use-bleedthrough-check").checked
                    ? revertDarkenedImage(
                          availabilityCorrectedPixelArray,
                          getDarkenedStudsToStuds(
                              ALL_BRICKLINK_SOLID_COLORS.map(color => color.hex)
                          )
                      )
                    : availabilityCorrectedPixelArray,
                bricklinkCacheCanvas
            );

            drawStudImageOnCanvas(
                document.getElementById("use-bleedthrough-check").checked
                    ? revertDarkenedImage(
                          availabilityCorrectedPixelArray,
                          getDarkenedStudsToStuds(
                              ALL_BRICKLINK_SOLID_COLORS.map(color => color.hex)
                          )
                      )
                    : availabilityCorrectedPixelArray,
                targetResolution[0],
                SCALING_FACTOR,
                step4CanvasUpscaled
            );
            if (
                document
                    .getElementById("step-4-depth-tab")
                    .className.includes("active")
            ) {
                setTimeout(create3dPreview, 50); // TODO: find better way to check that input is finished
            }
            if (asyncCallback) {
                await asyncCallback();
            }
            enableInteraction();
        }, 1); // TODO: find better way to check that input is finished
    } catch (_e) {
        enableInteraction();
    }
}

function addWaterMark(pdf) {
    for (let i = 0; i < pdf.internal.getNumberOfPages(); i++) {
        pdf.setPage(i + 1);
        pdf.setFontSize(20);
        pdf.setTextColor(200);
        pdf.text(
            pdf.internal.pageSize.height * 0.25,
            pdf.internal.pageSize.height * 0.3,
            "Generated by lego-art-remix.debkbanerji.com"
        );
        pdf.text(
            pdf.internal.pageSize.height * 0.25,
            pdf.internal.pageSize.height * 0.3 + 10,
            VERSION_NUMBER
        );
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setDPI(canvas, dpi) {
    // Set up CSS size.
    canvas.style.width = canvas.style.width || canvas.width + "px";
    canvas.style.height = canvas.style.height || canvas.height + "px";

    // Get size information.
    var scaleFactor = dpi / 96;
    var width = parseFloat(canvas.style.width);
    var height = parseFloat(canvas.style.height);

    // Backup the canvas contents.
    var oldScale = canvas.width / width;
    var backupScale = scaleFactor / oldScale;
    var backup = canvas.cloneNode(false);
    backup.getContext("2d").drawImage(canvas, 0, 0);

    // Resize the canvas.
    var ctx = canvas.getContext("2d");
    canvas.width = Math.ceil(width * scaleFactor);
    canvas.height = Math.ceil(height * scaleFactor);

    // Redraw the canvas image and scale future draws.
    ctx.setTransform(backupScale, 0, 0, backupScale, 0, 0);
    ctx.drawImage(backup, 0, 0);
    ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);
}

async function generateInstructions() {
    const instructionsCanvasContainer = document.getElementById(
        "instructions-canvas-container"
    );
    instructionsCanvasContainer.innerHTML = "";
    disableInteraction();
    runStep4(async () => {
        const isHighQuality = document.getElementById(
            "high-quality-insructions-check"
        ).checked;
        const step4PixelArray = getPixelArrayFromCanvas(step4Canvas);
        const resultImage = document.getElementById("use-bleedthrough-check")
            .checked
            ? revertDarkenedImage(
                  step4PixelArray,
                  getDarkenedStudsToStuds(
                      ALL_BRICKLINK_SOLID_COLORS.map(color => color.hex)
                  )
              )
            : step4PixelArray;

        const titlePageCanvas = document.createElement("canvas");
        instructionsCanvasContainer.appendChild(titlePageCanvas);
        generateInstructionTitlePage(
            resultImage,
            targetResolution[0],
            PLATE_WIDTH,
            selectedSortedStuds,
            SCALING_FACTOR,
            step4CanvasUpscaled,
            titlePageCanvas,
            isHighQuality
        );
        setDPI(titlePageCanvas, isHighQuality ? HIGH_DPI : LOW_DPI);

        const imgData = titlePageCanvas.toDataURL("image/png", 1.0);

        let pdf = new jsPDF({
            orientation:
                titlePageCanvas.width < titlePageCanvas.height ? "p" : "l",
            unit: "mm",
            format: [titlePageCanvas.width, titlePageCanvas.height]
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        const totalPlates =
            resultImage.length / (4 * PLATE_WIDTH * PLATE_WIDTH);

        document.getElementById("pdf-progress-bar").style.width = `${100 /
            (totalPlates + 1)}%`;

        document.getElementById("pdf-progress-bar").style.width = "0%";
        document.getElementById("pdf-progress-container").hidden = false;
        document.getElementById("download-instructions-button").hidden = true;

        pdf.addImage(
            imgData,
            "PNG",
            0,
            0,
            pdfWidth,
            (pdfWidth * titlePageCanvas.height) / titlePageCanvas.width
        );

        let numParts = 1;
        for (var i = 0; i < totalPlates; i++) {
            await sleep(50);
            if ((i + 1) % (isHighQuality ? 20 : 50) === 0) {
                addWaterMark(pdf);
                pdf.save(`Lego-Art-Remix-Instructions-Part-${numParts}.pdf`);
                numParts++;
                pdf = new jsPDF({
                    orientation:
                        titlePageCanvas.width < titlePageCanvas.height
                            ? "p"
                            : "l",
                    unit: "mm",
                    format: [titlePageCanvas.width, titlePageCanvas.height]
                });
            } else {
                pdf.addPage();
            }

            document.getElementById("pdf-progress-bar").style.width = `${((i +
                2) *
                100) /
                (totalPlates + 1)}%`;

            const instructionPageCanvas = document.createElement("canvas");
            instructionsCanvasContainer.appendChild(instructionPageCanvas);

            const subPixelArray = getSubPixelArray(
                resultImage,
                i,
                targetResolution[0],
                PLATE_WIDTH
            );
            generateInstructionPage(
                subPixelArray,
                PLATE_WIDTH,
                selectedSortedStuds,
                SCALING_FACTOR,
                instructionPageCanvas,
                i + 1,
                isHighQuality
            );

            setDPI(instructionPageCanvas, isHighQuality ? HIGH_DPI : LOW_DPI);
            const imgData = instructionPageCanvas.toDataURL(
                `image${i + 1}/jpeg`,
                i
            );

            pdf.addImage(
                imgData,
                "PNG",
                0,
                0,
                pdfWidth,
                (pdfWidth * instructionPageCanvas.height) /
                    instructionPageCanvas.width
            );
        }

        addWaterMark(pdf);
        pdf.save(
            numParts > 1
                ? `Lego-Art-Remix-Instructions-Part-${numParts}.pdf`
                : "Lego-Art-Remix-Instructions.pdf"
        );
        document.getElementById("pdf-progress-container").hidden = true;
        document.getElementById("download-instructions-button").hidden = false;
        enableInteraction();

        perfLoggingDatabase
            .ref("instructions-generated-count/total")
            .transaction(incrementTransaction);
        const loggingTimestamp = Math.floor(
            (Date.now() - (Date.now() % 8.64e7)) / 1000
        ); // 8.64e+7 = ms in day
        perfLoggingDatabase
            .ref("instructions-generated-count/per-day/" + loggingTimestamp)
            .transaction(incrementTransaction);
    });
}

document
    .getElementById("hogwarts-crest-example-instructions-link")
    .addEventListener("click", () => {
        perfLoggingDatabase
            .ref("examples-click-count/hogwarts-crest-instructions/total")
            .transaction(incrementTransaction);
        const loggingTimestamp = Math.floor(
            (Date.now() - (Date.now() % 8.64e7)) / 1000
        ); // 8.64e+7 = ms in day
        perfLoggingDatabase
            .ref(
                "examples-click-count/hogwarts-crest-instructions/per-day/" +
                    loggingTimestamp
            )
            .transaction(incrementTransaction);
    });

document
    .getElementById("31201-lego-website-link")
    .addEventListener("click", () => {
        perfLoggingDatabase
            .ref("examples-click-count/31201-lego-website-link/total")
            .transaction(incrementTransaction);
        const loggingTimestamp = Math.floor(
            (Date.now() - (Date.now() % 8.64e7)) / 1000
        ); // 8.64e+7 = ms in day
        perfLoggingDatabase
            .ref(
                "examples-click-count/31201-lego-website-link/per-day/" +
                    loggingTimestamp
            )
            .transaction(incrementTransaction);
    });

document
    .getElementById("download-instructions-button")
    .addEventListener("click", async () => {
        await generateInstructions();
    });

document
    .getElementById("export-to-bricklink-button")
    .addEventListener("click", () => {
        disableInteraction();
        navigator.clipboard
            .writeText(
                getWantedListXML(
                    getUsedPixelsStudMap(
                        getPixelArrayFromCanvas(bricklinkCacheCanvas)
                    ),
                    selectedPixelPartNumber
                )
            )
            .then(
                function() {
                    enableInteraction();
                },
                function(err) {
                    console.error("Async: Could not copy text: ", err);
                }
            );
    });

function triggerDepthMapGeneration() {
    disableInteraction();
    const worker = new Worker("js/depth-map-web-worker.js");

    const loadingMessageComponent = document.getElementById(
        "web-worker-loading-message"
    );
    loadingMessageComponent.hidden = false;

    webWorkerInputCanvas.width = CNN_INPUT_IMAGE_WIDTH;
    webWorkerInputCanvas.height = CNN_INPUT_IMAGE_HEIGHT;
    webWorkerInputCanvasContext.drawImage(
        inputImage,
        0,
        0,
        inputImage.width,
        inputImage.height,
        0,
        0,
        CNN_INPUT_IMAGE_WIDTH,
        CNN_INPUT_IMAGE_HEIGHT
    );
    setTimeout(() => {
        const inputPixelArray = getPixelArrayFromCanvas(webWorkerInputCanvas);
        worker.postMessage({inputPixelArray});

        worker.addEventListener("message", e => {
            const {result, loadingMessage} = e.data;
            if (result != null) {
                webWorkerOutputCanvas.width = CNN_INPUT_IMAGE_WIDTH;
                webWorkerOutputCanvas.height = CNN_INPUT_IMAGE_HEIGHT;
                drawPixelsOnCanvas(result, webWorkerOutputCanvas);
                setTimeout(() => {
                    inputDepthCanvas.width = CNN_INPUT_IMAGE_WIDTH;
                    inputDepthCanvas.height = CNN_INPUT_IMAGE_HEIGHT;
                    inputDepthCanvasContext.drawImage(
                        webWorkerOutputCanvas,
                        0,
                        0,
                        CNN_INPUT_IMAGE_WIDTH,
                        CNN_INPUT_IMAGE_HEIGHT,
                        0,
                        0,
                        CNN_INPUT_IMAGE_WIDTH,
                        CNN_INPUT_IMAGE_HEIGHT
                    );
                    setTimeout(() => {
                        loadingMessageComponent.hidden = true;
                        enableInteraction();
                        overrideDepthPixelArray = new Array(
                            targetResolution[0] * targetResolution[1] * 4
                        ).fill(null);
                        runStep1();
                    }, 50); // TODO: find better way to check that input is finished
                }, 50); // TODO: find better way to check that input is finished
            } else if (loadingMessage != null) {
                loadingMessageComponent.innerHTML = loadingMessage;
            } else {
                console.log("Message from web worker: ", e.data);
            }
        });
    }, 50); // TODO: find better way to check that input is finished
}

document
    .getElementById("generate-depth-image")
    .addEventListener("click", triggerDepthMapGeneration);

function handleInputImage(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        inputImage = new Image();
        inputImage.onload = function() {
            inputCanvas.width = inputImage.width;
            inputCanvas.height = inputImage.height;
            inputCanvasContext.drawImage(inputImage, 0, 0);
            inputDepthCanvas.width = inputImage.width;
            inputDepthCanvas.height = inputImage.height;
            inputDepthCanvasContext.fillStyle = "black";
            inputDepthCanvasContext.fillRect(
                0,
                0,
                inputDepthCanvas.width,
                inputDepthCanvas.height
            );
        };
        inputImage.src = event.target.result;
        document.getElementById("steps-row").hidden = false;
        document.getElementById("input-image-selector").innerHTML =
            "Reselect Input Image";
        setTimeout(() => {
            runStep1();
        }, 50); // TODO: find better way to check that input is finished

        perfLoggingDatabase
            .ref("input-image-count/total")
            .transaction(incrementTransaction);
        const loggingTimestamp = Math.floor(
            (Date.now() - (Date.now() % 8.64e7)) / 1000
        ); // 8.64e+7 = ms in day
        perfLoggingDatabase
            .ref("input-image-count/per-day/" + loggingTimestamp)
            .transaction(incrementTransaction);
    };
    reader.readAsDataURL(e.target.files[0]);
}

function handleInputDepthMapImage(e) {
    const reader = new FileReader();
    overrideDepthPixelArray = new Array(
        targetResolution[0] * targetResolution[1] * 4
    ).fill(null);
    reader.onload = function(event) {
        inputImage = new Image();
        inputImage.onload = function() {
            inputDepthCanvas.width = inputImage.width;
            inputDepthCanvas.height = inputImage.height;
            inputDepthCanvasContext.drawImage(inputImage, 0, 0);
        };
        inputImage.src = event.target.result;
        setTimeout(() => {
            runStep1();
        }, 50); // TODO: find better way to check that input is finished

        // TODO: log for perf estimation?
    };
    reader.readAsDataURL(e.target.files[0]);
}

const imageSelectorHidden = document.getElementById(
    "input-image-selector-hidden"
);
imageSelectorHidden.addEventListener("change", handleInputImage, false);
document
    .getElementById("input-image-selector")
    .addEventListener("click", () => {
        imageSelectorHidden.click();
    });

const depthImageSelectorHidden = document.getElementById(
    "input-depth-image-selector-hidden"
);
depthImageSelectorHidden.addEventListener(
    "change",
    handleInputDepthMapImage,
    false
);
document
    .getElementById("input-depth-image-selector")
    .addEventListener("click", () => {
        depthImageSelectorHidden.click();
    });
