// create a dummy variable to store info from scripts
window = {};
importScripts("ndarray-browser-min.js");
importScripts("onnx.min.js");
onnx = window.onnx;

const CNN_INPUT_IMAGE_WIDTH = 256;
const CNN_INPUT_IMAGE_HEIGHT = 256;

/**
 * Preprocess raw image data to match Resnet50 requirement.
 */
function preprocess(data, width, height) {
    const dataFromImage = window.ndarray(new Float32Array(data), [width, height, 4]);
    const dataProcessed = window.ndarray(new Float32Array(width * height * 3), [1, 3, height, width]);

    // Normalize 0-255 to (-1)-1
    window.ndarray.ops.divseq(dataFromImage, 128.0);
    window.ndarray.ops.subseq(dataFromImage, 1.0);

    // Realign imageData from [256*256*4] to the correct dimension [1*3*256*256].
    window.ndarray.ops.assign(dataProcessed.pick(0, 0, null, null), dataFromImage.pick(null, null, 2));
    window.ndarray.ops.assign(dataProcessed.pick(0, 1, null, null), dataFromImage.pick(null, null, 1));
    window.ndarray.ops.assign(dataProcessed.pick(0, 2, null, null), dataFromImage.pick(null, null, 0));

    return dataProcessed.data;
}

self.addEventListener(
    "message",
    async function (e) {
        const { inputPixelArray } = e.data;
        self.postMessage({ loadingMessage: "Preparing Input..." });
        const preprocessedData = preprocess(inputPixelArray, CNN_INPUT_IMAGE_WIDTH, CNN_INPUT_IMAGE_HEIGHT);
        window = undefined;
        const inputTensor = new onnx.Tensor(preprocessedData, "float32", [
            1,
            3,
            CNN_INPUT_IMAGE_WIDTH,
            CNN_INPUT_IMAGE_HEIGHT,
        ]);

        const session = new onnx.InferenceSession({ backendHint: "cpu" });
        self.postMessage({ loadingMessage: "Loading Model..." });

        await session.loadModel("../assets/models/model-small.onnx");

        // Run model with Tensor inputs and get the result.
        self.postMessage({ loadingMessage: "Running Inference..." });

        const outputMap = await session.run([inputTensor]);

        self.postMessage({ loadingMessage: "Processing Model Output..." });

        const outputData = outputMap.values().next().value.data;

        let maxHeight = outputData[0];
        outputData.forEach((val) => {
            maxHeight = Math.max(maxHeight, val);
        });

        const normalizedOutputData = outputData.map((val) => Math.floor((255 * val) / maxHeight));

        const result = [];
        for (let i = 0; i < CNN_INPUT_IMAGE_WIDTH * CNN_INPUT_IMAGE_HEIGHT; i += 1) {
            for (let j = 0; j < 3; j++) {
                result.push(normalizedOutputData[i]);
            }
            result.push(255);
        }

        self.postMessage({ loadingMessage: "Done!" });

        self.postMessage({ result });
    },
    false
);
