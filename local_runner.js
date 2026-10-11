#!/usr/bin/env node
/**
 * Knowledge Map - Standalone Local Embedding Inference Runner
 * Runs in pure Node.js background process without Chromium renderer origin/WASM sandbox restrictions.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Force UTF-8 on Windows
if (process.platform === 'win32') {
    if (process.stdout._handle && process.stdout._handle.setBlocking) {
        process.stdout._handle.setBlocking(true);
    }
}

async function main() {
    let inputData = null;
    const args = process.argv.slice(2);
    const inputArgIndex = args.indexOf('--input');

    if (inputArgIndex !== -1 && args[inputArgIndex + 1]) {
        const inputFilePath = args[inputArgIndex + 1];
        if (!fs.existsSync(inputFilePath)) {
            console.error(JSON.stringify({ type: 'error', message: `Input file not found: ${inputFilePath}` }));
            process.exit(1);
        }
        inputData = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
    } else {
        // Read from stdin
        const chunks = [];
        for await (const chunk of process.stdin) {
            chunks.push(chunk);
        }
        const fullStr = Buffer.concat(chunks).toString('utf8');
        inputData = JSON.parse(fullStr);
    }

    const { modelDir, notes, pluginDir: customPluginDir } = inputData;
    const pluginDir = customPluginDir || __dirname;

    if (!modelDir || !fs.existsSync(modelDir)) {
        console.error(JSON.stringify({ type: 'error', message: `Model directory not found: ${modelDir}` }));
        process.exit(1);
    }

    if (!Array.isArray(notes) || notes.length === 0) {
        console.log(JSON.stringify({ type: 'done', count: 0 }));
        process.exit(0);
    }

    // 1. Initialize ONNX runtime node bundle
    const wasmDir = path.join(pluginDir, 'node_modules', 'onnxruntime-web', 'dist');
    const ortNodePath = path.join(wasmDir, 'ort.node.min.js');
    if (!fs.existsSync(ortNodePath)) {
        console.error(JSON.stringify({ type: 'error', message: `ort.node.min.js not found in ${wasmDir}` }));
        process.exit(1);
    }

    const ort = require(ortNodePath);
    ort.env.wasm.wasmPaths = pathToFileURL(wasmDir).href + '/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
    globalThis[Symbol.for('onnxruntime')] = ort;

    // 2. Initialize HuggingFace Transformers Tokenizer
    const transformersPath = path.join(pluginDir, 'node_modules', '@huggingface', 'transformers', 'dist', 'transformers.js');
    const { AutoTokenizer, env } = await import(pathToFileURL(transformersPath).href);

    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.fetch = async (urlOrPath) => {
        let filePath = String(urlOrPath).replace(/^file:\/\/\/?/, '');
        filePath = decodeURIComponent(filePath);
        if (fs.existsSync(filePath)) {
            const buf = fs.readFileSync(filePath);
            return new Response(buf, { status: 200 });
        }
        return new Response(null, { status: 404, statusText: 'Not Found' });
    };

    console.log(JSON.stringify({ type: 'status', message: '正在加载分词器...' }));
    const tokenizer = await AutoTokenizer.from_pretrained(modelDir, { local_files_only: true });

    // 3. Locate ONNX weights file
    const candidates = [
        path.join(modelDir, 'onnx', 'model_quantized.onnx'),
        path.join(modelDir, 'model_quantized.onnx'),
        path.join(modelDir, 'onnx', 'model_int8.onnx'),
        path.join(modelDir, 'model_int8.onnx'),
        path.join(modelDir, 'onnx', 'model.onnx'),
        path.join(modelDir, 'model.onnx'),
    ];

    let selectedOnnx = '';
    for (const cand of candidates) {
        if (fs.existsSync(cand)) {
            selectedOnnx = cand;
            break;
        }
    }

    if (!selectedOnnx) {
        console.error(JSON.stringify({
            type: 'error',
            message: `在目录 ${modelDir} 中未找到可用的 ONNX 模型文件 (model_quantized.onnx 或 model.onnx)`
        }));
        process.exit(1);
    }

    console.log(JSON.stringify({
        type: 'status',
        message: `正在加载 ONNX 权重 (${path.basename(selectedOnnx)})...`
    }));

    const modelBuffer = fs.readFileSync(selectedOnnx);
    const session = await ort.InferenceSession.create(modelBuffer);

    const total = notes.length;
    console.log(JSON.stringify({ type: 'start', total }));

    const startTime = Date.now();
    const BATCH_SIZE = 8;
    const MAX_SEQ_LEN = 96;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = notes.slice(i, i + BATCH_SIZE);
        const bSize = batch.length;
        const texts = batch.map((item) => `${item.title || ''}\n${item.text || ''}`);

        const enc = tokenizer(texts, {
            padding: true,
            truncation: true,
            max_length: MAX_SEQ_LEN,
        });

        const seqLen = enc.input_ids.dims[1];
        const inputIdsArray = BigInt64Array.from(
            Array.from(enc.input_ids.data).map((x) => BigInt(x))
        );
        const attentionMaskArray = BigInt64Array.from(
            Array.from(enc.attention_mask.data).map((x) => BigInt(x))
        );

        const feeds = {
            input_ids: new ort.Tensor('int64', inputIdsArray, [bSize, seqLen]),
            attention_mask: new ort.Tensor('int64', attentionMaskArray, [bSize, seqLen]),
        };

        const ortResults = await session.run(feeds);
        const outputTensor = ortResults[session.outputNames[0]];
        const hiddenDim = outputTensor.dims[2];
        const rawData = outputTensor.data;

        for (let b = 0; b < bSize; b++) {
            const item = batch[b];
            const pooled = new Float64Array(hiddenDim);
            let maskSum = 0;
            const bOffset = b * seqLen;

            for (let s = 0; s < seqLen; s++) {
                const maskVal = Number(attentionMaskArray[bOffset + s]);
                if (maskVal === 0) continue;
                maskSum += 1;
                const tokenOffset = (bOffset + s) * hiddenDim;
                for (let d = 0; d < hiddenDim; d++) {
                    pooled[d] += rawData[tokenOffset + d];
                }
            }

            if (maskSum > 0) {
                for (let d = 0; d < hiddenDim; d++) pooled[d] /= maskSum;
            }

            let norm = 0;
            for (let d = 0; d < hiddenDim; d++) norm += pooled[d] * pooled[d];
            norm = Math.sqrt(norm) || 1;
            const vector = Array.from(pooled).map((v) => Number((v / norm).toFixed(6)));

            console.log(JSON.stringify({
                type: 'vector',
                path: item.path,
                vector,
            }));
        }

        const processedCount = Math.min(i + BATCH_SIZE, total);
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rate = processedCount > 0 ? (elapsedSec / processedCount) : 0.2;
        const remainSec = Math.max(0, Math.round((total - processedCount) * rate));

        console.log(JSON.stringify({
            type: 'progress',
            current: processedCount,
            total,
            remainSec,
            title: batch[batch.length - 1].title,
            path: batch[batch.length - 1].path,
        }));
    }

    console.log(JSON.stringify({ type: 'done', count: total }));
}

main().catch((err) => {
    console.error(JSON.stringify({
        type: 'error',
        message: err.message || String(err),
        stack: err.stack
    }));
    process.exit(1);
});
