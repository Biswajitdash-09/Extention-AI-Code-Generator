import * as vscode from 'vscode';
import * as path from 'path';

export interface TestInfo {
    framework: string;
    extension: string;
    template: string;
}

export class TestGenerator {
    /**
     * Detect test framework from package.json
     */
    static async detectFramework(workspaceRoot: string): Promise<TestInfo | null> {
        try {
            const packageJsonPath = path.join(workspaceRoot, 'package.json');
            const packageJson = JSON.parse(await vscode.workspace.fs.readFile(vscode.Uri.file(packageJsonPath)).then(buffer => buffer.toString()));

            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            if (deps.jest) {
                return {
                    framework: 'jest',
                    extension: '.test.ts',
                    template: 'jest'
                };
            } else if (deps.vitest) {
                return {
                    framework: 'vitest',
                    extension: '.test.ts',
                    template: 'vitest'
                };
            } else if (deps.mocha) {
                return {
                    framework: 'mocha',
                    extension: '.spec.ts',
                    template: 'mocha'
                };
            } else if (packageJson.name?.includes('python')) {
                return {
                    framework: 'pytest',
                    extension: '_test.py',
                    template: 'pytest'
                };
            }

            return null;
        } catch {
            return null;
        }
    }

    /**
     * Generate test file path for a source file
     */
    static getTestFilePath(sourceFile: string, testInfo: TestInfo): string {
        const dir = path.dirname(sourceFile);
        const ext = path.extname(sourceFile);
        const basename = path.basename(sourceFile, ext);

        // Common patterns: src/foo.ts -> src/foo.test.ts or test/foo.test.ts
        return path.join(dir, `${basename}${testInfo.extension}`);
    }

    /**
     * Generate test template based on framework
     */
    static generateTestTemplate(sourceFile: string, testInfo: TestInfo, functions: string[]): string {
        const basename = path.basename(sourceFile, path.extname(sourceFile));

        switch (testInfo.framework) {
            case 'jest':
            case 'vitest':
                return `import { ${functions.join(', ')} } from './${basename}';

describe('${basename}', () => {
${functions.map(fn => `  it('should test ${fn}', () => {
    // TODO: Add test implementation
    expect(true).toBe(true);
  });`).join('\n\n')}
});
`;

            case 'mocha':
                return `import { expect } from 'chai';
import { ${functions.join(', ')} } from './${basename}';

describe('${basename}', () => {
${functions.map(fn => `  it('should test ${fn}', () => {
    // TODO: Add test implementation
    expect(true).to.equal(true);
  });`).join('\n\n')}
});
`;

            case 'pytest':
                return `from ${basename} import ${functions.join(', ')}

${functions.map(fn => `def test_${fn}():
    # TODO: Add test implementation
    assert True`).join('\n\n')}
`;

            default:
                return `// Test file for ${basename}\n// TODO: Add tests\n`;
        }
    }
}
