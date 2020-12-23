function hexToRgb(hex) {
    const hexInt = parseInt(hex.replace("#", ""), 16);
    const r = (hexInt >> 16) & 255;
    const g = (hexInt >> 8) & 255;
    const b = hexInt & 255;

    return [r, g, b];
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function inverseHex(hex) {
    return (
        "#" +
        hex
            .match(/[a-f0-9]{2}/gi)
            .map(e =>
                ((255 - parseInt(e, 16)) | 0)
                    .toString(16)
                    .replace(/^([a-f0-9])$/, "0$1")
            )
            .join("")
    );
}

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function getPixelArrayFromCanvas(canvas) {
    const context = canvas.getContext("2d");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels;
}

function drawPixelsOnCanvas(pixels, canvas) {
    const context = canvas.getContext("2d");

    const imageData = context.createImageData(canvas.width, canvas.height);
    Object.keys(pixels).forEach(pixel => {
        imageData.data[pixel] = pixels[pixel];
    });
    context.putImageData(imageData, 0, 0);
}

function studMapToSortedColorList(studMap) {
    const result = Object.keys(studMap);
    result.sort();
    return result;
}

function RGBPixelDistanceSquared(pixel1, pixel2) {
    let sum = 0;
    for (let i = 0; i < 3; i++) {
        sum += Math.abs(pixel1[i] - pixel2[i]);
    }
    return sum;
}

function getDiscreteDepthPixels(pixels, thresholds) {
    const result = [];
    for (let i = 0; i < pixels.length; i++) {
        if (i % 4 === 3) {
            result.push(255); // doesn't really matter
        } else {
            let pixelLevel = 0;
            for (let j = 0; j < thresholds.length; j++) {
                if (pixels[i] > thresholds[j]) {
                    pixelLevel = j + 1;
                }
            }
            result.push(pixelLevel);
        }
    }

    // make grayscale
    for (let i = 0; i < result.length; i += 4) {
        let val = 0;
        for (let j = 0; j < 3; j++) {
            val += result[i + j];
        }
        val = Math.floor(val / 3);
        for (let j = 0; j < 3; j++) {
            result[i + j] = val;
        }
    }

    return result;
}

function scaleUpDiscreteDepthPixelsForDisplay(pixels, numLevels) {
    const result = [];
    for (let i = 0; i < pixels.length; i++) {
        if (i % 4 === 3) {
            result.push(255);
        } else {
            result.push(
                Math.round(Math.min((255 * (pixels[i] + 1)) / numLevels, 255))
            );
        }
    }
    return result;
}

// aligns each pixel in the input array to the closes pixel in the studMap, and adds in overrides
// returns the resulting pixels
function alignPixelsToStudMap(inputPixels, studMap, overridePixels) {
    const alignedPixels = [...inputPixels]; // initialize this way just so we keep 4th pixel values
    // note that 4th pixel values are ignored anyway because it's too much effort to use them
    const anchorPixels = studMapToSortedColorList(studMap).map(pixel =>
        hexToRgb(pixel)
    );
    for (let i = 0; i < inputPixels.length / 4; i++) {
        const targetPixelIndex = i * 4;
        const pixelToAlign = [];
        for (let j = 0; j < 3; j++) {
            pixelToAlign.push(inputPixels[targetPixelIndex + j]);
        }
        let closestAnchorPixel = 0;
        for (
            let anchorPixelIndex = 1;
            anchorPixelIndex < anchorPixels.length;
            anchorPixelIndex++
        ) {
            if (
                RGBPixelDistanceSquared(
                    pixelToAlign,
                    anchorPixels[anchorPixelIndex]
                ) <
                RGBPixelDistanceSquared(
                    pixelToAlign,
                    anchorPixels[closestAnchorPixel]
                )
            ) {
                closestAnchorPixel = anchorPixelIndex;
            }
        }
        for (let j = 0; j < 3; j++) {
            alignedPixels[targetPixelIndex + j] =
                anchorPixels[closestAnchorPixel][j];
        }
    }
    for (let i = 0; i < alignedPixels.length; i++) {
        if (overridePixels[i] != null) {
            alignedPixels[i] = overridePixels[i];
        }
    }
    return alignedPixels;
}

function getArrayWithOverridesApplied(inputPixels, overridePixels) {
    const resultPixels = [];
    for (let i = 0; i < inputPixels.length; i++) {
        if (overridePixels[i] != null) {
            resultPixels.push(overridePixels[i]);
        } else {
            resultPixels.push(inputPixels[i]);
        }
    }
    return resultPixels;
}

function getUsedPixelsStudMap(inputPixels) {
    let result = {};
    for (let i = 0; i < inputPixels.length / 4; i++) {
        const targetPixelIndex = i * 4;
        const pixelHexVal = rgbToHex(
            inputPixels[targetPixelIndex],
            inputPixels[targetPixelIndex + 1],
            inputPixels[targetPixelIndex + 2]
        );
        result[pixelHexVal] = (result[pixelHexVal] || 0) + 1;
    }
    return result;
}

function studMapDifference(map1, map2) {
    const hexCodes = Array.from(
        new Set(
            studMapToSortedColorList(map1).concat(
                studMapToSortedColorList(map2)
            )
        )
    );
    hexCodes.sort();
    const result = {};
    hexCodes.forEach(hexCode => {
        result[hexCode] = (map1[hexCode] || 0) - (map2[hexCode] || 0);
    });
    return result;
}

const TIEBREAKER_RATIO = 0.001;
// corrects the input pixels to account for which studs are actually available
function correctPixelsForAvailableStuds(
    anchorAlignedPixels,
    availableStudMap,
    originalPixels,
    overridePixelArray,
    tieResolutionMethod,
    imageWidth
) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap)); // clone
    const usedPixelStudMap = getUsedPixelsStudMap(anchorAlignedPixels);
    const remainingStudMap = studMapDifference(
        availableStudMap,
        usedPixelStudMap
    );

    // Maps each hex code to an array of objects representing which extra pixels to replace
    // because we don't have enough studs
    const problematicPixelsMap = {};
    // first, create and populate arrays with all studs for each color
    studMapToSortedColorList(availableStudMap).forEach(color => {
        problematicPixelsMap[color] = [];
    });
    studMapToSortedColorList(usedPixelStudMap).forEach(color => {
        problematicPixelsMap[color] = [];
    });

    for (let i = 0; i < anchorAlignedPixels.length; i += 4) {
        const alignedHex = rgbToHex(
            anchorAlignedPixels[i],
            anchorAlignedPixels[i + 1],
            anchorAlignedPixels[i + 2]
        );
        const wasOverridden =
            overridePixelArray[i] != null &&
            overridePixelArray[i + 1] != null &&
            overridePixelArray[i + 2] != null;
        const originalRGB = wasOverridden
            ? [
                  overridePixelArray[i],
                  overridePixelArray[i + 1],
                  overridePixelArray[i + 2]
              ]
            : [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]];
        const alignedRGB = [
            anchorAlignedPixels[i],
            anchorAlignedPixels[i + 1],
            anchorAlignedPixels[i + 2]
        ];
        const adjustedIndex = i / 4;
        const row = Math.floor(adjustedIndex / imageWidth);
        const col = adjustedIndex % imageWidth;
        let tiebreakFactor = TIEBREAKER_RATIO; // 'none'
        if (tieResolutionMethod === "random") {
            tiebreakFactor *= Math.random();
        } else if (tieResolutionMethod === "mod2") {
            tiebreakFactor *= (row + col) % 2;
        } else if (tieResolutionMethod === "mod3") {
            tiebreakFactor *= (row + col) % 3;
        } else if (tieResolutionMethod === "mod4") {
            tiebreakFactor *= (row + col) % 4;
        } else if (tieResolutionMethod === "mod5") {
            tiebreakFactor *= (row + col) % 5;
        } else if (tieResolutionMethod === "noisymod2") {
            tiebreakFactor *=
                ((row + col) % 2) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod3") {
            tiebreakFactor *=
                ((row + col) % 3) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod4") {
            tiebreakFactor *=
                ((row + col) % 4) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod5") {
            tiebreakFactor *=
                ((row + col) % 5) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "cascadingmod") {
            tiebreakFactor *=
                ((row + col) % 2) +
                ((row + col) % 3) * TIEBREAKER_RATIO +
                ((row + col) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                ((row + col) % 5) *
                    TIEBREAKER_RATIO *
                    TIEBREAKER_RATIO *
                    TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "cascadingnoisymod") {
            tiebreakFactor *=
                ((row + col) % 2) +
                ((row + col) % 3) * TIEBREAKER_RATIO +
                ((row + col) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                Math.random() *
                    TIEBREAKER_RATIO *
                    TIEBREAKER_RATIO *
                    TIEBREAKER_RATIO;
        }
        problematicPixelsMap[alignedHex].push({
            index: i,
            originalRGB,
            alignedRGB,
            alignmentDistSquared:
                RGBPixelDistanceSquared(originalRGB, alignedRGB) +
                tiebreakFactor
        });
    }

    // now sort each array by descending alignmentDistSquared
    Object.keys(problematicPixelsMap).forEach(anchorPixel => {
        problematicPixelsMap[anchorPixel].sort(
            (p1, p2) => p2.alignmentDistSquared - p1.alignmentDistSquared
        );
    });

    // now truncate each of these arrays so that for each color, the number of pixels
    // left is equal to the number of extra studs we would need to fill in that color
    Object.keys(problematicPixelsMap).forEach(anchorPixel => {
        let availableStuds = availableStudMap[anchorPixel] || 0;
        const pixelArray = problematicPixelsMap[anchorPixel];
        while (pixelArray.length > 0 && availableStuds > 0) {
            pixelArray.pop();
            availableStuds--;
        }
        problematicPixelsMap[anchorPixel] = pixelArray; // sanity check - not really required due to mutability
    });

    // now, get a list of all problematic pixels
    const problematicPixels = [].concat.apply(
        [],
        Object.values(problematicPixelsMap)
    );
    // sort from worst to best;
    problematicPixels.sort(
        (p1, p2) => p2.alignmentDistSquared - p1.alignmentDistSquared
    );

    const correctedPixels = [...anchorAlignedPixels];
    // clear remainingStudMap of any studs mapping to non positive values - we can't use these
    Object.keys(remainingStudMap).forEach(stud => {
        if (remainingStudMap[stud] <= 0) {
            delete remainingStudMap[stud];
        }
    });

    // starting from the worst, replace each problematic pixel, and update remainingStudMap
    for (let i = 0; i < problematicPixels.length; i++) {
        const problematicPixel = problematicPixels[i];
        const possibleReplacements = Object.keys(remainingStudMap);
        let replacement = possibleReplacements[0];
        possibleReplacements.forEach(possibleReplacement => {
            if (
                (RGBPixelDistanceSquared(
                    problematicPixel.originalRGB,
                    hexToRgb(possibleReplacement)
                ) < problematicPixel.originalRGB,
                hexToRgb(replacement))
            ) {
                replacement = possibleReplacement;
            }
        });

        // replace the pixel in correctedPixels with our replacement
        const pixelIndex = problematicPixel.index;
        const replacementRGB = hexToRgb(replacement);
        for (let j = 0; j < 3; j++) {
            correctedPixels[pixelIndex + j] = replacementRGB[j];
        }

        // update remainingStudMap
        remainingStudMap[replacement]--;
        if (remainingStudMap[replacement] <= 0) {
            // clear this out if we ran out of these studs
            delete remainingStudMap[replacement];
        }
    }

    return correctedPixels;
}

