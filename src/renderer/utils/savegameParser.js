/**
 * Parse a Quake savegame file content into structured entities
 * @param {string} content - The raw savegame file content
 * @returns {object[]} Array of parsed entities
 */
export function parseSavegame(content) {
    const entities = [];
    const lines = content.split(/\r?\n/);

    let currentEntity = null;
    let entityIndex = 0;
    let inEntity = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Start of entity block
        if (line.startsWith('{')) {
            inEntity = true;
            currentEntity = {
                classname: '',
                properties: {},
                entityIndex: entityIndex++
            };
            continue;
        }

        // End of entity block
        if (line === '}') {
            if (currentEntity && inEntity) {
                entities.push(currentEntity);
                currentEntity = null;
            }
            inEntity = false;
            continue;
        }

        // Parse property lines (format: "key" "value")
        if (inEntity && line.startsWith('"')) {
            const match = line.match(/"([^"]+)"\s+"([^"]*)"/);
            if (match) {
                const [, key, value] = match;

                if (key === 'classname') {
                    currentEntity.classname = value;
                }

                currentEntity.properties[key] = value;
            }
        }
    }

    return entities;
}

/**
 * Generate a consistent color for a classname using a simple hash
 */
export function getClassnameColor(classname) {
    if (!classname) {
        return 'transparent';
    }

    let hash = 0;
    for (let i = 0; i < classname.length; i++) {
        hash = classname.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }

    const hue = Math.abs(hash % 360);
    const saturation = 65 + (Math.abs(hash) % 20);
    const lightness = 45 + (Math.abs(hash >> 8) % 15);

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
