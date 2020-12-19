const VERSION_NUMBER = "v2020.12.14";
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
    "clear-overrides-button"
].map(id => document.getElementById(id));

const customStudTableBody = document.getElementById("custom-stud-table-body");

function disableInteraction() {
    customStudTableBody.hidden = true;
    interactionSelectors.forEach(button => {
        button.disabled = true;
    });
}

function enableInteraction() {
    customStudTableBody.hidden = false;
    interactionSelectors.forEach(button => {
        button.disabled = false;
    });
}

let inputImage = null;

const inputCanvas = document.getElementById("input-canvas");
const inputCanvasContext = inputCanvas.getContext("2d");

const step1Canvas = document.getElementById("step-1-canvas");
const step1CanvasContext = step1Canvas.getContext("2d");
const step1CanvasUpscaled = document.getElementById("step-1-canvas-upscaled");
const step1CanvasUpscaledContext = step1CanvasUpscaled.getContext("2d");
step1CanvasContext.imageSmoothingQuality = "high";

const step2Canvas = document.getElementById("step-2-canvas");
const step2CanvasContext = step2Canvas.getContext("2d");
const step2CanvasUpscaled = document.getElementById("step-2-canvas-upscaled");
const step2CanvasUpscaledContext = step2CanvasUpscaled.getContext("2d");

const step3Canvas = document.getElementById("step-3-canvas");
const step3CanvasContext = step3Canvas.getContext("2d");
const step3CanvasUpscaled = document.getElementById("step-3-canvas-upscaled");
const step3CanvasUpscaledContext = step3CanvasUpscaled.getContext("2d");

const step4Canvas = document.getElementById("step-4-canvas");
const step4CanvasContext = step4Canvas.getContext("2d");
const step4CanvasUpscaled = document.getElementById("step-4-canvas-upscaled");
const step4CanvasUpscaledContext = step4CanvasUpscaled.getContext("2d");

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
document.getElementById("width-slider").addEventListener(
    "change",
    () => {
        document.getElementById(
            "width-text"
        ).innerHTML = document.getElementById("width-slider").value;
        targetResolution[0] = document.getElementById("width-slider").value;
        overridePixelArray = new Array(
            targetResolution[0] * targetResolution[1] * 4
        ).fill(null);
        runStep1();
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
        overridePixelArray = new Array(
            targetResolution[0] * targetResolution[1] * 4
        ).fill(null);
        runStep1();
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
    {name: "None", value: "none"},
    {name: "Random", value: "random"},
    {name: "Mod 2", value: "mod2"},
    {name: "Mod 3", value: "mod3"},
    {name: "Mod 4", value: "mod4"},
    {name: "Noisy Mod 2", value: "noisymod2"},
    {name: "Noisy Mod 3", value: "noisymod3"},
    {name: "Noisy Mod 4", value: "noisymod4"},
    {name: "Cascading Mod", value: "cascadingmod"}
];
TIEBREAK_TECHNIQUES.forEach(technique => {
    const option = document.createElement("a");
    option.className = "dropdown-item btn";
    option.textContent = technique.name;
    option.value = technique.value;
    option.addEventListener("click", () => {
        document.getElementById("color-ties-resolution-button").innerHTML =
            "Color Tie Resolution: " + technique.name;
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
    const DEFAULT_COLOR = "#a6ca55";
    const DEFAULT_COLOR_NAME = "Lime";

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
    setTimeout(() => {
        runStep4();
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
    }, 1); // TODO: find better way to check that input is finished
}

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

step3CanvasUpscaled.addEventListener(
    "click",
    function(event) {
        const rawRow =
            event.clientY - step3CanvasUpscaled.getBoundingClientRect().y; //- step3CanvasUpscaled.offsetTop;
        const rawCol =
            event.clientX - step3CanvasUpscaled.getBoundingClientRect().x; // - step3CanvasUpscaled.offsetLeft;
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

function runStep4(callback) {
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
        setTimeout(() => {
            enableInteraction();
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
            if (callback) {
                callback();
            }
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

function generateInstructions() {
    const instructionsCanvasContainer = document.getElementById(
        "instructions-canvas-container"
    );
    instructionsCanvasContainer.innerHTML = "";
    disableInteraction();
    runStep4(() => {
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
            titlePageCanvas
            // selectedFullSetName
        );

        const imgData = titlePageCanvas.toDataURL("image/png", 1.0);

        const pdf = new jsPDF({
            orientation:
                titlePageCanvas.width < titlePageCanvas.height ? "p" : "l",
            unit: "mm",
            format: [titlePageCanvas.width, titlePageCanvas.height]
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(
            imgData,
            "PNG",
            0,
            0,
            pdfWidth,
            (pdfWidth * titlePageCanvas.height) / titlePageCanvas.width
        );

        const totalPlates =
            resultImage.length / (4 * PLATE_WIDTH * PLATE_WIDTH);
        for (var i = 0; i < totalPlates; i++) {
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
                i + 1
            );

            const imgData = instructionPageCanvas.toDataURL(
                `image${i + 1}/jpeg`,
                i
            );

            pdf.addPage();
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
        pdf.save("Lego-Art-Remix-Instructions.pdf");
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
    .addEventListener("click", () => {
        generateInstructions();
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

function handleInputImage(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        inputImage = new Image();
        inputImage.onload = function() {
            inputCanvas.width = inputImage.width;
            inputCanvas.height = inputImage.height;
            inputCanvasContext.drawImage(inputImage, 0, 0);
        };
        inputImage.src = event.target.result;
        document.getElementById("steps-row").hidden = false;
        document.getElementById("input-image-selector").innerHTML =
            "Reselect Input Image";
        setTimeout(() => {
            runStep1();
        }, 200); // TODO: find better way to check that input is finished

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

const imageSelectorHidden = document.getElementById(
    "input-image-selector-hidden"
);
imageSelectorHidden.addEventListener("change", handleInputImage, false);
document
    .getElementById("input-image-selector")
    .addEventListener("click", () => {
        imageSelectorHidden.click();
    });