// input: r,g,b in [0,1], out: h in [0,360) and s,v in [0,1]
function rgb2hsv(r, g, b) {
    let v = Math.max(r, g, b),
        n = v - Math.min(r, g, b);
    let h =
        n &&
        (v == r ? (g - b) / n : v == g ? 2 + (b - r) / n : 4 + (r - g) / n);
    return [60 * (h < 0 ? h + 6 : h), v && n / v, v];
}

// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,1]
function hsv2rgb(h, s, v) {
    let f = (n, k = (n + h / 60) % 6) =>
        v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [f(5), f(3), f(1)];
}

// input: h (offset) in [0,360] and s,v (offset) in [-1,1] - output: adjusted r,g,b
function adjustHSV(rgbPixel, h, s, v) {
    const scaledRGB = rgbPixel.map(pixel => pixel / 255);
    const baseHSV = rgb2hsv(scaledRGB[0], scaledRGB[1], scaledRGB[2]);
    const resultHue = (baseHSV[0] + Math.round(h)) % 360;
    const resultSaturation = Math.min(Math.max(baseHSV[1] + s, 0), 1);
    const resultValue = Math.min(Math.max(baseHSV[2] + v, 0), 1);
    const resultRGB = hsv2rgb(resultHue, resultSaturation, resultValue);
    return resultRGB.map(pixel => Math.round(pixel * 255));
}

