const VERSION_NUMBER = "v2020.8.13";
document.getElementById("version-number").innerHTML = VERSION_NUMBER;

const interactionSelectors = [
    "input-image-selector",
    "stud-map-button",
    "width-slider",
    "height-slider",
    "hue-slider",
    "saturation-slider",
    "value-slider",
    "reset-colors-button",
    "use-bleedthrough-check",
    "download-instructions-button",
    "add-custom-stud-button"
].map(id => document.getElementById(id));

function disableInteraction() {
    interactionSelectors.forEach(button => {
        button.disabled = true;
    });
}

function enableInteraction() {
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

document.getElementById("width-slider").addEventListener(
    "change",
    () => {
        document.getElementById(
            "width-text"
        ).innerHTML = document.getElementById("width-slider").value;
        targetResolution[0] = document.getElementById("width-slider").value;
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
        runStep1();
    },
    false
);

const DEFAULT_STUD_MAP = "warhol_marilyn_monroe";
let selectedStudMap = STUD_MAPS[DEFAULT_STUD_MAP].studMap;
let selectedFullSetName = STUD_MAPS[DEFAULT_STUD_MAP].officialName;
let selectedSortedStuds = STUD_MAPS[DEFAULT_STUD_MAP].sortedStuds;
document.getElementById("stud-map-button").innerHTML =
    "Input Set: " + STUD_MAPS[DEFAULT_STUD_MAP].name;

const customStudTableBody = document.getElementById("custom-stud-table-body");

function populateCustomStudSelectors(studMap) {
    customStudTableBody.innerHTML = "";
    studMap.sortedStuds.forEach(stud => {
        const studRow = getNewCustomStudRow();
        studRow.children[0].children[0].value = stud;
        studRow.children[1].children[0].value = studMap.studMap[stud];
        customStudTableBody.appendChild(studRow);
    });
    runCustomStudMap();
}

populateCustomStudSelectors(STUD_MAPS[DEFAULT_STUD_MAP]);

const studMapOptions = document.getElementById("stud-map-options");
studMapOptions.innerHTML = "";
Object.keys(STUD_MAPS).forEach(studMap => {
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

function runCustomStudMap() {
    const customStudMap = {};
    const customSortedStuds = [];
    Array.from(customStudTableBody.children).forEach(stud => {
        const studHex = stud.children[0].children[0].value;
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
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = "#ff0000";
    colorInput.addEventListener("change", () => {
        document.getElementById("stud-map-button").innerHTML = "Custom set";
        runCustomStudMap();
    });
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
            : selectedStudMap
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
                      getDarkenedStudsToStuds(Object.keys(selectedStudMap))
                  )
                : alignedPixelArray,
            targetResolution[0],
            SCALING_FACTOR,
            step3CanvasUpscaled
        );
    }, 1); // TODO: find better way to check that input is finished
}

function runStep4(callback) {
    const step2PixelArray = getPixelArrayFromCanvas(step2Canvas);
    const step3PixelArray = getPixelArrayFromCanvas(step3Canvas);
    step4Canvas.width = 0;
    try {
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
            step2PixelArray
        );

        drawPixelsOnCanvas(availabilityCorrectedPixelArray, step4Canvas);
        setTimeout(() => {
            enableInteraction();
            step4CanvasUpscaledContext.imageSmoothingEnabled = false;
            drawStudImageOnCanvas(
                document.getElementById("use-bleedthrough-check").checked
                    ? revertDarkenedImage(
                          availabilityCorrectedPixelArray,
                          getDarkenedStudsToStuds(Object.keys(selectedStudMap))
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
                  getDarkenedStudsToStuds(Object.keys(selectedStudMap))
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
    });
}

document
    .getElementById("download-instructions-button")
    .addEventListener("click", () => {
        generateInstructions();
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
        document.getElementById("input-image-text").innerHTML =
            "Reselect Input Image";
        setTimeout(() => {
            runStep1();
        }, 20); // TODO: find better way to check that input is finished
    };
    reader.readAsDataURL(e.target.files[0]);
}

const imageSelector = document.getElementById("input-image-selector");
imageSelector.addEventListener("change", handleInputImage, false);
