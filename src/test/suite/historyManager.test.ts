import * as assert from 'assert';
import { HistoryManager } from '../../services/historyManager';

class InMemoryMemento {
    private store = new Map<string, unknown>();

    get<T>(key: string, defaultValue?: T): T {
        return (this.store.has(key) ? (this.store.get(key) as T) : defaultValue) as T;
    }

    update(key: string, value: unknown): Thenable<void> {
        this.store.set(key, value);
        return Promise.resolve();
    }
}

function createTestContext() {
    return {
        subscriptions: [],
        globalState: new InMemoryMemento()
    } as any;
}

suite('HistoryManager', () => {

    test('addEntry prepends item and trims to max size', async () => {
        const ctx = createTestContext();
        const manager = new HistoryManager(ctx);

        // Add more than MAX_ITEMS entries
        const baseItem = {
            prompt: 'test',
            provider: 'openai',
            model: 'gpt-4o-mini',
            targetFolder: '/tmp',
            fileCount: 1
        };

        const addCount = 55;
        for (let i = 0; i < addCount; i++) {
            await manager.addEntry({
                ...baseItem,
                prompt: `test-${i}`
            });
        }

        const history = manager.getHistory();
        assert.ok(history.length <= 50);
        assert.strictEqual(history[0].prompt, 'test-54');
    });

    test('clearHistory empties local history', async () => {
        const ctx = createTestContext();
        const manager = new HistoryManager(ctx);

        await manager.addEntry({
            prompt: 'clear-me',
            provider: 'openai',
            model: 'gpt-4o-mini',
            targetFolder: '/tmp',
            fileCount: 1
        });

        let history = manager.getHistory();
        assert.ok(history.length > 0);

        await manager.clearHistory();
        history = manager.getHistory();
        assert.strictEqual(history.length, 0);
    });

    test('deleteItem removes only the matching item', async () => {
        const ctx = createTestContext();
        const manager = new HistoryManager(ctx);

        await manager.addEntry({
            prompt: 'first',
            provider: 'openai',
            model: 'gpt-4o-mini',
            targetFolder: '/tmp',
            fileCount: 1
        });
        await manager.addEntry({
            prompt: 'second',
            provider: 'openai',
            model: 'gpt-4o-mini',
            targetFolder: '/tmp',
            fileCount: 1
        });

        const all = manager.getHistory();
        const idToDelete = all[0].id; // newest

        await manager.deleteItem(idToDelete);

        const remaining = manager.getHistory();
        assert.strictEqual(remaining.length, 1);
        assert.notStrictEqual(remaining[0].id, idToDelete);
    });
});