function applyPixelFilter(inputPixels, rgbFilter) {
    const outputPixels = [...inputPixels];
    for (let i = 0; i < inputPixels.length; i += 4) {
        const filteredPixel = rgbFilter([
            inputPixels[i],
            inputPixels[i + 1],
            inputPixels[i + 2]
        ]);
        for (let j = 0; j < 3; j++) {
            outputPixels[i + j] = filteredPixel[j];
        }
    }
    return outputPixels;
}

function applyHSVAdjustment(inputPixels, h, s, v) {
    return applyPixelFilter(inputPixels, pixel => adjustHSV(pixel, h, s, v));
}

function getDarkenedPixel(rgbPixel) {
    return rgbPixel.map(color => Math.round((color * Math.PI) / 4));
}

function getDarkenedStudsToStuds(studList) {
    const result = {};
    studList.forEach(stud => {
        const darkenedRGB = getDarkenedPixel(hexToRgb(stud));
        result[rgbToHex(darkenedRGB[0], darkenedRGB[1], darkenedRGB[2])] = stud;
    });
    return result;
}

// Gets stud map adjusted for bleedthrough of the black back panel
function getDarkenedStudMap(studMap) {
    const result = {};
    Object.keys(studMap).forEach(stud => {
        const darkenedRGB = getDarkenedPixel(hexToRgb(stud));
        result[rgbToHex(darkenedRGB[0], darkenedRGB[1], darkenedRGB[2])] =
            studMap[stud];
    });
    return result;
}

