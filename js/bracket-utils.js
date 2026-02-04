/**
 * Kensho Tech - Bracket Utility
 * Shared logic for slot mapping and winner progression
 */

export const GOLDEN_PRESETS = {
    2: ['fn1', 'fn2'],
    3: ['sn3', 'sn4', 'fn1'],
    4: ['sn1', 'sn2', 'sn3', 'sn4'],
    5: ['qn7', 'qn8', 'sn1', 'sn2', 'sn3'],
    6: ['qn3', 'qn4', 'qn7', 'qn8', 'sn1', 'sn3'],
    7: ['qn3', 'qn4', 'qn5', 'qn6', 'qn7', 'qn8', 'sn1'],
    8: ['qn1', 'qn2', 'qn3', 'qn4', 'qn5', 'qn6', 'qn7', 'qn8'],
    9: ['p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn4', 'qn5', 'qn6', 'qn7'],
    10: ['p_n_7', 'p_n_8', 'p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn5', 'qn6', 'qn7'],
    11: ['p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_15', 'p_n_16', 'qn1', 'qn2', 'qn3', 'qn5', 'qn7'],
    12: ['p_n_3', 'p_n_4', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_15', 'p_n_16', 'qn1', 'qn3', 'qn5', 'qn7'],
    13: ['p_n_3', 'p_n_4', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1', 'qn3', 'qn5'],
    14: ['p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1', 'qn5'],
    15: ['p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_9', 'p_n_10', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16', 'qn1'],
    16: ['p_n_1', 'p_n_2', 'p_n_3', 'p_n_4', 'p_n_5', 'p_n_6', 'p_n_7', 'p_n_8', 'p_n_9', 'p_n_10', 'p_n_11', 'p_n_12', 'p_n_13', 'p_n_14', 'p_n_15', 'p_n_16']
};

/**
 * Get the logical slot ID (e.g., 'fn1', 'qn2') from a complex SVG element ID.
 * Supports legacy IDs like 'text5989' or 'p_nama_1'.
 * @param {string} svgId - The ID of the SVG element.
 * @returns {string|null} - Logical slot ID.
 */
export function getLogicalIdFromSVGId(svgId) {
    if (!svgId) return null;
    // Special legacy cases
    if (svgId === 'text5989') return 'fn1';
    if (svgId === 'p_nama_1') return 'p_n_1';

    // Standard patterns
    if (svgId.startsWith('p_n_')) return svgId;
    if (svgId.match(/^[qs]n\d+$/)) return svgId;
    if (svgId.startsWith('fn')) return svgId;

    // New underscore patterns (e.g., q_n_1 -> qn1)
    const match = svgId.match(/^([qsf])_n_(\d+)$/);
    if (match) return `${match[1]}n${match[2]}`;

    if (svgId === 'winner_nama') return 'winner_nama';
    return null;
}

/**
 * Get the next slot ID for a winner
 * @param {string} currentSlotId - Current logical slot ID (e.g., 'p_n_1', 'qn1', 'sn1')
 * @returns {string|null} - Target slot ID or null if final
 */
export function getNextSlot(currentSlotId) {
    if (!currentSlotId) return null;

    let numMatches = currentSlotId.match(/\d+/);
    let num = numMatches ? parseInt(numMatches[0]) : 0;

    if (currentSlotId.startsWith('p_n_')) {
        return `qn${Math.ceil(num / 2)}`;
    } else if (currentSlotId.startsWith('qn')) {
        return `sn${Math.ceil(num / 2)}`;
    } else if (currentSlotId.startsWith('sn')) {
        return `fn${Math.ceil(num / 2)}`;
    } else if (currentSlotId.startsWith('fn')) {
        return `winner_nama`;
    }
    return null;
}

/**
 * Get the corresponding team (kontingen) slot ID for a name slot
 * @param {string} nameSlotId - Name slot ID
 * @returns {string|null} - Team slot ID
 */
export function getTeamSlot(nameSlotId) {
    if (!nameSlotId) return null;

    let numMatches = nameSlotId.match(/\d+/);
    let num = numMatches ? parseInt(numMatches[0]) : 0;

    if (nameSlotId.startsWith('p_n_') || nameSlotId === 'p_nama_1') return `p_k_${num || 1}`;
    if (nameSlotId.startsWith('qn')) return `q_k_${num}`;
    if (nameSlotId.startsWith('sn')) return `s_k_${num}`;
    if (nameSlotId.startsWith('fn')) return `f_k_${num}`;

    // Champion/Winner Slot
    if (nameSlotId === 'winner_nama') return `winner_kontingen`;

    // Podium 1
    if (nameSlotId === 'nama_juara_1') return `kontingen_juara_1`;

    return null;
}

/**
 * Match structures for different phases
 */
export const ROUND_MATCH_IDS = {
    quarter: [
        { aka: 'qn1', ao: 'qn2' },
        { aka: 'qn3', ao: 'qn4' },
        { aka: 'qn5', ao: 'qn6' },
        { aka: 'qn7', ao: 'qn8' }
    ],
    semi: [
        { aka: 'sn1', ao: 'sn2' },
        { aka: 'sn3', ao: 'sn4' }
    ],
    final: [
        { aka: 'fn1', ao: 'fn2' }
    ]
};
