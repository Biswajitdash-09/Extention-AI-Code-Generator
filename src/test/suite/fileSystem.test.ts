import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { FileSystemUtils } from '../../utils/fileSystem';
import { ProjectStructure } from '../../types';

suite('FileSystemUtils Test Suite', () => {
    let tempDir: string;

    setup(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-code-gen-test-'));
    });

    teardown(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (e) {
            console.error('Failed to clean up temp dir', e);
        }
    });

    test('createProjectStructure creates folders and files', async () => {
        const structure: ProjectStructure = {
            folders: ['src', 'src/components'],
            files: [
                { path: 'src/index.ts', content: 'console.log("hello");' },
                { path: 'src/components/Button.tsx', content: 'export const Button = () => <button />' }
            ]
        };

        const result = await FileSystemUtils.createProjectStructure(tempDir, structure);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.filesCreated, 2);

        // Verify folders exist
        assert.ok(fs.existsSync(path.join(tempDir, 'src')));
        assert.ok(fs.existsSync(path.join(tempDir, 'src/components')));

        // Verify files exist and have correct content
        const indexContent = fs.readFileSync(path.join(tempDir, 'src/index.ts'), 'utf-8');
        assert.strictEqual(indexContent, 'console.log("hello");');

        const buttonContent = fs.readFileSync(path.join(tempDir, 'src/components/Button.tsx'), 'utf-8');
        assert.strictEqual(buttonContent, 'export const Button = () => <button />');
    });

    test('createProjectStructure handles empty structure', async () => {
        const structure: ProjectStructure = {
            folders: [],
            files: []
        };

        const result = await FileSystemUtils.createProjectStructure(tempDir, structure);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.filesCreated, 0);
    });
});