function getDarkenedImage(pixels) {
    const outputPixels = [...pixels];
    for (let i = 0; i < pixels.length; i += 4) {
        if (
            pixels[i] != null &&
            pixels[i + 1] != null &&
            pixels[i + 2] != null
        ) {
            const darkenedPixel = getDarkenedPixel([
                pixels[i],
                pixels[i + 1],
                pixels[i + 2]
            ]);
            for (let j = 0; j < 3; j++) {
                outputPixels[i + j] = darkenedPixel[j];
            }
        }
    }
    return outputPixels;
}

function revertDarkenedImage(pixels, darkenedStudsToStuds) {
    const outputPixels = [...pixels];
    for (let i = 0; i < pixels.length; i += 4) {
        const pixelHex = rgbToHex(pixels[i], pixels[i + 1], pixels[i + 2]);
        const revertedPixelHex = darkenedStudsToStuds[pixelHex];
        const revertedPixelRGB = hexToRgb(revertedPixelHex);
        for (let j = 0; j < 3; j++) {
            outputPixels[i + j] = revertedPixelRGB[j];
        }
    }
    return outputPixels;
}

// replaces square pixels with studs and upscales
function drawStudImageOnCanvas(pixels, width, scalingFactor, canvas) {
    const ctx = canvas.getContext("2d");

    canvas.width = width * scalingFactor;
    canvas.height = ((pixels.length / 4) * scalingFactor) / width;
    ctx.fillRect(
        0,
        0,
        width * scalingFactor,
        ((pixels.length / 4) * scalingFactor) / width
    );

    const radius = scalingFactor / 2;
    for (let i = 0; i < pixels.length / 4; i++) {
        const pixelHex = rgbToHex(
            pixels[i * 4],
            pixels[i * 4 + 1],
            pixels[i * 4 + 2]
        );
        ctx.beginPath();
        ctx.arc(
            ((i % width) * 2 + 1) * radius,
            (Math.floor(i / width) * 2 + 1) * radius,
            radius,
            0,
            2 * Math.PI
        );
        ctx.fillStyle = pixelHex;
        ctx.fill();
        ctx.strokeStyle = "#111111";
        ctx.stroke();
    }
}

