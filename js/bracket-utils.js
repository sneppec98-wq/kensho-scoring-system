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
 * Calculate the next slot ID for a winner
 * @param {string} currentSlotId - Current slot ID (e.g., 'p_n_1', 'qn1', 'sn1')
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
