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
            .map((e) => ((255 - parseInt(e, 16)) | 0).toString(16).replace(/^([a-f0-9])$/, "0$1"))
            .join("")
    );
}

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function clamp255(input) {
    return Math.round(Math.min(Math.max(input, 0), 255));
}

function getPixelArrayFromCanvas(canvas) {
    const context = canvas.getContext("2d");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels;
}

function drawPixelsOnCanvas(pixels, canvas) {
    const context = canvas.getContext("2d");

    const imageData = context.createImageData(canvas.width, canvas.height);
    Object.keys(pixels).forEach((pixel) => {
        imageData.data[pixel] = pixels[pixel];
    });
    context.putImageData(imageData, 0, 0);
}

function studMapToSortedColorList(studMap) {
    const result = Object.keys(studMap);
    result.sort();
    return result;
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
            result.push(Math.round(Math.min((255 * (pixels[i] + 1)) / numLevels, 255)));
        }
    }
    return result;
}

// aligns each pixel in the input array to the closes pixel in the studMap, and adds in overrides
// returns the resulting pixels
function alignPixelsToStudMap(inputPixels, studMap, colorDistanceFunction) {
    const alignedPixels = [...inputPixels]; // initialize this way just so we keep 4th pixel values
    // note that 4th pixel values are ignored anyway because it's too much effort to use them
    const anchorPixels = studMapToSortedColorList(studMap).map((pixel) => hexToRgb(pixel));
    for (let i = 0; i < inputPixels.length / 4; i++) {
        const targetPixelIndex = i * 4;
        const pixelToAlign = [];
        for (let j = 0; j < 3; j++) {
            pixelToAlign.push(inputPixels[targetPixelIndex + j]);
        }
        let closestAnchorPixel = 0;
        for (let anchorPixelIndex = 1; anchorPixelIndex < anchorPixels.length; anchorPixelIndex++) {
            if (
                colorDistanceFunction(pixelToAlign, anchorPixels[anchorPixelIndex]) <
                colorDistanceFunction(pixelToAlign, anchorPixels[closestAnchorPixel])
            ) {
                closestAnchorPixel = anchorPixelIndex;
            }
        }
        for (let j = 0; j < 3; j++) {
            alignedPixels[targetPixelIndex + j] = anchorPixels[closestAnchorPixel][j];
        }
    }
    return alignedPixels;
}