function getSubPixelArray(pixelArray, index, width, plateWidth) {
    const result = [];
    const horizontalOffset = (index * plateWidth) % width;
    const verticalOffset =
        plateWidth * Math.floor((index * plateWidth) / width);

    for (var i = 0; i < pixelArray.length / 4; i++) {
        const iHorizontal = i % width;
        const iVertical = Math.floor(i / width);

        if (
            horizontalOffset <= iHorizontal &&
            iHorizontal < horizontalOffset + plateWidth &&
            verticalOffset <= iVertical &&
            iVertical < verticalOffset + plateWidth
        ) {
            for (let p = 0; p < 4; p++) {
                result.push(pixelArray[4 * i + p]);
            }
        }
    }

    return result;
}

function drawStudCountForContext(
    studMap,
    availableStudHexList,
    scalingFactor,
    ctx,
    horizontalOffset,
    verticalOffset,
    showColorName
) {
    const radius = scalingFactor / 2;
    ctx.font = `${scalingFactor / 2}px Arial`;
    availableStudHexList.forEach((pixelHex, i) => {
        const number = i + 1;
        ctx.beginPath();
        const x = horizontalOffset;
        const y = verticalOffset + radius * 2.5 * number;
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = pixelHex;
        ctx.fill();
        ctx.strokeStyle = inverseHex(pixelHex);
        ctx.stroke();
        ctx.fillStyle = inverseHex(pixelHex);
        ctx.fillText(
            number,
            x - (scalingFactor * (1 + Math.floor(number / 2) / 6)) / 8,
            y + scalingFactor / 8
        );
        ctx.fillStyle = "#000000";
        ctx.fillText(
            `X ${studMap[pixelHex] || 0}`,
            x + radius * 1.5,
            y + scalingFactor / 8
        );
        ctx.font = `${scalingFactor / 4}px Arial`;
        if (showColorName) {
            ctx.fillText(
                HEX_TO_COLOR_NAME[pixelHex] || pixelHex,
                x + radius * 1.5,
                y + scalingFactor / 2.5
            );
        }
        ctx.font = `${scalingFactor / 2}px Arial`;
    });

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.rect(
        horizontalOffset - radius * 2,
        verticalOffset + radius * 0.75,
        radius * 8,
        radius * 2.5 * (availableStudHexList.length + 0.5)
    );
    ctx.stroke();
}

function generateInstructionTitlePage(
    pixelArray,
    width,
    plateWidth,
    availableStudHexList,
    scalingFactor,
    finalImageCanvas,
    canvas,
    showColorName
) {
    const ctx = canvas.getContext("2d");

    pictureWidth = plateWidth * scalingFactor;
    pictureHeight = plateWidth * scalingFactor;

    const radius = scalingFactor / 2;

    canvas.height = Math.max(
        pictureHeight * 1.5,
        pictureHeight * 0.4 + availableStudHexList.length * radius * 2.5
    );
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStudCountForContext(
        getUsedPixelsStudMap(pixelArray),
        availableStudHexList,
        scalingFactor,
        ctx,
        pictureWidth * 0.25,
        pictureHeight * 0.2 - radius,
        showColorName
    );

    ctx.fillStyle = "#000000";
    ctx.font = `${scalingFactor * 2}px Arial`;
    ctx.fillText("Lego Art Remix", pictureWidth * 0.75, pictureHeight * 0.28);
    ctx.font = `${scalingFactor / 2}px Arial`;
    ctx.fillText(
        `Resolution: ${width} x ${pixelArray.length / (4 * width)}`,
        pictureWidth * 0.75,
        pictureHeight * 0.34
    );

    const legendHorizontalOffset = pictureWidth * 0.75;
    const legendVerticalOffset = pictureHeight * 0.41;
    const numPlates = pixelArray.length / (4 * plateWidth * plateWidth);
    const legendSquareSide = scalingFactor;

    ctx.drawImage(
        finalImageCanvas,
        0,
        0,
        finalImageCanvas.width,
        finalImageCanvas.height,
        legendHorizontalOffset +
            legendSquareSide / 4 +
            (legendSquareSide * width) / plateWidth,
        legendVerticalOffset,
        (legendSquareSide * width) / plateWidth,
        legendSquareSide * ((numPlates * plateWidth) / width)
    );

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = `${legendSquareSide / 2}px Arial`;

    for (var i = 0; i < numPlates; i++) {
        const horIndex = ((i * plateWidth) % width) / plateWidth;
        const vertIndex = Math.floor((i * plateWidth) / width);
        ctx.beginPath();
        ctx.rect(
            legendHorizontalOffset + horIndex * legendSquareSide,
            legendVerticalOffset + vertIndex * legendSquareSide,
            legendSquareSide,
            legendSquareSide
        );
        ctx.fillText(
            i + 1,
            legendHorizontalOffset + (horIndex + 0.18) * legendSquareSide,
            legendVerticalOffset + (vertIndex + 0.65) * legendSquareSide
        );
        ctx.stroke();
    }
}

