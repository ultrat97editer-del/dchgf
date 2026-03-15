import esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';

async function build() {
    console.log('Building and obfuscating server...');

    try {
        // 1. Bundle with esbuild
        const result = await esbuild.build({
            entryPoints: ['server.ts'],
            bundle: true,
            platform: 'node',
            format: 'esm',
            target: 'node20',
            outfile: 'dist/server.bundled.js',
            external: ['express', 'cors', 'axios', 'cheerio', 'vite', 'path', 'fs'], // Keep these external
            write: true,
        });

        const bundledCode = fs.readFileSync('dist/server.bundled.js', 'utf8');

        // 2. Obfuscate
        const obfuscationResult = JavaScriptObfuscator.obfuscate(bundledCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            numbersToExpressions: true,
            simplify: true,
            stringArrayThreshold: 0.75,
            splitStrings: true,
            splitStringsChunkLength: 10,
            unicodeEscapeSequence: false
        });

        // 3. Write final file
        if (!fs.existsSync('dist')) fs.mkdirSync('dist');
        fs.writeFileSync('server.obfuscated.js', obfuscationResult.getObfuscatedCode());

        console.log('Server obfuscated successfully: server.obfuscated.js');
    } catch (err) {
        console.error('Build failed:', err);
        process.exit(1);
    }
}

build();
