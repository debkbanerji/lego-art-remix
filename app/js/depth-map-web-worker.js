// create a dummy variable to store info from scripts
window = {};
importScripts("ndarray-browser-min.js");
importScripts("onnx.min.js");

const CNN_INPUT_IMAGE_WIDTH = 256;
const CNN_INPUT_IMAGE_HEIGHT = 256;

/**
 * Preprocess raw image data to match Resnet50 requirement.
 */
function preprocess(data, width, height) {
    const dataFromImage = window.ndarray(new Float32Array(data), [
        width,
        height,
        4
    ]);
    const dataProcessed = window.ndarray(new Float32Array(width * height * 3), [
        1,
        3,
        height,
        width
    ]);

    // Normalize 0-255 to (-1)-1
    window.ndarray.ops.divseq(dataFromImage, 128.0);
    window.ndarray.ops.subseq(dataFromImage, 1.0);

    // Realign imageData from [256*256*4] to the correct dimension [1*3*256*256].
    window.ndarray.ops.assign(
        dataProcessed.pick(0, 0, null, null),
        dataFromImage.pick(null, null, 2)
    );
    window.ndarray.ops.assign(
        dataProcessed.pick(0, 1, null, null),
        dataFromImage.pick(null, null, 1)
    );
    window.ndarray.ops.assign(
        dataProcessed.pick(0, 2, null, null),
        dataFromImage.pick(null, null, 0)
    );

    return dataProcessed.data;
}

self.addEventListener(
    "message",
    function(e) {
        const {inputPixelArray} = e.data;
        self.postMessage({inputPixelArray});
    },
    false
);