function generateInstructionPage(
    pixelArray,
    plateWidth,
    availableStudHexList,
    scalingFactor,
    canvas,
    plateNumber,
    showColorName
) {
    const ctx = canvas.getContext("2d");

    pictureWidth = plateWidth * scalingFactor;
    pictureHeight = ((pixelArray.length / 4) * scalingFactor) / plateWidth;

    const radius = scalingFactor / 2;

    canvas.height = Math.max(
        pictureHeight * 1.5,
        pictureHeight * 0.4 + availableStudHexList.length * radius * 2.5
    );
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.rect(
        pictureWidth * 0.75,
        pictureHeight * 0.2,
        pictureWidth,
        pictureHeight
    );
    ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.fillRect(
        pictureWidth * 0.75,
        pictureHeight * 0.2,
        pictureWidth,
        pictureHeight
    );

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = `${scalingFactor}px Arial`;
    ctx.beginPath();
    ctx.fillText(
        `Section ${plateNumber}`,
        pictureWidth * 0.75,
        pictureHeight * 0.2 - scalingFactor
    );
    ctx.stroke();

    ctx.lineWidth = 1;

    const studToNumber = {};
    availableStudHexList.forEach((stud, i) => {
        studToNumber[stud] = i + 1;
    });

    ctx.font = `${scalingFactor / 2}px Arial`;

    for (let i = 0; i < plateWidth; i++) {
        for (let j = 0; j < plateWidth; j++) {
            const pixelIndex = i * plateWidth + j;
            const pixelHex = rgbToHex(
                pixelArray[pixelIndex * 4],
                pixelArray[pixelIndex * 4 + 1],
                pixelArray[pixelIndex * 4 + 2]
            );
            ctx.beginPath();
            const x = pictureWidth * 0.75 + (j * 2 + 1) * radius;
            const y = pictureHeight * 0.2 + ((i % plateWidth) * 2 + 1) * radius;
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = pixelHex;
            ctx.fill();
            ctx.strokeStyle = inverseHex(pixelHex);
            ctx.stroke();
            ctx.fillStyle = inverseHex(pixelHex);
            ctx.fillText(
                studToNumber[pixelHex],
                x -
                    (scalingFactor *
                        (1 + Math.floor(studToNumber[pixelHex] / 2) / 6)) /
                        8,
                y + scalingFactor / 8
            );
        }
    }

    drawStudCountForContext(
        getUsedPixelsStudMap(pixelArray),
        availableStudHexList,
        scalingFactor,
        ctx,
        pictureWidth * 0.25,
        pictureHeight * 0.2 - radius,
        showColorName
    );
}

function getWantedListXML(studMap, partID) {
    const items = Object.keys(studMap).map(
        stud =>
            `<ITEM>
      <ITEMTYPE>P</ITEMTYPE>
      <ITEMID>${partID}</ITEMID>
      <COLOR>${COLOR_NAME_TO_ID[HEX_TO_COLOR_NAME[stud]]}</COLOR>
      <MINQTY>${studMap[stud]}</MINQTY>
    </ITEM>`
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
  <INVENTORY>
    \n${items.join("\n")}\n
  </INVENTORY>`;
}