function getAverageQuantizationError(pixels1, pixels2, colorDistanceFunction) {
    let totalError = 0;
    for (let i = 0; i < pixels1.length / 4; i++) {
        const targetPixelIndex = i * 4;

        const pixel1 = [];
        const pixel2 = [];
        for (let j = 0; j < 3; j++) {
            pixel1.push(pixels1[targetPixelIndex + j]);
            pixel2.push(pixels2[targetPixelIndex + j]);
        }

        totalError += colorDistanceFunction(pixel1, pixel2);
    }
    return totalError / (pixels1.length / 4);
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
    const hexCodes = Array.from(new Set(studMapToSortedColorList(map1).concat(studMapToSortedColorList(map2))));
    hexCodes.sort();
    const result = {};
    hexCodes.forEach((hexCode) => {
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
    colorTieGroupingFactor,
    imageWidth,
    colorDistanceFunction
) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap)); // clone
    const usedPixelStudMap = getUsedPixelsStudMap(anchorAlignedPixels);
    const remainingStudMap = studMapDifference(availableStudMap, usedPixelStudMap);

    // Maps each hex code to an array of objects representing which extra pixels to replace
    // because we don't have enough studs
    const problematicPixelsMap = {};
    // first, create and populate arrays with all studs for each color
    studMapToSortedColorList(availableStudMap).forEach((color) => {
        problematicPixelsMap[color] = [];
    });
    studMapToSortedColorList(usedPixelStudMap).forEach((color) => {
        problematicPixelsMap[color] = [];
    });

    for (let i = 0; i < anchorAlignedPixels.length; i += 4) {
        const alignedHex = rgbToHex(anchorAlignedPixels[i], anchorAlignedPixels[i + 1], anchorAlignedPixels[i + 2]);
        const wasOverridden =
            overridePixelArray[i] != null && overridePixelArray[i + 1] != null && overridePixelArray[i + 2] != null;
        const originalRGB = wasOverridden
            ? [overridePixelArray[i], overridePixelArray[i + 1], overridePixelArray[i + 2]]
            : [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]];
        const alignedRGB = [anchorAlignedPixels[i], anchorAlignedPixels[i + 1], anchorAlignedPixels[i + 2]];
        const adjustedIndex = i / 4;
        const row = Math.floor(adjustedIndex / imageWidth);
        const col = adjustedIndex % imageWidth;
        const adjustedRow = Math.floor(row / colorTieGroupingFactor);
        const adjustedCol = Math.floor(col / colorTieGroupingFactor);
        const adjustedImageWidth = Math.floor(imageWidth / colorTieGroupingFactor);
        let tiebreakFactor = TIEBREAKER_RATIO; // 'none'
        if (tieResolutionMethod === "random") {
            tiebreakFactor *= Math.random();
        } else if (tieResolutionMethod === "mod2") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 2;
        } else if (tieResolutionMethod === "mod3") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 3;
        } else if (tieResolutionMethod === "mod4") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 4;
        } else if (tieResolutionMethod === "mod5") {
            tiebreakFactor *= (adjustedRow + adjustedCol) % 5;
        } else if (tieResolutionMethod === "noisymod2") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 2) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod3") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 3) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod4") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 4) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "noisymod5") {
            tiebreakFactor *= ((adjustedRow + adjustedCol) % 5) + Math.random() * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "cascadingmod") {
            tiebreakFactor *=
                ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 5) * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "cascadingnoisymod") {
            tiebreakFactor *=
                ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                Math.random() * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "alternatingmod") {
            tiebreakFactor *=
                ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedImageWidth - adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedImageWidth - adjustedCol) % 5) *
                    TIEBREAKER_RATIO *
                    TIEBREAKER_RATIO *
                    TIEBREAKER_RATIO;
        } else if (tieResolutionMethod === "alternatingnoisymod") {
            tiebreakFactor *=
                ((adjustedRow + adjustedCol) % 2) +
                ((adjustedRow + adjustedImageWidth - adjustedCol) % 3) * TIEBREAKER_RATIO +
                ((adjustedRow + adjustedCol) % 4) * TIEBREAKER_RATIO * TIEBREAKER_RATIO +
                Math.random() * TIEBREAKER_RATIO * TIEBREAKER_RATIO * TIEBREAKER_RATIO;
        }
        problematicPixelsMap[alignedHex].push({
            index: i,
            originalRGB,
            alignedRGB,
            alignmentDistSquared: colorDistanceFunction(originalRGB, alignedRGB) + tiebreakFactor,
        });
    }

    // now sort each array by descending alignmentDistSquared
    Object.keys(problematicPixelsMap).forEach((anchorPixel) => {
        problematicPixelsMap[anchorPixel].sort((p1, p2) => p2.alignmentDistSquared - p1.alignmentDistSquared);
    });

    // now truncate each of these arrays so that for each color, the number of pixels
    // left is equal to the number of extra studs we would need to fill in that color
    Object.keys(problematicPixelsMap).forEach((anchorPixel) => {
        let availableStuds = availableStudMap[anchorPixel] || 0;
        const pixelArray = problematicPixelsMap[anchorPixel];
        while (pixelArray.length > 0 && availableStuds > 0) {
            pixelArray.pop();
            availableStuds--;
        }
        problematicPixelsMap[anchorPixel] = pixelArray; // sanity check - not really required due to mutability
    });

    // now, get a list of all problematic pixels
    const problematicPixels = [].concat.apply([], Object.values(problematicPixelsMap));
    // sort from worst to best;
    problematicPixels.sort((p1, p2) => p2.alignmentDistSquared - p1.alignmentDistSquared);

    const correctedPixels = [...anchorAlignedPixels];
    // clear remainingStudMap of any studs mapping to non positive values - we can't use these
    Object.keys(remainingStudMap).forEach((stud) => {
        if (remainingStudMap[stud] <= 0) {
            delete remainingStudMap[stud];
        }
    });

    // starting from the worst, replace each problematic pixel, and update remainingStudMap
    for (let i = 0; i < problematicPixels.length; i++) {
        const problematicPixel = problematicPixels[i];
        const possibleReplacements = Object.keys(remainingStudMap);
        let replacement = possibleReplacements[0];
        possibleReplacements.forEach((possibleReplacement) => {
            if (
                colorDistanceFunction(problematicPixel.originalRGB, hexToRgb(possibleReplacement)) <
                colorDistanceFunction(problematicPixel.originalRGB, hexToRgb(replacement))
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

// Note 1: not normalized - we do that in code based on how many pixels are
// available for error propogation
// Note 2: Center is ignored
// Note 3: this one is only used in GDD rather than within traditional error
// dithering algorithms, so it is formatted differently
const GAUSSIAN_DITHERING_KERNEL = [
    [1, 4, 6, 4, 1],
    [4, 16, 26, 16, 4],
    [7, 26, 0, 26, 7],
    [4, 16, 26, 16, 4],
    [1, 4, 6, 4, 1],
];

const FLOYD_STEINBERG_DITHERING_KERNEL = [
    {
        row: 0,
        col: 1,
        val: 7,
    },
    {
        row: 1,
        col: -1,
        val: 3,
    },
    {
        row: 1,
        col: 0,
        val: 5,
    },
    {
        row: 1,
        col: 1,
        val: 1,
    },
];
const JARVIS_JUDICE_NINKE_DITHERING_KERNEL = [
    {
        row: 0,
        col: 1,
        val: 7,
    },
    {
        row: 0,
        col: 2,
        val: 5,
    },
    {
        row: 1,
        col: -2,
        val: 3,
    },
    {
        row: 1,
        col: -1,
        val: 5,
    },
    {
        row: 1,
        col: 0,
        val: 7,
    },
    {
        row: 1,
        col: 1,
        val: 5,
    },
    {
        row: 1,
        col: 2,
        val: 3,
    },
    {
        row: 2,
        col: -2,
        val: 1,
    },
    {
        row: 2,
        col: -1,
        val: 3,
    },
    {
        row: 2,
        col: 0,
        val: 5,
    },
    {
        row: 2,
        col: 1,
        val: 3,
    },
    {
        row: 2,
        col: 2,
        val: 1,
    },
];
const ATKINSON_DITHERING_KERNEL = [
    {
        row: 0,
        col: 1,
        val: 1,
    },
    {
        row: 0,
        col: 2,
        val: 1,
    },
    {
        row: 1,
        col: -1,
        val: 1,
    },
    {
        row: 1,
        col: 0,
        val: 1,
    },
    {
        row: 1,
        col: 1,
        val: 1,
    },
    {
        row: 2,
        col: 0,
        val: 1,
    },
].map((entry) => {
    entry.val = (entry.val * 3) / 4;
    return entry;
});
const SIERRA_DITHERING_KERNEL = [
    {
        row: 0,
        col: 1,
        val: 5,
    },
    {
        row: 0,
        col: 2,
        val: 3,
    },
    {
        row: 1,
        col: -2,
        val: 2,
    },
    {
        row: 1,
        col: -1,
        val: 4,
    },
    {
        row: 1,
        col: 0,
        val: 5,
    },
    {
        row: 1,
        col: 1,
        val: 4,
    },
    {
        row: 1,
        col: 2,
        val: 2,
    },
    {
        row: 2,
        col: -1,
        val: 2,
    },
    {
        row: 2,
        col: 0,
        val: 3,
    },
    {
        row: 2,
        col: 1,
        val: 2,
    },
];

function findReplacement(pixelRGB, remainingStudMap, colorDistanceFunction) {
    const possibleReplacements = Object.keys(remainingStudMap);
    let replacement = possibleReplacements[0];
    possibleReplacements.forEach((possibleReplacement) => {
        if (
            remainingStudMap[possibleReplacement] > 0 &&
            colorDistanceFunction(pixelRGB, hexToRgb(possibleReplacement)) <
                colorDistanceFunction(pixelRGB, hexToRgb(replacement))
        ) {
            replacement = possibleReplacement;
        }
    });
    return hexToRgb(replacement);
}

function correctPixelsForAvailableStudsWithGreedyDynamicDithering(
    availableStudMap,
    originalPixels,
    imageWidth,
    colorDistanceFunction,
    skipDithering,
    assumeInfinitePixelCounts
) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap)); // clone

    // We use this to easily get adjacent pixels when propogating dithering error
    const pixelMatrix = [];
    const height = Math.floor(originalPixels.length / 4 / imageWidth);
    for (let row = 0; row < height; row++) {
        pixelMatrix[row] = [];
        for (let col = 0; col < imageWidth; col++) {
            const i = (row * imageWidth + col) * 4;

            const pixelRGB = [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]];

            const tentativeReplacementRGB = findReplacement(pixelRGB, availableStudMap, colorDistanceFunction);
            const tentativeReplacementDistance = colorDistanceFunction(pixelRGB, tentativeReplacementRGB);
            const pixel = {
                pixelRGB,
                isInPixelQueue: true,
                row,
                col,
                tentativeReplacementRGB,
                tentativeReplacementDistance,
            };
            pixelMatrix[row][col] = pixel;
        }
    }

    const comparator = (b, a) => a.tentativeReplacementDistance - b.tentativeReplacementDistance;
    let pixelQueue = new Heap(comparator);

    pixelQueue.init(pixelMatrix.flat());

    while (!pixelQueue.isEmpty()) {
        const nextPixel = pixelQueue.pop();

        // Do this in the RGB color space so we can cleanly spread this around if we're doing dithering
        // TODO: see if/how this messes with other color distance functions
        const dequeuedPixelQuantizationError = [
            nextPixel.pixelRGB[0] - nextPixel.tentativeReplacementRGB[0],
            nextPixel.pixelRGB[1] - nextPixel.tentativeReplacementRGB[1],
            nextPixel.pixelRGB[2] - nextPixel.tentativeReplacementRGB[2],
        ];

        nextPixel.isInPixelQueue = false;
        nextPixel.pixelRGB = nextPixel.tentativeReplacementRGB; // lock this in - we're not changing this pixel now

        if (!assumeInfinitePixelCounts) {
            const pixelHex = rgbToHex(nextPixel.pixelRGB[0], nextPixel.pixelRGB[1], nextPixel.pixelRGB[2]);
            availableStudMap[pixelHex] = availableStudMap[pixelHex] - 1;
            if (availableStudMap[pixelHex] === 0) {
                // we're out of parts in this color - reassign the nodes and rebuild the heap
                const oldHeapPixels = [...pixelQueue.heapArray];
                oldHeapPixels.forEach((oldPixel) => {
                    const tentativeReplacementRGB = findReplacement(
                        oldPixel.pixelRGB,
                        availableStudMap,
                        colorDistanceFunction
                    );
                    const tentativeReplacementDistance = colorDistanceFunction(
                        oldPixel.pixelRGB,
                        tentativeReplacementRGB
                    );
                    oldPixel.tentativeReplacementRGB = tentativeReplacementRGB;
                    oldPixel.tentativeReplacementDistance = tentativeReplacementDistance;
                });
                pixelQueue.init(); // heapify
            }
        }

        if (!skipDithering) {
            // first, get the adjacent pixels we may need to adjust
            const kernel = GAUSSIAN_DITHERING_KERNEL;
            const kernelHeight = kernel.length;
            const kernelWidth = kernel[0].length;
            const kernelRowMiddle = Math.floor(kernelHeight / 2);
            const kernelColMiddle = Math.floor(kernelWidth / 2);

            let totalNeighborhoodPixels = 0;
            let errorDenominator = 0;
            for (let kr = 0; kr < kernelHeight; kr++) {
                for (let kc = 0; kc < kernelWidth; kc++) {
                    if (kr != kernelRowMiddle || kc != kernelColMiddle) {
                        const pixelMatrixRow = nextPixel.row - kernelRowMiddle + kr;
                        const pixelMatrixCol = nextPixel.col - kernelColMiddle + kc;
                        const neighborhoodPixel = (pixelMatrix[pixelMatrixRow] || {})[pixelMatrixCol];
                        if (neighborhoodPixel != null && neighborhoodPixel.isInPixelQueue) {
                            totalNeighborhoodPixels++;
                            errorDenominator += kernel[kr][kc];
                        }
                    }
                }
            }

            if (errorDenominator > 0) {
                for (let kr = 0; kr < kernelHeight; kr++) {
                    for (let kc = 0; kc < kernelWidth; kc++) {
                        if (kr != kernelRowMiddle || kc != kernelColMiddle) {
                            const pixelMatrixRow = nextPixel.row - kernelRowMiddle + kr;
                            const pixelMatrixCol = nextPixel.col - kernelColMiddle + kc;
                            const neighborhoodPixel = (pixelMatrix[pixelMatrixRow] || {})[pixelMatrixCol];
                            if (neighborhoodPixel != null && neighborhoodPixel.isInPixelQueue) {
                                // add in error
                                const errorWeight = kernel[kr][kc] / errorDenominator;
                                neighborhoodPixel.pixelRGB = [0, 1, 2].map((channel) =>
                                    clamp255(
                                        neighborhoodPixel.pixelRGB[channel] +
                                            dequeuedPixelQuantizationError[channel] * errorWeight
                                    )
                                );

                                const tentativeReplacementRGB = findReplacement(
                                    neighborhoodPixel.pixelRGB,
                                    availableStudMap,
                                    colorDistanceFunction
                                );
                                const tentativeReplacementDistance = colorDistanceFunction(
                                    neighborhoodPixel.pixelRGB,
                                    tentativeReplacementRGB
                                );
                                const oldReplacementRGB = neighborhoodPixel.tentativeReplacementRGB;
                                neighborhoodPixel.tentativeReplacementRGB = tentativeReplacementRGB;
                                neighborhoodPixel.tentativeReplacementDistance = tentativeReplacementDistance;

                                if (
                                    oldReplacementRGB[0] != neighborhoodPixel.tentativeReplacementRGB[0] ||
                                    oldReplacementRGB[1] != neighborhoodPixel.tentativeReplacementRGB[1] ||
                                    oldReplacementRGB[2] != neighborhoodPixel.tentativeReplacementRGB[2]
                                ) {
                                    pixelQueue.remove(neighborhoodPixel);
                                    pixelQueue.add(neighborhoodPixel);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    const result = [];
    pixelMatrix.forEach((row) =>
        row.forEach((pixel) => {
            pixel.tentativeReplacementRGB.forEach((channel) => {
                result.push(channel);
            });
            result.push(255);
        })
    );
    return new Uint8ClampedArray(result);
}

function alignPixelsWithTraditionalDithering(
    availableStudMap,
    originalPixels,
    imageWidth,
    colorDistanceFunction,
    kernel
) {
    availableStudMap = JSON.parse(JSON.stringify(availableStudMap)); // clone

    // We use this to easily get adjacent pixels when propogating dithering error
    const pixelMatrix = [];
    const height = Math.floor(originalPixels.length / 4 / imageWidth);
    for (let row = 0; row < height; row++) {
        pixelMatrix[row] = [];
        for (let col = 0; col < imageWidth; col++) {
            const i = (row * imageWidth + col) * 4;

            const pixelRGB = [originalPixels[i], originalPixels[i + 1], originalPixels[i + 2]];

            const pixel = {
                pixelRGB,
            };
            pixelMatrix[row][col] = pixel;
        }
    }

    const kernelDenominator = kernel.reduce((partialSum, entry) => partialSum + entry.val, 0);

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < imageWidth; col++) {
            const currentPixel = pixelMatrix[row][col];
            const replacementRGB = findReplacement(currentPixel.pixelRGB, availableStudMap, colorDistanceFunction);
            const currentPixelQuantizationError = [
                currentPixel.pixelRGB[0] - replacementRGB[0],
                currentPixel.pixelRGB[1] - replacementRGB[1],
                currentPixel.pixelRGB[2] - replacementRGB[2],
            ];

            // spread the error
            kernel.forEach((kernelEntry) => {
                const forwardPixel = (pixelMatrix[row + kernelEntry.row] || {})[col + kernelEntry.col];
                if (forwardPixel != null) {
                    forwardPixel.pixelRGB = [0, 1, 2].map((channel) =>
                        clamp255(
                            forwardPixel.pixelRGB[channel] +
                                (currentPixelQuantizationError[channel] * kernelEntry.val) / kernelDenominator
                        )
                    );
                }
            });

            // reassign the current pixel
            currentPixel.pixelRGB = replacementRGB;
        }
    }

    const result = [];
    pixelMatrix.forEach((row) =>
        row.forEach((pixel) => {
            pixel.pixelRGB.forEach((channel) => {
                result.push(channel);
            });
            result.push(255);
        })
    );
    return new Uint8ClampedArray(result);
}

// input: r,g,b in [0,1], out: h in [0,360) and s,v in [0,1]
function rgb2hsv(r, g, b) {
    let v = Math.max(r, g, b),
        n = v - Math.min(r, g, b);
    let h = n && (v == r ? (g - b) / n : v == g ? 2 + (b - r) / n : 4 + (r - g) / n);
    return [60 * (h < 0 ? h + 6 : h), v && n / v, v];
}

// input: h in [0,360] and s,v in [0,1] - output: r,g,b in [0,1]
function hsv2rgb(h, s, v) {
    let f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    return [f(5), f(3), f(1)];
}

// input: h (offset) in [0,360] and s,v (offset) in [-1,1] - output: adjusted r,g,b
function adjustHSV(rgbPixel, h, s, v) {
    const scaledRGB = rgbPixel.map((pixel) => pixel / 255);
    const baseHSV = rgb2hsv(scaledRGB[0], scaledRGB[1], scaledRGB[2]);
    const resultHue = (baseHSV[0] + Math.round(h)) % 360;
    const resultSaturation = Math.min(Math.max(baseHSV[1] + s, 0), 1);
    const resultValue = Math.min(Math.max(baseHSV[2] + v, 0), 1);
    const resultRGB = hsv2rgb(resultHue, resultSaturation, resultValue);
    return resultRGB.map((pixel) => Math.round(pixel * 255));
}

function applyPixelFilter(inputPixels, rgbFilter) {
    const outputPixels = [...inputPixels];
    for (let i = 0; i < inputPixels.length; i += 4) {
        const filteredPixel = rgbFilter([inputPixels[i], inputPixels[i + 1], inputPixels[i + 2]]);
        for (let j = 0; j < 3; j++) {
            outputPixels[i + j] = filteredPixel[j];
        }
    }
    return outputPixels;
}

function applyHSVAdjustment(inputPixels, h, s, v) {
    return applyPixelFilter(inputPixels, (pixel) => adjustHSV(pixel, h, s, v));
}

function adjustBrightness(rgbPixel, brightnessOffset) {
    return rgbPixel.map((channel) => Math.round(Math.min(Math.max(channel + brightnessOffset, 0), 255)));
}

function applyBrightnessAdjustment(inputPixels, brightnessOffset) {
    return applyPixelFilter(inputPixels, (pixel) => adjustBrightness(pixel, brightnessOffset));
}

function adjustContrast(rgbPixel, contrastFactor) {
    return rgbPixel.map((channel) => Math.round(Math.min(Math.max(contrastFactor * (channel - 128) + 128, 0), 255)));
}

function applyContrastAdjustment(inputPixels, contrastOffset) {
    const contrastFactor = (259 * (255 + contrastOffset)) / (255 * (259 - contrastOffset));
    return applyPixelFilter(inputPixels, (pixel) => adjustContrast(pixel, contrastFactor));
}

function getDarkenedPixel(rgbPixel) {
    return rgbPixel.map((color) => Math.round((color * Math.PI) / 4));
}

function getDarkenedStudsToStuds(studList) {
    const result = {};
    studList.forEach((stud) => {
        const darkenedRGB = getDarkenedPixel(hexToRgb(stud));
        result[rgbToHex(darkenedRGB[0], darkenedRGB[1], darkenedRGB[2])] = stud;
    });
    return result;
}

// Gets stud map adjusted for bleedthrough of the black back panel
function getDarkenedStudMap(studMap) {
    const result = {};
    Object.keys(studMap).forEach((stud) => {
        const darkenedRGB = getDarkenedPixel(hexToRgb(stud));
        result[rgbToHex(darkenedRGB[0], darkenedRGB[1], darkenedRGB[2])] = studMap[stud];
    });
    return result;
}

function getDarkenedImage(pixels) {
    const outputPixels = [...pixels];
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] != null && pixels[i + 1] != null && pixels[i + 2] != null) {
            const darkenedPixel = getDarkenedPixel([pixels[i], pixels[i + 1], pixels[i + 2]]);
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
        const revertedPixelHex = pixelHex === "#000000" ? "#000000" : darkenedStudsToStuds[pixelHex];
        const revertedPixelRGB = hexToRgb(revertedPixelHex);
        for (let j = 0; j < 3; j++) {
            outputPixels[i + j] = revertedPixelRGB[j];
        }
    }
    return outputPixels;
}

function drawPixel(ctx, x, y, radius, pixelHex, strokeHex, pixelType) {
    ctx.beginPath();
    if ([PIXEL_TYPE_OPTIONS[0].number, PIXEL_TYPE_OPTIONS[1].number].includes(pixelType)) {
        // draw a circle
        ctx.arc(x + radius, y + radius, radius, 0, 2 * Math.PI);
    } else {
        // draw a square
        ctx.rect(x, y, 2 * radius, 2 * radius);
    }
    ctx.fillStyle = pixelHex;
    ctx.fill();
    ctx.strokeStyle = strokeHex;
    if (!("" + pixelType).match("^variable.*$")) {
        // TODO: Look at perf?
        ctx.stroke();
    }
    if (
        [
            PIXEL_TYPE_OPTIONS[1].number,
            PIXEL_TYPE_OPTIONS[3].number,
            PIXEL_TYPE_OPTIONS[4].number,
            PIXEL_TYPE_OPTIONS[6].number,
            PIXEL_TYPE_OPTIONS[7].number,
        ].includes(pixelType)
    ) {
        // draw a circle on top of the piece to represent a stud
        ctx.beginPath();
        ctx.arc(x + radius, y + radius, radius * 0.6, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

// replaces square pixels with correct shape and upscales
function drawStudImageOnCanvas(
    pixels,
    width,
    scalingFactor,
    canvas,
    pixelType,
    plateDimensionsOverlay // only used if pixelType contains 'variable'
) {
    const ctx = canvas.getContext("2d");

    canvas.width = width * scalingFactor;
    canvas.height = ((pixels.length / 4) * scalingFactor) / width;
    ctx.fillRect(0, 0, width * scalingFactor, ((pixels.length / 4) * scalingFactor) / width);

    const radius = scalingFactor / 2;
    for (let i = 0; i < pixels.length / 4; i++) {
        const pixelHex = rgbToHex(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]);
        drawPixel(
            ctx,
            (i % width) * 2 * radius,
            Math.floor(i / width) * 2 * radius,
            radius,
            pixelHex,
            "#111111",
            pixelType
        );
    }

    if (("" + pixelType).match("^variable.*$") && plateDimensionsOverlay) {
        for (let row = 0; row < plateDimensionsOverlay.length; row++) {
            for (let col = 0; col < plateDimensionsOverlay[0].length; col++) {
                const part = plateDimensionsOverlay[row][col];
                if (part != null) {
                    ctx.strokeStyle = "#888888";
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.rect(col * 2 * radius, row * 2 * radius, 2 * radius * part[1], 2 * radius * part[0]);
                    ctx.stroke();
                }
            }
        }
    }
}

function getSubPixelArray(pixelArray, index, width, plateWidth) {
    const result = [];
    const horizontalOffset = (index * plateWidth) % width;
    const verticalOffset = plateWidth * Math.floor((index * plateWidth) / width);

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
    pixelType
) {
    const radius = scalingFactor / 2;
    ctx.font = `${scalingFactor / 2}px Arial`;
    availableStudHexList.forEach((pixelHex, i) => {
        const number = i + 1;
        ctx.beginPath();
        const x = horizontalOffset;
        const y = verticalOffset + radius * 2.5 * number;
        drawPixel(
            ctx,
            x - radius,
            y - radius,
            radius,
            pixelHex,
            inverseHex(pixelHex),
            PIXEL_TYPE_TO_FLATTENED[pixelType]
        );
        ctx.fillStyle = inverseHex(pixelHex);
        ctx.fillText(number, x - (scalingFactor * (1 + Math.floor(number / 2) / 6)) / 8, y + scalingFactor / 8);
        ctx.fillStyle = "#000000";
        if (!("" + pixelType).match("^variable.*$")) {
            ctx.fillText(`X ${studMap[pixelHex] || 0}`, x + radius * 1.5, y);
        }
        ctx.font = `${scalingFactor / 2.5}px Arial`;
        ctx.fillText(HEX_TO_COLOR_NAME[pixelHex] || pixelHex, x + radius * 1.5, y + scalingFactor / 2.5);
        ctx.font = `${scalingFactor / 2}px Arial`;
    });

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.rect(
        horizontalOffset - radius * 2,
        verticalOffset + radius * 0.75,
        radius * 11,
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
    pixelType
) {
    const ctx = canvas.getContext("2d");

    pictureWidth = plateWidth * scalingFactor;
    pictureHeight = plateWidth * scalingFactor;

    const radius = scalingFactor / 2;

    const studMap = getUsedPixelsStudMap(pixelArray);

    canvas.height = Math.max(pictureHeight * 1.5, pictureHeight * 0.4 + availableStudHexList.length * radius * 2.5);
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStudCountForContext(
        studMap,
        availableStudHexList,
        scalingFactor,
        ctx,
        pictureWidth * 0.25,
        pictureHeight * 0.2 - radius,
        pixelType
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
        legendHorizontalOffset + legendSquareSide / 4 + (legendSquareSide * width) / plateWidth,
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
    pixelType,
    variablePixelPieceDimensions
) {
    const ctx = canvas.getContext("2d");

    pictureWidth = plateWidth * scalingFactor;
    pictureHeight = ((pixelArray.length / 4) * scalingFactor) / plateWidth;

    const innerPadding = scalingFactor / 12;
    const radius = scalingFactor / 2;

    const studMap = getUsedPixelsStudMap(pixelArray);

    canvas.height = Math.max(pictureHeight * 1.5, pictureHeight * 0.4 + availableStudHexList.length * radius * 2.5);
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.rect(pictureWidth * 0.75, pictureHeight * 0.2, pictureWidth, pictureHeight);
    ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.fillRect(pictureWidth * 0.75, pictureHeight * 0.2, pictureWidth, pictureHeight);

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = `${scalingFactor}px Arial`;
    ctx.beginPath();
    ctx.fillText(`Section ${plateNumber}`, pictureWidth * 0.75, pictureHeight * 0.2 - scalingFactor);
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
            drawPixel(
                ctx,
                x - radius,
                y - radius,
                radius,
                pixelHex,
                inverseHex(pixelHex),
                PIXEL_TYPE_TO_FLATTENED[pixelType]
            );
            ctx.fillStyle = inverseHex(pixelHex);
            ctx.fillText(
                studToNumber[pixelHex],
                x - (scalingFactor * (1 + Math.floor(studToNumber[pixelHex] / 2) / 6)) / 8,
                y + scalingFactor / 8
            );
        }
    }

    if (variablePixelPieceDimensions != null) {
        for (let i = 0; i < plateWidth; i++) {
            for (let j = 0; j < plateWidth; j++) {
                const x = pictureWidth * 0.75 + (j * 2 + 1) * radius;
                const y = pictureHeight * 0.2 + ((i % plateWidth) * 2 + 1) * radius;
                const piece = variablePixelPieceDimensions[i][j];
                if (piece != null) {
                    ctx.strokeStyle = "#888888";
                    ctx.beginPath();
                    ctx.rect(x - radius, y - radius, 2 * radius * piece[1], 2 * radius * piece[0]);
                    ctx.stroke();
                    ctx.strokeStyle = "#FFFFFF";
                    ctx.beginPath();
                    ctx.rect(
                        x - radius + innerPadding,
                        y - radius + innerPadding,
                        2 * radius * piece[1] - 2 * innerPadding,
                        2 * radius * piece[0] - 2 * innerPadding
                    );
                    ctx.stroke();
                }
            }
        }
    }

    drawStudCountForContext(
        studMap,
        availableStudHexList,
        scalingFactor,
        ctx,
        pictureWidth * 0.25,
        pictureHeight * 0.2 - radius,
        pixelType
    );
}

function getDepthSubPixelMatrix(pixelArray, totalWidth, horizontalOffset, verticalOffset, width, height) {
    const result = [];
    for (var i = 0; i < pixelArray.length / 4; i++) {
        const iHorizontal = i % totalWidth;
        const iVertical = Math.floor(i / totalWidth);

        if (
            horizontalOffset <= iHorizontal &&
            iHorizontal < horizontalOffset + width &&
            verticalOffset <= iVertical &&
            iVertical < verticalOffset + height
        ) {
            const targetVertical = iVertical - verticalOffset;
            const targetHorizontal = iHorizontal - horizontalOffset;
            result[targetVertical] = result[targetVertical] || [];
            result[targetVertical][targetHorizontal] = pixelArray[4 * i];
        }
    }

    return result;
}

// TODO: Reduce this problem to the one from the previous function?
function convertPixelArrayToMatrix(pixelArray, totalWidth) {
    const result = [];
    for (var i = 0; i < pixelArray.length / 4; i++) {
        const iHorizontal = i % totalWidth;
        const iVertical = Math.floor(i / totalWidth);

        result[iVertical] = result[iVertical] || [];
        result[iVertical][iHorizontal] = [pixelArray[4 * i], pixelArray[4 * i + 1], pixelArray[4 * i + 2]];
    }

    return result;
}

// TODO: Make more efficient
function getSubPixelMatrix(pixelMatrix, horizontalOffset, verticalOffset, width, height) {
    const result = [];
    for (let iHorizontal = 0; iHorizontal < pixelMatrix[0].length; iHorizontal++) {
        for (let iVertical = 0; iVertical < pixelMatrix.length; iVertical++) {
            if (
                horizontalOffset <= iHorizontal &&
                iHorizontal < horizontalOffset + width &&
                verticalOffset <= iVertical &&
                iVertical < verticalOffset + height
            ) {
                const targetVertical = iVertical - verticalOffset;
                const targetHorizontal = iHorizontal - horizontalOffset;
                result[targetVertical] = result[targetVertical] || [];
                result[targetVertical][targetHorizontal] = pixelMatrix[iVertical][iHorizontal];
            }
        }
    }
    return result;
}

function maxPoolingKernel(inputPixels) {
    let result = [0, 0, 0];
    inputPixels.forEach((pixel) => {
        pixel.forEach((val, channel) => {
            result[channel] = Math.max(result[channel], val);
        });
    });
    return result;
}

function minPoolingKernel(inputPixels) {
    let result = [255, 255, 255];
    inputPixels.forEach((pixel) => {
        pixel.forEach((val, channel) => {
            result[channel] = Math.min(result[channel], val);
        });
    });
    return result;
}

function avgPoolingKernel(inputPixels) {
    let sum = [0, 0, 0];
    inputPixels.forEach((pixel) => {
        pixel.forEach((val, channel) => {
            sum[channel] += val;
        });
    });
    return sum.map((channel) => Math.round(channel / inputPixels.length));
}

function dualMinMaxPoolingKernel(inputPixels) {
    const maxPool = maxPoolingKernel(inputPixels);
    const minPool = minPoolingKernel(inputPixels);
    const avgPool = avgPoolingKernel(inputPixels);
    return [0, 1, 2].map((channel) => {
        const min = minPool[channel];
        const max = maxPool[channel];
        const avg = avgPool[channel];
        return avg - min < max - avg ? min : max;
    });
}

function resizeImageArrayWithAdaptivePooling(input2DArray, outputWidth, outputHeight, subArrayPoolingFunction) {
    const result = [];
    for (let h = 0; h < outputHeight; h++) {
        const row = [];
        for (let w = 0; w < outputWidth; w++) {
            const startW = Math.floor((w * input2DArray[1].length) / outputWidth);
            const endW = Math.ceil(((w + 1) * input2DArray[1].length) / outputWidth);
            const startH = Math.floor((h * input2DArray.length) / outputHeight);
            const endH = Math.ceil(((h + 1) * input2DArray.length) / outputHeight);

            const kernelPixels = [];
            for (k_w = startW; k_w < endW; k_w++) {
                for (k_h = startH; k_h < endH; k_h++) {
                    kernelPixels.push(input2DArray[k_h][k_w]);
                }
            }
            row.push(subArrayPoolingFunction(kernelPixels));
        }
        result.push(row);
    }
    return result;
}

function resizeImagePixelsWithAdaptivePooling(
    inputPixels,
    inputImageWidth,
    outputWidth,
    outputHeight,
    subArrayPoolingFunction
) {
    const pixelMatrix = convertPixelArrayToMatrix(inputPixels, inputImageWidth);
    const outputPixels = resizeImageArrayWithAdaptivePooling(
        pixelMatrix,
        outputWidth,
        outputHeight,
        subArrayPoolingFunction
    );

    const result = [];
    outputPixels.forEach((row) => {
        row.forEach((pixel) => {
            pixel.forEach((channel) => {
                result.push(channel);
            });
            result.push(255); // opacity
        });
    });
    return new Uint8ClampedArray(result);
}

function getRequiredPartMatrixFromSetPixelMatrix(
    // pixels which are not set but need to be
    // should be completely true by the end
    setPixelMatrix,
    partDimensions,
    boundaryWidth = null // if this is set, don't cross boundaries
) {
    // initial result as a null array
    const result = [];
    for (let i = 0; i < setPixelMatrix.length; i++) {
        result[i] = [];
        for (let j = 0; j < setPixelMatrix[0].length; j++) {
            result[i][j] = null; // nothing has been placed here yet
        }
    }

    partDimensions = JSON.parse(JSON.stringify(partDimensions));
    partDimensions.sort(
        // sort in decreasing order of area
        // break ties on the second dimension
        (part1, part2) => part2[0] * part2[1] - part2[0] * 0.01 - part1[0] * part1[1] + part1[0] * 0.01
    );
    for (let i = 0; i < partDimensions.length; i++) {
        const part = partDimensions[i];

        // place the part as many times as we can
        for (let row = 0; row < setPixelMatrix.length - part[0] + 1; row++) {
            for (let col = 0; col < setPixelMatrix[0].length - part[1] + 1; col++) {
                let canPlacePiece = true;
                for (let pRow = 0; pRow < part[0] && canPlacePiece; pRow++) {
                    for (let pCol = 0; pCol < part[1] && canPlacePiece; pCol++) {
                        canPlacePiece = canPlacePiece && !setPixelMatrix[row + pRow][col + pCol];
                    }
                }
                if (boundaryWidth && boundaryWidth > 1) {
                    // make sure we don't cross bounaries on either direction
                    canPlacePiece =
                        canPlacePiece &&
                        Math.floor(row / boundaryWidth) === Math.floor((row + part[0] - 1) / boundaryWidth) &&
                        Math.floor(col / boundaryWidth) === Math.floor((col + part[1] - 1) / boundaryWidth);
                }
                if (canPlacePiece) {
                    result[row][col] = [part[0], part[1]]; // place the piece here
                    // now mark the correct pieces as covered
                    for (let pRow = 0; pRow < part[0]; pRow++) {
                        for (let pCol = 0; pCol < part[1]; pCol++) {
                            setPixelMatrix[row + pRow][col + pCol] = true; // set this pixel
                        }
                    }
                }
            }
        }
    }

    return result;
}

function drawDepthPlatesCountForContext(usedDepthParts, scalingFactor, ctx, horizontalOffset, verticalOffset) {
    let sortedDepthParts = Object.keys(usedDepthParts).filter((part) => (usedDepthParts[part] || 0) > 0);

    if (sortedDepthParts.length === 0) {
        ctx.fillStyle = "#000000";
        ctx.fillText(
            `No depth offset in section`,
            horizontalOffset - scalingFactor * 1.5,
            verticalOffset + scalingFactor * 0.75
        );
        return;
    }

    sortedDepthParts = sortedDepthParts.sort((part1, part2) => {
        const part1Numbers = part1.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        const part2Numbers = part2.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        return Number(part1Numbers[0]) * Number(part1Numbers[1]) - Number(part2Numbers[0]) * Number(part2Numbers[1]);
    });

    ctx.font = `${scalingFactor / 2}px Arial`;

    const lineHeight = scalingFactor * 1.5;

    sortedDepthParts.forEach((part, i) => {
        const x = horizontalOffset + scalingFactor * 0.8;
        const y = verticalOffset + lineHeight * (i + 0.75);
        ctx.fillStyle = "#000000";
        ctx.fillRect(x - lineHeight * 0.1, y - lineHeight * 0.35, lineHeight, lineHeight * 0.5);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(part, x, y);
        ctx.fillStyle = "#000000";
        ctx.fillText(` X ${usedDepthParts[part]}`, x + lineHeight, y);
    });

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.beginPath();
    ctx.rect(horizontalOffset, verticalOffset, scalingFactor * 4, lineHeight * (sortedDepthParts.length + 0.5));
    ctx.stroke();
}

function getUsedDepthPartsMap(perDepthLevelMatrices) {
    const result = {};
    perDepthLevelMatrices.forEach((matrix) =>
        matrix.forEach((row) =>
            row.forEach((part) => {
                if (part != null) {
                    result[getPlateDimensionsString(part)] = (result[getPlateDimensionsString(part)] || 0) + 1;
                }
            })
        )
    );
    return result;
}

function generateDepthInstructionTitlePage(
    usedPlatesMatrices,
    targetResolution,
    scalingFactor,
    canvas,
    finalDepthImageCanvas,
    plateWidth
) {
    const ctx = canvas.getContext("2d");

    pictureWidth = usedPlatesMatrices[0][0].length * scalingFactor;
    pictureHeight = usedPlatesMatrices[0][0][0].length * scalingFactor;

    const usedDepthParts = getUsedDepthPartsMap(usedPlatesMatrices.flat());
    const sortedDepthParts = Object.keys(usedDepthParts);
    sortedDepthParts.sort((part1, part2) => {
        const part1Numbers = part1.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        const part2Numbers = part2.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        return Number(part1Numbers[0]) * Number(part1Numbers[1]) - Number(part2Numbers[0]) * Number(part2Numbers[1]);
    });

    const betweenLevelPicturePadding = pictureHeight * 0.2;
    canvas.height = Math.max(
        pictureHeight * 1.5 + (pictureHeight + betweenLevelPicturePadding) * (usedPlatesMatrices[0].length - 1),
        pictureHeight * 0.4 + sortedDepthParts.length * (scalingFactor / 2) * 2.5
    );
    canvas.width = pictureWidth * 2;

    drawDepthPlatesCountForContext(
        usedDepthParts,
        scalingFactor,
        ctx,
        pictureWidth * 0.25,
        pictureHeight * 0.2 - scalingFactor / 2
    );

    ctx.fillStyle = "#000000";
    ctx.font = `${scalingFactor * 2}px Arial`;
    ctx.fillText("Lego Art Remix", pictureWidth * 0.75, pictureHeight * 0.28);
    ctx.font = `${scalingFactor / 2}px Arial`;
    ctx.fillText(`Depth Instructions`, pictureWidth * 0.75, pictureHeight * 0.34);
    ctx.fillText(
        `Resolution: ${targetResolution[0]} x ${targetResolution[1]}`,
        pictureWidth * 0.75,
        pictureHeight * 0.37
    );

    const legendHorizontalOffset = pictureWidth * 0.75;
    const legendVerticalOffset = pictureHeight * 0.41;
    const numPlates = usedPlatesMatrices.length;
    const legendSquareSide = scalingFactor;

    ctx.drawImage(
        finalDepthImageCanvas,
        0,
        0,
        finalDepthImageCanvas.width,
        finalDepthImageCanvas.height,
        legendHorizontalOffset + legendSquareSide / 4 + (legendSquareSide * targetResolution[0]) / plateWidth,
        legendVerticalOffset,
        (legendSquareSide * targetResolution[0]) / plateWidth,
        legendSquareSide * ((numPlates * plateWidth) / targetResolution[0])
    );

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.font = `${legendSquareSide / 2}px Arial`;

    for (let i = 0; i < numPlates; i++) {
        const horIndex = ((i * plateWidth) % targetResolution[0]) / plateWidth;
        const vertIndex = Math.floor((i * plateWidth) / targetResolution[0]);
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

function generateDepthInstructionPage(perDepthLevelMatrices, scalingFactor, canvas, plateNumber) {
    const ctx = canvas.getContext("2d");

    pictureWidth = perDepthLevelMatrices[0].length * scalingFactor;
    pictureHeight = perDepthLevelMatrices[0][0].length * scalingFactor;

    const radius = scalingFactor / 2;

    const usedDepthParts = getUsedDepthPartsMap(perDepthLevelMatrices);
    const sortedDepthParts = Object.keys(usedDepthParts);
    sortedDepthParts.sort((part1, part2) => {
        const part1Numbers = part1.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        const part2Numbers = part2.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
        return Number(part1Numbers[0]) * Number(part1Numbers[1]) - Number(part2Numbers[0]) * Number(part2Numbers[1]);
    });

    const betweenLevelPicturePadding = pictureHeight * 0.2;
    canvas.height = Math.max(
        pictureHeight * 1.5 + (pictureHeight + betweenLevelPicturePadding) * (perDepthLevelMatrices.length - 1),
        pictureHeight * 0.4 + sortedDepthParts.length * radius * 2.5
    );
    canvas.width = pictureWidth * 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 5;
    ctx.strokeStyle = "#000000";
    ctx.fillStyle = "#000000";
    ctx.font = `${scalingFactor}px Arial`;
    ctx.beginPath();
    ctx.fillText(
        `Section ${plateNumber} Depth Plating Instructions`,
        pictureWidth * 0.75,
        pictureHeight * 0.2 - scalingFactor
    );
    ctx.stroke();

    ctx.lineWidth = 1;

    ctx.font = `${scalingFactor * 0.75}px Arial`;

    for (let depthIndex = 0; depthIndex < perDepthLevelMatrices.length; depthIndex++) {
        const horizontalOffset = pictureWidth * 0.75;
        const verticalOffset = pictureHeight * 0.25 + (pictureHeight + betweenLevelPicturePadding) * depthIndex;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.rect(horizontalOffset, verticalOffset, pictureWidth, pictureHeight);
        ctx.strokeStyle = "#000000";
        ctx.stroke();
        ctx.fillStyle = "#000000";
        ctx.fillRect(horizontalOffset, verticalOffset, pictureWidth, pictureHeight);

        ctx.beginPath();
        ctx.fillText(`Level ${depthIndex + 1}`, pictureWidth * 0.75, verticalOffset - scalingFactor * 0.5);
        ctx.stroke();

        const partMatrix = perDepthLevelMatrices[depthIndex];

        ctx.fillStyle = "#222222";
        ctx.lineWidth = 2;
        const innerPadding = scalingFactor / 12;
        const radius = scalingFactor * 0.5 - 2 * innerPadding;

        for (let row = 0; row < partMatrix.length; row++) {
            for (let col = 0; col < partMatrix[0].length; col++) {
                ctx.beginPath();
                ctx.arc(
                    horizontalOffset + (col + 0.5) * scalingFactor,
                    verticalOffset + (row + 0.5) * scalingFactor,
                    radius,
                    0,
                    2 * Math.PI
                );
                ctx.fill();

                const part = partMatrix[row][col];
                if (part != null) {
                    ctx.strokeStyle = "#888888";
                    ctx.beginPath();
                    ctx.rect(
                        horizontalOffset + col * scalingFactor,
                        verticalOffset + row * scalingFactor,
                        scalingFactor * part[1],
                        scalingFactor * part[0]
                    );
                    ctx.stroke();
                    ctx.strokeStyle = "#FFFFFF";
                    ctx.beginPath();
                    ctx.rect(
                        horizontalOffset + col * scalingFactor + innerPadding,
                        verticalOffset + row * scalingFactor + innerPadding,
                        scalingFactor * part[1] - 2 * innerPadding,
                        scalingFactor * part[0] - 2 * innerPadding
                    );
                    ctx.stroke();
                }
            }
        }
    }

    drawDepthPlatesCountForContext(
        usedDepthParts,
        scalingFactor,
        ctx,
        pictureWidth * 0.25,
        pictureHeight * 0.2 - radius
    );
}

function getSetPixelMatrixFromInputMatrix(inputMatrix, isSetFunction) {
    const result = [];
    for (let i = 0; i < inputMatrix.length; i++) {
        result[i] = [];
        for (let j = 0; j < inputMatrix[0].length; j++) {
            // TODO: don't pass in inputMatrix[i][j]?
            result[i][j] = isSetFunction(inputMatrix[i][j], i, j);
        }
    }
    return result;
}

const PLATE_DIMENSIONS_DEPTH_SEPERATOR = " X ";

function getPlateDimensionsString(part) {
    return part[0] < part[1]
        ? `${part[0]}${PLATE_DIMENSIONS_DEPTH_SEPERATOR}${part[1]}`
        : `${part[1]}${PLATE_DIMENSIONS_DEPTH_SEPERATOR}${part[0]}`;
}

const TILE_DIMENSIONS_TO_PART_ID = {
    "1 X 1": "3070b",
    "1 X 2": "3069b",
    "1 X 3": 63864,
    "1 X 4": 2431,
    "1 X 6": 6636,
    "1 X 8": 4162,
    "2 X 2": "3068b",
    "2 X 3": 26603,
    "2 X 4": 87079,
    "2 X 6": 69729,
    // "2 X 8": ?? ,
    // "4 X 4": ?? ,
    // "4 X 8": ?? ,
    // "4 X 10": ??
};

const PLATE_DIMENSIONS_TO_PART_ID = {
    "1 X 1": 3024,
    "1 X 2": 3023,
    "1 X 3": 3623,
    "1 X 4": 3710,
    "1 X 6": 3666,
    "1 X 8": 3460,
    "2 X 2": 3022,
    "2 X 3": 3021,
    "2 X 4": 3020,
    "2 X 6": 3795,
    "2 X 8": 3034,
    "4 X 4": 3031,
    "4 X 8": 3035,
    "4 X 10": 3030,
};

const BRICK_DIMENSIONS_TO_PART_ID = {
    "1 X 1": 3005,
    "1 X 2": 3004,
    "1 X 3": 3622,
    "1 X 4": 3010,
    "1 X 6": 3009,
    "1 X 8": 3008,
    "2 X 2": 3003,
    "2 X 3": 3002,
    "2 X 4": 3001,
    "2 X 6": 2456,
    "2 X 8": 3007,
    // "4 X 4": ?? ,
    // "4 X 8": ?? ,
    // "4 X 10": ??
};

const DEFAULT_DISABLED_DEPTH_PLATES = ["4 X 10", "4 X 8"];

const DEPTH_FILLER_PARTS = Object.keys(PLATE_DIMENSIONS_TO_PART_ID).map((part) =>
    part.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR).map((dimension) => Number(dimension))
);
Object.keys(PLATE_DIMENSIONS_TO_PART_ID).forEach((part) => {
    const splitPart = part.split(PLATE_DIMENSIONS_DEPTH_SEPERATOR);
    if (splitPart[0] !== splitPart[1]) {
        DEPTH_FILLER_PARTS.push([Number(splitPart[1]), Number(splitPart[0])]);
    }
});

function getDepthWantedListXML(depthPartsMap) {
    const items = Object.keys(depthPartsMap).map(
        (part) =>
            `<ITEM>
      <ITEMTYPE>P</ITEMTYPE>
      <ITEMID>${PLATE_DIMENSIONS_TO_PART_ID[part]}</ITEMID>
      <COLOR>11</COLOR>
      <MINQTY>${depthPartsMap[part]}</MINQTY>
    </ITEM>`
    );
    return `<?xml version="1.0" encoding="UTF-8"?>
  <INVENTORY>
    \n${items.join("\n")}\n
  </INVENTORY>`;
}

function getWantedListXML(studMap, partID) {
    const items = Object.keys(studMap).map(
        (stud) =>
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

function getVariablePixelWantedListXML(pixelColorMatrix, variablePixelPieceDimensions, pixelType) {
    let pieceCounts = {}; // map piece identifier strings to counts
    step3VariablePixelPieceDimensions.forEach((row, i) => {
        row.forEach((pixelDimensions, j) => {
            if (pixelDimensions != null) {
                const pixelRGB = pixelColorMatrix[i][j];
                const pixelHex = rgbToHex(pixelRGB[0], pixelRGB[1], pixelRGB[2]);
                const sortedPixelDimensions =
                    pixelDimensions[0] < pixelDimensions[1]
                        ? pixelDimensions
                        : [pixelDimensions[1], pixelDimensions[0]];
                const pieceKey =
                    pixelHex +
                    "_" +
                    sortedPixelDimensions[0] +
                    PLATE_DIMENSIONS_DEPTH_SEPERATOR +
                    sortedPixelDimensions[1];
                pieceCounts[pieceKey] = (pieceCounts[pieceKey] || 0) + 1;
            }
        });
    });

    const usedPieces = Object.keys(pieceCounts);
    usedPieces.sort();
    const items = usedPieces.map((keyString) => {
        const pieceKey = keyString.split("_");
        let pieceIDMap = PLATE_DIMENSIONS_TO_PART_ID;
        if (pixelType === "variable_tile") {
            pieceIDMap = TILE_DIMENSIONS_TO_PART_ID;
        } else if (pixelType === "variable_brick") {
            pieceIDMap = BRICK_DIMENSIONS_TO_PART_ID;
        }

        return `<ITEM>
            <ITEMTYPE>P</ITEMTYPE>
            <ITEMID>${pieceIDMap[pieceKey[1]]}</ITEMID>
            <COLOR>${COLOR_NAME_TO_ID[HEX_TO_COLOR_NAME[pieceKey[0]]]}</COLOR>
            <MINQTY>${pieceCounts[keyString]}</MINQTY>
         </ITEM>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
  <INVENTORY>
    \n${items.join("\n")}\n
  </INVENTORY>`;
}
